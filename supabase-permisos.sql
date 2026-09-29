-- Solo el cambio de la constraint. Las tablas ya existen y ya tienen los 111
-- tours cargados.
--
-- Pegas esto en el SQL Editor y le das Run. Tres statements cortos.
--
-- POR QUE
--
-- El check original era:
--     check (precio is not null or precio_brl is not null)
-- o sea, TODO tour necesitaba precio. Pero el importador de la planilla guarda
-- las filas sin PVP como inactivas, y esas no tienen precio. Se trababa en la
-- primera fila con 23514 "violates check constraint", sin decir cual.
--
-- El nuevo dice: solo un tour ACTIVO necesita precio. Uno inactivo puede no
-- tenerlo, y esa es justo la diferencia entre "no existe" y "no se ofrece
-- ahora". Las filas 'sin-precio-publicado' de la planilla se guardan asi, para
-- que la agencia las complete despues en lugar de que se pierdan.
--
-- Es idempotente.

alter table public.tours drop constraint if exists tours_precio_alguno;

alter table public.tours
  add constraint tours_precio_alguno check (
    not activo or precio is not null or precio_brl is not null
  );
