-- Demanda insatisfecha (lib/demanda.js, pestana Sistema > Demanda del panel /admin).
-- Correr una vez en Supabase: SQL Editor -> pegar esto -> Run.
--
-- Una fila por cosa que hizo un visitante: cotizo un destino, busco vuelos (y si hubo), pidio una reserva, o busco un
-- destino que no tenemos. "visitante" es un numero al azar que guarda su navegador (cs_v): no es nombre, ni correo, ni
-- IP; sirve para contar personas y no solo busquedas. "prueba" = la mando alguien con sesion del panel (nosotros).
-- Todo el acceso pasa por el server con la service role: RLS prendido y sin politicas.

create table if not exists public.demanda_eventos (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  visitante text not null,
  evento text not null,                    -- cotizo | vuelos | reserva | buscar_sin
  destino text not null default '',        -- clave del modelo (fln, rio, buz...)
  segundo text not null default '',        -- segunda parada del viaje, si hay
  ida date,
  vuelta date,
  medio text not null default '',          -- avion | auto | bus
  pax smallint,
  resultado text not null default '',      -- vuelos: ok | sin | error; reserva: tours | traslado | tours+traslado
  texto text not null default '',          -- buscar_sin: lo que escribio (corto, sin numeros)
  prueba boolean not null default false
);

create index if not exists demanda_eventos_creado on public.demanda_eventos (creado);

alter table public.demanda_eventos enable row level security;

-- El server inserta los eventos (POST /api/demanda) y los lee para el panel, con la service role.
revoke all on public.demanda_eventos from anon, authenticated;
grant select, insert on public.demanda_eventos to service_role;
