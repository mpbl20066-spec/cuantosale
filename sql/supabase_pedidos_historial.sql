-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- Historial de cada pedido del panel /admin: cambios de estado, servicios, cobros
-- y los WhatsApp que se mandaron desde la ficha. Lo escribe solo el server
-- (lib/pedidos.js), igual que el resto de la tabla.
--   historial: [{ t, tipo, texto, disp }]
--     t     fecha y hora (ISO)
--     tipo  estado | servicio | cancelado | proveedor | cobro | datos | whatsapp
--     disp  desde donde se hizo: celular | compu
--
-- Mientras no se corra, los pedidos se guardan igual, sin historial.

alter table public.pedidos add column if not exists historial jsonb not null default '[]'::jsonb;

-- PostgREST cachea el esquema: sin esto la columna nueva tarda en verse.
notify pgrst, 'reload schema';
