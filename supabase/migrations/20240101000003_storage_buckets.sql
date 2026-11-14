-- ============================================================
-- CampusOS · Migration 3 — Storage buckets & policies
-- ============================================================
-- Supabase Storage buckets are created via SQL for reproducibility.
-- All buckets are PRIVATE (no public access).

-- --------------------------------------------------------
-- 1. vault — private student documents
--    Path convention: {user_id}/{filename}
-- --------------------------------------------------------
insert into storage.buckets (id, name, public) values ('vault', 'vault', false);

-- Users can upload to their own folder only
create policy "Users can upload to own vault folder"
  on storage.objects for insert
  with check (
    bucket_id = 'vault'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own files only
create policy "Users can view own vault files"
  on storage.objects for select
  using (
    bucket_id = 'vault'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own files
create policy "Users can update own vault files"
  on storage.objects for update
  using (
    bucket_id = 'vault'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
create policy "Users can delete own vault files"
  on storage.objects for delete
  using (
    bucket_id = 'vault'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------
-- 2. campus-docs — admin-managed RAG corpus files
-- --------------------------------------------------------
insert into storage.buckets (id, name, public) values ('campus-docs', 'campus-docs', false);

-- All authenticated users can read (for RAG context)
create policy "Authenticated users can read campus docs"
  on storage.objects for select
  using (
    bucket_id = 'campus-docs'
    and auth.role() = 'authenticated'
  );

-- Only admins can upload/modify
create policy "Admin can upload campus docs"
  on storage.objects for insert
  with check (
    bucket_id = 'campus-docs'
    and public.is_admin()
  );

create policy "Admin can update campus docs"
  on storage.objects for update
  using (
    bucket_id = 'campus-docs'
    and public.is_admin()
  );

create policy "Admin can delete campus docs"
  on storage.objects for delete
  using (
    bucket_id = 'campus-docs'
    and public.is_admin()
  );

-- --------------------------------------------------------
-- 3. listing-images — photos for Campus Reuse listings
--    Path convention: {user_id}/{listing_id}/{filename}
-- --------------------------------------------------------
insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', false);

-- All authenticated users can view listing images
create policy "Authenticated users can view listing images"
  on storage.objects for select
  using (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
  );

-- Owners can upload to their own folder
create policy "Users can upload own listing images"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can update their own images
create policy "Users can update own listing images"
  on storage.objects for update
  using (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can delete their own images
create policy "Users can delete own listing images"
  on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
