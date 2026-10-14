-- Local PostgreSQL test doubles only. NEVER apply this file to Supabase.
-- The actual auth and storage schemas are managed by Supabase itself.
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = pg_catalog
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable set search_path = pg_catalog
as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_role::text) $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable set search_path = pg_catalog
as $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- Simulate dangerously broad policies on an existing shared project: the
-- migration must protect only its own bucket without rewriting these policies.
create policy existing_shared_read on storage.objects for select to anon, authenticated using (true);
create policy existing_shared_insert on storage.objects for insert to anon, authenticated with check (true);
create policy existing_shared_update on storage.objects for update to anon, authenticated using (true) with check (true);
create policy existing_shared_delete on storage.objects for delete to anon, authenticated using (true);

-- Existing application sentinel: the finance migrations must preserve its
-- schema, row, RLS policy and asymmetric privileges on the shared project.
create table public.existing_project_sentinel (id integer primary key, note text not null);
insert into public.existing_project_sentinel values (1, 'Shared application remains unchanged');
alter table public.existing_project_sentinel enable row level security;
create policy existing_project_authenticated_read on public.existing_project_sentinel for select to authenticated using (true);
grant select on public.existing_project_sentinel to authenticated;
