insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  750000,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "claimed users read profile photos" on storage.objects;
create policy "claimed users read profile photos"
on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and public.is_claimed_user());

drop policy if exists "admins and owners upload profile photos" on storage.objects;
create policy "admins and owners upload profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (
    public.current_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_profile_id()::text
  )
);

drop policy if exists "admins and owners update profile photos" on storage.objects;
create policy "admins and owners update profile photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    public.current_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_profile_id()::text
  )
)
with check (
  bucket_id = 'profile-photos'
  and (
    public.current_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_profile_id()::text
  )
);

drop policy if exists "admins and owners delete profile photos" on storage.objects;
create policy "admins and owners delete profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    public.current_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_profile_id()::text
  )
);

