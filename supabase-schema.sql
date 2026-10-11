-- Run in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  variety text not null default '',
  price numeric(10,2) not null check (price >= 0),
  description text not null default '',
  size text not null default '',
  availability text not null default 'Available'
    check (availability in ('Available', 'Limited', 'Sold out')),
  image_url text not null default '',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plants_created_at_idx on public.plants (created_at desc);
create index if not exists plants_featured_idx on public.plants (featured);

-- This starter app accesses Supabase through the server-side service role key.
-- Do not put the service role key in browser code or commit it to Git.
-- For a public-facing production app, review and tighten database/storage access policies.
