-- Run with the administrative SQL tool. No changes are committed.
begin;
do $tests$
declare
  test record;
  actual jsonb;
  events jsonb;
  n integer;
begin
  for test in select * from (values
    ('signed','ML OK M RDV MANDAT TEST','10','2026-10-24T09:00:00+02:00','signed','ML'),
    ('unsigned','OK NON M CP RDV MANDAT TEST','10','2026-10-24T09:00:00+02:00','unsigned','CP'),
    ('missing initials','OK M RDV MANDAT MR ML CLIENT','10','2026-10-24T09:00:00+02:00','signed',null),
    ('no show','NO SHOW RDV MANDAT TEST','5','2026-10-24T09:00:00+02:00','no_show',null),
    ('cancelled','ANNULÉ RDV MANDAT TEST','11','2026-10-24T09:00:00+02:00','cancelled',null),
    ('sold orange','VENDU RDV MANDAT TEST','6','2026-10-24T09:00:00+02:00','cancelled',null),
    ('sold feminine','VENDUE RDV MANDAT TEST','6','2026-10-24T09:00:00+02:00','cancelled',null),
    ('internal blue','ML OK M RDV MANDAT TEST','1','2026-10-24T09:00:00+02:00',null,null),
    ('Sunday','ML OK M RDV MANDAT TEST','10','2026-10-25T09:00:00+01:00',null,null),
    ('staff absence','ML ABSENT COIFFEUR','11','2026-10-24T09:00:00+02:00',null,null),
    ('unknown result','ML RDV MANDAT TEST','10','2026-10-24T09:00:00+02:00','review','ML'),
    ('synonym','NON SIGNÉ ML RDV MANDAT TEST','10','2026-10-24T09:00:00+02:00','unsigned','ML'),
    ('contradiction','ML OK M NON M RDV MANDAT TEST','10','2026-10-24T09:00:00+02:00','review','ML'),
    ('future','ML RDV MANDAT TEST','10','2026-10-30T09:00:00+01:00','scheduled','ML'),
    ('multiple agents','ML LJ OK M RDV MANDAT TEST','10','2026-10-24T09:00:00+02:00','signed',null),
    ('result first','OK-M-LJ CONF RDV MANDAT TEST','10','2026-10-24T09:00:00+02:00','signed','LJ')
  ) as cases(name,title,color,starts,outcome,agent)
  loop
    actual:=private.classify_blois_lead(jsonb_build_object('id',test.name,'summary',test.title,'color_id',test.color,'start',test.starts,'end',test.starts),'2026-10-29T10:59:00Z');
    if (actual->>'outcome' is distinct from test.outcome) or (actual->>'agent_code' is distinct from test.agent) then
      raise exception 'Classification failed: % => %',test.name,actual;
    end if;
  end loop;
  insert into private.lead_control_confirmations(event_id,event_date,outcome,agent_code,reason)
  values('test-user-confirmation','2026-09-04','signed','ML','Isolated test');
  actual:=private.classify_blois_lead('{"id":"test-user-confirmation","summary":"OK ML RDV MANDAT TEST","color_id":"10","start":"2026-09-04T14:00:00+02:00","end":"2026-09-04T15:00:00+02:00"}','2026-10-29T10:59:00Z');
  if actual->>'outcome'<>'signed' or actual->>'agent_code'<>'ML' or jsonb_array_length(actual->'errors')<>0 then raise exception 'Explicit user confirmation lost'; end if;
  events:='[{"id":"lead-control-transaction-test","summary":"ML OK M RDV MANDAT TEST","color_id":"10","start":"2026-10-01T09:00:00+02:00","end":"2026-10-01T10:00:00+02:00"}]';
  perform private.import_blois_leads(events,'2026-10-01',now());
  perform private.import_blois_leads(events,'2026-10-01',now());
  select count(*) into n from public.lead_control_events where calendar_id='blois@vroommarket.fr' and start_at>='2026-10-01T00:00:00+02:00' and start_at<'2026-11-01T00:00:00+01:00';
  if n<>1 then raise exception 'Idempotency failed'; end if;
  events:=jsonb_set(events,'{0,color_id}','"1"');
  perform private.import_blois_leads(events,'2026-10-01',now());
  select count(*) into n from public.lead_control_events where calendar_id='blois@vroommarket.fr' and start_at>='2026-10-01T00:00:00+02:00' and start_at<'2026-11-01T00:00:00+01:00';
  if n<>0 then raise exception 'Changed-to-blue reconciliation failed'; end if;
  perform private.import_blois_leads('[]','2026-10-01',now());
end $tests$;
rollback;
