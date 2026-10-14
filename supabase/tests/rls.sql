-- Adversarial RLS / provenance checks with synthetic local fixtures only.
-- Run after local-bootstrap.sql and all migrations against isolated PostgreSQL.
-- Every test runs in a transaction and leaves no fixture rows behind.
\set ON_ERROR_STOP on
begin;
create schema test_support;
grant usage on schema test_support to anon, authenticated, service_role;
create function test_support.assert(ok boolean, message text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if; end $$;
create function test_support.fails(statement text, expected_state text, expected_message text default null) returns void
language plpgsql as $$
declare actual_state text; actual_message text; failed boolean := false;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
    failed := true;
    if actual_state <> expected_state or (expected_message is not null and position(expected_message in actual_message) = 0) then
      raise exception 'Wrong failure: SQLSTATE %, message %; expected % / %', actual_state, actual_message, expected_state, expected_message;
    end if;
  end;
  if not failed then raise exception 'Statement unexpectedly succeeded: %', statement; end if;
end $$;
-- Invoker helper makes each adversarial candidate a real INSERT through RLS.
create function test_support.candidate_observation(p_code text, p_value numeric, p_start date, p_end date, p_publication date, p_url text)
returns uuid language plpgsql set search_path=pg_catalog as $$
declare inserted_id uuid;
begin
  insert into maroc_en_chiffres.observations(indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator,validation_status)
  select i.id,d.id,p_value,d.unit,d.scale,d.economic_scope,p_start,p_end,p_publication,'20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',p_url,'Synthetic adversarial candidate','approved'
  from maroc_en_chiffres.indicators i join maroc_en_chiffres.indicator_definitions d on d.indicator_id=i.id
  where i.code=p_code and d.validation_status='approved' order by d.version desc limit 1
  returning id into inserted_id;
  if inserted_id is null then raise exception 'Missing approved candidate definition'; end if;
  return inserted_id;
end $$;
grant execute on all functions in schema test_support to anon, authenticated, service_role;

select test_support.assert((select count(*)=1 and bool_and(note='Shared application remains unchanged') from public.existing_project_sentinel), 'existing public application data remains unchanged');
select test_support.assert(has_table_privilege('authenticated','public.existing_project_sentinel','SELECT') and not has_table_privilege('anon','public.existing_project_sentinel','SELECT'), 'existing public table privileges are preserved');
select test_support.assert(exists(select 1 from pg_policies where schemaname='public' and tablename='existing_project_sentinel' and policyname='existing_project_authenticated_read'), 'existing public RLS policy preserved');
select test_support.assert((select count(*)=1 from pg_tables where schemaname='public'), 'finance creates no tables in shared public schema');
select test_support.assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'finance_%' or p.proname like 'review_%' or p.proname like 'export_approved_%' or p.proname='has_admin_role')), 'finance creates no RPCs or privilege helpers in shared public schema');
select test_support.assert(has_schema_privilege('anon','maroc_en_chiffres','USAGE') and not has_schema_privilege('anon','maroc_en_chiffres','CREATE'), 'anonymous caller can use dedicated schema but cannot create objects');

-- The registry migration seeds metadata only: no numeric source data or approval.
select test_support.assert((select count(*)=9 and bool_and(validation_status='draft') from maroc_en_chiffres.institutions), 'nine seeded institutions remain draft');
select test_support.assert((select count(*)=9 and bool_and(validation_status='draft') from maroc_en_chiffres.data_sources), 'nine seeded documentary sources remain draft');
select test_support.assert((select count(*)=14 and bool_and(validation_status='draft') from maroc_en_chiffres.indicators), 'fourteen seeded indicators remain draft');
select test_support.assert((select count(*)=14 and bool_and(validation_status='draft') from maroc_en_chiffres.indicator_definitions), 'fourteen working definitions remain draft');
select test_support.assert(not exists(select 1 from maroc_en_chiffres.observations) and not exists(select 1 from maroc_en_chiffres.forecasts) and not exists(select 1 from maroc_en_chiffres.projections) and not exists(select 1 from maroc_en_chiffres.source_documents), 'registry seed invents no financial values or source documents');

insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003'), ('10000000-0000-0000-0000-000000000004'),
 ('10000000-0000-0000-0000-000000000005'), ('10000000-0000-0000-0000-000000000006');
insert into maroc_en_chiffres.admin_users(user_id, display_name, role, active) values
 ('10000000-0000-0000-0000-000000000001', 'Local reader', 'reader', true),
 ('10000000-0000-0000-0000-000000000002', 'Local editor', 'editor', true),
 ('10000000-0000-0000-0000-000000000003', 'Local reviewer', 'reviewer', true),
 ('10000000-0000-0000-0000-000000000004', 'Local admin', 'admin', true),
 ('10000000-0000-0000-0000-000000000005', 'Disabled editor', 'editor', false);
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
insert into maroc_en_chiffres.institutions(id, code, name, website_url, validation_status) values
 ('20000000-0000-0000-0000-000000000001', 'TEST_A', 'Synthetic approved institution', 'https://example.invalid', 'approved'),
 ('20000000-0000-0000-0000-000000000002', 'TEST_D', 'Synthetic draft institution', 'https://example.invalid', 'draft');
insert into maroc_en_chiffres.data_sources(id, institution_id, name, source_url, access_method, validation_status) values
 ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Approved source', 'https://example.invalid/source', 'document', 'approved'),
 ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Draft source', 'https://example.invalid/draft', 'document', 'draft');
insert into maroc_en_chiffres.source_documents(id, data_source_id, institution_id, title, source_url, published_at, document_type, storage_path, sha256, retrieved_at, validation_status) values
 ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Approved synthetic document', 'https://example.invalid/document', '2025-01-01', 'pdf', '10000000-0000-0000-0000-000000000002/original.pdf', repeat('a',64), '2025-01-02Z', 'approved'),
 ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Pending synthetic document', 'https://example.invalid/pending', '2025-01-01', 'pdf', null, null, '2025-01-02Z', 'pending'),
 ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Blocked document parent', 'https://example.invalid/blocked', '2025-01-01', 'pdf', null, null, '2025-01-02Z', 'pending');
insert into maroc_en_chiffres.indicators(id, code, name, category, description, validation_status) values
 ('50000000-0000-0000-0000-000000000001', 'test_exact', 'Synthetic amount', 'debt', 'Not production data', 'approved'),
 ('50000000-0000-0000-0000-000000000002', 'test_draft', 'Draft indicator', 'debt', 'Not production data', 'draft');
insert into maroc_en_chiffres.indicator_definitions(id, indicator_id, definition, unit, scale, economic_scope, frequency, accounting_basis, valid_from, validation_status) values
 ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Synthetic definition', 'MAD', 1, 'treasury', 'annual', 'stock', '2020-01-01', 'approved'),
 ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'Draft definition', 'MAD', 1, 'treasury', 'annual', 'stock', '2020-01-01', 'draft');
insert into maroc_en_chiffres.observations(id, indicator_id, indicator_definition_id, value, unit, scale, economic_scope, period_start, period_end, published_at, institution_id, source_document_id, source_url, document_locator, validation_status) values
 ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 9007199254740993.123456789012, 'MAD', 1, 'treasury', '2024-01-01', '2024-12-31', '2025-01-01', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'https://example.invalid/document', 'page 1, table 1', 'approved'),
 ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 999, 'MAD', 1, 'treasury', '2023-01-01', '2023-12-31', '2025-01-01', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'https://example.invalid/document', 'page 2', 'pending'),
 ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 777, 'MAD', 1, 'treasury', '2022-01-01', '2022-12-31', '2025-01-01', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'https://example.invalid/pending', 'page 3', 'pending');
insert into maroc_en_chiffres.calculation_methods(id, code, version, name, description, formula, limitations, max_horizon_days, validation_status) values
 ('80000000-0000-0000-0000-000000000001', 'test_method', 1, 'Synthetic method', 'Local fixture', 'v + r*t', 'Never official', 30, 'approved');
insert into maroc_en_chiffres.forecasts(id, indicator_definition_id, institution_id, source_document_id, source_url, document_locator, published_at, period_start, period_end, value, lower_bound, upper_bound, assumptions, validation_status) values
 ('90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'https://example.invalid/document', 'table 2', '2025-01-01', '2025-01-01', '2025-12-31', 9007199254740993.123456789012, 9007199254740992.123456789012, 9007199254740994.123456789012, '{}', 'approved'),
 ('90000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'https://example.invalid/document', 'table 2', '2025-01-01', '2026-01-01', '2026-12-31', 200, null, null, '{}', 'pending');
insert into maroc_en_chiffres.projections(id, indicator_definition_id, calculation_method_id, anchor_observation_id, scenario_name, reference_at, valid_until, value, rate_per_second, assumptions, validation_status) values
 ('a0000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Synthetic', '2025-01-01Z', '2025-01-02Z', 9007199254740993.123456789012, 0.000000000000000123, '{}', 'approved'),
 ('a0000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Draft', '2025-01-01Z', '2025-01-02Z', 456, 0, '{}', 'pending');
insert into maroc_en_chiffres.editorial_content(slug, title_translations, body_translations, validation_status) values
 ('test-approved', '{"fr":"Test"}', '{"fr":"Synthetic"}', 'approved'), ('test-draft', '{"fr":"Draft"}', '{"fr":"Synthetic"}', 'draft');
insert into storage.buckets(id, name, public) values ('other-private', 'Other local bucket', false);
insert into storage.objects(bucket_id, name, owner_id) values
 ('maroc-en-chiffres-documents', '10000000-0000-0000-0000-000000000002/original.pdf', '10000000-0000-0000-0000-000000000002'),
 ('other-private', '10000000-0000-0000-0000-000000000002/hidden.pdf', '10000000-0000-0000-0000-000000000002');

-- Anonymous reads: all registry tables, exact decimal view, private operational tables/storage.
set local request.jwt.claim.sub = '';
set local role anon;
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.institutions), 'anonymous institutions exclude draft');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.data_sources), 'anonymous data_sources exclude draft');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.source_documents), 'anonymous documents exclude pending');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.indicators), 'anonymous indicators exclude draft');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.indicator_definitions), 'anonymous definitions exclude draft');
select test_support.assert((select count(*) = 1 and sum(value) = 9007199254740993.123456789012 from maroc_en_chiffres.observations), 'anonymous aggregation cannot include pending values');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.forecasts), 'forecast pending hidden');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.projections), 'projection pending hidden');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.editorial_content), 'editorial draft hidden');
select test_support.assert((select value_exact = '9007199254740993.123456789012' and scale_exact = '1.000000' from maroc_en_chiffres.approved_observations), 'decimal text preserves precision beyond JS safe integer');
select test_support.assert((select count(*)=1 from maroc_en_chiffres.export_approved_observations()), 'anonymous export includes approved observation only');
select test_support.assert((select value_exact='9007199254740993.123456789012' and scale_exact='1.000000' and pg_typeof(value_exact)='text'::regtype and pg_typeof(scale_exact)='text'::regtype from maroc_en_chiffres.export_approved_observations()), 'RPC export transports decimals as exact text');
select test_support.assert((select indicator_code='test_exact' and source_id='test_a' and source_document_id='40000000-0000-0000-0000-000000000001'::uuid and source_url='https://example.invalid/document' and document_title='Approved synthetic document' and document_page is null and document_locator='page 1, table 1' and document_sha256=repeat('a',64) and document_retrieved_at='2025-01-02Z'::timestamptz from maroc_en_chiffres.export_approved_observations()), 'RPC export carries precise documentary provenance without invented page numbers');
select test_support.assert((select definition_id='60000000-0000-0000-0000-000000000001'::uuid and definition_version=1 and accounting_basis='stock' and frequency='annual' and economic_scope='treasury' and reference_date='2024-12-31'::date and published_at='2025-01-01'::date and validation_status='approved' from maroc_en_chiffres.export_approved_observations()), 'RPC export carries definition and reference metadata');
select test_support.assert((select count(*)=1 from maroc_en_chiffres.export_approved_observations('test_exact')), 'RPC indicator filter selects approved matching rows');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.export_approved_observations('test_missing')), 'RPC unknown indicator returns zero rows');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.export_approved_observations('debt_treasury')), 'RPC does not expose seeded draft definition');
select test_support.fails('select * from public.existing_project_sentinel', '42501');

select test_support.assert((select count(*)=1 from maroc_en_chiffres.approved_forecasts), 'exact forecast view hides pending');
select test_support.assert((select value_exact='9007199254740993.123456789012' and lower_bound_exact='9007199254740992.123456789012' and upper_bound_exact='9007199254740994.123456789012' from maroc_en_chiffres.approved_forecasts), 'forecast value and bounds preserve exact decimals');
select test_support.assert((select count(*)=1 from maroc_en_chiffres.approved_projections), 'exact projection view hides pending');
select test_support.assert((select value_exact='9007199254740993.123456789012' and rate_per_second_exact='0.000000000000000123' from maroc_en_chiffres.approved_projections), 'projection value and tiny per-second rate preserve exact decimals');
select test_support.assert((select count(*) = 0 from storage.objects where bucket_id='maroc-en-chiffres-documents'), 'private bucket unreadable even with existing permissive policies');
select test_support.fails('select * from maroc_en_chiffres.audit_logs', '42501');
select test_support.fails('select * from maroc_en_chiffres.admin_users', '42501');
select test_support.assert((select count(*) = 1 from storage.objects where bucket_id='other-private'), 'preexisting public-read policy still applies to other bucket');
select test_support.fails($$insert into storage.objects(bucket_id,name) values('maroc-en-chiffres-documents','anonymous.pdf')$$, '42501');
select test_support.fails($$select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000002','approved')$$, '42501');
select test_support.assert(not maroc_en_chiffres.has_admin_role(), 'uid-less caller has no membership');

-- Unknown authenticated and disabled staff are limited to public rows.
set local role authenticated;
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.observations), 'uid-less authenticated public access');
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000006';
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.observations), 'ordinary user cannot read pending');
select test_support.assert((select count(*) = 0 from maroc_en_chiffres.audit_logs), 'ordinary user cannot read operational audit');
select test_support.fails($$insert into maroc_en_chiffres.institutions(code,name,website_url) values('TEST_UN','Unauthorized','https://example.invalid')$$, '42501');
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
select test_support.assert(not maroc_en_chiffres.has_admin_role(), 'disabled editor has no active privilege');
select test_support.assert((select count(*) = 1 from maroc_en_chiffres.admin_users), 'disabled member can read only own profile');
select test_support.assert((select count(*) = 0 from storage.objects where bucket_id='maroc-en-chiffres-documents'), 'disabled member cannot access originals');
select test_support.fails($$update maroc_en_chiffres.admin_users set active=true,role='admin' where user_id=auth.uid()$$, '42501');

-- Reader can inspect administration, but cannot modify membership or data.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select test_support.assert((select count(*) = 3 from maroc_en_chiffres.observations), 'reader sees pending observations');
select test_support.assert((select count(*)=1 from maroc_en_chiffres.export_approved_observations()), 'admin reader export still excludes pending rows');
select test_support.assert((select note='Shared application remains unchanged' from public.existing_project_sentinel where id=1), 'existing authenticated public read still works');
select test_support.assert((select count(*) > 0 from maroc_en_chiffres.audit_logs), 'reader can inspect audit');
select test_support.fails($$insert into maroc_en_chiffres.institutions(code,name,website_url) values('TEST_RD','Reader mutation','https://example.invalid')$$, '42501');
update maroc_en_chiffres.institutions set name='Reader must not edit' where id='20000000-0000-0000-0000-000000000002';
select test_support.assert((select name='Synthetic draft institution' from maroc_en_chiffres.institutions where id='20000000-0000-0000-0000-000000000002'), 'reader UPDATE must affect zero rows');
select test_support.fails($$update maroc_en_chiffres.admin_users set role='admin' where user_id=auth.uid()$$, '42501');
select test_support.fails($$insert into storage.objects(bucket_id,name) values('maroc-en-chiffres-documents','10000000-0000-0000-0000-000000000001/reader.pdf')$$, '42501');

-- Editors create drafts but cannot approve, overwrite official observations, or forge history.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
insert into maroc_en_chiffres.institutions(id,code,name,website_url) values ('20000000-0000-0000-0000-000000000003','TEST_ED','Editor draft','https://example.invalid');
select test_support.fails($$update maroc_en_chiffres.institutions set validation_status='approved' where id='20000000-0000-0000-0000-000000000003'$$, '42501', 'Review privilege required');
select test_support.fails($$update maroc_en_chiffres.institutions set validation_status='rejected',review_note='Editor must not reject' where id='20000000-0000-0000-0000-000000000003'$$, '42501', 'Review privilege required');
select test_support.fails($$update maroc_en_chiffres.institutions set review_note='Forged reviewer note' where id='20000000-0000-0000-0000-000000000001'$$, '42501', 'Review privilege required');
select test_support.fails($$update maroc_en_chiffres.institutions set review_note='Forged draft reviewer note' where id='20000000-0000-0000-0000-000000000003'$$, '42501', 'Review privilege required');
select test_support.fails($$insert into maroc_en_chiffres.institutions(code,name,website_url,review_note) values('TEST_FAKE','Forged review','https://example.invalid','Fake reviewer note')$$, '42501', 'Review privilege required');
select test_support.fails($$select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000002','approved')$$, '42501', 'Review privilege required');
select test_support.fails($$select maroc_en_chiffres.review_source_document('40000000-0000-0000-0000-000000000002','approved')$$, '42501', 'Review privilege required');
select test_support.fails($$select maroc_en_chiffres.review_registry('institutions','20000000-0000-0000-0000-000000000003','approved')$$, '42501', 'Review privilege required');
select test_support.fails($$update maroc_en_chiffres.observations set value=1 where id='70000000-0000-0000-0000-000000000001'$$, 'P0001', 'immutable');
select test_support.fails($$update maroc_en_chiffres.observations set value=1 where id='70000000-0000-0000-0000-000000000002'$$, 'P0001', 'immutable');
select test_support.fails($$update maroc_en_chiffres.observations set validation_status='rejected' where id='70000000-0000-0000-0000-000000000001'$$, '42501', 'Review privilege required');
select test_support.fails($$delete from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001'$$, '42501');
select test_support.fails($$insert into maroc_en_chiffres.audit_logs(table_name,row_id,action) values('observations','fake','UPDATE')$$, '42501');
select test_support.fails($$update maroc_en_chiffres.data_revisions set actor_id=auth.uid()$$, '42501');
select test_support.fails($$delete from maroc_en_chiffres.audit_logs$$, '42501');
select test_support.fails($$update maroc_en_chiffres.admin_users set role='admin' where user_id=auth.uid()$$, '42501');
insert into storage.objects(bucket_id,name,owner_id) values('maroc-en-chiffres-documents','10000000-0000-0000-0000-000000000002/new.pdf','10000000-0000-0000-0000-000000000002');
select test_support.fails($$insert into storage.objects(bucket_id,name) values('maroc-en-chiffres-documents','10000000-0000-0000-0000-000000000003/cross-user.pdf')$$, '42501');
insert into storage.objects(bucket_id,name) values('other-private','10000000-0000-0000-0000-000000000002/shared-preserved.pdf');
select test_support.fails($$update storage.objects set bucket_id='maroc-en-chiffres-documents' where name='10000000-0000-0000-0000-000000000002/shared-preserved.pdf'$$, '42501');
update storage.objects set bucket_id='other-private' where name='10000000-0000-0000-0000-000000000002/original.pdf';
update storage.objects set name='10000000-0000-0000-0000-000000000003/stolen.pdf' where name='10000000-0000-0000-0000-000000000002/original.pdf';
delete from storage.objects where bucket_id='maroc-en-chiffres-documents';
select test_support.assert((select count(*) = 1 from storage.objects where bucket_id='maroc-en-chiffres-documents'), 'attached original survives DELETE; own unreferenced orphan cleaned');
select test_support.assert((select count(*) = 2 from storage.objects where bucket_id='other-private'), 'preexisting other-bucket permissions remain unchanged');

-- PostgreSQL numeric accepts NaN; every economic numeric field must reject it.
select test_support.fails($$insert into maroc_en_chiffres.observations(id,indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator) select '70000000-0000-0000-0000-000000000005',indicator_id,indicator_definition_id,'NaN'::numeric,unit,scale,economic_scope,'2027-01-01','2027-12-31','2028-01-01',institution_id,source_document_id,source_url,document_locator from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001'$$, '23514');
select test_support.fails($$update maroc_en_chiffres.forecasts set value='NaN'::numeric where id='90000000-0000-0000-0000-000000000002'$$, '23514');
select test_support.fails($$update maroc_en_chiffres.forecasts set lower_bound='NaN'::numeric where id='90000000-0000-0000-0000-000000000002'$$, '23514');
select test_support.fails($$update maroc_en_chiffres.forecasts set upper_bound='NaN'::numeric where id='90000000-0000-0000-0000-000000000002'$$, '23514');
select test_support.fails($$update maroc_en_chiffres.projections set value='NaN'::numeric where id='a0000000-0000-0000-0000-000000000002'$$, '23514');
select test_support.fails($$update maroc_en_chiffres.projections set rate_per_second='NaN'::numeric where id='a0000000-0000-0000-0000-000000000002'$$, '23514');

-- Linked observation revision: same series/period, next version only.
select test_support.fails($$insert into maroc_en_chiffres.observations(id,indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator,version,previous_observation_id) select '70000000-0000-0000-0000-000000000004',indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator,3,id from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001'$$, 'P0001', 'one version');
select test_support.fails($$insert into maroc_en_chiffres.observations(id,indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator,version,previous_observation_id) select '70000000-0000-0000-0000-000000000004',indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start - 1,period_end,published_at,institution_id,source_document_id,source_url,document_locator,2,id from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001'$$, 'P0001', 'same series and period');
insert into maroc_en_chiffres.observations(id,indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator,version,previous_observation_id)
select '70000000-0000-0000-0000-000000000004',indicator_id,indicator_definition_id,9007199254740994.123456789012,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,'revision page 4',2,id from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001';
select test_support.assert((select created_by=auth.uid() from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000004'), 'revision actor from authenticated identity');
select test_support.assert((select count(*)=1 from maroc_en_chiffres.data_revisions where observation_id='70000000-0000-0000-0000-000000000004' and action='revision'), 'revision audit auto-recorded');

-- Reviewer workflow and parent approval guard, with direct RPC rejection checks.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select test_support.fails($$select maroc_en_chiffres.review_source_document('40000000-0000-0000-0000-000000000003','approved')$$, 'P0001', 'Data source must be approved');
select test_support.fails($$select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000003','approved')$$, 'P0001', 'Source document must be approved');
select test_support.fails($$select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000002','rejected',' ')$$, 'P0001', 'Rejection reason');
select test_support.fails($$update maroc_en_chiffres.observations set validation_status='rejected',review_note=' ' where id='70000000-0000-0000-0000-000000000002'$$, 'P0001', 'Rejection reason');
update maroc_en_chiffres.observations set validation_status='rejected',review_note='Synthetic reviewer rejection' where id='70000000-0000-0000-0000-000000000002';
select test_support.assert((select validation_status='rejected' and review_note='Synthetic reviewer rejection' from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000002'), 'reviewer can reject directly with required reason');
select test_support.fails($$select maroc_en_chiffres.review_registry('admin_users','10000000-0000-0000-0000-000000000003','approved')$$, 'P0001', 'Invalid registry entity');
select maroc_en_chiffres.review_registry('institutions','20000000-0000-0000-0000-000000000003','approved');
select maroc_en_chiffres.review_source_document('40000000-0000-0000-0000-000000000002','approved');
select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000003','approved');
select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000004','approved');
select test_support.assert((select approved_by=auth.uid() and approved_at is not null from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000004'), 'review attribution uses accountable reviewer');
select test_support.assert((select count(*)=1 from maroc_en_chiffres.data_revisions where observation_id='70000000-0000-0000-0000-000000000004' and action='review'), 'review append-only history');
select test_support.fails($$update maroc_en_chiffres.projections set validation_status='approved',valid_until='2026-01-01Z' where id='a0000000-0000-0000-0000-000000000002'$$, 'P0001', 'horizon');
select test_support.fails($$update maroc_en_chiffres.admin_users set role='admin' where user_id=auth.uid()$$, '42501');
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
select test_support.fails($$update maroc_en_chiffres.admin_users set active=true where user_id='10000000-0000-0000-0000-000000000005'$$, '42501');
select test_support.fails($$truncate maroc_en_chiffres.audit_logs$$, '42501');

-- The public exact-value view selects the newest APPROVED revision.
set local request.jwt.claim.sub = '';
set local role anon;
select test_support.assert((select value_exact='9007199254740994.123456789012' and version=2 from maroc_en_chiffres.approved_observations where period_end='2024-12-31'), 'latest approved revision with exact decimal');
select test_support.assert((select count(*)=2 from maroc_en_chiffres.approved_observations), 'pending 2023 stays hidden');
reset role;
select test_support.assert((select role='editor' and active from maroc_en_chiffres.admin_users where user_id='10000000-0000-0000-0000-000000000002'), 'editor membership was not elevated');
select test_support.assert((select role='editor' and not active from maroc_en_chiffres.admin_users where user_id='10000000-0000-0000-0000-000000000005'), 'disabled member remains disabled');
select test_support.assert((select count(*)=1 from storage.objects where bucket_id='maroc-en-chiffres-documents' and name='10000000-0000-0000-0000-000000000002/original.pdf'), 'original storage path/bucket intact');
select test_support.assert((select value=9007199254740993.123456789012 from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001'), 'original official amount remains immutable');

-- Publication chronology and provenance cannot be bypassed by a reviewer.
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select test_support.fails($$select test_support.candidate_observation('test_exact',100,'2028-01-01','2028-12-31','2025-01-01','https://example.invalid/document')$$,'23514','observation_published_after_period');
select test_support.fails($$select test_support.candidate_observation('test_exact',100,'2019-01-01','2019-12-31','2025-01-01','https://example.invalid/document')$$,'P0001','Period falls outside definition validity');
select test_support.fails($$select test_support.candidate_observation('test_exact',100,'2024-01-01','2024-12-31','2025-01-02','https://example.invalid/document')$$,'P0001','Publication date and URL must match');
select test_support.fails($$select test_support.candidate_observation('test_exact',100,'2024-01-01','2024-12-31','2025-01-01','https://example.invalid/mismatched-document')$$,'P0001','Publication date and URL must match');

-- Valid subdomains are accepted; authority spoofing, ports and lookalikes fail.
select test_support.fails($$insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,validation_status) values('20000000-0000-0000-0000-000000000001','Wrong host','https://evil.invalid/source','document','approved')$$,'P0001','official HTTPS domain');
select test_support.fails($$insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,validation_status) values('20000000-0000-0000-0000-000000000001','Userinfo authority','https://example.invalid@evil.invalid/source','document','approved')$$,'P0001','official HTTPS domain');
select test_support.fails($$insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,validation_status) values('20000000-0000-0000-0000-000000000001','Port authority','https://example.invalid:443/source','document','approved')$$,'P0001','official HTTPS domain');
select test_support.fails($$insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,validation_status) values('20000000-0000-0000-0000-000000000001','Suffix lookalike','https://example.invalid.evil.invalid/source','document','approved')$$,'P0001','official HTTPS domain');
insert into maroc_en_chiffres.data_sources(id,institution_id,name,source_url,access_method,validation_status) values('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Official subdomain','https://data.example.invalid/source','document','approved');
select test_support.assert((select validation_status='approved' from maroc_en_chiffres.data_sources where id='30000000-0000-0000-0000-000000000003'),'institution official subdomain source is valid');
select test_support.fails($$insert into maroc_en_chiffres.source_documents(data_source_id,institution_id,title,source_url,published_at,document_type,validation_status) values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Wrong host','https://evil.invalid/document','2025-01-01','pdf','approved')$$,'P0001','official HTTPS domain');
select test_support.fails($$insert into maroc_en_chiffres.source_documents(data_source_id,institution_id,title,source_url,published_at,document_type,validation_status) values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Userinfo authority','https://example.invalid@evil.invalid/document','2025-01-01','pdf','approved')$$,'P0001','official HTTPS domain');
select test_support.fails($$insert into maroc_en_chiffres.source_documents(data_source_id,institution_id,title,source_url,published_at,document_type,validation_status) values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Port authority','https://example.invalid:443/document','2025-01-01','pdf','approved')$$,'P0001','official HTTPS domain');
insert into maroc_en_chiffres.source_documents(id,data_source_id,institution_id,title,source_url,published_at,document_type,validation_status) values('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Official subdomain document','https://data.example.invalid/document','2025-01-01','pdf','approved');
select test_support.assert((select validation_status='approved' from maroc_en_chiffres.source_documents where id='40000000-0000-0000-0000-000000000004'),'institution official subdomain document is valid');

-- Definition validity and indicator sign/percent semantics are checked at review.
select maroc_en_chiffres.review_registry('indicators',(select id from maroc_en_chiffres.indicators where code='gdp'),'approved');
select maroc_en_chiffres.review_registry('indicators',(select id from maroc_en_chiffres.indicators where code='debt_treasury'),'approved');
insert into maroc_en_chiffres.indicator_definitions(indicator_id,version,definition,unit,scale,economic_scope,frequency,accounting_basis,valid_from,validation_status)
select id,2,'Synthetic GDP definition','MAD',1,'national_economy','annual','Synthetic test: nominal annual output','2020-01-01','approved' from maroc_en_chiffres.indicators where code='gdp';
insert into maroc_en_chiffres.indicator_definitions(indicator_id,version,definition,unit,scale,economic_scope,frequency,accounting_basis,valid_from,validation_status)
select id,2,'Synthetic debt definition','MAD',1,'treasury','annual','Synthetic test: nominal closing stock','2020-01-01','approved' from maroc_en_chiffres.indicators where code='debt_treasury';
select test_support.fails($$select test_support.candidate_observation('gdp',-1,'2024-01-01','2024-12-31','2025-01-01','https://example.invalid/document')$$,'P0001','cannot be negative');
select test_support.fails($$select test_support.candidate_observation('gdp',0,'2024-01-01','2024-12-31','2025-01-01','https://example.invalid/document')$$,'P0001','must be positive');
select test_support.fails($$select test_support.candidate_observation('debt_treasury',-1,'2024-01-01','2024-12-31','2025-01-01','https://example.invalid/document')$$,'P0001','cannot be negative');
insert into maroc_en_chiffres.indicators(id,code,name,category,description,validation_status) values('50000000-0000-0000-0000-000000000003','test_expired','Expired definition','debt','Synthetic test','approved'),('50000000-0000-0000-0000-000000000004','test_percent','Scaled percent','debt','Synthetic test','approved');
insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,valid_from,valid_until,validation_status) values
('50000000-0000-0000-0000-000000000003','Expired fixture','MAD',1,'treasury','annual','Synthetic nominal stock','2020-01-01','2023-12-31','approved'),
('50000000-0000-0000-0000-000000000004','Percent fixture','percent',1000,'treasury','annual','Synthetic debt ratio','2020-01-01',null,'approved');
select test_support.fails($$select test_support.candidate_observation('test_expired',100,'2024-01-01','2024-12-31','2025-01-01','https://example.invalid/document')$$,'P0001','Period falls outside definition validity');
select test_support.fails($$select test_support.candidate_observation('test_percent',50,'2024-01-01','2024-12-31','2025-01-01','https://example.invalid/document')$$,'P0001','Percent values must use unit scale');

-- Revocation of a parent hides approved descendants from public reads.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
-- Approved publisher estimates must not silently become official observations.
insert into maroc_en_chiffres.observations(id,indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator,observation_status)
select '70000000-0000-0000-0000-000000000005',indicator_id,indicator_definition_id,100,unit,scale,economic_scope,'2020-01-01','2020-12-31',published_at,institution_id,source_document_id,source_url,'Synthetic estimate fixture','estimated' from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001';
insert into maroc_en_chiffres.observations(id,indicator_id,indicator_definition_id,value,unit,scale,economic_scope,period_start,period_end,published_at,institution_id,source_document_id,source_url,document_locator,observation_status)
select '70000000-0000-0000-0000-000000000006',indicator_id,indicator_definition_id,200,unit,scale,economic_scope,'2021-01-01','2021-12-31',published_at,institution_id,source_document_id,source_url,'Synthetic provisional fixture','provisional' from maroc_en_chiffres.observations where id='70000000-0000-0000-0000-000000000001';
select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000005','approved');
select maroc_en_chiffres.review_observation('70000000-0000-0000-0000-000000000006','approved');
set local request.jwt.claim.sub='';
set local role anon;
select test_support.assert((select count(*)=1 from maroc_en_chiffres.approved_observations where id='70000000-0000-0000-0000-000000000005'), 'estimated fixture is genuinely approved before export filtering');
select test_support.assert((select count(*)=3 from maroc_en_chiffres.export_approved_observations()), 'export combines approved observed and provisional only');
select test_support.assert(not exists(select 1 from maroc_en_chiffres.export_approved_observations() where observation_status='estimated'), 'estimated values are excluded from official live export');
select test_support.assert((select count(*)=1 from maroc_en_chiffres.export_approved_observations() where id='70000000-0000-0000-0000-000000000006' and observation_status='provisional'), 'approved provisional values retain their status');
select test_support.assert(not exists(select 1 from maroc_en_chiffres.export_approved_observations() where id in ('90000000-0000-0000-0000-000000000001'::uuid,'a0000000-0000-0000-0000-000000000001'::uuid)), 'forecasts and calculated projections never mix into official export');
select test_support.assert((select value_exact='9007199254740994.123456789012' and version=2 from maroc_en_chiffres.export_approved_observations() where period_end='2024-12-31'), 'export uses exact value from newest approved revision');
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select maroc_en_chiffres.review_registry('institutions','20000000-0000-0000-0000-000000000001','rejected','Synthetic test revocation');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.export_approved_observations()), 'reviewer export honors explicit revoked provenance even with admin RLS access');
set local request.jwt.claim.sub = '';
set local role anon;
select test_support.assert((select count(*)=0 from maroc_en_chiffres.source_documents), 'revoked institution hides downstream documents');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.observations), 'revoked institution hides downstream approved observations');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.approved_observations), 'invoker view preserves parent provenance RLS');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.export_approved_observations()), 'anonymous RPC export respects revoked provenance through invoker RLS');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.forecasts), 'revoked institution hides forecasts');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.projections), 'revoked institution hides projections');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.approved_forecasts), 'exact forecast invoker view respects revoked provenance');
select test_support.assert((select count(*)=0 from maroc_en_chiffres.approved_projections), 'exact projection invoker view respects revoked provenance');

-- A working definition cannot be approved until its accounting basis is real.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select maroc_en_chiffres.review_registry('indicators',(select id from maroc_en_chiffres.indicators where code='debt_treasury'),'approved');
select test_support.fails($$select maroc_en_chiffres.review_registry('indicator_definitions',(select d.id from maroc_en_chiffres.indicator_definitions d join maroc_en_chiffres.indicators i on i.id=d.indicator_id where i.code='debt_treasury' and d.version=1),'approved')$$, 'P0001', 'Accounting basis must be documented');
update maroc_en_chiffres.indicator_definitions set accounting_basis=' ' where indicator_id=(select id from maroc_en_chiffres.indicators where code='debt_treasury') and version=1;
select test_support.fails($$select maroc_en_chiffres.review_registry('indicator_definitions',(select d.id from maroc_en_chiffres.indicator_definitions d join maroc_en_chiffres.indicators i on i.id=d.indicator_id where i.code='debt_treasury' and d.version=1),'approved')$$, 'P0001', 'Accounting basis must be documented');
update maroc_en_chiffres.indicator_definitions set accounting_basis='  to be defined' where indicator_id=(select id from maroc_en_chiffres.indicators where code='debt_treasury') and version=1;
select test_support.fails($$select maroc_en_chiffres.review_registry('indicator_definitions',(select d.id from maroc_en_chiffres.indicator_definitions d join maroc_en_chiffres.indicators i on i.id=d.indicator_id where i.code='debt_treasury' and d.version=1),'approved')$$, 'P0001', 'Accounting basis must be documented');
update maroc_en_chiffres.indicator_definitions set accounting_basis='TBD' where indicator_id=(select id from maroc_en_chiffres.indicators where code='debt_treasury') and version=1;
select test_support.fails($$select maroc_en_chiffres.review_registry('indicator_definitions',(select d.id from maroc_en_chiffres.indicator_definitions d join maroc_en_chiffres.indicators i on i.id=d.indicator_id where i.code='debt_treasury' and d.version=1),'approved')$$, 'P0001', 'Accounting basis must be documented');
update maroc_en_chiffres.indicator_definitions set accounting_basis='n/a' where indicator_id=(select id from maroc_en_chiffres.indicators where code='debt_treasury') and version=1;
select test_support.fails($$select maroc_en_chiffres.review_registry('indicator_definitions',(select d.id from maroc_en_chiffres.indicator_definitions d join maroc_en_chiffres.indicators i on i.id=d.indicator_id where i.code='debt_treasury' and d.version=1),'approved')$$, 'P0001', 'Accounting basis must be documented');
update maroc_en_chiffres.indicator_definitions set accounting_basis='Synthetic local test only: closing nominal stock, per fixture source document' where indicator_id=(select id from maroc_en_chiffres.indicators where code='debt_treasury') and version=1;
select maroc_en_chiffres.review_registry('indicator_definitions',(select d.id from maroc_en_chiffres.indicator_definitions d join maroc_en_chiffres.indicators i on i.id=d.indicator_id where i.code='debt_treasury' and d.version=1),'approved');
select test_support.assert((select validation_status='approved' and approved_by=auth.uid() from maroc_en_chiffres.indicator_definitions where indicator_id=(select id from maroc_en_chiffres.indicators where code='debt_treasury') and version=1), 'definition becomes approvable after documenting its accounting basis');

-- Revocation cannot erase approval history or unlock authoritative metadata.
select test_support.fails($$update maroc_en_chiffres.institutions set name='Tampered after revocation' where id='20000000-0000-0000-0000-000000000001'$$,'P0001','Previously approved content is immutable');
select test_support.fails($$update maroc_en_chiffres.institutions set approved_at=null where id='20000000-0000-0000-0000-000000000001'$$,'P0001','Historic approval attribution cannot be erased');
select maroc_en_chiffres.review_source_document('40000000-0000-0000-0000-000000000001','rejected','Synthetic revocation');
select test_support.fails($$update maroc_en_chiffres.source_documents set source_url='https://example.invalid/replaced-document' where id='40000000-0000-0000-0000-000000000001'$$,'P0001','Previously approved content is immutable');
select test_support.fails($$update maroc_en_chiffres.source_documents set sha256=repeat('b',64) where id='40000000-0000-0000-0000-000000000001'$$,'P0001','Previously approved content is immutable');
select maroc_en_chiffres.review_registry('indicator_definitions','60000000-0000-0000-0000-000000000001','rejected','Synthetic revocation');
select test_support.fails($$update maroc_en_chiffres.indicator_definitions set accounting_basis='Tampered definition after revocation' where id='60000000-0000-0000-0000-000000000001'$$,'P0001','Previously approved content is immutable');
select test_support.assert((select sha256=repeat('a',64) and approved_at is not null from maroc_en_chiffres.source_documents where id='40000000-0000-0000-0000-000000000001'),'revoked documentary fingerprint and approval history remain intact');

-- Privileged operational clients can append logs but cannot rewrite history.
set local role service_role;
select test_support.fails('update maroc_en_chiffres.audit_logs set action=''DELETE''', '42501');
select test_support.fails('delete from maroc_en_chiffres.data_revisions', '42501');
select test_support.fails('truncate maroc_en_chiffres.ingestion_logs', '42501');
reset role;
rollback;
\echo 'RLS, exact precision, review, history and private storage checks passed.'
