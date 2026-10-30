-- Extend lead snapshots to Tours. Blois classification/import stays unchanged.
alter table public.lead_control_events drop constraint lead_control_events_calendar_id_check;
alter table public.lead_control_events drop constraint lead_control_events_agent_code_check;
alter table public.lead_control_events add constraint lead_control_events_calendar_id_check
  check(calendar_id in ('blois@vroommarket.fr','tours@vroommarket.fr'));
alter table public.lead_control_events add constraint lead_control_events_agent_code_check check(
  (calendar_id='blois@vroommarket.fr' and agent_code in ('ML','LJ','AR','EF','CP')) or
  (calendar_id='tours@vroommarket.fr' and agent_code in ('MLG','FB','CP')));
alter table private.lead_control_manual_corrections drop constraint lead_control_manual_corrections_calendar_id_check;
alter table private.lead_control_manual_corrections drop constraint lead_control_manual_corrections_agent_code_check;
alter table private.lead_control_manual_corrections add constraint lead_control_manual_corrections_calendar_id_check
  check(calendar_id in ('blois@vroommarket.fr','tours@vroommarket.fr'));
alter table private.lead_control_manual_corrections add constraint lead_control_manual_corrections_agent_code_check check(
  (calendar_id='blois@vroommarket.fr' and agent_code in ('ML','LJ','AR','EF','CP')) or
  (calendar_id='tours@vroommarket.fr' and agent_code in ('MLG','FB','CP')));

create function private.classify_tours_lead(e jsonb, cutoff timestamptz) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  title text:=coalesce(e->>'summary','');
  t text:=translate(upper(title),'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ','AAAEEEEIIOOUUUC');
  starts timestamptz:=(e->>'start')::timestamptz;
  ends timestamptz:=coalesce(nullif(e->>'end','')::timestamptz,starts);
  prefix text;
  identity_text text;
  codes text[];
  code text;
  negative boolean;
  positive boolean;
  absent boolean;
  cancelled boolean;
  external_evidence boolean;
  outcome text;
  errors text[]:='{}';
  negative_pattern text:='\m(NON[[:space:]-]*M([[:space:]-]+OK)?|M[[:space:]-]*NON([[:space:]-]+OK)?|NON[[:space:]-]+SIGNEE?)\M';
begin
  if starts is null or extract(isodow from starts at time zone 'Europe/Paris')=7 then return null; end if;
  prefix:=case when t ~ '\mMANDAT\M' then split_part(t,'MANDAT',1) else split_part(t,' - ',1) end;
  -- Activities of staff/stock are not paid client leads, regardless of their labels.
  if prefix ~ '\m(ABSENT(E)?|ABS|CONGES?|COIFFEUR|COIFF|LIVRAISON|LIV|VISITE|CT|CONTROLE[[:space:]-]+TECHNIQUE|PHOTOS?|DEPOT|RETRAIT|FERME|FERMETURE|NETTOYAGE|LAVAGE|REUNION|COMPTABLE|FORMATION|MEDECIN)\M'
    or t ~ '^(RETOUR[[:space:]]+(MAEL|FLO|CHARLES)|PAS[[:space:]]+DE[[:space:]]+RDV|[12][[:space:]]+RDV/H)' then return null; end if;
  negative:=prefix ~ negative_pattern;
  positive:=regexp_replace(prefix,negative_pattern,'','g') ~ '\m(OK[[:space:]-]*M|M[[:space:]-]*OK|SIGNEE?)\M';
  absent:=prefix ~ '\m(NO[[:space:]-]*SHOW|NON[[:space:]-]*SHOW|PAS[[:space:]-]*VENUE?)\M';
  cancelled:=prefix ~ '\m(ANNULE(E)?|VENDU(E)?)\M' or e->>'status'='cancelled';
  external_evidence:=t ~ '\mRDV[[:space:]-]+MANDAT\M' or
    (t ~ '(\+?33[ .-]?[1-9]|0[1-9])([ .-]?[0-9]{2}){4}' and t ~ '(\m(19|20)[0-9]{2}\M|\mKM\M)' and t like '% - %');
  if t !~ '\mMANDAT\M' and not (negative or positive or absent or cancelled or external_evidence)
    and not (prefix ~ '\mRDV\M' and t ~ '(\+?33[ .-]?[1-9]|0[1-9])([ .-]?[0-9]{2}){4}') then return null; end if;
  identity_text:=prefix;
  if not external_evidence then
    identity_text:=identity_text||' '||coalesce(substring(t from '/[[:space:]]*(MLG|MAEL|CP|FB)[[:space:]]*$'),'');
  end if;
  select array_agg(distinct case m[1] when 'MAEL' then 'MLG' else m[1] end) into codes
  from regexp_matches(identity_text,'\m(MLG|MAEL|CP|FB)\M','g') m;
  if cardinality(codes)=1 then code:=codes[1]; end if;
  if ends>cutoff then outcome:='scheduled';
  else
    if (positive and negative) or (cancelled and absent) or ((cancelled or absent) and (positive or negative)) then
      outcome:='review'; errors:=array_append(errors,'Résultats contradictoires dans le titre');
    elsif external_evidence and cancelled then outcome:='cancelled';
    elsif external_evidence and absent then outcome:='no_show';
    elsif external_evidence and positive then outcome:='signed';
    elsif external_evidence and negative then outcome:='unsigned';
    else outcome:='review'; end if;
    if outcome in ('signed','unsigned','review') then
      if cardinality(codes)>1 then errors:=array_append(errors,'Plusieurs agents indiqués : attribution ambiguë');
      elsif code is null then errors:=array_append(errors,'Initiales absentes ou non reconnues (CP, MLG/MAEL, FB)'); end if;
    end if;
    if outcome='review' then
      if not external_evidence then errors:=array_append(errors,'Origine du mandat à vérifier : interne ou lead facturé'); end if;
      if not positive and not negative then errors:=array_append(errors,'Résultat non renseigné : signé, non signé, annulé ou no show'); end if;
    end if;
  end if;
  return jsonb_build_object('event_id',e->>'id','start_at',starts,'end_at',ends,
    'title',btrim(regexp_replace(title,'(\+?33[ .-]?[1-9]|0[1-9])([ .-]?[0-9]{2}){4}','[téléphone masqué]','g')),
    'color_id',e->>'color_id','agent_code',code,'outcome',outcome,'errors',to_jsonb(errors),
    'event_url',case when e->>'url' like 'https://www.google.com/calendar/event?%' then e->>'url' else null end);
end;
$$;
revoke all on function private.classify_tours_lead(jsonb,timestamptz) from public,anon,authenticated;
create function private.import_tours_leads(events jsonb, month_start date, cutoff timestamptz) returns jsonb
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
  select id into strict agency from public.agencies where lower(name)='tours';
  perform pg_advisory_xact_lock(hashtext('tours-leads-'||month_start::text));
  if exists(select 1 from public.lead_control_syncs s where s.agency_id=agency and s.month_start=import_tours_leads.month_start and s.checked_at>cutoff) then
    raise exception 'Newer snapshot already imported'; end if;
  delete from public.lead_control_events where agency_id=agency and start_at>=lower_bound and start_at<upper_bound;
  insert into public.lead_control_events(calendar_id,agency_id,event_id,start_at,end_at,title,color_id,agent_code,outcome,errors,event_url)
  select 'tours@vroommarket.fr',agency,d->>'event_id',(d->>'start_at')::timestamptz,(d->>'end_at')::timestamptz,
    d->>'title',d->>'color_id',d->>'agent_code',d->>'outcome',
    array(select jsonb_array_elements_text(d->'errors')),d->>'event_url'
  from jsonb_array_elements(events) e
  cross join lateral (select private.classify_tours_lead(e,cutoff) d) classified
  where d is not null;
  get diagnostics leads=row_count;
  insert into public.lead_control_syncs(agency_id,month_start,checked_at,source_event_count,lead_event_count)
  values(agency,month_start,cutoff,jsonb_array_length(events),leads)
  on conflict on constraint lead_control_syncs_pkey do update set checked_at=excluded.checked_at,
    source_event_count=excluded.source_event_count,lead_event_count=excluded.lead_event_count;
  return jsonb_build_object('month',month_start,'source_events',jsonb_array_length(events),'leads',leads,'checked_at',cutoff);
end;
$$;
revoke all on function private.import_tours_leads(jsonb,date,timestamptz) from public,anon,authenticated;
create function private.save_agency_lead_control_correction(
  p_calendar_id text, p_event_id text, p_agent_code text, p_outcome text,
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
  if p_calendar_id is null or p_calendar_id not in ('blois@vroommarket.fr','tours@vroommarket.fr') then
    raise exception 'Agence invalide.' using errcode='22023';
  end if;
  if p_outcome is null or p_outcome not in ('signed','unsigned','no_show','cancelled','review')
    or (p_agent_code is not null and (
      (p_calendar_id='blois@vroommarket.fr' and p_agent_code not in ('ML','LJ','AR','EF','CP')) or
      (p_calendar_id='tours@vroommarket.fr' and p_agent_code not in ('MLG','FB','CP')))) then
    raise exception 'Agent ou statut invalide.' using errcode='22023';
  end if;
  if p_outcome in ('signed','unsigned') and p_agent_code is null then
    raise exception 'Choisis un agent pour un lead signé ou non signé.' using errcode='22023';
  end if;
  select * into lead from public.lead_control_events l
    where l.calendar_id=p_calendar_id and l.event_id=p_event_id;
  if not found then raise exception 'Ce lead est introuvable. Actualise la liste.' using errcode='P0002'; end if;
  -- Same transaction lock as the monthly import; re-read after waiting.
  perform pg_advisory_xact_lock(hashtext((case p_calendar_id when 'blois@vroommarket.fr' then 'blois' else 'tours' end)||'-leads-'||date_trunc('month',lead.start_at at time zone 'Europe/Paris')::date::text));
  select * into lead from public.lead_control_events l
    where l.calendar_id=p_calendar_id and l.event_id=p_event_id for update;
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
revoke all on function private.save_agency_lead_control_correction(text,text,text,text,timestamptz) from public,anon;
grant execute on function private.save_agency_lead_control_correction(text,text,text,text,timestamptz) to authenticated;

create function public.save_agency_lead_control_correction(
  p_calendar_id text, p_event_id text, p_agent_code text, p_outcome text,
  p_expected_corrected_at timestamptz default null
) returns jsonb language sql security invoker set search_path='' as $$
  select private.save_agency_lead_control_correction(p_calendar_id,p_event_id,p_agent_code,p_outcome,p_expected_corrected_at);
$$;
revoke all on function public.save_agency_lead_control_correction(text,text,text,text,timestamptz) from public,anon;
grant execute on function public.save_agency_lead_control_correction(text,text,text,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
