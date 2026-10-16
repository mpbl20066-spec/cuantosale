-- Finanzas, etapa 1: transferencias que entran y salen, a que se asignan, lo que
-- les debemos a los proveedores y la auditoria. Ejecutar en el Supabase SQL
-- Editor. Es idempotente y ADITIVO: no cambia ni borra ninguna columna de
-- pedidos, proveedores ni tours. Para volver atras: sql/supabase_finanzas_1_revertir.sql.
--
--
-- LA IDEA
--
-- La plata se registra una sola vez, como MOVIMIENTO: una transferencia que entro
-- (cobro a un cliente) o que salio (Pix a un proveedor, reembolso). Cada
-- movimiento guarda su moneda e importe tal como estan en el banco.
--
-- Despues se ASIGNA a lo que paga: un cobro va a un pedido, un Pix va a una o
-- varias OBLIGACIONES (lo que le debemos al proveedor por un servicio). Asi una
-- transferencia puede pagar varias cosas y una cosa se puede pagar en partes,
-- sin copiar importes en dos lugares.
--
-- Un movimiento nace 'registrado' y pasa a 'verificado' solo a mano, despues de
-- verlo en el home banking, y con referencia o comprobante. No hay integracion
-- bancaria: nada se verifica solo.
--
-- Nada se borra: un movimiento o una asignacion equivocada se ANULA con motivo y
-- queda en la historia. Lo mismo las obligaciones.
--
--
-- MONEDAS
--
-- UYU, USD o BRL. Una asignacion guarda el importe en la moneda del movimiento y
-- el equivalente en la moneda de destino (los pedidos estan en USD). El tipo de
-- cambio queda fijo en la fila: nunca se recalcula.
--
--
-- MISMAS REGLAS QUE pedidos Y proveedores
--
-- RLS activado, sin policies, sin grants a anon ni a authenticated. Lo toca solo
-- el server con la service role, despues de validar la sesion de /admin.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Movimientos: transferencias que entran y salen
-- ---------------------------------------------------------------------------
create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  sentido text not null,
  medio text not null default 'transferencia',
  -- De que cuenta nuestra sale o a cual entra, ej. "BROU pesos", "Itaú dólares", "Pix".
  cuenta text not null default '',
  fecha date not null,
  moneda text not null,
  importe numeric(14,2) not null,
  -- Numero de operacion del banco o id del Pix (E2E). Es lo que evita duplicados.
  referencia text not null default '',
  -- Quien manda o recibe (nombre del cliente, del proveedor).
  contraparte text not null default '',
  nota text not null default '',
  estado text not null default 'registrado',
  verificado_por text not null default '',
  verificado_at timestamptz,
  anulado_por text not null default '',
  anulado_at timestamptz,
  anulado_motivo text not null default '',
  -- Ruta del archivo en el bucket privado 'comprobantes'. Nunca una URL publica.
  comprobante text not null default '',
  -- sentido|moneda|importe|fecha|referencia (o contraparte si no hay referencia),
  -- normalizado. Ver lib/finanzas.js (huella).
  huella text not null,
  creado_por text not null default '',
  creado_at timestamptz not null default now(),
  constraint movimientos_sentido check (sentido in ('entrada', 'salida')),
  constraint movimientos_medio check (medio in ('transferencia', 'pix', 'deposito', 'efectivo', 'otro')),
  constraint movimientos_moneda check (moneda in ('UYU', 'USD', 'BRL')),
  constraint movimientos_importe check (importe > 0),
  constraint movimientos_estado check (estado in ('registrado', 'verificado', 'anulado')),
  -- Verificado tiene que decir quien y cuando, y tener referencia o comprobante.
  constraint movimientos_verificado check (estado <> 'verificado' or (verificado_at is not null and verificado_por <> '' and (referencia <> '' or comprobante <> ''))),
  constraint movimientos_anulado check (estado <> 'anulado' or (anulado_at is not null and anulado_motivo <> ''))
);
-- La misma transferencia no entra dos veces (salvo que la primera este anulada).
create unique index if not exists movimientos_huella_unica on public.movimientos (huella) where estado <> 'anulado';
create index if not exists movimientos_fecha_idx on public.movimientos (fecha desc);
create index if not exists movimientos_estado_idx on public.movimientos (estado);

-- ---------------------------------------------------------------------------
-- Obligaciones: lo que le debemos a un proveedor por un servicio de un pedido
-- ---------------------------------------------------------------------------
-- El servicio vive dentro de pedidos.items (jsonb), por eso va su id como texto
-- y una copia del nombre: si el pedido cambia, la obligacion sigue legible.
create table if not exists public.obligaciones (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references public.proveedores(id) on delete set null,
  proveedor_nombre text not null default '',
  pedido_id uuid references public.pedidos(id) on delete set null,
  pedido_ref text not null default '',
  item_id text not null default '',
  servicio text not null default '',
  concepto text not null default 'total',
  moneda text not null,
  importe numeric(14,2) not null,
  vence date,
  nota text not null default '',
  estado text not null default 'abierta',
  anulada_por text not null default '',
  anulada_at timestamptz,
  anulada_motivo text not null default '',
  creado_por text not null default '',
  creado_at timestamptz not null default now(),
  constraint obligaciones_concepto check (concepto in ('sena', 'saldo', 'total', 'penalidad', 'ajuste')),
  constraint obligaciones_moneda check (moneda in ('UYU', 'USD', 'BRL')),
  constraint obligaciones_importe check (importe > 0),
  constraint obligaciones_estado check (estado in ('abierta', 'anulada')),
  constraint obligaciones_anulada check (estado <> 'anulada' or (anulada_at is not null and anulada_motivo <> ''))
);
create index if not exists obligaciones_proveedor_idx on public.obligaciones (proveedor_id);
create index if not exists obligaciones_pedido_idx on public.obligaciones (pedido_id);
create index if not exists obligaciones_vence_idx on public.obligaciones (vence) where estado = 'abierta';

-- ---------------------------------------------------------------------------
-- Asignaciones: que paga cada movimiento
-- ---------------------------------------------------------------------------
--   cobro      entrada  -> pedido       (el cliente nos paga)
--   pago       salida   -> obligacion   (le pagamos al proveedor)
--   reembolso  salida   -> pedido       (le devolvemos al cliente)
create table if not exists public.asignaciones (
  id uuid primary key default gen_random_uuid(),
  -- restrict: un movimiento con asignaciones no se puede borrar (se anula).
  movimiento_id uuid not null references public.movimientos(id) on delete restrict,
  tipo text not null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  pedido_ref text not null default '',
  obligacion_id uuid references public.obligaciones(id) on delete restrict,
  -- En la moneda del movimiento.
  importe numeric(14,2) not null,
  -- En la moneda de lo que se paga (USD para pedidos, la de la obligacion). Igual
  -- a importe si las monedas coinciden. tc = importe_destino / importe, fijo.
  moneda_destino text not null,
  importe_destino numeric(14,2) not null,
  tc numeric(14,6) not null default 1,
  nota text not null default '',
  anulada boolean not null default false,
  anulada_por text not null default '',
  anulada_at timestamptz,
  anulada_motivo text not null default '',
  creado_por text not null default '',
  creado_at timestamptz not null default now(),
  constraint asignaciones_tipo check (tipo in ('cobro', 'pago', 'reembolso')),
  constraint asignaciones_importe check (importe > 0 and importe_destino > 0 and tc > 0),
  constraint asignaciones_moneda check (moneda_destino in ('UYU', 'USD', 'BRL')),
  constraint asignaciones_destino check (
    (tipo = 'pago' and obligacion_id is not null) or (tipo in ('cobro', 'reembolso') and pedido_id is not null)
  ),
  constraint asignaciones_anulada check (not anulada or (anulada_at is not null and anulada_motivo <> ''))
);
create index if not exists asignaciones_mov_idx on public.asignaciones (movimiento_id);
create index if not exists asignaciones_obl_idx on public.asignaciones (obligacion_id) where obligacion_id is not null;
create index if not exists asignaciones_ped_idx on public.asignaciones (pedido_id) where pedido_id is not null;

-- ---------------------------------------------------------------------------
-- Auditoria: quien hizo que y cuando. Solo se agrega.
-- ---------------------------------------------------------------------------
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  usuario text not null default '',
  ip text not null default '',
  entidad text not null,
  entidad_id text not null default '',
  accion text not null,
  antes jsonb,
  despues jsonb
);
create index if not exists auditoria_entidad_idx on public.auditoria (entidad, entidad_id, at desc);
create index if not exists auditoria_at_idx on public.auditoria (at desc);

-- Ni el server puede editar ni borrar una fila de auditoria.
create or replace function public.auditoria_solo_agregar() returns trigger
language plpgsql as $$
begin
  raise exception 'La auditoria no se edita ni se borra.';
end;
$$;
drop trigger if exists auditoria_inmutable on public.auditoria;
create trigger auditoria_inmutable before update or delete on public.auditoria
  for each row execute function public.auditoria_solo_agregar();

-- Los movimientos tampoco se borran: se anulan.
create or replace function public.finanzas_no_borrar() returns trigger
language plpgsql as $$
begin
  raise exception 'Los registros de plata no se borran: se anulan con motivo.';
end;
$$;
drop trigger if exists movimientos_no_borrar on public.movimientos;
create trigger movimientos_no_borrar before delete on public.movimientos
  for each row execute function public.finanzas_no_borrar();
drop trigger if exists obligaciones_no_borrar on public.obligaciones;
create trigger obligaciones_no_borrar before delete on public.obligaciones
  for each row execute function public.finanzas_no_borrar();
drop trigger if exists asignaciones_no_borrar on public.asignaciones;
create trigger asignaciones_no_borrar before delete on public.asignaciones
  for each row execute function public.finanzas_no_borrar();

-- ---------------------------------------------------------------------------
-- Comprobantes: bucket PRIVADO. Se ven solo por un link firmado que arma el
-- server para /admin y vence en 5 minutos.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 3145728, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------------
-- Llave: con activo=false el panel no muestra ni deja cargar nada de Finanzas.
-- "on conflict do nothing": correr esto de nuevo no la vuelve a prender.
-- ---------------------------------------------------------------------------
insert into public.operaciones_config (clave, valor, actualizado_por) values
  ('finanzas', '{"activo": true}', 'sql/supabase_finanzas_1.sql')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Cerradas
-- ---------------------------------------------------------------------------
alter table public.movimientos enable row level security;
alter table public.obligaciones enable row level security;
alter table public.asignaciones enable row level security;
alter table public.auditoria enable row level security;
revoke all on public.movimientos, public.obligaciones, public.asignaciones, public.auditoria from anon, authenticated;
grant select, insert, update on public.movimientos, public.obligaciones, public.asignaciones to service_role;
grant select, insert on public.auditoria to service_role;

notify pgrst, 'reload schema';
