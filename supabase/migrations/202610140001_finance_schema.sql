-- MAROC EN CHIFFRES — exact, traceable source data. PostgreSQL 15+ / Supabase.
-- Apply only to the explicitly verified target project (lodgicore), in this dedicated schema.
begin;

-- Fail rather than merge with an unexpected pre-existing schema.
create schema maroc_en_chiffres;
revoke all on schema maroc_en_chiffres from public;
grant usage on schema maroc_en_chiffres to anon, authenticated, service_role;

create type maroc_en_chiffres.validation_status as enum ('draft', 'pending', 'approved', 'rejected');
create type maroc_en_chiffres.admin_role as enum ('reader', 'editor', 'reviewer', 'admin');
create type maroc_en_chiffres.observation_status as enum ('observed', 'provisional', 'estimated');
create type maroc_en_chiffres.document_type as enum ('pdf', 'csv', 'xlsx', 'html', 'json');
create type maroc_en_chiffres.ingestion_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

create table maroc_en_chiffres.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role maroc_en_chiffres.admin_role not null default 'reader',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table maroc_en_chiffres.institutions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  name text not null,
  name_translations jsonb not null default '{}'::jsonb check (jsonb_typeof(name_translations) = 'object'),
  website_url text not null check (website_url ~ '^https://[^[:space:]]+$'),
  country_code text not null default 'MA' check (country_code ~ '^[A-Z]{2}$'),
  validation_status maroc_en_chiffres.validation_status not null default 'draft',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table maroc_en_chiffres.data_sources (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references maroc_en_chiffres.institutions(id),
  name text not null,
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  access_method text not null check (access_method in ('document', 'api', 'manual')),
  api_verified_at timestamptz,
  notes text,
  validation_status maroc_en_chiffres.validation_status not null default 'draft',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  check (access_method <> 'api' or api_verified_at is not null),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table maroc_en_chiffres.source_documents (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null,
  institution_id uuid not null references maroc_en_chiffres.institutions(id),
  title text not null,
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  published_at date not null,
  retrieved_at timestamptz not null default now(),
  document_type maroc_en_chiffres.document_type not null,
  language text not null default 'fr' check (language in ('fr', 'ar', 'en')),
  storage_path text unique,
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint check (byte_size is null or byte_size > 0),
  extraction_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(extraction_metadata) = 'object'),
  validation_status maroc_en_chiffres.validation_status not null default 'draft',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (data_source_id, institution_id) references maroc_en_chiffres.data_sources(id, institution_id),
  check (storage_path is null or (storage_path !~ '(^/|(^|/)\.\.(/|$))' and length(storage_path) > 0)),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table maroc_en_chiffres.indicators (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  name text not null,
  name_translations jsonb not null default '{}'::jsonb check (jsonb_typeof(name_translations) = 'object'),
  category text not null check (category in ('debt', 'budget', 'deficit', 'interest', 'population', 'gdp', 'comparison')),
  description text not null,
  validation_status maroc_en_chiffres.validation_status not null default 'draft',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table maroc_en_chiffres.indicator_definitions (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references maroc_en_chiffres.indicators(id),
  version integer not null default 1 check (version > 0),
  definition text not null,
  unit text not null,
  scale numeric(18,6) not null default 1 check (scale in (1, 1000, 1000000, 1000000000)),
  economic_scope text not null,
  frequency text not null check (frequency in ('annual', 'quarterly', 'monthly', 'point_in_time')),
  accounting_basis text not null,
  comparability_notes text,
  valid_from date not null,
  valid_until date,
  validation_status maroc_en_chiffres.validation_status not null default 'draft',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (indicator_id, version),
  unique (id, indicator_id, unit, scale, economic_scope),
  check (valid_until is null or valid_until >= valid_from),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

-- Official publisher observations only; generated estimates belong in projections.
create table maroc_en_chiffres.observations (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references maroc_en_chiffres.indicators(id),
  indicator_definition_id uuid not null,
  value numeric(38,12) not null check (value <> 'NaN'::numeric),
  unit text not null,
  scale numeric(18,6) not null,
  economic_scope text not null,
  period_start date not null,
  period_end date not null,
  published_at date not null,
  institution_id uuid not null references maroc_en_chiffres.institutions(id),
  source_document_id uuid not null,
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  document_locator text not null check (length(trim(document_locator)) > 0),
  observation_status maroc_en_chiffres.observation_status not null default 'observed',
  origin text not null default 'official_publisher' check (origin = 'official_publisher'),
  validation_status maroc_en_chiffres.validation_status not null default 'pending',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  previous_observation_id uuid unique references maroc_en_chiffres.observations(id),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (indicator_definition_id, indicator_id, unit, scale, economic_scope)
    references maroc_en_chiffres.indicator_definitions(id, indicator_id, unit, scale, economic_scope),
  foreign key (source_document_id, institution_id) references maroc_en_chiffres.source_documents(id, institution_id),
  unique (indicator_definition_id, period_start, period_end, version),
  check (period_end >= period_start),
  constraint observation_published_after_period check (published_at >= period_end),
  check ((version = 1 and previous_observation_id is null) or (version > 1 and previous_observation_id is not null)),
  check (previous_observation_id is null or previous_observation_id <> id),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

-- Forecasts published by an institution are distinct from official observations.
create table maroc_en_chiffres.forecasts (
  id uuid primary key default gen_random_uuid(),
  indicator_definition_id uuid not null references maroc_en_chiffres.indicator_definitions(id),
  institution_id uuid not null references maroc_en_chiffres.institutions(id),
  source_document_id uuid not null,
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  document_locator text not null,
  published_at date not null,
  period_start date not null,
  period_end date not null,
  value numeric(38,12) not null check (value <> 'NaN'::numeric),
  lower_bound numeric(38,12) check (lower_bound <> 'NaN'::numeric),
  upper_bound numeric(38,12) check (upper_bound <> 'NaN'::numeric),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  validation_status maroc_en_chiffres.validation_status not null default 'pending',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_document_id, institution_id) references maroc_en_chiffres.source_documents(id, institution_id),
  check (period_end >= period_start),
  check (lower_bound is null or lower_bound <= value),
  check (upper_bound is null or upper_bound >= value),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table maroc_en_chiffres.calculation_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null check (version > 0),
  name text not null,
  description text not null,
  formula text not null,
  limitations text not null,
  max_horizon_days integer not null check (max_horizon_days between 1 and 3660),
  validation_status maroc_en_chiffres.validation_status not null default 'draft',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

-- Engine estimates, with explicit bounds and assumptions; never official data.
create table maroc_en_chiffres.projections (
  id uuid primary key default gen_random_uuid(),
  indicator_definition_id uuid not null references maroc_en_chiffres.indicator_definitions(id),
  calculation_method_id uuid not null references maroc_en_chiffres.calculation_methods(id),
  anchor_observation_id uuid not null references maroc_en_chiffres.observations(id),
  scenario_name text not null,
  reference_at timestamptz not null,
  valid_until timestamptz not null,
  value numeric(38,12) not null check (value <> 'NaN'::numeric),
  rate_per_second numeric(38,18) not null check (rate_per_second <> 'NaN'::numeric),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  provenance text not null default 'calculated_estimate' check (provenance = 'calculated_estimate'),
  validation_status maroc_en_chiffres.validation_status not null default 'pending',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until > reference_at),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table maroc_en_chiffres.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references maroc_en_chiffres.source_documents(id),
  status maroc_en_chiffres.ingestion_status not null default 'queued',
  parser_version text not null,
  requested_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  observation_count integer not null default 0 check (observation_count >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table maroc_en_chiffres.ingestion_logs (
  id bigint generated always as identity primary key,
  ingestion_job_id uuid not null references maroc_en_chiffres.ingestion_jobs(id),
  level text not null check (level in ('info', 'warning', 'error')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table maroc_en_chiffres.data_revisions (
  id bigint generated always as identity primary key,
  observation_id uuid not null references maroc_en_chiffres.observations(id),
  action text not null check (action in ('insert', 'review', 'revision')),
  previous_snapshot jsonb,
  new_snapshot jsonb not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table maroc_en_chiffres.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz not null default now()
);

create table maroc_en_chiffres.editorial_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]+$'),
  title_translations jsonb not null check (jsonb_typeof(title_translations) = 'object'),
  body_translations jsonb not null check (jsonb_typeof(body_translations) = 'object'),
  validation_status maroc_en_chiffres.validation_status not null default 'draft',
  review_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (validation_status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create index observations_published_series on maroc_en_chiffres.observations (indicator_definition_id, period_end desc, version desc)
  where validation_status = 'approved';
create index observations_documents on maroc_en_chiffres.observations (source_document_id);
create index documents_source on maroc_en_chiffres.source_documents (data_source_id);
create index forecasts_series on maroc_en_chiffres.forecasts (indicator_definition_id, period_end);
create index projections_anchor on maroc_en_chiffres.projections (anchor_observation_id);
create index ingestion_logs_job on maroc_en_chiffres.ingestion_logs (ingestion_job_id, created_at);
create index data_revisions_observation on maroc_en_chiffres.data_revisions (observation_id, created_at);
create index audit_logs_record on maroc_en_chiffres.audit_logs (table_name, row_id, created_at);

commit;
