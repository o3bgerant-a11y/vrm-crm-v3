-- Read-only manager snapshots. Imports run through authenticated administrative SQL only.
create table public.jv_commission_months (
 agency_id bigint not null references public.agencies(id) check(agency_id=2),
 month_start date not null check(extract(day from month_start)=1),
 source_file_id text not null check(source_file_id='1p0FoXI9JbB-t_MjgGdSuyOkAoNdnH95j'),
 checked_at timestamptz not null,
 source_modified_at timestamptz,
 total_ht numeric(14,2) not null,
 total_vat numeric(14,2) not null,
 total_ttc numeric(14,2) not null,
 rows jsonb not null check(jsonb_typeof(rows)='array'),
 primary key(agency_id,month_start)
);
alter table public.jv_commission_months enable row level security;
revoke all on public.jv_commission_months from anon,authenticated;
grant select on public.jv_commission_months to authenticated;
create policy jv_managers_read on public.jv_commission_months for select to authenticated
 using ((select private.can_read_lead_control()));
create function private.import_tours_jv(months jsonb, cutoff timestamptz) returns integer
language plpgsql security invoker set search_path='' as $$
declare m jsonb; r jsonb; n integer:=0; total numeric; keydate date;
begin
 if jsonb_typeof(months)<>'array' or jsonb_array_length(months)=0 or cutoff is null then raise exception 'Invalid complete workbook'; end if;
 if (select count(*)<>count(distinct x->>'month_start') from jsonb_array_elements(months) x) then raise exception 'Duplicate months'; end if;
 perform pg_advisory_xact_lock(hashtext('tours-jv-commissions'));
 for m in select value from jsonb_array_elements(months) loop
  keydate:=(m->>'month_start')::date;
  if keydate is null or extract(day from keydate)<>1 or jsonb_typeof(m->'rows')<>'array' then raise exception 'Invalid month'; end if;
  if exists(select 1 from public.jv_commission_months where agency_id=2 and month_start=keydate and checked_at>cutoff) then raise exception 'Newer snapshot exists'; end if;
  total:=0;
  for r in select value from jsonb_array_elements(m->'rows') loop
   if coalesce(r->>'commercial','')='' or coalesce(r->>'vehicle','')='' then raise exception 'Missing commercial or vehicle'; end if;
   if (r->>'commission_ht') is null or (r->>'margin_ht') is null or (r->>'base_ht') is null or (r->>'guarantee_ht') is null or (r->>'cash_ht') is null then raise exception 'Missing amount'; end if;
   if round((r->>'margin_ht')::numeric-(r->>'guarantee_ht')::numeric-(r->>'cash_ht')::numeric,2)<>(r->>'base_ht')::numeric then raise exception 'Invalid base'; end if;
   total:=total+(r->>'commission_ht')::numeric;
  end loop;
  if m->>'total_ht' is null or abs(total-(m->>'total_ht')::numeric)>0.005 or abs((m->>'total_ht')::numeric+(m->>'total_vat')::numeric-(m->>'total_ttc')::numeric)>0.005 then raise exception 'Totals do not reconcile'; end if;
  insert into public.jv_commission_months values(2,keydate,'1p0FoXI9JbB-t_MjgGdSuyOkAoNdnH95j',cutoff,(m->>'source_modified_at')::timestamptz,(m->>'total_ht')::numeric,(m->>'total_vat')::numeric,(m->>'total_ttc')::numeric,m->'rows')
  on conflict(agency_id,month_start) do update set checked_at=excluded.checked_at,source_modified_at=excluded.source_modified_at,total_ht=excluded.total_ht,total_vat=excluded.total_vat,total_ttc=excluded.total_ttc,rows=excluded.rows;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function private.import_tours_jv(jsonb,timestamptz) from public,anon,authenticated;
notify pgrst,'reload schema';
