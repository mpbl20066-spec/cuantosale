-- Alertas de precio de vuelos (lib/alertas.js).
-- Correr una vez en Supabase: SQL Editor -> pegar esto -> Run.
--
-- Una fila por vuelo que alguien sigue: destino, fechas y pasajeros, con el precio total (ida y vuelta, todos los
-- pasajeros, en USD) del vuelo mas barato. Todo el acceso pasa por el server con la service role: el navegador no lee
-- ni escribe esta tabla directo, por eso RLS queda prendido y sin politicas.
-- Al borrar la cuenta se borran sus alertas (on delete cascade).

create table if not exists public.alertas_precio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  nombre text,
  destino text not null,                 -- clave del destino (rio, fln...)
  fecha_ida date not null,
  fecha_vuelta date not null,
  pasajeros int not null check (pasajeros between 1 and 9),
  precio_inicial numeric(10, 2) not null, -- al crear la alerta
  precio_referencia numeric(10, 2) not null, -- contra el que se mide la baja: el inicial o el del ultimo aviso
  precio_ultimo numeric(10, 2),          -- el de la ultima revision
  revisada_at timestamptz,
  avisada_at timestamptz,
  avisos int not null default 0,
  activa boolean not null default true,
  fin text,                              -- por que termino: 'baja' (la persona), 'vencida' (paso la fecha)
  created_at timestamptz not null default now()
);

create index if not exists alertas_precio_activas on public.alertas_precio (activa, revisada_at);
create index if not exists alertas_precio_usuario on public.alertas_precio (user_id, activa);

alter table public.alertas_precio enable row level security;

-- Este proyecto no da permisos por defecto a las tablas nuevas: sin esto el server recibe 403.
grant select, insert, update, delete on public.alertas_precio to service_role;
