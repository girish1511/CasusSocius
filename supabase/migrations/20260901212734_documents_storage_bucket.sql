-- Storage bucket for raw uploaded course documents (PDF/DOCX/PPTX/TXT).
-- Access follows the same open, no-login decision as the table RLS
-- policies in 20260901211614_rls_policies.sql.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "public full access to documents bucket"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');
