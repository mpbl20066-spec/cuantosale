-- Costo de venta de los transfers, cargado por la agencia.
--
-- Ejecutar en el SQL Editor de Supabase (o pegarlo y darle Run). Es idempotente:
-- se puede volver a correr sin romper lo que ya se cargo a mano.
--
-- POR QUE ESTA TABLA Y NO data/transfer-precios.json
--
-- El JSON sigue siendo la unica fuente de verdad de lo que la app VENDE (km,
-- tipo de servicio, precio compartido y privado). Eso no se toca, y por el
-- motivo que el README ya documento: cuando el precio de transfer vivia en
-- tres lugares, los tres decian una cosa distinta.
--
-- Acá vive lo unico que la base todavia no tenia: lo que le PAGAMOS al
-- operador. Antes no existia en ningun lado, y es el dato que hace falta para
-- saber si una venta deja margen.
--
-- Por eso la tabla NO tiene km ni los precios de la app: no es que falten,
-- es que estan en el JSON y duplicarlos seria volver al bug de las tres
-- fuentes. El script scripts/db-tabla.js pull junta las dos cosas por
-- destino_key y arma el .xlsx con todo junto.
--
-- Los nombres de destino son copias de convenience: si el JSON cambia el
-- nombre, esta fila se actualiza sola con "npm run db:seed", que no toca las
-- columnas de costo.
--
-- COMO SE EDITA
--
-- Dashboard de Supabase -> Table Editor -> transfer_destinos. Es una grilla:
-- se hace doble clic en la celda, se escribe, se guarda. No hace falta SQL para
-- cargar costos.
--
-- COMO SE LEE DESDE EL REPO
--
-- scripts/db-tabla.js, con la service role key. La anon key NO sirve: esta
-- tabla queda sin permisos para anon y authenticated a proposito (abajo), y la
-- anon key es la que la app manda al navegador para el split de gastos.

create table if not exists public.transfer_destinos (
  -- La misma clave que DEST en lib/model.js. Si se agrega un destino sin esta
  -- fila, no tiene donde cargar su costo.
  destino_key text primary key,

  -- Copias de referencia, no fuente de verdad. Ver la nota de arriba.
  nombre text not null,
  aeropuerto text,
  modo text check (modo in ('car', 'ferry', 'vuelo')),
  km numeric,
  compartido_usd numeric,
  privado_usd numeric,

  -- Lo que carga la agencia. Dos columnas de costo y no una porque el
  -- compartido se paga por persona y el privado por vehiculo de hasta 4: son
  -- unidades distintas y un solo costo las reduce a la mitad de una de las dos.
  costo_compartido numeric check (costo_compartido is null or costo_compartido >= 0),
  costo_privado numeric check (costo_privado is null or costo_privado >= 0),
  -- 0.30 es 30%. Fraccion, no 30, para que el % se vea bien en la grilla y
  -- aritmetica no haya que convertirlo cada vez que se lee.
  comision numeric check (comision is null or comision >= 0),

  -- Columnas generadas: el precio final lo calcula Postgres. Si se edita a mano
  -- se recalcula solo, y no puede quedar desincronizado del costo.
  precio_compartido numeric generated always as (
    case when costo_compartido is null or comision is null then null
    else round(costo_compartido * (1 + comision)::numeric, 2) end
  ) stored,
  precio_privado numeric generated always as (
    case when costo_privado is null or comision is null then null
    else round(costo_privado * (1 + comision)::numeric, 2) end
  ) stored,

  -- Anotacion libre: de donde sale el numero, para cuando alguien pregunte por
  -- que un destino vale mas que otro.
  nota text,
  actualizado_at timestamptz not null default now()
);

create index if not exists transfer_destinos_aeropuerto_idx
  on public.transfer_destinos (aeropuerto);

-- Sin policies, como waitlist y como reservas_viaje: esta tabla no se lee ni
-- se escribe desde el cliente, nunca. El costo del operador no es un dato que
-- deba ver alguien que esta buscando un vuelo.
--
-- El que la edita es la agencia, y entra por el Dashboard de Supabase con su
-- sesion, que va como postgres y por eso no le aplica la RLS. Los scripts del
-- repo van con la service role, que tambien la ignora.
alter table public.transfer_destinos enable row level security;

-- Sin ningun grant: ni anon ni authenticated. Un grant equivocado alcanza para
-- abrir los costos, y el costo es el unico dato de esta tabla que no es publico.
revoke all on public.transfer_destinos from anon, authenticated;

-- Las 45 filas de referencia. El costo va en null: es lo que carga la agencia.
--
-- on conflict do update SOLO de las columnas de referencia: si el seed volviera
-- a correr, no pisa un costo que ya se cargo a mano.
insert into public.transfer_destinos
  (destino_key, nombre, aeropuerto, modo, km, compartido_usd, privado_usd,
   costo_compartido, costo_privado, comision)
values
  ('rio', 'Río de Janeiro', 'GIG', 'car', 18, 22, 45, null, null, null, null)
    -- Río de Janeiro: 18 km | la app cobra US$ 22 pax / US$ 45 vehiculo,
  ('angra', 'Angra dos Reis', 'GIG', 'car', 139, 25, 98, null, null, null, null)
    -- Angra dos Reis: 139 km | la app cobra US$ 25 pax / US$ 98 vehiculo,
  ('arraial', 'Arraial do Cabo', 'GIG', 'car', 170, 30, 117, null, null, null, null)
    -- Arraial do Cabo: 170 km | la app cobra US$ 30 pax / US$ 117 vehiculo,
  ('buz', 'Búzios', 'GIG', 'car', 174, 29, 120, null, null, null, null)
    -- Búzios: 174 km | la app cobra US$ 29 pax / US$ 120 vehiculo,
  ('cabo', 'Cabo Frio', 'GIG', 'car', 160, 30, 111, null, null, null, null)
    -- Cabo Frio: 160 km | la app cobra US$ 30 pax / US$ 111 vehiculo,
  ('ilha', 'Ilha Grande', 'GIG', 'ferry', null, 48, 130, null, null, null, null)
    -- Ilha Grande: ferry | la app cobra US$ 48 pax / US$ 130 vehiculo,
  ('paraty', 'Paraty', 'GIG', 'car', 248, 35, 166, null, null, null, null)
    -- Paraty: 248 km | la app cobra US$ 35 pax / US$ 166 vehiculo,
  ('sao', 'São Paulo', 'GRU', 'car', 26, 20, 41, null, null, null, null)
    -- São Paulo: 26 km | la app cobra US$ 20 pax / US$ 41 vehiculo,
  ('ilhabela', 'Ilhabela', 'GRU', 'car', 185, 30, 127, null, null, null, null)
    -- Ilhabela: 185 km | la app cobra US$ 30 pax / US$ 127 vehiculo,
  ('ubatuba', 'Ubatuba', 'GRU', 'car', 206, 30, 140, null, null, null, null)
    -- Ubatuba: 206 km | la app cobra US$ 30 pax / US$ 140 vehiculo,
  ('bho', 'Belo Horizonte', 'CNF', 'car', 40, 20, 37, null, null, null, null)
    -- Belo Horizonte: 40 km | la app cobra US$ 20 pax / US$ 37 vehiculo,
  ('curitiba', 'Curitiba', 'CWB', 'car', 17, 20, 30, null, null, null, null)
    -- Curitiba: 17 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('rec', 'Recife', 'REC', 'car', 13, 20, 30, null, null, null, null)
    -- Recife: 13 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('porto', 'Porto de Galinhas', 'REC', 'car', 53, 20, 45, null, null, null, null)
    -- Porto de Galinhas: 53 km | la app cobra US$ 20 pax / US$ 45 vehiculo,
  ('mcz', 'Maceió', 'MCZ', 'car', 21, 20, 30, null, null, null, null)
    -- Maceió: 21 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('maragogi', 'Maragogi', 'MCZ', 'car', 129, 25, 92, null, null, null, null)
    -- Maragogi: 129 km | la app cobra US$ 25 pax / US$ 92 vehiculo,
  ('nat', 'Natal', 'NAT', 'car', 25, 20, 30, null, null, null, null)
    -- Natal: 25 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('pip', 'Pipa', 'NAT', 'car', 30, 20, 31, null, null, null, null)
    -- Pipa: 30 km | la app cobra US$ 20 pax / US$ 31 vehiculo,
  ('ssa', 'Salvador de Bahía', 'SSA', 'car', 24, 20, 30, null, null, null, null)
    -- Salvador de Bahía: 24 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('ajuda', 'Arraial d’Ajuda', 'SSA', 'car', 170, 30, 118, null, null, null, null)
    -- Arraial d’Ajuda: 170 km | la app cobra US$ 30 pax / US$ 118 vehiculo,
  ('itacare', 'Itacaré', 'SSA', 'car', 359, 40, 235, null, null, null, null)
    -- Itacaré: 359 km | la app cobra US$ 40 pax / US$ 235 vehiculo,
  ('morro', 'Morro de São Paulo', 'SSA', 'car', 242, 35, 162, null, null, null, null)
    -- Morro de São Paulo: 242 km | la app cobra US$ 35 pax / US$ 162 vehiculo,
  ('portoseguro', 'Porto Seguro', 'SSA', 'car', 699, 60, 445, null, null, null, null)
    -- Porto Seguro: 699 km | la app cobra US$ 60 pax / US$ 445 vehiculo,
  ('forte', 'Praia do Forte', 'SSA', 'car', 62, 20, 50, null, null, null, null)
    -- Praia do Forte: 62 km | la app cobra US$ 20 pax / US$ 50 vehiculo,
  ('trancoso', 'Trancoso', 'SSA', 'car', 163, 30, 113, null, null, null, null)
    -- Trancoso: 163 km | la app cobra US$ 30 pax / US$ 113 vehiculo,
  ('for', 'Fortaleza', 'FOR', 'car', 9, 20, 30, null, null, null, null)
    -- Fortaleza: 9 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('jericoacoara', 'Jericoacoara', 'FOR', 'car', 295, 35, 195, null, null, null, null)
    -- Jericoacoara: 295 km | la app cobra US$ 35 pax / US$ 195 vehiculo,
  ('fernando', 'Fernando de Noronha', 'FEN', 'vuelo', null, null, 95, null, null, null, null)
    -- Fernando de Noronha: vuelo | la app cobra US$ 0 pax / US$ 95 vehiculo,
  ('fln', 'Florianópolis', 'FLN', 'car', 17, 20, 30, null, null, null, null)
    -- Florianópolis: 17 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('bcm', 'Balneário Camboriú', 'FLN', 'car', 96, 25, 72, null, null, null, null)
    -- Balneário Camboriú: 96 km | la app cobra US$ 25 pax / US$ 72 vehiculo,
  ('bombinhas', 'Bombinhas', 'FLN', 'car', 89, 25, 67, null, null, null, null)
    -- Bombinhas: 89 km | la app cobra US$ 25 pax / US$ 67 vehiculo,
  ('ferrugem', 'Ferrugem', 'FLN', 'car', 100, 25, 74, null, null, null, null)
    -- Ferrugem: 100 km | la app cobra US$ 25 pax / US$ 74 vehiculo,
  ('garopaba', 'Garopaba', 'FLN', 'car', 89, 25, 67, null, null, null, null)
    -- Garopaba: 89 km | la app cobra US$ 25 pax / US$ 67 vehiculo,
  ('itapema', 'Itapema', 'FLN', 'car', 88, 25, 67, null, null, null, null)
    -- Itapema: 88 km | la app cobra US$ 25 pax / US$ 67 vehiculo,
  ('picarras', 'Piçarras', 'FLN', 'car', 129, 25, 92, null, null, null, null)
    -- Piçarras: 129 km | la app cobra US$ 25 pax / US$ 92 vehiculo,
  ('rosa', 'Praia do Rosa', 'FLN', 'car', 96, 25, 72, null, null, null, null)
    -- Praia do Rosa: 96 km | la app cobra US$ 25 pax / US$ 72 vehiculo,
  ('poa', 'Porto Alegre', 'POA', 'car', 9, 20, 30, null, null, null, null)
    -- Porto Alegre: 9 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('canela', 'Canela', 'POA', 'car', 115, 25, 83, null, null, null, null)
    -- Canela: 115 km | la app cobra US$ 25 pax / US$ 83 vehiculo,
  ('canoa', 'Capão da Canoa', 'POA', 'car', 135, 25, 96, null, null, null, null)
    -- Capão da Canoa: 135 km | la app cobra US$ 25 pax / US$ 96 vehiculo,
  ('gram', 'Gramado', 'POA', 'car', 109, 25, 80, null, null, null, null)
    -- Gramado: 109 km | la app cobra US$ 25 pax / US$ 80 vehiculo,
  ('torres', 'Torres', 'POA', 'car', 184, 30, 126, null, null, null, null)
    -- Torres: 184 km | la app cobra US$ 30 pax / US$ 126 vehiculo,
  ('igu', 'Foz de Iguazú', 'IGU', 'car', 14, 20, 30, null, null, null, null)
    -- Foz de Iguazú: 14 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('joaopessoa', 'João Pessoa', 'JPA', 'car', 13, 20, 30, null, null, null, null)
    -- João Pessoa: 13 km | la app cobra US$ 20 pax / US$ 30 vehiculo,
  ('bue', 'Buenos Aires', 'EZE', 'car', 32, 20, 32, null, null, null, null)
    -- Buenos Aires: 32 km | la app cobra US$ 20 pax / US$ 32 vehiculo
on conflict (destino_key) do update set
  nombre = excluded.nombre,
  aeropuerto = excluded.aeropuerto,
  modo = excluded.modo,
  km = excluded.km,
  compartido_usd = excluded.compartido_usd,
  privado_usd = excluded.privado_usd,
  actualizado_at = now();

-- Marcar cuando se toco el costo a mano, sin depender de que alguien se acuerde.
create or replace function public.transfer_destinos_tocar() returns trigger
language plpgsql as $$
begin
  new.actualizado_at = now();
  return new;
end;
$$;

drop trigger if exists transfer_destinos_tocar on public.transfer_destinos;
create trigger transfer_destinos_tocar
  before update on public.transfer_destinos
  for each row execute function public.transfer_destinos_tocar();
