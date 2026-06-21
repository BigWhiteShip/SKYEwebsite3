insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload listing photos" on storage.objects;
drop policy if exists "Authenticated users can update listing photos" on storage.objects;
drop policy if exists "Authenticated users can delete listing photos" on storage.objects;
drop policy if exists "Public can view listing photos" on storage.objects;

create policy "Authenticated users can upload listing photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'listing-photos');

create policy "Authenticated users can update listing photos"
on storage.objects for update
to authenticated
using (bucket_id = 'listing-photos')
with check (bucket_id = 'listing-photos');

create policy "Authenticated users can delete listing photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'listing-photos');

create policy "Public can view listing photos"
on storage.objects for select
to public
using (bucket_id = 'listing-photos');
