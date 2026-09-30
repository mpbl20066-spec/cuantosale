-- ---------------------------------------------------------------------------
-- Ficha de la experiencia: duracion, grupo, punto de salida, edad y foto.
-- ---------------------------------------------------------------------------
-- Lo que muestra la franja de datos del modal "Ver detalles" de cada tour.
--
-- Es ADITIVO: no toca tours_todos, tours_para_cliente ni tours_guardar_lote.
-- Esas tres siguen devolviendo y guardando lo mismo que antes; esta migracion
-- agrega tres columnas y dos funciones nuevas al lado. Correrlo dos veces no
-- cambia nada la segunda (if not exists / create or replace).
--
-- Se corre UNA vez en Supabase -> SQL Editor. Hasta que se corra, el server
-- sigue andando igual: lib/tours.js trata que tours_ficha no exista como
-- "no hay ficha" y sigue con los datos de siempre.
--
-- duracion y url_imagen ya existian como columnas, pero ninguna funcion de
-- lectura las devolvia: por eso la web en produccion no las veia.

alter table public.tours
  add column if not exists grupo text not null default '',
  add column if not exists punto_salida text not null default '',
  add column if not exists edad_minima text not null default '';

comment on column public.tours.grupo is
  'Texto tal cual se muestra, ej. "4 personas por grupo". Vacio = no se dibuja la celda.';
comment on column public.tours.punto_salida is
  'Texto tal cual se muestra, ej. "En la agencia". Vacio = no se dibuja la celda.';
comment on column public.tours.edad_minima is
  'Texto tal cual se muestra, ej. "Desde 21 años". Vacio = no se dibuja la celda.';

-- Lectura: solo tours activos, igual que tours_todos.
create or replace function public.tours_ficha()
returns table (
  destino text,
  titulo text,
  url_imagen text,
  duracion text,
  grupo text,
  punto_salida text,
  edad_minima text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.destino, t.titulo, t.url_imagen, t.duracion, t.grupo, t.punto_salida, t.edad_minima
  from public.tours t
  where t.activo;
$$;

comment on function public.tours_ficha() is
  'Datos de la ficha de cada tour activo (foto, duracion, grupo, salida, edad). Se une con tours_todos() por (destino, titulo).';

-- Escritura: solo actualiza filas que YA existen; no crea ni borra tours.
-- Una clave que no viene en la fila se deja como esta (coalesce con la
-- columna), y una que viene vacia se guarda vacia: es la forma de borrar un dato.
create or replace function public.tours_ficha_lote(p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_n integer;
  f jsonb;
begin
  for f in select * from jsonb_array_elements(p_filas) loop
    update public.tours t set
      url_imagen   = coalesce(f->>'url_imagen', t.url_imagen),
      duracion     = coalesce(f->>'duracion', t.duracion),
      grupo        = coalesce(f->>'grupo', t.grupo),
      punto_salida = coalesce(f->>'punto_salida', t.punto_salida),
      edad_minima  = coalesce(f->>'edad_minima', t.edad_minima),
      activo       = coalesce((f->>'activo')::boolean, t.activo),
      updated_at   = now()
    where t.destino = f->>'destino' and t.titulo = f->>'titulo';
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end;
$$;

comment on function public.tours_ficha_lote(jsonb) is
  'Actualiza foto, duracion, grupo, salida, edad y activo de tours existentes, por (destino, titulo). La corre el server con la service role.';

revoke all on function public.tours_ficha() from public;
revoke all on function public.tours_ficha_lote(jsonb) from public;
grant execute on function public.tours_ficha() to anon, authenticated, service_role;
grant execute on function public.tours_ficha_lote(jsonb) to service_role;
