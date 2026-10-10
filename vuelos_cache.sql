-- Cache compartida de precios de vuelos (Ignav).
--
-- Guarda los precios que trae Ignav (lista de vuelos, tarifa principal y cada fecha del calendario
-- "mismo viaje, otra fecha") para reusarlos entre visitas durante 48 h, en vez de volver a pedirlos y gastar
-- busquedas. En Vercel el server no tiene disco ni memoria que sobreviva entre pedidos: sin esta tabla, la cache
-- se pierde en cada arranque. La lee y la escribe lib/providers/cache-persistente.js.
--
-- Columnas:
--   key         la clave de la cache: "o|..." lista de vuelos, "q|..." tarifa, "c2|..." un dia del calendario
--   value       el precio normalizado (jsonb)
--   expires_at  cuando deja de servir
--
-- Son precios publicos, sin datos personales, pero la tabla no se expone: solo la usa el server con la service role.
-- Es idempotente: se puede correr las veces que haga falta.
-- (Antes se llamaba serpapi_cache, de cuando el proveedor era SerpAPI; nunca llego a crearse en produccion.)

create table if not exists public.vuelos_cache (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists vuelos_cache_expires_at_idx on public.vuelos_cache (expires_at);

-- El navegador (anon key) no puede leer ni escribir: solo el server, con la service role (que saltea RLS).
alter table public.vuelos_cache enable row level security;
drop policy if exists "vuelos_cache solo server" on public.vuelos_cache;
create policy "vuelos_cache solo server" on public.vuelos_cache for all using (false) with check (false);
grant select, insert, update, delete on public.vuelos_cache to service_role;

-- Limpieza de lo vencido:  select public.vuelos_cache_purgar();
-- Para correrla cada hora (Dashboard > Database > Extensions > pg_cron):
--   select cron.schedule('vuelos-cache-purga', '17 * * * *', 'select public.vuelos_cache_purgar()');
create or replace function public.vuelos_cache_purgar()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borrados integer;
begin
  delete from public.vuelos_cache where expires_at < now();
  get diagnostics borrados = row_count;
  return borrados;
end;
$$;

comment on table public.vuelos_cache is 'Cache de precios de vuelos de Ignav (48 h). La escribe y lee solo el server. Ver lib/providers/cache-persistente.js.';
comment on function public.vuelos_cache_purgar() is 'Borra las entradas vencidas. Devuelve cuantas borro.';
