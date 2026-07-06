create extension if not exists "pgcrypto";

create table if not exists public.crm_clients (
    id uuid primary key default gen_random_uuid(),
    first_name text not null,
    last_name text not null,
    email text not null unique,
    phone text,
    lead_source text not null default 'property_contact_form',
    status text not null default 'new',
    marketing_consent boolean not null default true,
    contact_consent boolean not null default true,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.contact_submissions (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references public.crm_clients(id) on delete set null,
    first_name text not null,
    last_name text not null,
    email text not null,
    phone text,
    message text,
    captcha_confirmed boolean not null default false,
    marketing_consent boolean not null default true,
    contact_consent boolean not null default true,
    property_slug text,
    property_address text,
    agent_email text,
    page_url text,
    user_agent text,
    created_at timestamptz not null default now()
);

alter table public.contact_submissions
    add column if not exists property_slug text,
    add column if not exists property_address text,
    add column if not exists agent_email text;

alter table public.crm_clients
    alter column lead_source set default 'property_contact_form';

create index if not exists crm_clients_status_idx
    on public.crm_clients(status);

create index if not exists crm_clients_created_at_idx
    on public.crm_clients(created_at desc);

create index if not exists contact_submissions_client_id_idx
    on public.contact_submissions(client_id);

create index if not exists contact_submissions_created_at_idx
    on public.contact_submissions(created_at desc);

create index if not exists contact_submissions_property_slug_idx
    on public.contact_submissions(property_slug);

alter table public.crm_clients enable row level security;
alter table public.contact_submissions enable row level security;

-- The submit-contact-form Edge Function writes with SUPABASE_SERVICE_ROLE_KEY.
-- Browser users do not need direct insert permissions on these CRM tables.
