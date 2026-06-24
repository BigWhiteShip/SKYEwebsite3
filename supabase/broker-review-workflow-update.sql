drop policy if exists "Agents can update owned non-final listings" on public.listings;

create policy "Agents can update owned non-final listings"
on public.listings for update
using (created_by = auth.uid() and status::text in ('draft', 'unpublished'))
with check (created_by = auth.uid() and status::text in ('draft', 'pending_approval', 'unpublished'));
