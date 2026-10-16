-- Intentos fallidos de login del panel /admin (lib/login-intentos.js).
-- Correr una vez en Supabase: SQL Editor -> pegar esto -> Run.
--
-- POR QUE EN LA BASE Y NO EN MEMORIA
-- En Vercel cada instancia lleva su propia cuenta: con varias instancias vivas, el tope de 6 intentos cada 15 min
-- se multiplicaba por la cantidad de instancias. Aca la cuenta es una sola para todas.
--
-- No se guarda la IP: se guarda un hash (sha256) de la IP, que alcanza para contar y no dice de quien es.
-- Todo el acceso pasa por el server con la service role: RLS prendido y sin politicas.
-- Para deshacerlo: drop function public.admin_login_fallo(text, integer); drop table public.admin_login_fallos;

create table if not exists public.admin_login_fallos (
  ip_hash text primary key,
  n integer not null default 0,
  reset_en timestamptz not null
);

alter table public.admin_login_fallos enable row level security;

-- Suma un fallo sin carreras y devuelve cuantos van en la ventana. Si la ventana vencio, arranca de nuevo en 1.
-- De paso borra las filas vencidas hace mas de un dia, para que la tabla no crezca.
create or replace function public.admin_login_fallo(p_ip_hash text, p_ventana_seg integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  delete from public.admin_login_fallos where reset_en < now() - interval '1 day';
  insert into public.admin_login_fallos (ip_hash, n, reset_en)
    values (p_ip_hash, 1, now() + make_interval(secs => p_ventana_seg))
  on conflict (ip_hash) do update set
    n = case when public.admin_login_fallos.reset_en < now() then 1 else public.admin_login_fallos.n + 1 end,
    reset_en = case when public.admin_login_fallos.reset_en < now() then excluded.reset_en else public.admin_login_fallos.reset_en end
  returning n into v_n;
  return v_n;
end;
$$;

revoke all on table public.admin_login_fallos from public, anon, authenticated;
-- El server lee la cuenta (select) y la borra al entrar bien (delete); la suma pasa por la funcion.
grant select, delete on table public.admin_login_fallos to service_role;
revoke all on function public.admin_login_fallo(text, integer) from public, anon, authenticated;
grant execute on function public.admin_login_fallo(text, integer) to service_role;
