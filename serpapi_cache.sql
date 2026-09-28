-- Cache persistente de resultados de SerpAPI.
--
-- POR QUÉ ESTA TABLA EXISTE
--
-- lib/providers/index.js ya tenía un cache en memoria y otro en disco
-- (.serpapi-cache.json). Los dos sirven cuando el proceso tiene un disco que
-- sobrevive entre requests. En Vercel no: cada invocación corre en un contenedor
-- nuevo y el filesystem es de solo lectura fuera de /tmp. O sea que en
-- producción el cache se llenaba, servía el request en curso y moría con él.
-- saveCache() envolvía la escritura en un try/catch que sólo logueaba un
-- warning, así que el fallo era invisible.
--
-- El costo de eso no es un detalle: el gráfico "mismo viaje, otra fecha" pide
-- 15 tarifas, o sea 15 créditos de SerpAPI, y esa serie se dispara sola al
-- cotizar. Con el cache muerto, cada visita pagaba los 15 completos.
--
-- La ventana de fechas de model.seriesDates() va de -7 a +7 días con las mismas
-- noches. Dos personas que buscan la misma ruta y la misma cantidad de noches
-- con un día de diferencia consultan ventanas que se solapan en 14 de 15
-- puntos. Ese solapamiento es lo que vuelve barata la serie, y es exactamente
-- lo que se estaba tirando a la basura.
--
-- Las columnas:
--   key         la clave que ya usa el cache en memoria: "q|origen|dest|ida|
--               vuelta|cabina" para la tarifa principal y "c|...|pax|cabina"
--               para un punto del calendario.
--   value       el objeto normalizado que devuelve el provider. jsonb para no
--               depender del formato: si mañana el normalizador agrega un
--               campo, no hay que migrar nada.
--   expires_at  vencimiento. Se guarda la fecha, no el TTL, porque el TTL se
--               puede cambiar por variable de entorno y lo que importa es
--               cuándo dejó de servir, no por qué.
--
-- IMPORTANTE SOBRE LA CLAVE: es el precio de un vuelo. Es información pública
-- (lo mismo que muestra Google Flights) y no hay datos personales, pero la tabla
-- no se expone: las policies de abajo solo permiten lo que necesita el server.
-- La anon key llega al navegador para el split de gastos, así que la policy de
-- select es solo para el service role, que es el único que la usa.
--
-- Es idempotente: se puede correr las veces que haga falta.

create table if not exists public.serpapi_cache (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- El índice es por expires_at y no por key porque key ya es primary key. Lo usa
-- la limpieza periódica; sin él, el DELETE de vencidos hace un seq scan sobre
-- una tabla que crece con cada tarifa nueva.
create index if not exists serpapi_cache_expires_at_idx
  on public.serpapi_cache (expires_at);

-- El server lee y escribe con la service role, que saltea RLS. Las policies de
-- abajo existen para que la anon key del navegador NO pueda ni leer ni escribir
-- esta tabla: si pudiera, cualquiera podría leer el catálogo completo de precios
-- que la app pagó para construir, o inyectar precios falsos.
alter table public.serpapi_cache enable row level security;

drop policy if exists "serpapi_cache is server only" on public.serpapi_cache;
create policy "serpapi_cache is server only"
  on public.serpapi_cache
  for all
  using (false)
  with check (false);

-- El service role entra por PostgREST con el service_role, que ya ignora RLS.
-- Estos grants son los que hacen falta para que las llamadas del server pasen.
grant select, insert, update, delete on public.serpapi_cache to service_role;

-- Mantenimiento: borrar lo vencido.
--
--   select public.serpapi_cache_purgar();
--
-- y para correrla cada hora, en Supabase Dashboard > Database Extensions > pg_cron:
--
--   select cron.schedule('serpapi-cache-purga', '17 * * * *',
--            'select public.serpapi_cache_purgar()');
--
-- El minuto 17 y no el 0 a propósito: si todos los servicios usan cron(0), los
-- Jobs se disparan al mismo segundo y la base se frena.
create or replace function public.serpapi_cache_purgar()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borrados integer;
begin
  delete from public.serpapi_cache where expires_at < now();
  get diagnostics borrados = row_count;
  return borrados;
end;
$$;

comment on table public.serpapi_cache is
  'Cache de tarifas de SerpAPI por punto (ruta+fechas+pax+cabina). La escribe y lee solo el server. Ver lib/providers/cache-persistente.js.';
comment on function public.serpapi_cache_purgar() is
  'Borra las entradas vencidas. Devuelve cuantas borro.';
