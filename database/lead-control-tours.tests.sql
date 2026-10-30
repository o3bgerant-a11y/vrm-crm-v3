-- Run as administrator; all fixtures and corrections are rolled back.
begin;
do $tests$
declare test record; actual jsonb;
begin
  for test in select * from (values
    ('MAEL M OK - CLIENT - 0600000000 - RENAULT - CLIO - 2020 - 100000 KM','signed','MLG'),
    ('MLG OK M - RDV MANDAT CLIENT','signed','MLG'),
    ('M OK MLG - CLIENT - 0600000000 - RENAULT - CLIO - 2020 - 100000 KM','signed','MLG'),
    ('FB M NON OK - CLIENT - 0600000000 - RENAULT - CLIO - 2020 - 100000 KM','unsigned','FB'),
    ('CP NON M OK CONF - RDV MANDAT CLIENT','unsigned','CP'),
    ('FB NON M - RDV MANDAT CLIENT','unsigned','FB'),
    ('MAEL MLG OK M - RDV MANDAT CLIENT','signed','MLG'),
    ('NO -SHOW - CLIENT - 0600000000 - RENAULT - CLIO - 2020 - 100000 KM','no_show',null),
    ('VENDU - RDV MANDAT CLIENT','cancelled',null),
    ('ANNULÉ - RDV MANDAT CLIENT','cancelled',null),
    ('MLG MANDAT CAPTUR','review','MLG'),
    ('Mandat Captur / MLG','review','MLG'),
    ('RDV MANDAT - CLIENT MAEL','review',null),
    ('CP FB OK M - RDV MANDAT CLIENT','signed',null),
    ('FB OK M NON M - RDV MANDAT CLIENT','review','FB'),
    ('NON CONF - RDV MANDAT CLIENT','review',null),
    ('MAEL ABSENT',null,null),
    ('FB LIVRAISON CLIO',null,null),
    ('VISITE BMW / MLG',null,null),
    ('CT CLIO',null,null),
    ('PHOTOS CLIO FB',null,null),
    ('PAS DE RDV',null,null),
    ('ANNULE REUNION MAEL',null,null)
  ) as cases(title,outcome,agent) loop
    actual:=private.classify_tours_lead(jsonb_build_object('id','test','summary',test.title,'start','2026-09-01T10:00:00+02:00','end','2026-09-01T11:00:00+02:00'),'2026-10-30T10:00:00Z');
    if actual->>'outcome' is distinct from test.outcome or actual->>'agent_code' is distinct from test.agent then raise exception 'Classification failed: % => %',test.title,actual; end if;
  end loop;
  actual:=private.classify_tours_lead('{"id":"test","summary":"MLG OK M RDV MANDAT CLIENT","start":"2026-09-06T10:00:00+02:00","end":"2026-09-06T11:00:00+02:00"}','2026-10-30T10:00:00Z');
  if actual is not null then raise exception 'Sunday counted'; end if;
end $tests$;

insert into public.lead_control_events(calendar_id,event_id,agency_id,start_at,end_at,title,color_id,outcome,errors)
select case lower(name) when 'blois' then 'blois@vroommarket.fr' else 'tours@vroommarket.fr' end,
 'shared-id-rollback-test',id,'2026-09-01T09:00:00+02:00','2026-09-01T10:00:00+02:00','RDV MANDAT TEST','10','review',array['Test']
from public.agencies where lower(name) in ('blois','tours');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select p.user_id from public.profiles p join private.lead_control_readers r on r.user_id=p.user_id where p.status='active' and p.role='patron' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $tests$
declare saved jsonb;
begin
  saved:=public.save_agency_lead_control_correction('tours@vroommarket.fr','shared-id-rollback-test','MLG','signed',null);
  if saved->>'calendar_id'<>'tours@vroommarket.fr' or saved->>'outcome'<>'signed' then raise exception 'Tours correction failed'; end if;
  if exists(select 1 from public.lead_control_events where calendar_id='blois@vroommarket.fr' and event_id='shared-id-rollback-test' and outcome<>'review') then raise exception 'Tours correction modified Blois'; end if;
  begin
    perform public.save_agency_lead_control_correction('tours@vroommarket.fr','shared-id-rollback-test','ML','signed',(saved->>'corrected_at')::timestamptz);
    raise exception 'Wrong agency agent accepted';
  exception when invalid_parameter_value then null; end;
  perform public.save_lead_control_correction('shared-id-rollback-test','CP','unsigned',null);
end $tests$;
reset role;
do $tests$
declare source jsonb; before_hash text; after_hash text; n integer;
begin
  select md5(string_agg(to_jsonb(l)::text,',' order by l.event_id)) into before_hash from public.lead_control_events l where calendar_id='blois@vroommarket.fr';
  select jsonb_agg(jsonb_build_object('id',event_id,'summary',title,'color_id',color_id,'start',start_at,'end',end_at,'url',event_url)) into source
  from public.lead_control_events where calendar_id='tours@vroommarket.fr' and start_at>='2026-09-01T00:00:00+02:00' and start_at<'2026-10-01T00:00:00+02:00';
  perform private.import_tours_leads(source,'2026-09-01',now());
  perform private.import_tours_leads(source,'2026-09-01',now());
  select count(*) into n from public.lead_control_events where calendar_id='tours@vroommarket.fr' and event_id='shared-id-rollback-test' and agent_code='MLG' and outcome='signed' and corrected_at is not null;
  if n<>1 then raise exception 'Persistent correction / deduplication failed'; end if;
  select md5(string_agg(to_jsonb(l)::text,',' order by l.event_id)) into after_hash from public.lead_control_events l where calendar_id='blois@vroommarket.fr';
  if before_hash<>after_hash then raise exception 'Tours import modified Blois'; end if;
end $tests$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.profiles where role='agent' and status='active' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $tests$
begin
  if exists(select 1 from public.lead_control_events) then raise exception 'Agent reads leads'; end if;
  begin
    perform public.save_agency_lead_control_correction('tours@vroommarket.fr','shared-id-rollback-test','FB','signed',null);
    raise exception 'Agent write accepted';
  exception when insufficient_privilege then null; end;
end $tests$;
reset role;
rollback;
