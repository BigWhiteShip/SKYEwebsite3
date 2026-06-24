alter type listing_status add value if not exists 'needs_edits';

drop policy if exists "Agents can update owned non-final listings" on public.listings;

create policy "Agents can update owned non-final listings"
on public.listings for update
using (created_by = auth.uid() and status::text in ('draft', 'needs_edits', 'unpublished'))
with check (created_by = auth.uid() and status::text in ('draft', 'pending_approval', 'needs_edits', 'unpublished'));
