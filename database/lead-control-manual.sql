-- Persistent manual decisions. Calendar imports keep using the same procedure.
create table private.lead_control_manual_corrections (
  calendar_id text not null check(calendar_id='blois@vroommarket.fr'),
  event_id text not null,
  agent_code text check(agent_code in ('ML','LJ','AR','EF','CP')),
  outcome text not null check(outcome in ('signed','unsigned','no_show','cancelled','review')),
  corrected_at timestamptz not null,
  corrected_by uuid not null references auth.users(id),
  corrected_by_name text not null,
  primary key(calendar_id,event_id),
  check(outcome not in ('signed','unsigned') or agent_code is not null)
);
create table private.lead_control_correction_history (
  id bigint generated always as identity primary key,
  calendar_id text not null,
  event_id text not null,
  previous_value jsonb not null,
  new_value jsonb not null,
  corrected_at timestamptz not null,
  corrected_by uuid not null references auth.users(id)
);
alter table private.lead_control_manual_corrections enable row level security;
alter table private.lead_control_correction_history enable row level security;
revoke all on private.lead_control_manual_corrections,private.lead_control_correction_history from public,anon,authenticated;

alter table public.lead_control_events
  add column corrected_at timestamptz,
  add column corrected_by_name text;

create function private.apply_manual_lead_correction() returns trigger
language plpgsql security invoker set search_path='' as $$
declare correction private.lead_control_manual_corrections%rowtype;
begin
  select * into correction from private.lead_control_manual_corrections c
  where c.calendar_id=new.calendar_id and c.event_id=new.event_id;
  if found then
    new.agent_code:=correction.agent_code;
    new.outcome:=correction.outcome;
    new.errors:=case when correction.outcome='review' then array['Résultat à renseigner après attribution manuelle'] else '{}'::text[] end;
    new.corrected_at:=correction.corrected_at;
    new.corrected_by_name:=correction.corrected_by_name;
  end if;
  return new;
end;
$$;
revoke all on function private.apply_manual_lead_correction() from public,anon,authenticated;
create trigger preserve_manual_lead_correction
before insert or update on public.lead_control_events
for each row execute function private.apply_manual_lead_correction();

-- Privileged work stays private. Both authentication and manager authorization
-- are checked here; callers never choose the actor or write snapshots directly.
create function private.save_lead_control_correction(
  p_event_id text, p_agent_code text, p_outcome text,
  p_expected_corrected_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  actor_name text;
  lead public.lead_control_events%rowtype;
  saved_at timestamptz;
  previous jsonb;
begin
  if actor is null or not private.can_read_lead_control() then
    raise exception 'Accès réservé aux responsables.' using errcode='42501';
  end if;
  if p_outcome is null or p_outcome not in ('signed','unsigned','no_show','cancelled','review')
    or (p_agent_code is not null and p_agent_code not in ('ML','LJ','AR','EF','CP')) then
    raise exception 'Agent ou statut invalide.' using errcode='22023';
  end if;
  if p_outcome in ('signed','unsigned') and p_agent_code is null then
    raise exception 'Choisis un agent pour un lead signé ou non signé.' using errcode='22023';
  end if;
  select * into lead from public.lead_control_events l
    where l.calendar_id='blois@vroommarket.fr' and l.event_id=p_event_id;
  if not found then raise exception 'Ce lead est introuvable. Actualise la liste.' using errcode='P0002'; end if;
  -- Same transaction lock as the monthly import; re-read after waiting.
  perform pg_advisory_xact_lock(hashtext('blois-leads-'||date_trunc('month',lead.start_at at time zone 'Europe/Paris')::date::text));
  select * into lead from public.lead_control_events l
    where l.calendar_id='blois@vroommarket.fr' and l.event_id=p_event_id for update;
  if not found then raise exception 'Ce lead a changé. Actualise la liste.' using errcode='P0002'; end if;
  if lead.corrected_at is distinct from p_expected_corrected_at then
    raise exception 'Ce lead a déjà été corrigé. Actualise avant de le modifier.' using errcode='40001';
  end if;
  select p.full_name into actor_name from public.profiles p where p.user_id=actor and p.status='active' limit 1;
  saved_at:=clock_timestamp();
  previous:=jsonb_build_object('agent_code',lead.agent_code,'outcome',lead.outcome,'errors',lead.errors,'corrected_at',lead.corrected_at);
  insert into private.lead_control_manual_corrections(calendar_id,event_id,agent_code,outcome,corrected_at,corrected_by,corrected_by_name)
  values(lead.calendar_id,lead.event_id,p_agent_code,p_outcome,saved_at,actor,coalesce(actor_name,'Responsable'))
  on conflict(calendar_id,event_id) do update set agent_code=excluded.agent_code,outcome=excluded.outcome,
    corrected_at=excluded.corrected_at,corrected_by=excluded.corrected_by,corrected_by_name=excluded.corrected_by_name;
  update public.lead_control_events l set agent_code=p_agent_code,outcome=p_outcome
    where l.calendar_id=lead.calendar_id and l.event_id=lead.event_id returning * into lead;
  insert into private.lead_control_correction_history(calendar_id,event_id,previous_value,new_value,corrected_at,corrected_by)
  values(lead.calendar_id,lead.event_id,previous,jsonb_build_object('agent_code',lead.agent_code,'outcome',lead.outcome),saved_at,actor);
  return to_jsonb(lead);
end;
$$;
revoke all on function private.save_lead_control_correction(text,text,text,timestamptz) from public,anon;
grant execute on function private.save_lead_control_correction(text,text,text,timestamptz) to authenticated;

create function public.save_lead_control_correction(
  p_event_id text, p_agent_code text, p_outcome text,
  p_expected_corrected_at timestamptz default null
) returns jsonb
language sql security invoker set search_path='' as $$
  select private.save_lead_control_correction(p_event_id,p_agent_code,p_outcome,p_expected_corrected_at);
$$;
revoke all on function public.save_lead_control_correction(text,text,text,timestamptz) from public,anon;
grant execute on function public.save_lead_control_correction(text,text,text,timestamptz) to authenticated;
