-- Viajes guardados: link corto /viaje/<codigo> y lista en el panel /admin
-- (lib/viajes-guardados.js). El server lee trips con la service role, que no
-- tenia permiso sobre la tabla (solo authenticated, ver sql/supabase_trips_rls_fix.sql).
-- Solo lectura: el server nunca escribe en trips. Ejecutar en Supabase SQL Editor.

grant select on public.trips to service_role;
