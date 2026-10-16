-- Vuelta atras de sql/supabase_operativa_1.sql. Antes, sacar un respaldo: node scripts/respaldo-base.js
--
-- BORRA los pasajeros cargados en los pedidos y las fichas de clientes (alertas y notas). No toca nada mas de
-- pedidos: los servicios, cobros e historial quedan como estan. El panel sigue andando sin la columna: los
-- pasajeros vacios se guardan igual y con pasajeros cargados avisa que falta la columna.

begin;
drop table if exists public.clientes_fichas;
alter table public.pedidos drop column if exists pasajeros;
commit;

notify pgrst, 'reload schema';
