-- Lead control: read-only to explicitly authorized managers; imports use SQL tooling.
create schema if not exists private;
create table private.lead_control_readers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.lead_control_readers enable row level security;
revoke all on private.lead_control_readers from public, anon, authenticated;
insert into private.lead_control_readers(user_id)
select user_id from public.profiles
where status='active' and (is_admin is true or role in ('patron','responsable')) and user_id is not null
on conflict do nothing;

create function private.can_read_lead_control() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.lead_control_readers r
    join public.profiles p on p.user_id=r.user_id
    where r.user_id=(select auth.uid()) and p.status='active'
      and (p.is_admin is true or p.role in ('patron','responsable'))
  );
$$;
revoke all on function private.can_read_lead_control() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.can_read_lead_control() to authenticated;

create table public.lead_control_events (
  calendar_id text not null default 'blois@vroommarket.fr' check(calendar_id='blois@vroommarket.fr'),
  event_id text not null,
  agency_id bigint not null references public.agencies(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  title text not null,
  color_id text,
  agent_code text check(agent_code in ('ML','LJ','AR','EF','CP')),
  outcome text not null check(outcome in ('signed','unsigned','no_show','cancelled','review','scheduled')),
  errors text[] not null default '{}',
  event_url text,
  synced_at timestamptz not null default now(),
  primary key(calendar_id,event_id)
);
create index lead_control_events_agency_start on public.lead_control_events(agency_id,start_at);
create table public.lead_control_syncs (
  agency_id bigint not null references public.agencies(id),
  month_start date not null,
  checked_at timestamptz not null,
  source_event_count integer not null,
  lead_event_count integer not null,
  primary key(agency_id,month_start)
);
alter table public.lead_control_events enable row level security;
alter table public.lead_control_syncs enable row level security;
revoke all on public.lead_control_events,public.lead_control_syncs from anon,authenticated;
grant select on public.lead_control_events,public.lead_control_syncs to authenticated;
create policy lead_control_managers_read on public.lead_control_events for select to authenticated
using ((select private.can_read_lead_control()));
create policy lead_control_sync_managers_read on public.lead_control_syncs for select to authenticated
using ((select private.can_read_lead_control()));

create table private.lead_control_confirmations (
  event_id text primary key,
  event_date date not null,
  outcome text not null check(outcome in ('signed','unsigned')),
  agent_code text not null check(agent_code in ('ML','LJ','AR','EF','CP')),
  reason text not null
);
alter table private.lead_control_confirmations enable row level security;
revoke all on private.lead_control_confirmations from public,anon,authenticated;

create function private.classify_blois_lead(e jsonb, cutoff timestamptz) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  title text := coalesce(e->>'summary','');
  t text := translate(upper(title),'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ','AAAEEEEIIOOUUUC');
  c text := e->>'color_id';
  starts timestamptz := (e->>'start')::timestamptz;
  ends timestamptz := coalesce(nullif(e->>'end','')::timestamptz,starts);
  prefix text;
  codes text[];
  code text;
  unsigned_result boolean;
  signed_result boolean;
  absent_result boolean;
  cancelled_result boolean;
  sold boolean;
  confirmation record;
  outcome text;
  errors text[] := '{}';
begin
  if starts is null or extract(isodow from starts at time zone 'Europe/Paris')=7 then return null; end if;
  if c in ('1','7','9') then return null; end if;
  -- Only mandate appointments. Staff absences, visits, deliveries and slot rules are not leads.
  if t !~ '\mMANDAT\M' then return null; end if;
  prefix := split_part(t,'MANDAT',1);
  select array_agg(distinct m[1]) into codes
    from regexp_matches(prefix,'\m(ML|LJ|AR|EF|CP)\M','g') m;
  if cardinality(codes)=1 then code:=codes[1]; end if;
  unsigned_result := t ~ '\mNON[[:space:]-]*(M\M|SIGNEE?\M)';
  signed_result := regexp_replace(t,'\mNON[[:space:]-]*(M\M|SIGNEE?\M)','','g') ~ '\m(OK[[:space:]-]*M|SIGNEE?)\M';
  absent_result := t ~ '\m(NO[[:space:]-]*SHOW|NON[[:space:]-]*SHOW|PAS[[:space:]-]*VENUE?)\M';
  cancelled_result := t ~ '\mANNULE';
  sold := t ~ '\mVENDUE?\M';
  select cf.outcome,cf.agent_code into confirmation from private.lead_control_confirmations cf
    where cf.event_id=e->>'id' and cf.event_date=(starts at time zone 'Europe/Paris')::date;
  if found and c='10' then
    code:=confirmation.agent_code;
    signed_result:=confirmation.outcome='signed';
    unsigned_result:=confirmation.outcome='unsigned';
  end if;
  if ends > cutoff then
    outcome:='scheduled';
  else
    if c='11' or sold or e->>'status'='cancelled' then outcome:='cancelled';
    elsif c='5' then outcome:='no_show';
    elsif c='10' and not absent_result and not cancelled_result and signed_result and not unsigned_result then outcome:='signed';
    elsif c='10' and not absent_result and not cancelled_result and unsigned_result and not signed_result then outcome:='unsigned';
    else outcome:='review'; end if;
    if (c='10' and not sold) or outcome='review' then
      if cardinality(codes)>1 then errors:=array_append(errors,'Plusieurs agents indiqués : attribution ambiguë');
      elsif code is null then errors:=array_append(errors,'Initiales absentes ou non reconnues'); end if;
    end if;
    if outcome='review' then errors:=array_append(errors,'Résultat ou couleur à clarifier : aucun classement facturable automatique'); end if;
    if c='5' and not absent_result then errors:=array_append(errors,'Jaune sans mention pas venu / no show'); end if;
    if (c='5' and (signed_result or unsigned_result or cancelled_result))
      or (c='11' and (signed_result or unsigned_result or absent_result))
      or (c='10' and (absent_result or cancelled_result)) then
      errors:=array_append(errors,'Incohérence entre la couleur et le résultat');
    end if;
    if signed_result and unsigned_result then errors:=array_append(errors,'Résultats signé et non signé contradictoires'); end if;
  end if;
  return jsonb_build_object('event_id',e->>'id','start_at',starts,'end_at',ends,
    'title',btrim(regexp_replace(title,'(\+33[ .-]?[1-9]|0[1-9])([ .-]?[0-9]{2}){4}','[téléphone masqué]','g')),
    'color_id',c,'agent_code',code,'outcome',outcome,'errors',to_jsonb(errors),
    'event_url',case when e->>'url' like 'https://www.google.com/calendar/event?%' then e->>'url' else null end);
end;
$$;
revoke all on function private.classify_blois_lead(jsonb,timestamptz) from public,anon,authenticated;

-- Call once per fully paginated month, including ALL source events in that month.
-- Atomic replacement removes stale/cancelled/moved events and prevents duplicate counts.
create function private.import_blois_leads(events jsonb, month_start date, cutoff timestamptz) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  agency bigint;
  lower_bound timestamptz;
  upper_bound timestamptz;
  leads integer;
begin
  if month_start < date '2026-09-01' or month_start <> date_trunc('month',month_start)::date
    or cutoff > now()+interval '5 minutes' or cutoff < month_start::timestamp at time zone 'Europe/Paris'
    or jsonb_typeof(events)<>'array' then raise exception 'Invalid import window'; end if;
  lower_bound:=month_start::timestamp at time zone 'Europe/Paris';
  upper_bound:=(month_start+interval '1 month')::timestamp at time zone 'Europe/Paris';
  if exists(select 1 from jsonb_array_elements(events) e where
    nullif(e->>'id','') is null or nullif(e->>'start','') is null or
    (e->>'start')::timestamptz < lower_bound or (e->>'start')::timestamptz >= upper_bound) then
    raise exception 'Event outside import month or missing ID/date'; end if;
  if (select count(*) from jsonb_array_elements(events)) <>
     (select count(distinct e->>'id') from jsonb_array_elements(events) e) then raise exception 'Duplicate source event IDs'; end if;
  select id into strict agency from public.agencies where lower(name)='blois';
  perform pg_advisory_xact_lock(hashtext('blois-leads-'||month_start::text));
  if exists(select 1 from public.lead_control_syncs s where s.agency_id=agency and s.month_start=import_blois_leads.month_start and s.checked_at>cutoff) then
    raise exception 'Newer snapshot already imported'; end if;
  delete from public.lead_control_events where agency_id=agency and start_at>=lower_bound and start_at<upper_bound;
  insert into public.lead_control_events(agency_id,event_id,start_at,end_at,title,color_id,agent_code,outcome,errors,event_url)
  select agency,d->>'event_id',(d->>'start_at')::timestamptz,(d->>'end_at')::timestamptz,
    d->>'title',d->>'color_id',d->>'agent_code',d->>'outcome',
    array(select jsonb_array_elements_text(d->'errors')),d->>'event_url'
  from jsonb_array_elements(events) e
  cross join lateral (select private.classify_blois_lead(e,cutoff) d) classified
  where d is not null;
  get diagnostics leads=row_count;
  insert into public.lead_control_syncs(agency_id,month_start,checked_at,source_event_count,lead_event_count)
  values(agency,month_start,cutoff,jsonb_array_length(events),leads)
  on conflict on constraint lead_control_syncs_pkey do update set checked_at=excluded.checked_at,
    source_event_count=excluded.source_event_count,lead_event_count=excluded.lead_event_count;
  return jsonb_build_object('month',month_start,'source_events',jsonb_array_length(events),'leads',leads,'checked_at',cutoff);
end;
$$;
revoke all on function private.import_blois_leads(jsonb,date,timestamptz) from public,anon,authenticated;
