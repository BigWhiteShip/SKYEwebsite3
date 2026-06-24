create extension if not exists "pgcrypto";

create type app_role as enum ('agent', 'principal_broker');
create type listing_status as enum (
    'draft',
    'pending_approval',
    'needs_edits',
    'published',
    'unpublished',
    'sold',
    'archived'
);

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    full_name text not null,
    role app_role not null default 'agent',
    office_phone text,
    mobile_phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.listings (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id),
    approved_by uuid references public.profiles(id),
    status listing_status not null default 'draft',
    title text not null,
    slug text not null unique,
    description text not null,
    address text not null,
    city text,
    state text default 'OR',
    zip_code text,
    hide_address boolean not null default false,
    price integer not null check (price > 0),
    bedrooms numeric(4,1) not null check (bedrooms >= 0),
    bathrooms numeric(4,1) not null check (bathrooms >= 0),
    interior_sq_ft integer not null check (interior_sq_ft > 0),
    lot_size text not null,
    mls_number text not null,
    zillow_url text not null check (zillow_url like 'https://%'),
    agent_name text not null,
    agent_office_phone text not null,
    agent_mobile_phone text not null,
    agent_email text not null,
    submitted_at timestamptz,
    approved_at timestamptz,
    published_at timestamptz,
    sold_at timestamptz,
    archived_at timestamptz,
    autosaved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.listing_photos (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings(id) on delete cascade,
    storage_path text not null,
    public_url text not null,
    alt_text text not null,
    sort_order integer not null default 0,
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),
    unique (listing_id, sort_order)
);

create table public.listing_approval_events (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings(id) on delete cascade,
    actor_id uuid references public.profiles(id),
    event_type text not null,
    notes text,
    created_at timestamptz not null default now()
);

create or replace function public.is_principal_broker()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid()
        and role = 'principal_broker'
    );
$$;

create or replace function public.owns_listing(listing_owner uuid)
returns boolean
language sql
stable
as $$
    select auth.uid() = listing_owner;
$$;

create view public.public_listings as
select
    l.*,
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'url', p.public_url,
                'alt_text', p.alt_text,
                'sort_order', p.sort_order,
                'is_primary', p.is_primary
            )
            order by p.sort_order
        ) filter (where p.id is not null),
        '[]'::jsonb
    ) as photos
from public.listings l
left join public.listing_photos p on p.listing_id = l.id
where l.status in ('published', 'sold')
group by l.id;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.listing_approval_events enable row level security;

create policy "Public can view published and sold listings"
on public.listings for select
using (status in ('published', 'sold'));

create policy "Agents can view their listings"
on public.listings for select
using (created_by = auth.uid() or public.is_principal_broker());

create policy "Agents can create drafts"
on public.listings for insert
with check (created_by = auth.uid());

create policy "Agents can update owned non-final listings"
on public.listings for update
using (created_by = auth.uid() and status::text in ('draft', 'needs_edits', 'unpublished'))
with check (created_by = auth.uid() and status::text in ('draft', 'pending_approval', 'needs_edits', 'unpublished'));

create policy "Broker can manage all listings"
on public.listings for all
using (public.is_principal_broker())
with check (public.is_principal_broker());

create policy "Photos visible for public listings"
on public.listing_photos for select
using (
    exists (
        select 1 from public.listings l
        where l.id = listing_id
        and l.status in ('published', 'sold')
    )
);

create policy "Agents can manage photos on owned listings"
on public.listing_photos for all
using (
    exists (
        select 1 from public.listings l
        where l.id = listing_id
        and (l.created_by = auth.uid() or public.is_principal_broker())
    )
)
with check (
    exists (
        select 1 from public.listings l
        where l.id = listing_id
        and (l.created_by = auth.uid() or public.is_principal_broker())
    )
);

create policy "Users can read their profile"
on public.profiles for select
using (id = auth.uid() or public.is_principal_broker());

create policy "Broker can manage profiles"
on public.profiles for all
using (public.is_principal_broker())
with check (public.is_principal_broker());

create policy "Approval events visible to listing owner and broker"
on public.listing_approval_events for select
using (
    public.is_principal_broker()
    or exists (
        select 1 from public.listings l
        where l.id = listing_id
        and l.created_by = auth.uid()
    )
);

create policy "Approval events created by authenticated users"
on public.listing_approval_events for insert
with check (actor_id = auth.uid() or public.is_principal_broker());
