-- Catalogo de tours y actividades. Ejecutar en el Supabase SQL Editor.
-- Es idempotente: se puede correr de nuevo sin romper nada.
--
-- QUE ESTA TABLA RESUELVE
--
-- Los 111 tours estaban escritos a mano en public/app.js. Agregar uno era un
-- cambio de codigo: revisar, mergear, deployar. Y, peor, eran PUBLICOS: el
-- archivo se servia en /app.js y cualquiera que lo bajara con curl tenia el
-- catalogo completo con precios.
--
-- Esta tabla los saca del bundle. El server los lee con la service role y los
-- manda dentro del meta de /api/cotizar, que ya viaja en cada propuesta, asi
-- que no hay ni un request extra. El navegador nunca habla con la tabla.
--
-- Lo mismo que ya se hizo con la Guia Secreta (lib/guias.js + /api/guia con
-- token): contenido vendible, no va en un archivo que se pueda bajar.
--
--
-- POR QUE ESTA CERRADA Y NO ABIERTA A ANON
--
-- La anon key va al navegador: la usa public/grupo.js para el split de gastos.
-- Si esta tabla tuviera "grant select to anon", los precios de los tours serian
-- publicos otra vez, solo que via la API en vez de via un .js. Seria el mismo
-- problema con mas pasos.
--
-- Asique: RLS activado, ningun grant a anon ni a authenticated, y toda la
-- lectura y escritura pasa por las funciones SECURITY DEFINER de mas abajo, que
-- son las unicas que tocan la tabla.
--
-- Mismo criterio que reservas_viaje y que el cache de SerpAPI.


-- ---------------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------------
-- Una fila por tour. El destino es la key de lib/model.js ("buz", "rio", "fln"),
-- NO el nombre de la ciudad: es lo que toursFor() filtra, y por eso una key
-- mal escrita deja el tour invisible sin error.
create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  destino text not null,
  -- EXACTO como se muestra, y es la clave de la foto: ver la nota de abajo.
  titulo text not null,
  descripcion text not null default '',
  -- Precio de origen. Si el operador brasilero cobra en reales, va precio_brl y
  -- el precio en dolares es derivado. Ver la funcion tours_para_cliente.
  precio numeric(10,2),
  precio_brl numeric(10,2),
  detalle text not null default '',
  -- Para apagar un tour de temporada sin borrarlo: es la diferencia entre
  -- "no existe" y "no se ofrece ahora".
  activo boolean not null default true,
  -- De donde salio el precio. El precio es REFERENCIAL (no hay operador de
  -- tours que lo tome), asi que saber quien lo puso y cuando es la unica forma
  -- de saber cuanto vale.
  fuente text not null default '',
  verificado date,
  orden integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- --- Datos que trae la planilla de agencias (scripts/cargar-tours-xlsx.py) ---
  --
  -- Todo lo de abajo viene de la hoja que arma la agencia. Es informacion que se
  -- la seccion de tours sigue usando precio y descripcion, que es lo que esta
  -- revisado. Tenerlo aca es para poder decidir despues sin volver a pedir la
  -- planilla, que es un ida y vuelta con otra persona.
  --
  -- Los de precio van aparte a proposito: PVP es lo que paga el pasajero y Neto
  -- es lo que entra a la agencia. El precio que muestra la web es PVP, asi que
  -- si se subiera el Neto por error la web venderia por debajo de lo que
  -- cuesta. Estan en columnas distintas justamente para que el error sea visible.
  pvp numeric(10,2),
  comision numeric(10,2),
  neto numeric(10,2),
  duracion text not null default '',
  tipo_servicio text not null default '',
  incluye text not null default '',
  no_incluye text not null default '',
  politica_cancelacion text not null default '',
  dias_salida text not null default '',
  link_web text not null default '',
  agencia text not null default '',
  -- La foto que trae la planilla. NO se usa todavia: son fotos de la agencia,
  -- sin autor ni licencia, y el pie de creditos de la web dice que las fotos
  -- son de Wikimedia Commons con licencia libre (ver TOUR_PHOTOS en app.js y
  -- creditos-fotos.generated.js). Poner estas aca y usarlas haria que ese pie
  -- mintiera. Queda guardada para cuando se decida el tema del credito.
  url_imagen text not null default '',
  -- 'ok' | 'ok-catalogo' | 'sin-precio-publicado' | 'descartada'. Traido de la
  -- planilla para poder filtrar despues sin volver a abrir el archivo.
  estado_scrapeo text not null default '',

  -- El titulo tiene que ser unico por destino, y no por un indice suelto porque
  -- es lo que garantiza que dos filas no compitan por la misma foto.
  unique (destino, titulo),
  -- Un precio negativo es un error de tipeo, no un dato.
  constraint tours_no_negativo check (
    (precio is null or precio >= 0) and (precio_brl is null or precio_brl >= 0)
  ),
  -- Un tour ACTIVO necesita precio: no se puede cotizar. Uno INACTIVO puede no
  -- tenerlo, y esa es la diferencia entre "no existe" y "no se ofrece ahora".
  --
  -- El "not activo" del principio es lo que hace que las filas de la planilla sin
  -- PVP se puedan guardar. Sin el, el importador se traba en la primera: la
  -- planilla trae 'sin-precio-publicado', que es informacion que vale guardar
  -- para cuando la agencia complete el precio, y no algo que haya que descartar.
  constraint tours_precio_alguno check (
    not activo or precio is not null or precio_brl is not null
  )
);

create index if not exists tours_destino_activo_idx on public.tours (destino) where activo;

comment on table public.tours is
  'Catalogo de tours por destino. Se lee solo por el server (funciones SECURITY DEFINER). El precio es referencial, no un precio de reserva.';

comment on column public.tours.destino is
  'Key de destino, como en lib/model.js: buz, rio, fln, bue... NO el nombre de la ciudad. Una key desconocida deja el tour invisible sin error.';
comment on column public.tours.titulo is
  'EXACTO como se muestra. Es la clave de la foto en public/app.js (TOUR_PHOTOS usa "destino#titulo"): cambiarlo deja la card sin foto, que es un degradado con el icono, sin error ni aviso.';
comment on column public.tours.precio_brl is
  'Precio de origen en reales. Si esta, gana sobre precio: es el numero que hay que re-cotizar cuando cambia la moneda.';
comment on column public.tours.fuente is
  'De donde salio el precio. Ej: "Booking, precio de la pagina del operador, set/2026".';

-- ---------------------------------------------------------------------------
-- Cerrada al mundo
-- ---------------------------------------------------------------------------
-- RLS sin ninguna policy: no se lee ni se escribe directo, nunca. Las funciones
-- de abajo son las unicas que tocan la tabla, y son SECURITY DEFINER.
alter table public.tours enable row level security;

revoke all on table public.tours from anon, authenticated;
-- No hay revoke de secuencia porque id es uuid con default gen_random_uuid(), que
-- no crea ninguna. Un revoke sobre tours_id_seq aborta el script entero con
-- 42P01, que es lo que paso la primera vez que se corrio esto.
--
-- Y service_role SÍ lleva permiso, aunque el panel de RLS diga que la bypasea:
-- eso es para las POLICIES, y esta tabla no tiene ninguna. El permiso de tabla
-- va aparte y es acumulativo, asi que revocar a anon y a authenticated no le
-- quita nada a service_role pero tampoco se lo da. Sin esta linea, escribir con
-- la service role falla con 403.
grant select, insert, update, delete on public.tours to service_role;


-- ---------------------------------------------------------------------------
-- Leer los tours de un destino
-- ---------------------------------------------------------------------------
-- Devuelve la fila YA CONVERTIDA a dolares, que es lo que la UI usa.
--
-- La conversion vive en SQL y no en el JS del cliente a proposito: si viviera
-- en el navegador, cada pagina tendria su propia copia de la cotizacion y un
-- cambio de moneda se propagaria a medias. Aca hay una sola.
--
-- La cotizacion es un parametro, no una constante: la pasa el server desde
-- _meta.tipo_cambio_ref de data/tours.json. Un tour sin precio_brl devuelve
-- precio tal cual, sin sumar margen.
create or replace function public.tours_para_cliente(
  p_destino text,
  p_cotizacion_brl numeric default null,
  p_margen_usd numeric default 0
)
returns table (
  destino text,
  titulo text,
  descripcion text,
  precio numeric,
  detalle text,
  fuente text,
  verificado date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.destino,
    t.titulo,
    t.descripcion,
    case
      when t.precio_brl is not null
        then round(t.precio_brl / nullif(p_cotizacion_brl, 0) + p_margen_usd, 2)
      else t.precio
    end as precio,
    t.detalle,
    t.fuente,
    t.verificado
  from public.tours t
  where t.destino = p_destino
    and t.activo
  order by t.orden, t.titulo;
$$;

-- Los tres parametros que necesita la de arriba van juntos porque separarlos
-- son tres defaults que se pueden olvidar uno.
comment on function public.tours_para_cliente(text, numeric, numeric) is
  'Lee los tours activos de un destino, con el precio ya convertido a USD. SECURITY DEFINER: es la unica via de lectura.';

create or replace function public.tours_todos(p_cotizacion_brl numeric default null, p_margen_usd numeric default 0)
returns table (
  destino text,
  titulo text,
  descripcion text,
  precio numeric,
  detalle text,
  fuente text,
  verificado date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.destino,
    t.titulo,
    t.descripcion,
    case
      when t.precio_brl is not null and p_cotizacion_brl is not null and p_cotizacion_brl > 0
        then round(t.precio_brl / p_cotizacion_brl + coalesce(p_margen_usd, 0), 2)
      when t.precio_brl is not null
        then t.precio_brl
      else t.precio
    end as precio,
    t.detalle,
    t.fuente,
    t.verificado
  from public.tours t
  where t.activo
  order by t.destino, t.orden, t.titulo;
$$;

comment on function public.tours_todos(numeric, numeric) is
  'Todos los tours activos, con el precio ya convertido. La usa la carga inicial y el respaldo cuando la tabla esta vacia.';


-- ---------------------------------------------------------------------------
-- Escribir
-- ---------------------------------------------------------------------------
-- El panel de edicion (/tours) escribe por estas funciones. Son SECURITY
-- DEFINER y sin RLS que las cubra porque el panel lo usa una persona
-- logueada, pero el permiso se comprueba dentro contra es_agencia().
--
-- Ojo con la razon: la tabla no se abre a authenticated. Se abre UNA funcion
-- que ademas pregunta si quien llama es la agencia. Abrir la tabla y filtrar en
-- el panel dejaria la escritura disponible para cualquier sesion valida, que
-- no es lo mismo.
create or replace function public.tours_guardar(
  p_destino text,
  p_titulo text,
  p_descripcion text default '',
  p_precio numeric default null,
  p_precio_brl numeric default null,
  p_detalle text default '',
  p_activo boolean default true,
  p_fuente text default '',
  p_verificado date default null,
  p_orden integer default 100
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.es_agencia() then
    raise exception 'no autorizado';
  end if;

  update public.tours
     set destino = p_destino,
         titulo = p_titulo,
         descripcion = coalesce(p_descripcion, ''),
         precio = p_precio,
         precio_brl = p_precio_brl,
         detalle = coalesce(p_detalle, ''),
         activo = coalesce(p_activo, true),
         fuente = coalesce(p_fuente, ''),
         verificado = p_verificado,
         orden = coalesce(p_orden, 100),
         updated_at = now()
   where destino = p_destino and titulo = p_titulo
  returning id into v_id;

  if v_id is null then
    insert into public.tours (destino, titulo, descripcion, precio, precio_brl, detalle, activo, fuente, verificado, orden)
    values (p_destino, p_titulo, coalesce(p_descripcion, ''), p_precio, p_precio_brl, coalesce(p_detalle, ''), coalesce(p_activo, true), coalesce(p_fuente, ''), p_verificado, coalesce(p_orden, 100))
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- Carga por lotes. La usa scripts/cargar-tours.js, que manda las filas de
-- data/tours.json en pedazos de 200.
--
-- NO comprueba es_agencia() a proposito, y es la unica excepcion: la corre el
-- servidor con la service role, que es una credencial de la aplicacion, no una
-- persona. Si exigiera el permiso de agencia, la carga inicial no tendria como
-- arrancar (la tabla de agencia todavia no tendria a nadie) y cada recarga
-- dependeria de un usuario. El que decide quien puede cambiar el catalogo desde
-- la pagina es tours_guardar(), que si lo comprueba.
create or replace function public.tours_guardar_lote(p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  f jsonb;
begin
  for f in select * from jsonb_array_elements(p_filas) loop
    insert into public.tours as t (destino, titulo, descripcion, precio, precio_brl, detalle, activo, fuente, verificado, orden,
                                   pvp, comision, neto, duracion, tipo_servicio, incluye, no_incluye,
                                   politica_cancelacion, dias_salida, link_web, agencia, url_imagen, estado_scrapeo)
    values (
      f->>'destino',
      f->>'titulo',
      coalesce(f->>'descripcion', ''),
      nullif(f->>'precio', '')::numeric,
      nullif(f->>'precio_brl', '')::numeric,
      coalesce(f->>'detalle', ''),
      coalesce((f->>'activo')::boolean, true),
      coalesce(f->>'fuente', ''),
      nullif(f->>'verificado', '')::date,
      coalesce((f->>'orden')::integer, 100),
      -- Las columnas de la planilla. Se leen con ->> y un cast a numeric que
      -- puede fallar si viene "R$ 1.400" o "1.400,50": por eso el importador
      -- las normaliza antes de mandarlas. Ver scripts/cargar-tours-xlsx.py.
      nullif(f->>'pvp', '')::numeric,
      nullif(f->>'comision', '')::numeric,
      nullif(f->>'neto', '')::numeric,
      coalesce(f->>'duracion', ''),
      coalesce(f->>'tipo_servicio', ''),
      coalesce(f->>'incluye', ''),
      coalesce(f->>'no_incluye', ''),
      coalesce(f->>'politica_cancelacion', ''),
      coalesce(f->>'dias_salida', ''),
      coalesce(f->>'link_web', ''),
      coalesce(f->>'agencia', ''),
      coalesce(f->>'url_imagen', ''),
      coalesce(f->>'estado_scrapeo', '')
    )
    on conflict (destino, titulo) do update set
      descripcion = excluded.descripcion,
      precio = excluded.precio,
      precio_brl = excluded.precio_brl,
      detalle = excluded.detalle,
      activo = excluded.activo,
      fuente = excluded.fuente,
      verificado = excluded.verificado,
      orden = excluded.orden,
      pvp = excluded.pvp,
      comision = excluded.comision,
      neto = excluded.neto,
      duracion = excluded.duracion,
      tipo_servicio = excluded.tipo_servicio,
      incluye = excluded.incluye,
      no_incluye = excluded.no_incluye,
      politica_cancelacion = excluded.politica_cancelacion,
      dias_salida = excluded.dias_salida,
      link_web = excluded.link_web,
      agencia = excluded.agencia,
      url_imagen = excluded.url_imagen,
      estado_scrapeo = excluded.estado_scrapeo,
      updated_at = now();

    /* Una fila ACTIVA sin ninguno de los dos precios aborta todo el lote.
     *
     * Se valida acá y no solo con la constraint porque el mensaje de Postgres
     * sobre el check no dice que fila fallo: el error que llega es "violates
     * check constraint" y no dice cual. Este dice el titulo, que es lo que hace
     * falta para encontrarla en la planilla.
     *
     * Las filas inactivas sin precio pasan: son las de 'sin-precio-publicado',
     * que se guardan para cuando la agencia las complete. */
    if coalesce((f->>'activo')::boolean, true)
       and coalesce(nullif(f->>'precio', ''), nullif(f->>'precio_brl', '')) is null then
      raise exception 'el tour "%" esta activo y no tiene precio', coalesce(f->>'titulo', '(sin titulo)');
    end if;

    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

comment on function public.tours_guardar_lote(jsonb) is
  'Upsert por lote de (destino, titulo). Sin chequeo de es_agencia: la corre el server con la service role.';

-- Borrar por lote, para el panel. Mismo criterio que la de arriba: sin
-- es_agencia, porque la usa el servidor.
create or replace function public.tours_borrar_lote(p_claves jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  f jsonb;
begin
  for f in select * from jsonb_array_elements(p_claves) loop
    delete from public.tours
     where destino = f->>'destino' and titulo = f->>'titulo';
    if found then v_total := v_total + 1; end if;
  end loop;
  return v_total;
end;
$$;

create or replace function public.tours_borrar(p_destino text, p_titulo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_agencia() then
    raise exception 'no autorizado';
  end if;
  delete from public.tours where destino = p_destino and titulo = p_titulo;
  return found;
end;
$$;

-- Apagar y encender sin borrar. Existe aparte de tours_guardar porque es la
-- operacion de todos los dias en temporada, y no merece el riesgo de un borrado.
create or replace function public.tours_alternar_activo(p_destino text, p_titulo text, p_activo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_agencia() then
    raise exception 'no autorizado';
  end if;
  update public.tours set activo = p_activo, updated_at = now()
   where destino = p_destino and titulo = p_titulo;
  return found;
end;
$$;


-- ---------------------------------------------------------------------------
-- Grants: solo authenticated puede LLAMAR las funciones. La tabla sigue cerrada.
-- ---------------------------------------------------------------------------
-- authenticated y no anon: el panel exige sesion, y con anon una pagina anon
-- cualquiera podria escribir el catalogo.
grant execute on function public.tours_para_cliente(text, numeric, numeric) to anon, authenticated;
grant execute on function public.tours_todos(numeric, numeric) to anon, authenticated;
grant execute on function public.tours_guardar(text, text, text, numeric, numeric, text, boolean, text, date, integer) to authenticated;
grant execute on function public.tours_borrar(text, text) to authenticated;
grant execute on function public.tours_alternar_activo(text, text, boolean) to authenticated;

-- Estas dos NO se les da a nadie con rol: solo las puede llamar la service
-- role, que no pasa por RLS. Es la proteccion de la carga inicial. Por eso el
-- grant es a service_role y no a authenticated.
grant execute on function public.tours_guardar_lote(jsonb) to service_role;
grant execute on function public.tours_borrar_lote(jsonb) to service_role;

-- Nota sobre por que tours_para_cliente se le puede dar a anon sin abrir la
-- tabla: una funcion SECURITY DEFINER lee lo que le digan y devuelve lo que
-- ella decide devolver. El precio del tour ya es publico de todas formas (se
-- muestra en la card), lo que no puede terminar publico es la tabla entera con su
-- fuente, su verificado y su updated_at, y eso no sale de la funcion.
--
-- El server igual usa la service role para leer, que no pasa por RLS.
