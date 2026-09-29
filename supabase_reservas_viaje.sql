-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- Trae lo que la pagina de /grupo y el voucher de /app necesitan y la base no
-- tenia: poder volver a dividir un gasto ya cargado, que cada uno borre solo
-- los suyos y el que creo el grupo borre todos, y que el "Reservar" del voucher
-- pase a "Reservado" —a mano, desde la cuenta de la agencia.
--
-- Al final esta la linea para cargar el correo de la agencia. Sin esa fila la
-- app anda normal, pero el boton de "Marcar reservado" no le aparece a nadie.
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
-- El boton de la agencia es la unica forma de que una reserva cargada por error
-- (una transferencia que despues se cancelo) tenga arreglo desde la pagina.
--
-- Solo la agencia, y no es un detalle: el boton de deshacer aparece en el
-- voucher que ve el cliente, asi que si esta funcion saliera abierta el
-- cliente podria sacarse el "Reservado" de un tour que la agencia ya coordino.
-- Es la contraparte del gate de marcar: si se puede poner, solo la agencia lo
-- saca.
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
  if not public.es_agencia() then
    raise exception 'Solo la agencia puede sacar la marca de reserva';
  end if;
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
-- Quien puede poner la marca a mano
--
-- El vuelo y el hotel se marcan solos cuando la persona toca el link, porque
-- ahi no hay nada que decidir: el link abre WhatsApp o Booking y la intencion
-- esta clara. Los traslados y los tours NO: eso los coordina la agencia, y el
-- "Reservado" tiene que ponerlo quien confirmo la reserva, no el cliente. Por
-- eso hay una tabla de correos y las funciones de a mano la consultan.
--
-- Es una tabla y no un hardcode en el codigo para poder sumar a otra persona
-- (un agente, un socio) sin tocar la app ni volver a desplegar.
-- ---------------------------------------------------------------------------
create table if not exists public.agencia (
  email text primary key,
  nombre text,
  created_at timestamptz not null default now()
);

-- Sin policies, como waitlist y como reservas_viaje: nadie lee esta tabla
-- desde el cliente, solo la consultan las funciones de abajo.
alter table public.agencia enable row level security;

-- ---------------------------------------------------------------------------
-- PONER TU CORREO ACA
--
-- Cambiá el valor y corré esta línea. Tiene que ser el mismo correo con el que
-- iniciás sesión en la web, porque es contra ese correo que se decide si los
-- controles de "Reservado" se muestran. Sin esta fila la app anda normal y solo
-- que no le aparece nada a nadie para marcar.
--
-- Para sumar a otra persona (un agente, un socio), repetí la línea con su
-- correo: la tabla no tiene tope.
-- ---------------------------------------------------------------------------
-- insert into public.agencia (email, nombre) values ('TU@EMAIL.COM', 'Agencia');


-- Dice si quien esta mirando es de la agencia. La respuesta sale del JWT, no
-- de un parametro: si el parametro lo mandara el navegador, cualquiera que
-- lo pasara en false y el control de la pagina no valdria nada.
create or replace function public.es_agencia()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agencia a
     where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;


-- Marcar a mano. Solo la agencia; el error sale de la base y no de un if del
-- navegador, porque el navegador es del cliente y se lo puede editar.
create or replace function public.reservas_marcar_manual(
  p_viaje_id uuid, p_categoria text, p_destino text default null, p_detalle jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria text := lower(trim(coalesce(p_categoria, '')));
begin
  if not public.es_agencia() then
    raise exception 'Solo la agencia puede marcar reservas';
  end if;
  if p_viaje_id is null then return null; end if;
  if v_categoria not in ('pasajes', 'alojamiento', 'traslados', 'tours') then
    raise exception 'Categoría inválida: %', p_categoria;
  end if;

  insert into public.reservas_viaje (viaje_id, user_id, categoria, destino, detalle)
  values (p_viaje_id, auth.uid(), v_categoria, nullif(trim(p_destino), ''), coalesce(p_detalle, '{}'::jsonb))
  on conflict (viaje_id, categoria) do update
    set updated_at = now(),
        destino = excluded.destino,
        detalle = excluded.detalle,
        user_id = coalesce(excluded.user_id, public.reservas_viaje.user_id);
  return v_categoria;
end;
$$;


-- ---------------------------------------------------------------------------
-- Permisos
--
-- Se saca todo de la tabla y se da solo execute sobre las funciones: asi no
-- alcanza con un grant equivocado para que alguien lea la tabla entera.
--
-- reservas_marcar queda abierta a proposito: es la del clic en el link de
-- vuelo y hotel, que hace cualquiera. Lo que se gatea es la de a mano.
-- ---------------------------------------------------------------------------
revoke all on public.reservas_viaje from anon, authenticated;
revoke all on public.agencia from anon, authenticated;
grant execute on function public.es_agencia() to anon, authenticated;
grant execute on function public.reservas_marcar(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.reservas_leer(uuid) to anon, authenticated;
-- La firma tiene CUATRO argumentos (viaje, categoria, destino, detalle). Con tres
-- el grant no encuentra la funcion y el "Marcar reservado" falla con permiso
-- denegado, que es el error mas dificil de leer de todos.
grant execute on function public.reservas_marcar_manual(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.reservas_desmarcar(uuid, text) to anon, authenticated;
