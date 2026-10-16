-- Reservas operativas: pasajeros de cada pedido y ficha de cada cliente. Ejecutar en el Supabase SQL Editor.
-- Es idempotente y ADITIVO: agrega una columna a pedidos (vacia por defecto) y una tabla nueva. No cambia ni
-- borra nada de lo que ya existe. Para volver atras: sql/supabase_operativa_1_revertir.sql.
--
-- La fecha, la hora y el pickup de cada servicio NO necesitan SQL: viven dentro de pedidos.items (jsonb), como el
-- costo y el proveedor.
--
-- Mismas reglas que pedidos: RLS activado, sin policies, sin grants a anon ni a authenticated. Hay documentos y
-- edades de pasajeros: solo los lee el server con la service role, despues de validar la sesion de /admin.

-- ---------------------------------------------------------------------------
-- Pasajeros del pedido: [{ "nombre", "documento", "edad", "nota" }]
-- ---------------------------------------------------------------------------
alter table public.pedidos add column if not exists pasajeros jsonb not null default '[]'::jsonb;
comment on column public.pedidos.pasajeros is
  'Pasajeros: nombre, documento, edad y requerimientos especiales. Solo /admin. Lo valida lib/pedidos.js (limpiarPasajero).';

-- ---------------------------------------------------------------------------
-- Ficha del cliente: lo que no es de un pedido sino de la persona
-- ---------------------------------------------------------------------------
-- Un cliente es su telefono (o su email si no dejo telefono): clave 'tel:59899123456' o 'mail:ana@x.com'. Los
-- pedidos no se tocan: la ficha se cruza con ellos por esa clave (ver lib/operativa.js, claveCliente).
create table if not exists public.clientes_fichas (
  clave text primary key,
  pais text not null default '',
  -- Se muestra en rojo en la ficha del pedido y en la agenda: "Requiere silla de bebe", "Vuelo con demoras".
  alerta text not null default '',
  notas text not null default '',
  actualizado_at timestamptz not null default now(),
  actualizado_por text not null default '',
  constraint clientes_fichas_clave check (clave ~ '^(tel:[0-9]{8,15}|mail:.+@.+)$')
);

alter table public.clientes_fichas enable row level security;
revoke all on public.clientes_fichas from anon, authenticated;
grant select, insert, update on public.clientes_fichas to service_role;

notify pgrst, 'reload schema';
