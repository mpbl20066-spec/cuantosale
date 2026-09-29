-- Costos de transfer cargados desde data/tabla-transfers.xlsx.
--
-- Generado por scripts/build-costos-desde-xlsx.py. Pegar en el SQL Editor de
-- Supabase y darle Run.
--
-- SOLO va lo que tiene costo cargado. Los 45 destinos y sus columnas de
-- referencia los crea supabase_transfer_costos.sql: si ese todavia no se corrio,
-- esto agrega las filas con on conflict, asi que tambien sirve para crearlas de
-- a poco.
--
-- comision va como fraccion (0.30 es 30%) y los precios finales los calcula la
-- columna generada de la tabla, no esta consulta.

insert into public.transfer_destinos
  (destino_key, costo_compartido, costo_privado, comision)
values
  ('rio', 18.0, 40.0, 0.25)   -- Río de Janeiro,
  ('angra', 1234.5, 2500.0, 0.22)   -- Angra dos Reis,
  ('buz', 22.0, 88.0, 0.3)   -- Búzios,
  ('sao', 12.0, 44.0, 0.3)   -- São Paulo,
  ('ilhabela', 25.5, 1100.0, 0.3)   -- Ilhabela,
  ('ssa', 11.0, 60.0, 0.3)   -- Salvador de Bahía,
  ('portoseguro', null, 300.0, 0.35)   -- Porto Seguro,
  ('jericoacoara', 35.0, 195.0, null)   -- Jericoacoara,
  ('gram', 20.0, 70.0, 0.3)   -- Gramado,
  ('torres', 35.0, 126.0, 0.18)   -- Torres,
  ('bue', 1200.0, null, 0.2)   -- Buenos Aires
on conflict (destino_key) do update set
  costo_compartido = excluded.costo_compartido,
  costo_privado = excluded.costo_privado,
  comision = excluded.comision,
  actualizado_at = now();

-- Verificacion: si algo quedo en null, ese destino quedo sin costo.
select destino_key, nombre, costo_compartido, costo_privado, comision,
       precio_compartido, precio_privado
  from public.transfer_destinos
 where costo_compartido is not null or costo_privado is not null
 order by destino_key;
