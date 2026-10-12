-- Modulo de Operaciones: proveedores, servicios, precios publicados, cola de
-- cambios, historial e importaciones. Ejecutar en el Supabase SQL Editor.
-- Es idempotente y ADITIVO: no cambia tours_todos, tours_para_cliente ni nada
-- que la web use hoy. Correrlo no mueve ningun precio.
--
--
-- LA IDEA
--
-- Hasta ahora el precio que veia la web se calculaba en cada lectura:
-- precio_brl / cotizacion + margen, con la cotizacion y el margen escritos en
-- data/tours.json. Cambiar la cotizacion cambiaba los 105 precios de golpe y sin
-- que nadie los mirara.
--
-- Desde aca la fila del tour guarda dos cosas separadas:
--
--   - el PRECIO DE ORIGEN: lo que cobra el proveedor (precio_brl o precio, con
--     su unidad y capacidad). Las columnas de siempre.
--   - el PRECIO PUBLICADO: lo que ve la web, en dolares por persona, ya con
--     cotizacion y margen. Es un numero fijo que solo cambia cuando alguien
--     publica desde el panel.
--
-- Todo cambio pasa por precio_cambios: primero como 'pendiente' (la fila del
-- tour no se toca), y al publicarlo se aplica a la fila y queda como historial.
-- La fila del tour es siempre lo publicado; lo que no se publico vive en la cola.
--
--
-- MISMAS REGLAS QUE tours Y proveedores
--
-- RLS activado, sin policies, sin grants a anon ni a authenticated. Lo toca solo
-- el server con la service role, despues de validar la sesion de /admin. Aca hay
-- costos y margenes: no pueden llegar al navegador.


-- ---------------------------------------------------------------------------
-- Proveedores: se amplia la tabla que ya usan los pedidos
-- ---------------------------------------------------------------------------
-- No se crea otra tabla de operadores a proposito: un pedido y un tour tienen que
-- apuntar al MISMO proveedor, si no las cuentas por pagar y el catalogo se
-- separan.
alter table public.proveedores
  add column if not exists web text not null default '',
  add column if not exists whatsapp text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists cadastur text not null default '',
  add column if not exists region text not null default '',
  -- Texto libre, ej. "Recife | Porto de Galinhas". Los servicios llevan su
  -- destino propio; esto es para buscar y filtrar el directorio.
  add column if not exists destinos text not null default '',
  add column if not exists moneda text not null default 'BRL',
  add column if not exists condiciones text not null default '',
  add column if not exists espanol text not null default '',
  -- Lo que conviene saber antes de cotizarle (el "avisos_operador" del CSV).
  add column if not exists avisos text not null default '',
  -- Margen propio del proveedor. Null = usa el general de operaciones_config.
  add column if not exists margen_tipo text,
  add column if not exists margen_valor numeric(10,2),
  -- Papelera: no se borra, se esconde. Un proveedor con pedidos viejos no se
  -- puede borrar sin romper el historial de esos pedidos.
  add column if not exists eliminado_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.proveedores add constraint proveedores_margen_tipo
    check (margen_tipo is null or margen_tipo in ('usd', 'pct'));
exception when duplicate_object then null; end $$;

create index if not exists proveedores_nombre_idx on public.proveedores (lower(nombre));


-- ---------------------------------------------------------------------------
-- Servicios: se amplia la tabla tours
-- ---------------------------------------------------------------------------
-- Sigue llamandose tours para no romper nada, pero ahora tambien guarda
-- traslados y paseos en barco que trae el directorio de operadores.
alter table public.tours
  add column if not exists proveedor_id uuid references public.proveedores(id) on delete set null,
  add column if not exists tipo text not null default 'tour',
  -- A que corresponde el precio de origen. La web suma precios por persona, asi
  -- que un precio por vehiculo se publica dividido por la capacidad.
  add column if not exists unidad text not null default 'persona',
  add column if not exists capacidad integer,
  -- Margen propio del servicio. Null = el del proveedor, y si no, el general.
  add column if not exists margen_tipo text,
  add column if not exists margen_valor numeric(10,2),
  -- Lo que ve la web: USD por persona, ya con cotizacion y margen.
  add column if not exists precio_publicado numeric(10,2),
  add column if not exists publicado_at timestamptz,
  -- 'pendiente' = falta completar algo (unidad, destino, precio) antes de poder
  -- publicarlo. El motivo dice que.
  add column if not exists revision text not null default 'ok',
  add column if not exists revision_motivo text not null default '';

do $$ begin
  alter table public.tours add constraint tours_tipo
    check (tipo in ('tour', 'actividad', 'traslado', 'barco', 'otro'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tours add constraint tours_unidad
    check (unidad in ('persona', 'vehiculo', 'grupo', 'embarcacion', 'tramo'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tours add constraint tours_capacidad
    check (capacidad is null or capacidad > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tours add constraint tours_margen_tipo
    check (margen_tipo is null or margen_tipo in ('usd', 'pct'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tours add constraint tours_publicado_no_negativo
    check (precio_publicado is null or precio_publicado >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tours add constraint tours_revision
    check (revision in ('ok', 'pendiente'));
exception when duplicate_object then null; end $$;

create index if not exists tours_proveedor_idx on public.tours (proveedor_id);

comment on column public.tours.precio_publicado is
  'USD por persona que ve la web. Solo lo cambia una publicacion desde /admin. Null = la web lo calcula como antes (precio_brl / cotizacion + margen).';
comment on column public.tours.unidad is
  'A que corresponde el precio de origen: persona, vehiculo, grupo, embarcacion o tramo. Si no es persona, capacidad dice entre cuantos se divide.';


-- ---------------------------------------------------------------------------
-- Configuracion de precios
-- ---------------------------------------------------------------------------
-- Cotizacion y margen general. Reemplazan _meta de data/tours.json como lugar
-- donde se decide el numero, pero cambiarlos NO mueve precios: genera cambios
-- pendientes para revisar.
create table if not exists public.operaciones_config (
  clave text primary key,
  valor jsonb not null,
  actualizado_at timestamptz not null default now(),
  actualizado_por text not null default ''
);

-- Los valores de hoy, los mismos de data/tours.json. "on conflict do nothing":
-- correr esto de nuevo no pisa lo que se haya cambiado desde el panel.
insert into public.operaciones_config (clave, valor, actualizado_por) values
  ('cotizacion_brl_usd', '{"valor": 5.1414, "fuente": "PTAX 23/09/2026"}', 'inicial'),
  ('margen', '{"tipo": "usd", "valor": 5}', 'inicial'),
  ('dias_desactualizado', '{"valor": 90}', 'inicial')
on conflict (clave) do nothing;


-- ---------------------------------------------------------------------------
-- Cola de cambios e historial (una sola tabla)
-- ---------------------------------------------------------------------------
-- Cada fila es un cambio a un servicio. Nace 'pendiente'; al publicarlo pasa a
-- 'publicado' y queda como historial. Volver atras no borra nada: crea un
-- cambio nuevo con origen 'reversion' y los valores de antes.
create table if not exists public.precio_cambios (
  id uuid primary key default gen_random_uuid(),
  -- set null y no cascade: borrar un servicio no puede borrar su historial.
  -- Por eso tambien va la clave legible, que sobrevive al borrado.
  tour_id uuid references public.tours(id) on delete set null,
  tour_clave text not null default '',
  origen text not null,
  importacion_id uuid,
  -- Solo los campos que cambian: {"precio_brl": 180, "unidad": "persona"}.
  antes jsonb not null default '{}',
  despues jsonb not null default '{}',
  publicado_antes numeric(10,2),
  publicado_despues numeric(10,2),
  fuente text not null default '',
  nota text not null default '',
  estado text not null default 'pendiente',
  creado_por text not null default '',
  creado_at timestamptz not null default now(),
  resuelto_por text not null default '',
  resuelto_at timestamptz,
  constraint precio_cambios_origen check (origen in ('manual', 'importacion', 'ajuste', 'cotizacion', 'reversion', 'inicial')),
  constraint precio_cambios_estado check (estado in ('pendiente', 'publicado', 'descartado', 'reemplazado'))
);

-- Un solo pendiente por servicio: un cambio nuevo reemplaza al anterior en vez
-- de apilarse, asi lo que se revisa es siempre el estado final propuesto.
create unique index if not exists precio_cambios_un_pendiente
  on public.precio_cambios (tour_id) where estado = 'pendiente';
create index if not exists precio_cambios_tour_idx on public.precio_cambios (tour_id, creado_at desc);
create index if not exists precio_cambios_fecha_idx on public.precio_cambios (creado_at desc);


-- ---------------------------------------------------------------------------
-- Importaciones
-- ---------------------------------------------------------------------------
create table if not exists public.importaciones (
  id uuid primary key default gen_random_uuid(),
  archivo text not null default '',
  -- Nombre de la plantilla de columnas usada, ej. "directorio-operadores".
  plantilla text not null default '',
  mapeo jsonb not null default '{}',
  -- {"nuevos": 12, "actualiza": 30, "sin_cambios": 400, "errores": 4}
  totales jsonb not null default '{}',
  estado text not null default 'borrador',
  creado_por text not null default '',
  creado_at timestamptz not null default now(),
  confirmado_at timestamptz,
  constraint importaciones_estado check (estado in ('borrador', 'confirmada', 'descartada', 'fallida'))
);

create table if not exists public.importacion_filas (
  id uuid primary key default gen_random_uuid(),
  importacion_id uuid not null references public.importaciones(id) on delete cascade,
  n integer not null,
  datos jsonb not null default '{}',
  accion text not null,
  errores jsonb not null default '[]',
  tour_id uuid references public.tours(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  constraint importacion_filas_accion check (accion in ('nuevo', 'actualiza', 'sin_cambios', 'error', 'omitida'))
);

create index if not exists importacion_filas_imp_idx on public.importacion_filas (importacion_id, n);


-- ---------------------------------------------------------------------------
-- Alias de destino
-- ---------------------------------------------------------------------------
-- Los archivos traen "Porto de Galinhas" o "Búzios"; la web usa la key de
-- lib/model.js ("pdg", "buz"). El alias se guarda normalizado (minusculas, sin
-- acentos). Un nombre sin alias es un error en la vista previa, no un tour
-- invisible.
create table if not exists public.destino_alias (
  alias text primary key,
  destino text not null,
  creado_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- Lectura para la web
-- ---------------------------------------------------------------------------
-- Como tours_todos, pero trae el precio publicado y el de origen crudos: lib/tours.js
-- usa el publicado y, si una fila todavia no lo tiene, calcula como antes. No
-- trae costos de convenio (neto, comision) ni margenes.
--
-- Solo service_role: es la lectura del server. tours_todos queda como estaba
-- para no romper el panel /tours mientras exista.
create or replace function public.tours_publicados()
returns table (
  destino text,
  titulo text,
  descripcion text,
  precio numeric,
  precio_brl numeric,
  precio_publicado numeric,
  detalle text,
  fuente text,
  verificado date
)
language sql
stable
security definer
set search_path = public
as $$
  select t.destino, t.titulo, t.descripcion, t.precio, t.precio_brl, t.precio_publicado,
         t.detalle, t.fuente, t.verificado
  from public.tours t
  where t.activo and t.revision = 'ok'
  order by t.destino, t.orden, t.titulo;
$$;

comment on function public.tours_publicados() is
  'Tours activos y revisados con su precio publicado (USD por persona). La lee lib/tours.js con la service role.';


-- ---------------------------------------------------------------------------
-- Cerradas
-- ---------------------------------------------------------------------------
alter table public.operaciones_config enable row level security;
alter table public.precio_cambios enable row level security;
alter table public.importaciones enable row level security;
alter table public.importacion_filas enable row level security;
alter table public.destino_alias enable row level security;

revoke all on public.operaciones_config, public.precio_cambios, public.importaciones,
  public.importacion_filas, public.destino_alias from anon, authenticated;
grant select, insert, update, delete on public.operaciones_config, public.precio_cambios,
  public.importaciones, public.importacion_filas, public.destino_alias to service_role;

revoke all on function public.tours_publicados() from public, anon, authenticated;
grant execute on function public.tours_publicados() to service_role;
