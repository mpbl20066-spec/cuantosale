/*
 * Genera supabase_transfer_costos.sql: la tabla de costos que carga la agencia
 * mas las 45 filas de referencia.
 *
 * Se genera en vez de escribirse a mano por la misma razon que el resto de las
 * tablas del repo: el destino_key tiene que coincidir con DEST de lib/model.js,
 * y si alguien lo tipea mal el costo queda pegado a un destino que no existe
 * sin que nada se queje. Ver scripts/validar-transfer.js y prueba-destinos.js.
 */
const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const SRC = path.join(BASE, 'data', 'transfer-precios.json');
const OUT = path.join(BASE, 'supabase_transfer_costos.sql');

const tabla = JSON.parse(fs.readFileSync(SRC, 'utf8')).destinos;

// Mismo orden que la tabla del .xlsx (scripts/armar-tabla-transfers.py).
const ORD = ['GIG', 'GRU', 'CNF', 'CWB', 'REC', 'MCZ', 'NAT', 'SSA', 'FOR', 'FEN',
  'FLN', 'POA', 'IGU', 'JPA', 'EZE'];
const HUB = new Set(['rio', 'sao', 'fln', 'poa', 'nat', 'ssa', 'rec', 'for', 'mcz',
  'bho', 'curitiba', 'igu', 'joaopessoa', 'fernando', 'bue']);

const filas = Object.entries(tabla);
filas.sort((a, b) => (
  (ORD.indexOf(a[1].iata) < 0 ? 99 : ORD.indexOf(a[1].iata)) -
  (ORD.indexOf(b[1].iata) < 0 ? 99 : ORD.indexOf(b[1].iata)) ||
  (HUB.has(a[0]) ? 0 : 1) - (HUB.has(b[0]) ? 0 : 1) ||
  a[1].nombre.localeCompare(b[1].nombre, 'es')
));

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const inserts = filas.map(([key, v]) =>
  `  (${q(key)}, ${q(v.nombre)}, ${q(v.iata)}, ${q(v.modo)}, ${v.km ?? 'null'}, ` +
  `${v.compartido || 'null'}, ${v.privado ?? 'null'}, null, null, null, null)` +
  `\n    -- ${v.nombre}: ${v.km != null ? v.km + ' km' : v.modo} | ` +
  `la app cobra US$ ${v.compartido || 0} pax / US$ ${v.privado} vehiculo`);

const sql = `-- Costo de venta de los transfers, cargado por la agencia.
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
${inserts.join(',\n')}
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
`;

fs.writeFileSync(OUT, sql, 'utf8');
console.log('OK ->', OUT);
console.log('filas:', filas.length);
