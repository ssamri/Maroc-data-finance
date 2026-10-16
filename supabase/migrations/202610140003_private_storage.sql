begin;

-- Existing policies on a shared project's storage.objects may be permissive.
-- Restrictive, bucket-scoped policies below protect this new bucket while their
-- condition is always true for every pre-existing bucket. Do not replace or
-- modify any existing policies. Abort if platform RLS is unexpectedly absent.
do $$ begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'Storage RLS must already be enabled; operator review required';
  end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'maroc-en-chiffres-documents', 'maroc-en-chiffres-documents', false, 26214400,
  array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/json','text/html']
);

-- Only active staff can access originals. Public users follow official source
-- URLs; neither a public bucket nor public object URLs are used.
create policy finance_documents_read on storage.objects for select to authenticated using (
  bucket_id = 'maroc-en-chiffres-documents' and maroc_en_chiffres.has_admin_role()
);
create policy finance_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'maroc-en-chiffres-documents' and
  maroc_en_chiffres.has_admin_role(array['editor','reviewer','admin']::maroc_en_chiffres.admin_role[]) and
  (storage.foldername(name))[1] = (select auth.uid())::text
);
-- Originals are immutable through the application: upload a new path/version.
-- No UPDATE policy, preserving SHA256-linked source provenance.
-- A failed import may clean up its own orphan; attached originals are retained.
create policy finance_documents_orphan_delete on storage.objects for delete to authenticated using (
  bucket_id = 'maroc-en-chiffres-documents' and
  maroc_en_chiffres.has_admin_role(array['editor','reviewer','admin']::maroc_en_chiffres.admin_role[]) and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  not exists (select 1 from maroc_en_chiffres.source_documents d where d.storage_path = storage.objects.name)
);

create policy finance_documents_isolation_read on storage.objects as restrictive for select to anon, authenticated using (
  bucket_id <> 'maroc-en-chiffres-documents' or maroc_en_chiffres.has_admin_role()
);
create policy finance_documents_isolation_insert on storage.objects as restrictive for insert to anon, authenticated with check (
  bucket_id <> 'maroc-en-chiffres-documents' or (
    maroc_en_chiffres.has_admin_role(array['editor','reviewer','admin']::maroc_en_chiffres.admin_role[]) and
    (storage.foldername(name))[1] = (select auth.uid())::text
  )
);
create policy finance_documents_isolation_update on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'maroc-en-chiffres-documents') with check (bucket_id <> 'maroc-en-chiffres-documents');
create policy finance_documents_isolation_delete on storage.objects as restrictive for delete to anon, authenticated using (
  bucket_id <> 'maroc-en-chiffres-documents' or (
    maroc_en_chiffres.has_admin_role(array['editor','reviewer','admin']::maroc_en_chiffres.admin_role[]) and
    (storage.foldername(name))[1] = (select auth.uid())::text and
    not exists (select 1 from maroc_en_chiffres.source_documents d where d.storage_path = storage.objects.name)
  )
);

commit;
