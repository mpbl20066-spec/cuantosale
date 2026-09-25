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

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin text,
  destination text,
  departure_date date,
  return_date date,
  total_amount numeric not null default 0,
  currency text not null default 'USD',
  offer_id text,
  flight_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;

create policy "Users can read their own trips"
  on public.trips for select using (auth.uid() = user_id);

create policy "Users can insert their own trips"
  on public.trips for insert with check (auth.uid() = user_id);

create policy "Users can update their own trips"
  on public.trips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own trips"
  on public.trips for delete using (auth.uid() = user_id);

create index if not exists trips_user_created_idx
  on public.trips (user_id, created_at desc);

-- Registra cada clic saliente hacia el link de afiliado de Travelpayouts en
-- estado "pending", para poder conciliarlo después contra el reporte de
-- conversiones de Travelpayouts (que solo entrega sub_id, no nuestro user_id).
create table if not exists public.reservas_hoteles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  destination_key text not null,
  hotel_name text,
  sub_id text not null unique,
  click_total numeric,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'clicked', 'confirmed', 'cancelled')),
  provider text not null default 'travelpayouts',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reservas_hoteles enable row level security;

create policy "Users can read their own hotel clicks"
  on public.reservas_hoteles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own hotel clicks"
  on public.reservas_hoteles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own hotel clicks"
  on public.reservas_hoteles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists reservas_hoteles_user_created_idx
  on public.reservas_hoteles (user_id, created_at desc);

create index if not exists reservas_hoteles_sub_id_idx
  on public.reservas_hoteles (sub_id);

-- Cachea la polyline calculada por Directions para cada combinación
-- origen (MVD/PDP) + destino, así solo se llama a la API de Google una vez
-- por ruta en vez de una vez por cada visitante que mira ese destino en auto.
create table if not exists public.route_polylines (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination_key text not null,
  distance_km numeric not null,
  duration_minutes integer not null,
  encoded_polyline text not null,
  provider text not null default 'google_directions',
  created_at timestamptz not null default now(),
  unique (origin, destination_key)
);

alter table public.route_polylines enable row level security;

-- Es un caché compartido, no datos personales: cualquiera puede leerlo, y
-- cualquiera puede insertar la primera vez que se calcula una ruta (el índice
-- único de arriba hace que solo el primer cálculo quede guardado).
create policy "Anyone can read cached routes"
  on public.route_polylines for select
  using (true);

create policy "Anyone can cache a newly computed route"
  on public.route_polylines for insert
  with check (true);

-- Split de gastos por link (cuantosale.uy/grupo/{id}), sin login obligatorio.
-- El id (uuid) del grupo funciona como "contraseña" del link: quien lo tiene
-- puede leer y escribir en ese grupo. No usar para montos sensibles: no hay
-- otra capa de autenticación sobre estas tres tablas.
create table if not exists public.grupos_viaje (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  destination_key text,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_viaje(id) on delete cascade,
  display_name text not null,
  device_id text not null,
  joined_at timestamptz not null default now(),
  unique (grupo_id, device_id)
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_viaje(id) on delete cascade,
  paid_by_participante_id uuid not null references public.participantes(id) on delete cascade,
  description text not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'USD',
  split_between uuid[] not null,
  created_at timestamptz not null default now()
);

alter table public.grupos_viaje enable row level security;
alter table public.participantes enable row level security;
alter table public.gastos enable row level security;

create policy "Anyone with the link can read a group"
  on public.grupos_viaje for select using (true);
create policy "Anyone can create a group"
  on public.grupos_viaje for insert with check (true);

create policy "Anyone with the link can read participants"
  on public.participantes for select using (true);
create policy "Anyone with the link can join a group"
  on public.participantes for insert with check (true);

create policy "Anyone with the link can read expenses"
  on public.gastos for select using (true);
create policy "Anyone with the link can add an expense"
  on public.gastos for insert with check (true);
create policy "Anyone with the link can delete an expense"
  on public.gastos for delete using (true);

create index if not exists participantes_grupo_idx on public.participantes (grupo_id);
create index if not exists gastos_grupo_idx on public.gastos (grupo_id);

-- Waitlist de /waitlist con referidos. La tabla no tiene ninguna policy de
-- select/insert para anon: toda lectura y escritura pasa por las funciones
-- SECURITY DEFINER de abajo, que nunca devuelven emails ajenos, solo
-- posición numérica, el propio código de referido y un conteo.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  referral_code text not null unique,
  referred_by uuid references public.waitlist(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create index if not exists waitlist_created_idx on public.waitlist (created_at);
create index if not exists waitlist_referred_by_idx on public.waitlist (referred_by);

-- Contador público para "X personas ya están anotadas" en la landing, antes
-- de que alguien se anote (no requiere saber ningún email).
create or replace function public.waitlist_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*) from public.waitlist;
$$;

-- Anota un email (idempotente: si ya estaba anotado, devuelve su estado
-- actual en vez de fallar) y resuelve el referido por código si vino uno.
-- Devuelve solo lo que la pantalla de confirmación necesita mostrar.
create or replace function public.waitlist_signup(p_email text, p_ref_code text default null)
returns table(out_position bigint, out_referral_code text, out_invited_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_referrer_id uuid;
  v_code text;
  v_id uuid;
  v_created_at timestamptz;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;

  if p_ref_code is not null and length(trim(p_ref_code)) > 0 then
    select id into v_referrer_id from public.waitlist where referral_code = upper(trim(p_ref_code));
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.waitlist where referral_code = v_code);
  end loop;

  insert into public.waitlist (email, referral_code, referred_by)
  values (v_email, v_code, v_referrer_id)
  on conflict (email) do update set email = excluded.email
  returning id, created_at, waitlist.referral_code into v_id, v_created_at, v_code;

  select count(*) into out_position from public.waitlist where created_at <= v_created_at;
  select count(*) into out_invited_count from public.waitlist where referred_by = v_id;
  out_referral_code := v_code;
  return next;
end;
$$;

revoke all on public.waitlist from anon, authenticated;
grant execute on function public.waitlist_count() to anon, authenticated;
grant execute on function public.waitlist_signup(text, text) to anon, authenticated;
