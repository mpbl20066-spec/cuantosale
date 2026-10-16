-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- Bandeja de WhatsApp del panel /admin (lib/mensajes.js): lo que escriben los clientes (llega por el webhook de
-- Meta) y lo que se les contesta. Igual que pedidos: RLS activada, sin policies y sin grants para anon ni
-- authenticated; solo la toca el server con la service role.

create table if not exists public.wa_mensajes (
  id uuid primary key default gen_random_uuid(),
  wa_id text unique,                      -- id del mensaje en Meta: el webhook puede repetir un mensaje
  telefono text not null,                 -- solo digitos, con codigo de pais (59899123456)
  nombre text not null default '',        -- nombre del perfil de WhatsApp del cliente
  direccion text not null check (direccion in ('in', 'out')),
  tipo text not null default 'text',
  texto text not null default '',
  estado text not null default 'recibido', -- recibido | sent | delivered | read | failed
  error text not null default '',
  leido boolean not null default false,   -- leido en el panel (solo cuenta para los entrantes)
  created_at timestamptz not null default now()
);

create index if not exists wa_mensajes_tel_idx on public.wa_mensajes (telefono, created_at);
create index if not exists wa_mensajes_created_idx on public.wa_mensajes (created_at desc);

alter table public.wa_mensajes enable row level security;
revoke all on public.wa_mensajes from anon, authenticated;
grant select, insert, update, delete on public.wa_mensajes to service_role;
