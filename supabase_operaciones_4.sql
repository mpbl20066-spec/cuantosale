-- Modulo de Operaciones: hasta 3 fotos por servicio.
-- Ejecutar en el Supabase SQL Editor. Idempotente; no mueve ningun precio.
--
-- La tarjeta del tour usa una foto (url_imagen, la primera elegida) y el detalle
-- muestra una galeria de hasta 3 (galeria). Antes la galeria salia solo de
-- data/tour-galerias.json; lo que se elige en el panel gana sobre eso.

alter table public.tours
  add column if not exists galeria jsonb not null default '[]'::jsonb;

comment on column public.tours.galeria is
  'Hasta 3 URLs de fotos (las del operador copiadas al bucket tours). La primera es la portada (url_imagen).';

-- tours_ficha suma la galeria. Se borra antes porque cambia las columnas que devuelve.
drop function if exists public.tours_ficha();
create or replace function public.tours_ficha()
returns table (
  destino text,
  titulo text,
  url_imagen text,
  duracion text,
  grupo text,
  punto_salida text,
  edad_minima text,
  politica_cancelacion text,
  incluye text,
  no_incluye text,
  que_llevar text,
  galeria jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select t.destino, t.titulo, t.url_imagen, t.duracion, t.grupo, t.punto_salida, t.edad_minima,
         t.politica_cancelacion, t.incluye, t.no_incluye, t.que_llevar, t.galeria
  from public.tours t
  where t.activo;
$$;

revoke all on function public.tours_ficha() from public;
grant execute on function public.tours_ficha() to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Pedido de tarifa neta a cada proveedor
-- ---------------------------------------------------------------------------
-- Para no escribirle dos veces y saber quien respondio. El mensaje sale por el
-- WhatsApp (o el email) de quien opera el panel, asi que la respuesta se marca a mano.
alter table public.proveedores
  add column if not exists tarifa_pedida_at timestamptz,
  add column if not exists tarifa_estado text not null default '',
  add column if not exists tarifa_respondio_at timestamptz;

comment on column public.proveedores.tarifa_estado is
  'Pedido de tarifa neta: vacio (no se pidio), esperando, respondio o sin_respuesta.';
