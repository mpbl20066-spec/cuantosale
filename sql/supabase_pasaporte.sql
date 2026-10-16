-- Pasaporte del explorador: XP verificado por el servidor y cupones de descuento.
--
-- El XP no se guarda como un numero sino como EVENTOS (uno por accion, con una clave unica por persona): asi
-- repetir una accion no suma dos veces, y el server pone los topes. El nivel y los cupones salen de la suma.
-- Lo lee y lo escribe solo lib/pasaporte.js con la service role; el navegador (anon key) no toca estas tablas.
-- Es idempotente: se puede correr las veces que haga falta.

create table if not exists public.pasaporte_eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  clave text not null,                 -- "visita:2026-10-10", "sello:rio", "guardar:<codigo del viaje>", "reserva:<codigo>"
  tipo text not null,                  -- visita | busqueda | sello | guardar | compartir | dividir | reserva
  nombre text not null default '',     -- etiqueta legible (el nombre del destino en los sellos)
  xp integer not null,
  creado timestamptz not null default now(),
  unique (user_id, clave)
);
create index if not exists pasaporte_eventos_user_idx on public.pasaporte_eventos (user_id, tipo);

-- Un cupon por nivel y por persona. usado_en se marca de forma atomica al canjearlo en una reserva.
create table if not exists public.cupones (
  codigo text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nivel integer not null,
  pct numeric not null,                -- 2, 3 o 5 (% de descuento)
  tope_usd numeric not null,           -- el descuento nunca pasa de este monto
  minimo_usd numeric not null,         -- compra minima para poder usarlo
  expira timestamptz not null,
  usado_en timestamptz,
  creado timestamptz not null default now(),
  unique (user_id, nivel)
);
create index if not exists cupones_user_idx on public.cupones (user_id);

alter table public.pasaporte_eventos enable row level security;
alter table public.cupones enable row level security;
drop policy if exists "pasaporte_eventos solo server" on public.pasaporte_eventos;
create policy "pasaporte_eventos solo server" on public.pasaporte_eventos for all using (false) with check (false);
drop policy if exists "cupones solo server" on public.cupones;
create policy "cupones solo server" on public.cupones for all using (false) with check (false);
grant select, insert, update, delete on public.pasaporte_eventos to service_role;
grant select, insert, update, delete on public.cupones to service_role;

-- Cupones en reales: un monto fijo en R$ (se descuenta en dolares al valor del dia) con tope en % de la reserva.
-- Los cupones viejos (en %) que nadie uso se borran para que se vuelvan a crear con el formato nuevo; los usados quedan.
alter table public.cupones add column if not exists monto_brl numeric;
alter table public.cupones add column if not exists tope_pct numeric;
delete from public.cupones where monto_brl is null and usado_en is null;
