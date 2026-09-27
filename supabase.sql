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

-- Estas tablas se crean por SQL Editor, así que a diferencia de trips/user_trips
-- (creadas antes, probablemente con grants ya aplicados) necesitan el GRANT
-- explícito: RLS solo filtra filas, no reemplaza el permiso de tabla.
grant select, insert, update on public.reservas_hoteles to authenticated;

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
  -- Transferencias ya saldadas, por par y con su importe: {"bruno|paola": 13251941721.22}.
  -- Es un jsonb y no una tabla aparte porque nobody tiene cuenta: el link del
  -- grupo es la contraseña, así que no hay a quién auditear y alcanza con no
  -- volver a mostrar lo ya pagado.
  -- El importe va adentro, y no solo el par, porque el greedy de saldas
  -- recalcula los montos cada vez que se agrega o borra un gasto. Con la clave
  -- del par sola, un gasto nuevo que volviera a generar esa pareja salía con el
  -- tilde de "Pagado" y el dinero nuevo desaparecía de la lista. Guardando el
  -- monto, lo pagado se descuenta del saldo antes de repartir.
  -- Los grupos creados antes de esto tienen ["quien|quien"] (el par, sin
  -- importe). La app los lee igual y completa el importe una vez, al cargar, sin
  -- migración: no hay que correr nada contra la base.
  saldos jsonb not null default '[]'::jsonb,
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
-- Necesario para marcar una transferencia como pagada. El alcance es el mismo
-- que el delete de gastos: cualquiera con el link toca la fila del grupo.
create policy "Anyone with the link can update a group"
  on public.grupos_viaje for update using (true) with check (true);

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

-- Link de grupo = "contraseña" del grupo, así que anon también necesita
-- poder leer/escribir a nivel de tabla (las policies de arriba ya acotan qué
-- filas puede tocar cada quien).
grant select, insert, update on public.grupos_viaje to anon, authenticated;
grant select, insert on public.participantes to anon, authenticated;
grant select, insert, delete on public.gastos to anon, authenticated;

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

-- Órdenes de vuelo cobradas con tarjeta a través de Duffel.
--
-- SIN USO desde que los vuelos se consultan con SerpAPI. SerpAPI devuelve
-- precios y un link a Google Flights: no emite boletos, no cobra y no hay PNR,
-- así que ya no se crea ninguna orden de vuelo desde la app. La tabla queda
-- como está a propósito: borrarla es una operación destructiva y hay que
-- confirmar antes contra la base real que no quedó ninguna fila que valga.
-- Si se confirma, el drop es:
--   drop table if exists public.vuelos_ordenes cascade;  -- más el nombre real
--
-- Es distinta de reservas_hoteles: aquella es de Travelpayouts (4-5% sobre
-- reservas de Booking, que se cobran 60-90 días después y llegan sin nuestro
-- user_id). Acá el cobro es inmediato y sincrónico contra nuestro propio
-- pedido, así que sí se puede associate al user_id y, sobre todo, se guarda
-- el desglose del markup para saber cuánto se ganó de verdad.
--
-- La escribe el navegador con la clave anónima después de que el servidor
-- devuelve 201, por eso la RLS puede seguir atando cada fila a su usuario.
-- `cost` y `markup_amount` vienen del server (que relee la oferta en Duffel),
-- nunca del cliente: si se pudieran alterar, la conciliación no valdría.
create table if not exists public.ordenes_vuelo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  duffel_order_id text not null unique,
  duffel_offer_id text,
  booking_reference text,
  airline text,
  origin text,
  destination text,
  departure_date date,
  return_date date,
  passengers integer not null default 1 check (passengers > 0),
  cost numeric not null check (cost >= 0),
  markup_amount numeric not null check (markup_amount >= 0),
  markup_percent numeric not null check (markup_percent >= 0),
  charged numeric not null check (charged > 0),
  currency text not null default 'USD',
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'cancelled', 'refunded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ordenes_vuelo enable row level security;

create policy "Users can read their own flight orders"
  on public.ordenes_vuelo for select
  using (auth.uid() = user_id);

create policy "Users can insert their own flight orders"
  on public.ordenes_vuelo for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own flight orders"
  on public.ordenes_vuelo for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists ordenes_vuelo_user_created_idx
  on public.ordenes_vuelo (user_id, created_at desc);

-- Conciliación: cuánto se facturó y cuánto se ganó, por mes y por markup.
-- Ahora mismo no hay política de select para anon: la vista es solo de la
-- persona dueña. Para el negocio se lee con credenciales de servidor.
create or replace function public.ingresos_vuelo_mensual(p_mes date)
returns table(ordenes bigint, facturado numeric, costo numeric, margen numeric, margen_pct numeric)
language sql
security definer
set search_path = public
as $$
  select
    count(*),
    coalesce(sum(charged), 0),
    coalesce(sum(cost), 0),
    coalesce(sum(markup_amount), 0),
    case when coalesce(sum(charged), 0) > 0
      then round((sum(markup_amount) / sum(charged) * 100)::numeric, 2)
      else 0 end
  from public.ordenes_vuelo
  where status = 'confirmed'
    and date_trunc('month', created_at)::date = p_mes;
$$;

revoke all on public.ordenes_vuelo from anon;
grant execute on function public.ingresos_vuelo_mensual(date) to authenticated;
