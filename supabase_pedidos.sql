-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- Tablas del panel /admin: los pedidos (solicitudes de reserva de los clientes) y
-- los proveedores a los que CuantoSale les terceriza cada servicio.
--
-- Las dos quedan con RLS activada y SIN policies, y sin ningun grant para anon ni
-- authenticated: nadie las lee ni las escribe desde el navegador. Solo las toca el
-- server de la app con la service role (SUPABASE_SERVICE_KEY), despues de validar
-- el usuario y la contrasena del admin. Tienen datos personales de clientes
-- (nombre, telefono, email) y las cuentas del negocio; no pueden ser publicas.
--
-- `items` y `pagos` son jsonb a proposito: un pedido es una unidad que se edita
-- entera desde el panel, y asi no hay joins ni escrituras a medias.
--   items: [{ id, tipo, nombre, detalle, precio_usd, proveedor_id, proveedor_nombre,
--             costo_usd, pagado_proveedor_usd, estado, ref_proveedor, notas }]
--   pagos: [{ id, fecha, monto_usd, medio, nota }]   -- cobros hechos por el cliente

create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text not null default '',
  telefono text not null default '',
  email text not null default '',
  servicios text not null default '',
  datos_pago text not null default '',
  notas text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'en_gestion', 'confirmado', 'completado', 'cancelado')),
  cliente_nombre text not null default '',
  cliente_telefono text not null default '',
  cliente_email text not null default '',
  destino text not null default '',
  fecha_ida date,
  fecha_vuelta date,
  fechas_txt text not null default '',
  personas integer not null default 1 check (personas > 0),
  personas_txt text not null default '',
  medio_pago text not null default '',
  notas text not null default '',
  origen text not null default 'web',
  total_usd numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  pagos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pedidos_created_idx on public.pedidos (created_at desc);
create index if not exists pedidos_estado_idx on public.pedidos (estado);

alter table public.proveedores enable row level security;
alter table public.pedidos enable row level security;
revoke all on public.proveedores from anon, authenticated;
revoke all on public.pedidos from anon, authenticated;
