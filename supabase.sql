-- Ejecutar en el SQL Editor de Supabase.
create table if not exists public.user_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  destination_key text not null,
  destination_name text not null,
  departure_date date,
  return_date date,
  nights integer not null default 1,
  travelers integer not null default 1,
  transport_mode text not null default 'flight',
  food_per_day numeric not null default 0,
  local_per_day numeric not null default 0,
  total_amount numeric not null default 0,
  currency text not null default 'USD',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_trips enable row level security;

create policy "Users can read their own trips"
  on public.user_trips for select
  using (auth.uid() = user_id);

create policy "Users can insert their own trips"
  on public.user_trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own trips"
  on public.user_trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own trips"
  on public.user_trips for delete
  using (auth.uid() = user_id);

create index if not exists user_trips_user_created_idx
  on public.user_trips (user_id, created_at desc);
