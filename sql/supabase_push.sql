-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- Dispositivos donde se activaron las notificaciones del panel /admin (lib/push.js). Igual que pedidos y
-- wa_mensajes: RLS activada, sin policies y sin grants para anon ni authenticated; solo la toca el server.

create table if not exists public.admin_push (
  endpoint text primary key,           -- direccion de push que da el navegador del dispositivo
  dispositivo text not null default '',
  created_at timestamptz not null default now()
);

alter table public.admin_push enable row level security;
revoke all on public.admin_push from anon, authenticated;
grant select, insert, update, delete on public.admin_push to service_role;
