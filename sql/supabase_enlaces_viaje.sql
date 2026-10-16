-- Enlaces cortos del presupuesto: cuantosale.uy/v/<codigo>
--
-- El server (POST /api/enlace y GET /v/<codigo>) es el unico que toca esta
-- tabla, con la service role. RLS queda activada y SIN politicas a proposito:
-- ni la anon key ni un usuario logueado pueden leer ni escribir directo.
--
-- El codigo son los primeros 8 caracteres de base64url(sha256(token)), asi que
-- el mismo viaje siempre da el mismo codigo y compartirlo diez veces no crea
-- diez filas.

create table if not exists public.enlaces_viaje (
  codigo text primary key check (codigo ~ '^[A-Za-z0-9_-]{8}$'),
  token text not null check (length(token) <= 6000),
  creado timestamptz not null default now()
);

alter table public.enlaces_viaje enable row level security;
revoke all on public.enlaces_viaje from anon, authenticated;
grant select, insert on public.enlaces_viaje to service_role;
