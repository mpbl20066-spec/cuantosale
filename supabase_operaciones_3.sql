-- Modulo de Operaciones: comparar ofertas de proveedores y traslados en la base.
-- Ejecutar en el Supabase SQL Editor DESPUES de supabase_operaciones.sql y _2.
-- Idempotente y aditivo: no mueve ningun precio.


-- ---------------------------------------------------------------------------
-- Ofertas para comparar
-- ---------------------------------------------------------------------------
-- Cuando un archivo trae un paseo parecido a uno que ya esta (o el mismo paseo de
-- otro operador), no se importa como nuevo: queda como alternativa de ese servicio,
-- apagada, para compararla en el panel y elegir con que proveedor quedarse.
-- Nunca se ve en la web: esta apagada y sin precio publicado.
alter table public.tours
  add column if not exists alternativa_de uuid references public.tours(id) on delete set null;

create index if not exists tours_alternativa_idx on public.tours (alternativa_de) where alternativa_de is not null;

comment on column public.tours.alternativa_de is
  'Oferta de otro proveedor para comparar con ese servicio. Se resuelve en /admin: quedarse con el propio, usar este operador o publicar los dos.';


-- ---------------------------------------------------------------------------
-- Traslados (aeropuerto -> hotel) por destino
-- ---------------------------------------------------------------------------
-- Una fila por destino con el MISMO registro que data/transfer-precios.json. Lo
-- que esta aca gana sobre el JSON (lib/traslados.js); el JSON queda de respaldo.
-- publicado = lo que ve la web. borrador = un cambio guardado sin publicar.
create table if not exists public.traslados (
  destino text primary key,
  publicado jsonb not null,
  borrador jsonb,
  borrador_por text not null default '',
  borrador_at timestamptz,
  actualizado_at timestamptz not null default now(),
  actualizado_por text not null default ''
);

create table if not exists public.traslados_historial (
  id uuid primary key default gen_random_uuid(),
  destino text not null,
  antes jsonb,
  despues jsonb,
  nota text not null default '',
  por text not null default '',
  at timestamptz not null default now()
);
create index if not exists traslados_historial_idx on public.traslados_historial (destino, at desc);

-- La cotizacion de los traslados es aparte de la de los tours: la planilla de
-- transfers ya trae el precio final de venta y se paso a dolares a 5,2, sin margen.
insert into public.operaciones_config (clave, valor, actualizado_por) values
  ('cotizacion_traslados', '{"valor": 5.2, "fuente": "Planilla de transfers"}', 'inicial')
on conflict (clave) do nothing;

alter table public.traslados enable row level security;
alter table public.traslados_historial enable row level security;
revoke all on public.traslados, public.traslados_historial from anon, authenticated;
grant select, insert, update, delete on public.traslados, public.traslados_historial to service_role;
