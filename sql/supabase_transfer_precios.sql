-- Precios de transfer por destino y tipo, en reales. Ejecutar en el SQL Editor.
-- Es idempotente: se puede correr de nuevo.
--
-- QUE ES ESTO Y QUE NO ES
--
-- Es el precio que cobra la agencia, por destino y por modalidad, en reales.
-- No lleva nombre de agencia a proposito: el precio es del destino, no de quien
-- lo vendio. Si manana hay dos agencias para el mismo destino, lo que importa es
-- cuanto sale, no quien lo dijo.
--
-- NO es de donde saca su precio la web. Eso sale de data/transfer-precios.json,
-- que esta en dolares y tiene su fuente citada. Esta tabla es el dato crudo, en
-- la moneda en que se paga, para poder comparar, cotizar contra el operador y
-- decidir despues si la web tiene que mostrar esto o seguir con el modelo.
--
-- Por eso tiene columna moneda. Los precios de esta tabla vienen de
-- data/tabla-transfers.xlsx, y si un dia se decide que la moneda es otra, se
-- cambia el default y el nombre de la columna, no cada fila.


-- ---------------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------------
create table if not exists public.transfer_precios (
  -- La misma clave que DEST en lib/model.js. Sin esta fila el precio no se
  -- puede leer, porque "Buzios" no dice de que ciudad se trata.
  destino_key text not null,

  -- Dos filas por destino: una por modalidad. Se unan en (destino_key, tipo) y
  -- no en un solo numero, porque el compartido se paga por persona y el privado
  -- por vehiculo: son precios distintos, no dos versiones del mismo.
  tipo text not null check (tipo in ('compartido', 'privado')),

  -- El precio. En la moneda de la columna de al lado.
  precio numeric(10,2) check (precio is null or precio >= 0),
  -- 'BRL' es el default porque la planilla de la agencia esta en reales.
  moneda text not null default 'BRL',

  updated_at timestamptz not null default now(),

  primary key (destino_key, tipo)
);

comment on table public.transfer_precios is
  'Precio de transfer por destino y modalidad, en la moneda de la agencia. No es de donde saca su precio la web (eso es data/transfer-precios.json, en USD).';

comment on column public.transfer_precios.tipo is
  'compartido = por persona. privado = por vehiculo. No son dos versiones del mismo precio: el privado se paga una vez para todos los que van.';

create index if not exists transfer_precios_destino_idx on public.transfer_precios (destino_key);


-- ---------------------------------------------------------------------------
-- Cerrada al mundo
-- ---------------------------------------------------------------------------
-- El costo de un traslado es el dato que menos debe ver alguien que esta
-- buscando un vuelo. Mismo criterio que transfer_destinos, que esta en el mismo
-- archivo de script: RLS sin policies, y sin ningun grant.
alter table public.transfer_precios enable row level security;
revoke all on public.transfer_precios from anon, authenticated;

-- service_role SÍ necesita permiso, y no se lo da el bypass de RLS.
--
-- Los grants en Postgres son ACUMULATIVOS: revocar a anon y a authenticated no le
-- quita nada a service_role, pero tampoco se lo da. Sin esta linea la tabla
-- queda sin permiso para el rol que usan los scripts, y la carga falla con 403
-- y "permission denied for table transfer_precios".
--
-- Ojo con lo que dice el panel de la RLS: "service_role bypasses RLS". Es
-- cierto para las POLICIES, que no existen en esta tabla. El permiso de tabla va
-- aparte, y ese es el que faltaba.
grant select, insert, update on public.transfer_precios to service_role;

-- El server lee con la service role, que no pasa por RLS. El panel de la
-- agencia, si alguna vez lo hay, entra por el Dashboard de Supabase con la
-- sesion de postgres, que tampoco aplica la RLS. Por eso no hay ningun grant
-- para authenticated: nadie escribe desde el cliente.


-- ---------------------------------------------------------------------------
-- Como leerla desde el server
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER por el mismo motivo que las de public.tours: para que un
-- endpoint pueda devolver los precios sin abrirle la tabla al que tenga la anon
-- key, que va en el bundle.
create or replace function public.transfer_precios_por_destino(p_destino text)
returns table (tipo text, precio numeric, moneda text)
language sql
stable
security definer
set search_path = public
as $$
  select tp.tipo, tp.precio, tp.moneda
    from public.transfer_precios tp
   where tp.destino_key = p_destino
     and tp.precio is not null
   order by tp.tipo;
$$;

comment on function public.transfer_precios_por_destino(text) is
  'Precios de un destino, por modalidad. SECURITY DEFINER: no abre la tabla.';

grant execute on function public.transfer_precios_por_destino(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Verificacion, para correr despues de cargar
-- ---------------------------------------------------------------------------
-- Cuantos destinos tienen las dos modalidades y cuantos tienen una sola.
-- Los que tienen una sola van a caer al precio del modelo, y conviene saber
-- cuantos son antes de que alguien se pregunte por que un destino no cotiza.
--
-- select count(*) filter (where n = 2) as completos,
--        count(*) filter (where n = 1) as parciales
--   from (
--     select destino_key, count(*) as n
--       from public.transfer_precios
--      where precio is not null
--      group by destino_key
--   ) t;
