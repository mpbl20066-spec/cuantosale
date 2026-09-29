-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- Guarda que rubros del viaje ya estan reservados, para que el boton del
-- voucher pase de "Reservar" a "Reservado" y siga asi al recargar.
--
-- La tabla existe y NO se le da permiso a nadie: la escritura y la lectura pasan
-- solo por las funciones de abajo, que son SECURITY DEFINER. Es el mismo modelo
-- que usa waitlist en supabase.sql, y esta vez no es por privacy sino por
-- necesidad: en el momento de reservar casi nadie esta logueado (el OTP del
-- checkout se manda sin esperar y la sesion todavia no existe), asi que una RLS
-- atada a auth.uid() dejaria la reserva sin poder guardarse.
--
-- Que sea una fila por (viaje_id, categoria) y no un historial: la pregunta que
-- hace la pantalla es "este rubro, esta reservado si o no", no el historial de
-- las reservas. El on conflict del update resuelve las dos escrituras que
-- pueden caer (el link de vuelo y el de hotel, por ejemplo).


-- ---------------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------------
create table if not exists public.reservas_viaje (
  id uuid primary key default gen_random_uuid(),
  -- El "contraseña" de la fila, igual que el link en grupos_viaje: un uuid que
  -- el navegador genera por viaje y se guarda en localStorage. No es adivinable
  -- y por eso puede vivir la reserva sin columna user_id obligatoria.
  viaje_id uuid not null,
  -- Se llena sola si la persona esta logueada. Queda en null si no, y da igual:
  -- la lectura se hace por viaje_id, no por user_id. Es un dato para saber a
  -- quien preguntarle, no la llave.
  user_id uuid references auth.users(id) on delete set null,
  -- Las mismas cuatro claves que usa getCategoryColor()/categoryIcon() para
  -- pintar las filas del voucher, para que la reserva y la fila no puedan
  -- desincronizarse por una diferencia de nombre.
  categoria text not null check (categoria in ('pasajes', 'alojamiento', 'traslados', 'tours')),
  destino text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viaje_id, categoria)
);

create index if not exists reservas_viaje_viaje_idx on public.reservas_viaje (viaje_id);

-- RLS sin ninguna policy: no se lee ni se escribe directo, nunca. Las funciones
-- de abajo son las unicas que tocan la tabla, y son SECURITY DEFINER.
alter table public.reservas_viaje enable row level security;


-- ---------------------------------------------------------------------------
-- Marcar un rubro como reservado
-- ---------------------------------------------------------------------------
create or replace function public.reservas_marcar(
  p_viaje_id uuid,
  p_categoria text,
  p_destino text default null,
  p_detalle jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria text := lower(trim(coalesce(p_categoria, '')));
begin
  if p_viaje_id is null then
    return null;
  end if;
  -- El check de la tabla ya lo rechaza, pero con un error de Postgres que en la
  -- pagina no se entiende. Acá se contesta con el motivo.
  if v_categoria not in ('pasajes', 'alojamiento', 'traslados', 'tours') then
    raise exception 'Categoría inválida: %', p_categoria;
  end if;

  insert into public.reservas_viaje (viaje_id, user_id, categoria, destino, detalle)
  values (p_viaje_id, auth.uid(), v_categoria, nullif(trim(p_destino), ''), coalesce(p_detalle, '{}'::jsonb))
  on conflict (viaje_id, categoria) do update
    set updated_at = now(),
        destino = excluded.destino,
        detalle = excluded.detalle,
        -- Guardar dos veces el mismo rubro no tiene que borrar el user_id del
        -- que lo marco la primera vez.
        user_id = coalesce(excluded.user_id, public.reservas_viaje.user_id);
  return v_categoria;
end;
$$;


-- ---------------------------------------------------------------------------
-- Leer que rubros estan reservados de este viaje
--
-- Devuelve un array de categorias, no la fila entera: la pantalla solo necesita
-- la lista, y devolver menos es devolver menos datos de los que hay.
-- ---------------------------------------------------------------------------
create or replace function public.reservas_leer(p_viaje_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_viaje_id is null then
    return array[]::text[];
  end if;
  return coalesce(
    (select array_agg(r.categoria order by r.categoria)
       from public.reservas_viaje r
      where r.viaje_id = p_viaje_id),
    array[]::text[]
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Sacar la marca, para poder corregir una reserva mal puesta
--
-- El boton "Reservado" es la unica forma de que una reserva cargada por error
-- (una transferencia que despues se cancelo) tenga arreglo desde la pagina.
-- ---------------------------------------------------------------------------
create or replace function public.reservas_desmarcar(p_viaje_id uuid, p_categoria text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria text := lower(trim(coalesce(p_categoria, '')));
begin
  if p_viaje_id is null then
    return null;
  end if;
  delete from public.reservas_viaje
   where viaje_id = p_viaje_id
     and categoria = v_categoria;
  return v_categoria;
end;
$$;


-- ---------------------------------------------------------------------------
-- Permisos
--
-- Se saca todo de la tabla y se da solo execute sobre las funciones: asi no
-- alcanza con un grant equivocado para que alguien lea la tabla entera.
-- ---------------------------------------------------------------------------
revoke all on public.reservas_viaje from anon, authenticated;
grant execute on function public.reservas_marcar(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.reservas_leer(uuid) to anon, authenticated;
grant execute on function public.reservas_desmarcar(uuid, text) to anon, authenticated;
