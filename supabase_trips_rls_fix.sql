-- Ejecutar una vez en Supabase SQL Editor para corregir el 403 de public.trips.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.trips to authenticated;

alter table public.trips enable row level security;

drop policy if exists "Users can read their own trips" on public.trips;
drop policy if exists "Users can insert their own trips" on public.trips;
drop policy if exists "Users can update their own trips" on public.trips;
drop policy if exists "Users can delete their own trips" on public.trips;

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
