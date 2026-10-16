-- Ejecutar en Supabase SQL Editor para corregir el 403 y compatibilizar
-- una tabla trips creada previamente con otra estructura.
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.trips add column if not exists origin text;
alter table public.trips add column if not exists destination text;
alter table public.trips add column if not exists departure_date date;
alter table public.trips add column if not exists return_date date;
alter table public.trips add column if not exists total_amount numeric not null default 0;
alter table public.trips add column if not exists currency text not null default 'USD';
alter table public.trips add column if not exists offer_id text;
alter table public.trips add column if not exists flight_details jsonb not null default '{}'::jsonb;
alter table public.trips add column if not exists data jsonb not null default '{}'::jsonb;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.trips to authenticated;

alter table public.trips enable row level security;

drop policy if exists "Users can read their own trips" on public.trips;
drop policy if exists "Users can insert their own trips" on public.trips;
drop policy if exists "Users can update their own trips" on public.trips;
drop policy if exists "Users can delete their own trips" on public.trips;
drop policy if exists "Usuarios pueden ver sus propios trips" on public.trips;
drop policy if exists "Usuarios pueden insertar sus propios trips" on public.trips;
drop policy if exists "Acceso total autenticados" on public.trips;
drop policy if exists "Permitir todo a todos temporariamente" on public.trips;
drop policy if exists "Utilizadores podem ver as suas próprias viagens" on public.trips;
drop policy if exists "Utilizadores podem inserir as suas próprias viagens" on public.trips;

create policy "Users can read their own trips"
  on public.trips for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own trips"
  on public.trips for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own trips"
  on public.trips for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own trips"
  on public.trips for delete
  to authenticated
  using (auth.uid() = user_id);
