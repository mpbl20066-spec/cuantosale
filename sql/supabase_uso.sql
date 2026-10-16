-- Contador de uso del sitio (lib/uso.js, pestana "Uso" del panel /admin).
-- Correr una vez en Supabase: SQL Editor -> pegar esto -> Run.
--
-- Una fila por dia, evento y detalle (la pagina, el destino o la pestana), con cuantas veces paso. No se guarda nada
-- de la persona: ni IP, ni cookie, ni id. Por eso cuenta a todos, hayan aceptado o no las cookies de Analytics.
-- Todo el acceso pasa por el server con la service role: RLS prendido y sin politicas.

create table if not exists public.uso_diario (
  fecha date not null,
  evento text not null,
  detalle text not null default '',
  n integer not null default 0,
  primary key (fecha, evento, detalle)
);

alter table public.uso_diario enable row level security;

-- Suma de a uno sin carreras: dos pedidos al mismo tiempo no se pisan.
create or replace function public.uso_sumar(p_fecha date, p_evento text, p_detalle text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.uso_diario (fecha, evento, detalle, n) values (p_fecha, p_evento, coalesce(p_detalle, ''), 1)
  on conflict (fecha, evento, detalle) do update set n = public.uso_diario.n + 1;
$$;

revoke all on function public.uso_sumar(date, text, text) from public, anon, authenticated;
grant execute on function public.uso_sumar(date, text, text) to service_role;

-- El server lee el resumen para el panel (select); las sumas pasan por la funcion de arriba.
revoke all on public.uso_diario from anon, authenticated;
grant select on public.uso_diario to service_role;
