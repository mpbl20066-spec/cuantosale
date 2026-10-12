-- Notificaciones push de las alertas de precio (lib/alertas.js). Correr una vez en Supabase: SQL Editor -> Run.
--
-- Una fila por dispositivo donde alguien activo los avisos: la direccion de push que da el navegador (endpoint).
-- El push viaja vacio; al recibirlo, el service worker del sitio (public/sw.js) pide el texto a
-- /api/alertas/push-resumen con su endpoint, que se lee de `pendientes` (las bajas de las ultimas 24 h).
-- Solo la toca el server con la service role. Al borrar la cuenta se borran sus dispositivos.

create table if not exists public.alertas_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  dispositivo text,
  pendientes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists alertas_push_usuario on public.alertas_push (user_id);

alter table public.alertas_push enable row level security;

-- Este proyecto no da permisos por defecto a las tablas nuevas: sin esto el server recibe 403.
grant select, insert, update, delete on public.alertas_push to service_role;
