-- Administrative SQL regression checks. All fixtures and edits are rolled back.
begin;
insert into public.lead_control_events(event_id,agency_id,start_at,end_at,title,color_id,outcome,errors)
select 'manual-correction-rollback-test',id,'2026-09-01T09:00:00+02:00','2026-09-01T10:00:00+02:00',
  'RDV MANDAT TEST','10','review',array['Initiales manquantes'] from public.agencies where lower(name)='blois';
select set_config('request.jwt.claims',jsonb_build_object('sub',(select p.user_id from public.profiles p join private.lead_control_readers r on r.user_id=p.user_id where p.status='active' and p.role='patron' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $test$
declare saved jsonb;
begin
  saved:=public.save_lead_control_correction('manual-correction-rollback-test','ML','signed',null);
  if saved->>'outcome'<>'signed' or saved->>'agent_code'<>'ML' or saved->>'corrected_at' is null or jsonb_array_length(saved->'errors')<>0 then raise exception 'Save failed'; end if;
  begin
    perform public.save_lead_control_correction('manual-correction-rollback-test','CP','unsigned',null);
    raise exception 'Stale concurrent update was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_lead_control_correction('manual-correction-rollback-test',null,'signed',(saved->>'corrected_at')::timestamptz);
    raise exception 'Billable lead without agent was accepted';
  exception when invalid_parameter_value then null; end;
  saved:=public.save_lead_control_correction('manual-correction-rollback-test',null,'cancelled',(saved->>'corrected_at')::timestamptz);
  if saved->>'outcome'<>'cancelled' or jsonb_array_length(saved->'errors')<>0 then raise exception 'Cancellation failed'; end if;
  saved:=public.save_lead_control_correction('manual-correction-rollback-test','CP','no_show',(saved->>'corrected_at')::timestamptz);
  if saved->>'outcome'<>'no_show' or saved->>'agent_code'<>'CP' then raise exception 'No-show failed'; end if;
  saved:=public.save_lead_control_correction('manual-correction-rollback-test','ML','review',(saved->>'corrected_at')::timestamptz);
  if saved->>'outcome'<>'review' or jsonb_array_length(saved->'errors')<>1 then raise exception 'Assignment-only failed'; end if;
  perform public.save_lead_control_correction('manual-correction-rollback-test','ML','signed',(saved->>'corrected_at')::timestamptz);
end $test$;
reset role;
-- The real import deletes/reinserts the snapshot. The trigger must reapply decisions.
do $test$
declare source jsonb; n integer;
begin
  select jsonb_agg(jsonb_build_object('id',event_id,'summary',title,'color_id',color_id,'start',start_at,'end',end_at,'url',event_url)) into source
  from public.lead_control_events where calendar_id='blois@vroommarket.fr' and start_at>='2026-09-01T00:00:00+02:00' and start_at<'2026-10-01T00:00:00+02:00';
  perform private.import_blois_leads(source,'2026-09-01',now());
  select count(*) into n from public.lead_control_events where event_id='manual-correction-rollback-test' and outcome='signed' and agent_code='ML' and corrected_at is not null and cardinality(errors)=0;
  if n<>1 then raise exception 'Manual decision was lost during import'; end if;
  select count(*) into n from private.lead_control_correction_history where event_id='manual-correction-rollback-test';
  if n<>5 then raise exception 'Audit history failed: %',n; end if;
end $test$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.profiles where role='agent' and status='active' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $test$
begin
  if exists(select 1 from public.lead_control_events) then raise exception 'Agent can read leads'; end if;
  begin
    perform public.save_lead_control_correction('manual-correction-rollback-test','CP','signed',null);
    raise exception 'Agent write was accepted';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
set local request.jwt.claims='{}';
do $test$
begin
  begin
    perform public.save_lead_control_correction('manual-correction-rollback-test','CP','signed',null);
    raise exception 'Unauthenticated write was accepted';
  exception when insufficient_privilege then null; end;
end $test$;
rollback;
