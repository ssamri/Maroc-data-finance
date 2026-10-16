begin;

-- A caller can only test its own membership. No uid argument, no membership leak.
create function maroc_en_chiffres.has_admin_role(required_roles maroc_en_chiffres.admin_role[] default array['reader','editor','reviewer','admin']::maroc_en_chiffres.admin_role[])
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from maroc_en_chiffres.admin_users a
    where a.user_id = (select auth.uid()) and a.active and a.role = any(required_roles)
  );
$$;
revoke all on function maroc_en_chiffres.has_admin_role(maroc_en_chiffres.admin_role[]) from public;
grant execute on function maroc_en_chiffres.has_admin_role(maroc_en_chiffres.admin_role[]) to anon, authenticated, service_role;

create function maroc_en_chiffres.finance_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin new.updated_at := now(); return new; end; $$;
revoke all on function maroc_en_chiffres.finance_touch_updated_at() from public;

-- An editor cannot approve even by calling the REST API directly.
create function maroc_en_chiffres.finance_guard_approval()
returns trigger language plpgsql set search_path = pg_catalog
as $$
declare trusted_operator boolean; indicator_code text; official_host text; document_host text;
begin
  trusted_operator := current_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role';
  if not trusted_operator and not maroc_en_chiffres.has_admin_role(array['reviewer','admin']::maroc_en_chiffres.admin_role[]) then
    if (new.validation_status in ('approved','rejected') and
       (tg_op = 'INSERT' or old.validation_status is distinct from new.validation_status)) or
       (tg_op = 'INSERT' and new.review_note is not null) or
       (tg_op = 'UPDATE' and new.review_note is distinct from old.review_note) then
      raise exception 'Review privilege required' using errcode = '42501';
    end if;
  end if;
  if new.validation_status = 'rejected' and length(trim(coalesce(new.review_note, ''))) = 0 then
    raise exception 'Rejection reason is required';
  end if;
  if tg_op = 'UPDATE' and old.approved_at is not null and new.approved_at is null then
    raise exception 'Historic approval attribution cannot be erased';
  end if;
  if tg_op = 'UPDATE' and old.approved_at is not null and
    (to_jsonb(new) - array['validation_status','review_note','approved_by','approved_at','updated_at']) is distinct from
    (to_jsonb(old) - array['validation_status','review_note','approved_by','approved_at','updated_at']) then
    raise exception 'Previously approved content is immutable: create a new version';
  end if;
  if new.validation_status = 'approved' and
    (tg_op = 'INSERT' or old.validation_status is distinct from new.validation_status) then
    if not trusted_operator and not maroc_en_chiffres.has_admin_role(array['reviewer','admin']::maroc_en_chiffres.admin_role[]) then
      raise exception 'Review privilege required' using errcode = '42501';
    end if;
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := now();
    if new.approved_by is null then
      raise exception 'Approval needs a real, accountable reviewer identity';
    end if;
    if tg_table_name in ('data_sources','source_documents') then
      select lower(regexp_replace(substring(website_url from '^https://([^/?#]+)'), '^www\.', ''))
        into official_host from maroc_en_chiffres.institutions where id = new.institution_id;
      document_host := lower(regexp_replace(substring(new.source_url from '^https://([^/?#]+)'), '^www\.', ''));
      if official_host is null or document_host is null or document_host ~ '[@:]' or
        (document_host <> official_host and right(document_host, length(official_host) + 1) <> '.' || official_host) then
        raise exception 'Source URL must use the institution official HTTPS domain';
      end if;
    end if;
    if tg_table_name = 'data_sources' then
      if not exists (select 1 from maroc_en_chiffres.institutions where id = new.institution_id and validation_status = 'approved') then
        raise exception 'Institution must be approved';
      end if;
    end if;
    if tg_table_name = 'source_documents' then
      if not exists (select 1 from maroc_en_chiffres.data_sources where id = new.data_source_id and validation_status = 'approved') then
        raise exception 'Data source must be approved';
      end if;
    end if;
    if tg_table_name = 'indicator_definitions' then
      if trim(new.accounting_basis) = '' or trim(new.accounting_basis) ~* '^(à préciser|unspecified|todo|to be defined|tbd|n/a)' then
        raise exception 'Accounting basis must be documented before approval';
      end if;
      if not exists (select 1 from maroc_en_chiffres.indicators where id = new.indicator_id and validation_status = 'approved') then
        raise exception 'Indicator must be approved';
      end if;
    end if;
    if tg_table_name in ('observations', 'forecasts') then
      if not exists (select 1 from maroc_en_chiffres.source_documents where id = new.source_document_id and validation_status = 'approved') then
        raise exception 'Source document must be approved';
      end if;
      if not exists (select 1 from maroc_en_chiffres.indicator_definitions where id = new.indicator_definition_id and validation_status = 'approved') then
        raise exception 'Indicator definition must be approved';
      end if;
      if not exists (
        select 1 from maroc_en_chiffres.source_documents where id = new.source_document_id
        and published_at = new.published_at and source_url = new.source_url
      ) then raise exception 'Publication date and URL must match the source document'; end if;
      if not exists (
        select 1 from maroc_en_chiffres.indicator_definitions where id = new.indicator_definition_id
        and valid_from <= new.period_start and (valid_until is null or valid_until >= new.period_end)
      ) then raise exception 'Period falls outside definition validity'; end if;
    end if;
    if tg_table_name = 'observations' then
      select code into indicator_code from maroc_en_chiffres.indicators where id = new.indicator_id;
      if indicator_code not in ('deficit','debt_stock_change') and new.value < 0 then
        raise exception 'This indicator cannot be negative';
      end if;
      if indicator_code in ('gdp','population') and new.value <= 0 then
        raise exception 'GDP and population must be positive';
      end if;
      if new.unit = 'percent' and new.scale <> 1 then raise exception 'Percent values must use unit scale'; end if;
    end if;
    if tg_table_name = 'projections' then
      if not exists (
        select 1 from maroc_en_chiffres.observations where id = new.anchor_observation_id
        and indicator_definition_id = new.indicator_definition_id and validation_status = 'approved'
      ) then raise exception 'Projection needs a compatible approved anchor'; end if;
      if not exists (
        select 1 from maroc_en_chiffres.calculation_methods where id = new.calculation_method_id and validation_status = 'approved'
        and new.valid_until <= new.reference_at + max_horizon_days * interval '1 day'
      ) then raise exception 'Projection horizon exceeds approved method bounds'; end if;
    end if;
  end if;
  -- Only a reviewer can reject a previously approved record or change its attribution.
  if tg_op = 'UPDATE' and old.validation_status = 'approved' and
    (new.validation_status is distinct from old.validation_status or
     new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at) and
    not trusted_operator and not maroc_en_chiffres.has_admin_role(array['reviewer','admin']::maroc_en_chiffres.admin_role[]) then
    raise exception 'Review privilege required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function maroc_en_chiffres.finance_guard_approval() from public;

create function maroc_en_chiffres.finance_guard_observation_history()
returns trigger language plpgsql set search_path = pg_catalog
as $$
declare prior maroc_en_chiffres.observations;
begin
  if tg_op = 'UPDATE' and
    (to_jsonb(new) - array['validation_status','review_note','approved_by','approved_at','updated_at']) is distinct from
    (to_jsonb(old) - array['validation_status','review_note','approved_by','approved_at','updated_at']) then
    raise exception 'Observations are immutable: insert a linked revision instead';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if new.previous_observation_id is not null then
      select * into prior from maroc_en_chiffres.observations where id = new.previous_observation_id;
      if not found or new.indicator_definition_id <> prior.indicator_definition_id or
        new.period_start <> prior.period_start or new.period_end <> prior.period_end or new.version <> prior.version + 1 then
        raise exception 'Revision must extend the same series and period by one version';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function maroc_en_chiffres.finance_guard_observation_history() from public;

create function maroc_en_chiffres.finance_record_audit()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare previous jsonb; next_record jsonb;
begin
  if tg_op <> 'INSERT' then previous := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then next_record := to_jsonb(new); end if;
  insert into maroc_en_chiffres.audit_logs(actor_id, table_name, row_id, action, old_record, new_record)
  values (auth.uid(), tg_table_name, coalesce(next_record->>'id', previous->>'id', next_record->>'user_id', previous->>'user_id'), tg_op, previous, next_record);
  if tg_table_name = 'observations' and tg_op <> 'DELETE' then
    insert into maroc_en_chiffres.data_revisions(observation_id, action, previous_snapshot, new_snapshot, actor_id)
    values (new.id, case when tg_op = 'UPDATE' then 'review' when new.version > 1 then 'revision' else 'insert' end, previous, next_record, auth.uid());
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function maroc_en_chiffres.finance_record_audit() from public;

do $$
declare relation text;
begin
  foreach relation in array array[
    'institutions','data_sources','source_documents','indicators','indicator_definitions',
    'observations','forecasts','calculation_methods','projections','editorial_content'
  ] loop
    execute format('alter table maroc_en_chiffres.%I enable row level security', relation);
    execute format('create trigger guard_approval before insert or update on maroc_en_chiffres.%I for each row execute function maroc_en_chiffres.finance_guard_approval()', relation);
    execute format('create trigger touch_updated_at before update on maroc_en_chiffres.%I for each row execute function maroc_en_chiffres.finance_touch_updated_at()', relation);
    execute format('create trigger record_audit after insert or update or delete on maroc_en_chiffres.%I for each row execute function maroc_en_chiffres.finance_record_audit()', relation);
    execute format('revoke all on maroc_en_chiffres.%I from public, anon, authenticated', relation);
    execute format('grant select on maroc_en_chiffres.%I to anon, authenticated', relation);
    execute format('grant insert, update on maroc_en_chiffres.%I to authenticated', relation);
    execute format('create policy admin_read on maroc_en_chiffres.%I for select to authenticated using (maroc_en_chiffres.has_admin_role())', relation);
    execute format('create policy editor_insert on maroc_en_chiffres.%I for insert to authenticated with check (maroc_en_chiffres.has_admin_role(array[''editor'',''reviewer'',''admin'']::maroc_en_chiffres.admin_role[]))', relation);
    execute format('create policy editor_update on maroc_en_chiffres.%I for update to authenticated using (maroc_en_chiffres.has_admin_role(array[''editor'',''reviewer'',''admin'']::maroc_en_chiffres.admin_role[])) with check (maroc_en_chiffres.has_admin_role(array[''editor'',''reviewer'',''admin'']::maroc_en_chiffres.admin_role[]))', relation);
    -- No DELETE granted: retain source provenance and reviewed history.
  end loop;
  foreach relation in array array['admin_users','ingestion_jobs','ingestion_logs','data_revisions','audit_logs'] loop
    execute format('alter table maroc_en_chiffres.%I enable row level security', relation);
    execute format('revoke all on maroc_en_chiffres.%I from public, anon, authenticated', relation);
    execute format('grant select on maroc_en_chiffres.%I to authenticated', relation);
    execute format('create policy admin_read on maroc_en_chiffres.%I for select to authenticated using (maroc_en_chiffres.has_admin_role())', relation);
  end loop;
end $$;

create policy own_admin_profile on maroc_en_chiffres.admin_users for select to authenticated using (user_id = (select auth.uid()));
create trigger admin_users_touch before update on maroc_en_chiffres.admin_users for each row execute function maroc_en_chiffres.finance_touch_updated_at();
create trigger admin_users_audit after insert or update or delete on maroc_en_chiffres.admin_users for each row execute function maroc_en_chiffres.finance_record_audit();

grant insert, update on maroc_en_chiffres.ingestion_jobs to authenticated;
create policy editor_jobs_insert on maroc_en_chiffres.ingestion_jobs for insert to authenticated
  with check (maroc_en_chiffres.has_admin_role(array['editor','reviewer','admin']::maroc_en_chiffres.admin_role[]));
create policy editor_jobs_update on maroc_en_chiffres.ingestion_jobs for update to authenticated
  using (maroc_en_chiffres.has_admin_role(array['editor','reviewer','admin']::maroc_en_chiffres.admin_role[]))
  with check (maroc_en_chiffres.has_admin_role(array['editor','reviewer','admin']::maroc_en_chiffres.admin_role[]));
create trigger ingestion_jobs_touch before update on maroc_en_chiffres.ingestion_jobs for each row execute function maroc_en_chiffres.finance_touch_updated_at();
create trigger ingestion_jobs_audit after insert or update or delete on maroc_en_chiffres.ingestion_jobs for each row execute function maroc_en_chiffres.finance_record_audit();

-- Public reads are approval- and provenance-aware at every link in the chain.
create policy approved_read on maroc_en_chiffres.institutions for select to anon, authenticated using (validation_status = 'approved');
create policy approved_read on maroc_en_chiffres.indicators for select to anon, authenticated using (validation_status = 'approved');
create policy approved_read on maroc_en_chiffres.calculation_methods for select to anon, authenticated using (validation_status = 'approved');
create policy approved_read on maroc_en_chiffres.editorial_content for select to anon, authenticated using (validation_status = 'approved');
create policy approved_read on maroc_en_chiffres.data_sources for select to anon, authenticated using (
  validation_status = 'approved' and exists (select 1 from maroc_en_chiffres.institutions i where i.id = institution_id and i.validation_status = 'approved')
);
create policy approved_read on maroc_en_chiffres.source_documents for select to anon, authenticated using (
  validation_status = 'approved' and exists (select 1 from maroc_en_chiffres.data_sources s where s.id = data_source_id and s.validation_status = 'approved')
);
create policy approved_read on maroc_en_chiffres.indicator_definitions for select to anon, authenticated using (
  validation_status = 'approved' and exists (select 1 from maroc_en_chiffres.indicators i where i.id = indicator_id and i.validation_status = 'approved')
);
create policy approved_read on maroc_en_chiffres.observations for select to anon, authenticated using (
  validation_status = 'approved' and
  exists (select 1 from maroc_en_chiffres.indicator_definitions d where d.id = indicator_definition_id and d.validation_status = 'approved') and
  exists (select 1 from maroc_en_chiffres.source_documents s where s.id = source_document_id and s.validation_status = 'approved')
);
create policy approved_read on maroc_en_chiffres.forecasts for select to anon, authenticated using (
  validation_status = 'approved' and
  exists (select 1 from maroc_en_chiffres.indicator_definitions d where d.id = indicator_definition_id and d.validation_status = 'approved') and
  exists (select 1 from maroc_en_chiffres.source_documents s where s.id = source_document_id and s.validation_status = 'approved')
);
create policy approved_read on maroc_en_chiffres.projections for select to anon, authenticated using (
  validation_status = 'approved' and
  exists (select 1 from maroc_en_chiffres.observations o where o.id = anchor_observation_id and o.validation_status = 'approved') and
  exists (select 1 from maroc_en_chiffres.calculation_methods m where m.id = calculation_method_id and m.validation_status = 'approved')
);
create trigger observations_history before insert or update on maroc_en_chiffres.observations for each row execute function maroc_en_chiffres.finance_guard_observation_history();

-- Preserve decimal precision in the API. Reading raw numeric columns through JS
-- can round amounts; applications use this text-valued, RLS-respecting view.
create view maroc_en_chiffres.approved_observations with (security_invoker = true) as
select distinct on (o.indicator_definition_id, o.period_start, o.period_end)
  o.id, o.indicator_id, o.indicator_definition_id,
  o.value::text as value_exact, o.unit, o.scale::text as scale_exact, o.economic_scope,
  o.period_start, o.period_end, o.published_at, o.institution_id, o.source_document_id,
  o.source_url, o.document_locator, o.observation_status, o.origin, o.version,
  o.previous_observation_id, o.approved_at
from maroc_en_chiffres.observations o
where o.validation_status = 'approved'
order by o.indicator_definition_id, o.period_start, o.period_end, o.version desc;
revoke all on maroc_en_chiffres.approved_observations from public;
grant select on maroc_en_chiffres.approved_observations to anon, authenticated, service_role;

create view maroc_en_chiffres.approved_forecasts with (security_invoker = true) as
select f.id, f.indicator_definition_id, f.institution_id, f.source_document_id,
  f.source_url, f.document_locator, f.published_at, f.period_start, f.period_end,
  f.value::text as value_exact, f.lower_bound::text as lower_bound_exact,
  f.upper_bound::text as upper_bound_exact, f.assumptions, f.approved_at
from maroc_en_chiffres.forecasts f where f.validation_status = 'approved';
create view maroc_en_chiffres.approved_projections with (security_invoker = true) as
select p.id, p.indicator_definition_id, p.calculation_method_id, p.anchor_observation_id,
  p.scenario_name, p.reference_at, p.valid_until, p.value::text as value_exact,
  p.rate_per_second::text as rate_per_second_exact, p.assumptions, p.provenance, p.approved_at
from maroc_en_chiffres.projections p where p.validation_status = 'approved';
revoke all on maroc_en_chiffres.approved_forecasts, maroc_en_chiffres.approved_projections from public;
grant select on maroc_en_chiffres.approved_forecasts, maroc_en_chiffres.approved_projections to anon, authenticated, service_role;

-- Complete, exact-decimal public export for the application's source contract.
-- Both the view and RPC remain invoker functions and keep underlying RLS.
create view maroc_en_chiffres.approved_observation_export with (security_invoker = true) as
select o.id, i.code as indicator_code, o.value_exact, o.scale_exact, o.unit,
  o.economic_scope, o.period_start, o.period_end, o.period_end as reference_date,
  o.published_at, case institution.code when 'WORLD_BANK' then 'worldbank'
    when 'OPEN_DATA' then 'opendata' else lower(institution.code) end as source_id,
  o.source_url, o.source_document_id, document.title as document_title, null::integer as document_page,
  document.sha256 as document_sha256, document.retrieved_at as document_retrieved_at,
  o.document_locator, o.observation_status, 'approved'::text as validation_status,
  o.version, institution.name as producer_name, definition.id as definition_id, definition.version as definition_version,
  definition.accounting_basis, definition.frequency
from maroc_en_chiffres.approved_observations o
join maroc_en_chiffres.indicators i on i.id = o.indicator_id
join maroc_en_chiffres.indicator_definitions definition on definition.id = o.indicator_definition_id
join maroc_en_chiffres.source_documents document on document.id = o.source_document_id
join maroc_en_chiffres.data_sources source on source.id = document.data_source_id
join maroc_en_chiffres.institutions institution on institution.id = o.institution_id
where i.validation_status = 'approved' and definition.validation_status = 'approved'
  and document.validation_status = 'approved' and source.validation_status = 'approved'
  and institution.validation_status = 'approved';
revoke all on maroc_en_chiffres.approved_observation_export from public;
grant select on maroc_en_chiffres.approved_observation_export to anon, authenticated, service_role;

create function maroc_en_chiffres.export_approved_observations(p_indicator_code text default null)
returns setof maroc_en_chiffres.approved_observation_export language sql stable set search_path = pg_catalog
as $$
  select * from maroc_en_chiffres.approved_observation_export
  where (p_indicator_code is null or indicator_code = p_indicator_code)
    and observation_status in ('observed','provisional')
  order by period_end, indicator_code;
$$;
revoke all on function maroc_en_chiffres.export_approved_observations(text) from public;
grant execute on function maroc_en_chiffres.export_approved_observations(text) to anon, authenticated, service_role;

create function maroc_en_chiffres.review_observation(p_observation_id uuid, p_decision maroc_en_chiffres.validation_status, p_reason text default null)
returns maroc_en_chiffres.observations language plpgsql set search_path = pg_catalog
as $$
declare reviewed maroc_en_chiffres.observations;
begin
  if not maroc_en_chiffres.has_admin_role(array['reviewer','admin']::maroc_en_chiffres.admin_role[]) then
    raise exception 'Review privilege required' using errcode = '42501';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Rejection reason is required'; end if;
  update maroc_en_chiffres.observations set validation_status = p_decision, review_note = p_reason where id = p_observation_id returning * into reviewed;
  if not found then raise exception 'Observation not found' using errcode = 'P0002'; end if;
  return reviewed;
end;
$$;
revoke all on function maroc_en_chiffres.review_observation(uuid, maroc_en_chiffres.validation_status, text) from public;
grant execute on function maroc_en_chiffres.review_observation(uuid, maroc_en_chiffres.validation_status, text) to authenticated;

create function maroc_en_chiffres.review_source_document(p_document_id uuid, p_decision maroc_en_chiffres.validation_status, p_reason text default null)
returns maroc_en_chiffres.source_documents language plpgsql set search_path = pg_catalog
as $$
declare reviewed maroc_en_chiffres.source_documents;
begin
  if not maroc_en_chiffres.has_admin_role(array['reviewer','admin']::maroc_en_chiffres.admin_role[]) then
    raise exception 'Review privilege required' using errcode = '42501';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Rejection reason is required'; end if;
  update maroc_en_chiffres.source_documents set validation_status = p_decision, review_note = p_reason where id = p_document_id returning * into reviewed;
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  return reviewed;
end;
$$;
revoke all on function maroc_en_chiffres.review_source_document(uuid, maroc_en_chiffres.validation_status, text) from public;
grant execute on function maroc_en_chiffres.review_source_document(uuid, maroc_en_chiffres.validation_status, text) to authenticated;

create function maroc_en_chiffres.review_registry(p_entity text, p_id uuid, p_decision maroc_en_chiffres.validation_status, p_reason text default null)
returns jsonb language plpgsql set search_path = pg_catalog
as $$
declare reviewed jsonb;
begin
  if not maroc_en_chiffres.has_admin_role(array['reviewer','admin']::maroc_en_chiffres.admin_role[]) then
    raise exception 'Review privilege required' using errcode = '42501';
  end if;
  if p_entity not in ('institutions','data_sources','indicators','indicator_definitions','calculation_methods','editorial_content') then
    raise exception 'Invalid registry entity';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Rejection reason is required'; end if;
  execute format('update maroc_en_chiffres.%I as r set validation_status = $1, review_note = $2 where id = $3 returning to_jsonb(r)', p_entity)
    into reviewed using p_decision, p_reason, p_id;
  if reviewed is null then raise exception 'Registry entry not found' using errcode = 'P0002'; end if;
  return reviewed;
end;
$$;
revoke all on function maroc_en_chiffres.review_registry(text, uuid, maroc_en_chiffres.validation_status, text) from public;
grant execute on function maroc_en_chiffres.review_registry(text, uuid, maroc_en_chiffres.validation_status, text) to authenticated;

-- service_role is deliberately not used by public reads or ordinary admin CRUD.
grant all on maroc_en_chiffres.admin_users, maroc_en_chiffres.institutions, maroc_en_chiffres.data_sources, maroc_en_chiffres.source_documents,
  maroc_en_chiffres.indicators, maroc_en_chiffres.indicator_definitions, maroc_en_chiffres.observations, maroc_en_chiffres.forecasts,
  maroc_en_chiffres.calculation_methods, maroc_en_chiffres.projections, maroc_en_chiffres.ingestion_jobs, maroc_en_chiffres.ingestion_logs,
  maroc_en_chiffres.data_revisions, maroc_en_chiffres.audit_logs, maroc_en_chiffres.editorial_content to service_role;
revoke all on maroc_en_chiffres.ingestion_logs_id_seq, maroc_en_chiffres.data_revisions_id_seq, maroc_en_chiffres.audit_logs_id_seq from public, anon, authenticated;
grant usage, select on maroc_en_chiffres.ingestion_logs_id_seq, maroc_en_chiffres.data_revisions_id_seq, maroc_en_chiffres.audit_logs_id_seq to service_role;
-- History is append-only even for operational clients. Owners can maintain it.
revoke update, delete, truncate on maroc_en_chiffres.audit_logs, maroc_en_chiffres.data_revisions, maroc_en_chiffres.ingestion_logs from service_role;

commit;
