-- Vuelta atras de supabase_finanzas_1.sql.
--
-- PRIMERO probar lo suave: apagar la llave. El panel deja de mostrar y de cargar
-- Finanzas y todo lo demas sigue como antes, sin perder nada:
--
--   update public.operaciones_config set valor = '{"activo": false}' where clave = 'finanzas';
--
-- Lo de abajo BORRA las tablas nuevas con todo lo cargado en ellas. Antes de
-- correrlo, sacar un respaldo: node scripts/respaldo-base.js (guarda tambien
-- movimientos, obligaciones, asignaciones y auditoria si existen).
--
-- No toca pedidos, proveedores, tours ni ninguna otra tabla que ya existia.
-- Los comprobantes subidos al bucket se borran a mano desde Storage (Supabase no
-- deja borrar un bucket con archivos adentro).

begin;
drop table if exists public.asignaciones;
drop table if exists public.obligaciones;
drop table if exists public.movimientos;
drop trigger if exists auditoria_inmutable on public.auditoria;
drop table if exists public.auditoria;
drop function if exists public.auditoria_solo_agregar();
drop function if exists public.finanzas_no_borrar();
delete from public.operaciones_config where clave = 'finanzas';
commit;

-- Si el bucket ya esta vacio:
-- delete from storage.buckets where id = 'comprobantes';

notify pgrst, 'reload schema';
