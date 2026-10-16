-- Modulo de Operaciones, etapa 3: papelera de servicios e importacion.
-- Ejecutar en el Supabase SQL Editor DESPUES de sql/supabase_operaciones.sql.
-- Idempotente: se puede correr de nuevo sin romper nada. No mueve ningun precio.


-- ---------------------------------------------------------------------------
-- Papelera de servicios
-- ---------------------------------------------------------------------------
-- Mandar un servicio a la papelera lo saca de la web en el momento (ademas lo
-- apaga) pero no lo borra: se puede recuperar. Borrarlo para siempre es otro
-- paso, y aun asi su historial de precios queda (precio_cambios.tour_id pasa a null).
alter table public.tours
  add column if not exists eliminado_at timestamptz;

comment on column public.tours.eliminado_at is
  'Papelera: con fecha, el servicio no se ve en la web ni en el panel salvo en la vista Papelera.';


-- ---------------------------------------------------------------------------
-- Lectura para la web
-- ---------------------------------------------------------------------------
-- Igual que antes, mas dos filtros:
--   - nada que este en la papelera;
--   - ningun traslado. Los traslados del directorio de operadores quedan en el
--     catalogo como referencia; la web calcula los traslados aparte
--     (data/transfer-precios.json) y mostrarlos aca los pondria como tarjetas de tour.
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
  where t.activo and t.revision = 'ok' and t.eliminado_at is null and t.tipo <> 'traslado'
  order by t.destino, t.orden, t.titulo;
$$;

revoke all on function public.tours_publicados() from public, anon, authenticated;
grant execute on function public.tours_publicados() to service_role;
