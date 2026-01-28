-- Create the storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);

-- Allow public access to view images
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'product-images' );

-- Allow uploads
-- Note: This allows public uploads. For better security, consider restricting this to authenticated users.
create policy "Public Upload"
  on storage.objects for insert
  with check ( bucket_id = 'product-images' );
