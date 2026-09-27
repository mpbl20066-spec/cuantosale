'use strict';
/*
 * Modelo de costos de CuántoSale.
 *
 * Todo lo que no viene de una fuente real se ESTIMA con reglas simples
 * (temporada, día de la semana, anticipación). Cuando un proveedor entrega un
 * precio real de vuelo (quote), reemplaza la estimación del pasaje y el
 * resultado lo marca como "real".º
 */

const MODES = {
  avion_mvd: { label: 'Vuelo desde Montevideo', short: 'Vuelo desde Montevideo', kind: 'flight', comfort: 3,
    tip: 'Salís desde Carrasco, sin cruces ni combinaciones.' },
  avion_ba: { label: 'Salir por Buenos Aires', short: 'Salir por Buenos Aires', kind: 'flight', comfort: 2,
    tip: 'Cruzás a Buenos Aires en ferry o bus y volás desde Aeroparque o Ezeiza.' },
  ferry: { label: 'Ferry desde Colonia', short: 'Ferry desde Colonia', kind: 'ground', comfort: 2,
    tip: 'Cruce corto en barco, sin pasar por aeropuertos.' },
  bus: { label: 'Bus semicama / cama', short: 'Bus semicama/cama desde Montevideo', kind: 'ground', comfort: 1,
    tip: 'Tarda más, pero cuesta bastante menos que volar.' },
  auto: { label: 'Auto / Roadtrip', short: 'Auto / Roadtrip', kind: 'roadtrip', comfort: 2,
    tip: 'Viajás a tu ritmo; el cálculo incluye combustible y peajes de ida y vuelta.' }
};

// Kilómetros por ruta de ida desde Montevideo, peajes estimados y horas de
// manejo al volante (sin paradas de descanso).
//
// `km` y `hours` salen de rutas reales de OSRM
// (https://router.project-osrm.org, perfil auto) consultadas desde MVD, no de
// estimar a ojo. Los peajes siguen siendo aproximados: OSRM no los trae.
//
// Antes este grupo tenía valores que no podían existir: el roadtrip a
// Florianópolis declaraba 720 km cuando la línea recta ya son 1087, y una
// ruta por carretera nunca es más corta que la línea recta. El mismo error
// arrastraba a todo el litoral de Santa Catarina. Eso subestimaba el
// combustible, las horas de manejo y el número de cargas del eléctrico.
// La prueba 'ningún roadtrip es más corto que la línea recta' en test.js
// impide que vuelva a colarse un valor así.
const ROADTRIP_ROUTES = {
  // Buenos Aires se deja en 650 a propósito: por ruta son ~579 km, pero el
  // viaje habitual es en ferry por Colonia, y con la alternativa suma.
  bue: { km: 650, tolls: 78, hours: 9 },
  fln: { km: 1245, tolls: 42, hours: 17 }, rio: { km: 2355, tolls: 120, hours: 31.5 },
  buz: { km: 2050, tolls: 128, hours: 25 }, igu: { km: 1375, tolls: 76, hours: 17.7 },
  ssa: { km: 3300, tolls: 205, hours: 40 }, sao: { km: 2050, tolls: 132, hours: 25 },
  poa: { km: 800, tolls: 55, hours: 11.6 }, rec: { km: 4500, tolls: 270, hours: 54 },
  for: { km: 5100, tolls: 300, hours: 62 }, mcz: { km: 4100, tolls: 245, hours: 49 },
  nat: { km: 4700, tolls: 280, hours: 57 }, pip: { km: 4750, tolls: 282, hours: 58 },
  // Litoral y norte de Santa Catarina. Todos por arriba de 1100 km: son
  // destinos de un día largo de manejar, no de un fin de semana corto.
  camboriu: { km: 1310, tolls: 40, hours: 17.8 }, bcm: { km: 1310, tolls: 40, hours: 17.8 },
  bombinhas: { km: 1305, tolls: 44, hours: 17.9 }, rosa: { km: 1180, tolls: 38, hours: 16.2 },
  // Paradas nuevas del mismo corredor, interpoladas por latitud entre las
  // vecinas de arriba. La distancia por ruta crece monotonamente hacia el
  // norte en esta tabla, asi que el kilometraje se puede interpolar entre los
  // dos destinos que la rodean. Las horas salen de km/73 en Santa Catarina
  // (rosa, fln, bombinhas y bcm dan exactamente eso) y de km/70 en Rio Grande
  // do Sul, que rinden mas (poa, canela y gram). Los peajes no siguen la
  // distancia: en SC valen 38-44, y en RS son ~54 porque se cruza la plaza de
  // peaje de la Rota de Santa Maria, que esta al norte de Torres y de Canoa.
  itapema: { km: 1307, tolls: 42, hours: 17.9 }, picarras: { km: 1310, tolls: 40, hours: 17.9 },
  garopaba: { km: 1192, tolls: 40, hours: 16.3 }, ferrugem: { km: 1183, tolls: 38, hours: 16.2 },
  torres: { km: 916, tolls: 54, hours: 13.1 }, canoa: { km: 887, tolls: 54, hours: 12.7 },
  // Sierra gaúcha, un poco más allá de Porto Alegre.
  gram: { km: 905, tolls: 54, hours: 13.3 }, canela: { km: 915, tolls: 54, hours: 13.5 }
};
const ROADTRIP_ALLOWED_DESTINATIONS = new Set(['rio', 'bue', 'fln', 'bcm', 'gram', 'canela', 'igu', 'poa', 'camboriu', 'bombinhas', 'rosa', 'garopaba', 'ferrugem', 'picarras', 'itapema', 'torres', 'canoa']);
// Coordenadas aproximadas del centro de cada destino habilitado para roadtrip.
// Antes servían para consultar cargadores cercanos en Open Charge Map; ya no
// se listan cargadores, y hoy se usan para comprobar que ninguna ruta por
// carretera sea más corta que su línea recta (ver test.js).
const DEST_COORDS = {
  rio: { lat: -22.9068, lng: -43.1729 }, bue: { lat: -34.6037, lng: -58.3816 },
  fln: { lat: -27.5954, lng: -48.5480 }, bcm: { lat: -26.9906, lng: -48.6349 },
  camboriu: { lat: -26.9930, lng: -48.6350 }, gram: { lat: -29.3747, lng: -50.8764 },
  canela: { lat: -29.3667, lng: -50.8167 }, igu: { lat: -25.5478, lng: -54.5882 },
  poa: { lat: -30.0346, lng: -51.2177 }, bombinhas: { lat: -27.1500, lng: -48.4833 },
  rosa: { lat: -28.1167, lng: -48.6167 },
  // Paradas del litoral sur, todas sobre el corredor de la BR-101 desde
  // Montevideo. Coordenadas del centro del pueblo, aproximadas al grado, que es
  // lo que necesita la comprobacion de que la ruta por carretera no sea mas
  // corta que la linea recta.
  garopaba: { lat: -28.0236, lng: -48.6069 }, ferrugem: { lat: -28.1300, lng: -48.5500 },
  picarras: { lat: -26.9900, lng: -48.6700 }, itapema: { lat: -27.1000, lng: -48.6700 },
  torres: { lat: -29.3344, lng: -49.7336 }, canoa: { lat: -29.6167, lng: -50.0333 }
};
// Puntos de salida del roadtrip. Se usan como origen en la comprobación de que
// ninguna ruta sea más corta que su línea recta: como el destino puede ser
// MVD o PDP, la cota hay que verificar contra los dos.
const ORIGIN_COORDS = {
  MVD: { lat: -34.9011, lng: -56.1645 },
  PDP: { lat: -34.9678, lng: -54.9511 }
};

function isRoadtripAllowed(destKey) {
  return ROADTRIP_ALLOWED_DESTINATIONS.has(String(destKey || '').toLowerCase());
}

// pp = precio estimado por persona (ida y vuelta, US$). iata = código para buscar vuelos reales.
const DEST = {
  bue: { name: 'Buenos Aires', region: 'Buenos Aires', country: 'Argentina', iata: 'EZE', group: 'city', f: 0.88, lodge: [48, 90, 160],
    modes: { bus: { pp: 78, dur: 'unas 8 h por tierra' }, avion_mvd: { pp: 220, dur: 'unas 1 h de vuelo' } } },
  buz: { name: 'Búzios', region: 'Río de Janeiro', iata: 'GIG', group: 'beach', f: 1.00, lodge: [60, 105, 185],
    modes: { avion_ba: { pp: 410, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 500, dur: 'unas 6 h con escala' } } },
  arraial: { name: 'Arraial do Cabo', region: 'Río de Janeiro', iata: 'GIG', group: 'beach', f: 0.98, lodge: [55, 95, 165],
    modes: { avion_ba: { pp: 390, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 480, dur: 'unas 6 h con escala' } } },
  cabo: { name: 'Cabo Frio', region: 'Río de Janeiro', iata: 'GIG', group: 'beach', f: 0.98, lodge: [52, 92, 160],
    modes: { avion_ba: { pp: 390, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 470, dur: 'unas 6 h con escala' } } },
  ilha: { name: 'Ilha Grande', region: 'Río de Janeiro', iata: 'GIG', group: 'beach', f: 0.99, lodge: [60, 100, 175],
    modes: { avion_ba: { pp: 410, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 500, dur: 'unas 6 h con escala' } } },
  paraty: { name: 'Paraty', region: 'Río de Janeiro', iata: 'GIG', group: 'beach', f: 0.98, lodge: [58, 100, 170],
    modes: { avion_ba: { pp: 420, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 510, dur: 'unas 6 h con escala' } } },
  ilhabela: { name: 'Ilhabela', region: 'São Paulo', iata: 'GRU', group: 'beach', f: 1.02, lodge: [60, 105, 180],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 7 h con escala' } } },
  ubatuba: { name: 'Ubatuba', region: 'São Paulo', iata: 'GRU', group: 'beach', f: 1.00, lodge: [58, 102, 175],
    modes: { avion_ba: { pp: 420, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 510, dur: 'unas 7 h con escala' } } },
  rio: { name: 'Río de Janeiro', region: 'Río de Janeiro', iata: 'RIO', group: 'beach', f: 1.05, lodge: [55, 95, 170],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 6 h con escala' } } },
  angra: { name: 'Angra dos Reis', region: 'Río de Janeiro', iata: 'GIG', group: 'beach', f: 1.00, lodge: [58, 100, 175],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 6 h con escala' } } },
  sao: { name: 'São Paulo', region: 'São Paulo', iata: 'SAO', group: 'city', f: 1.00, lodge: [50, 90, 160],
    modes: { avion_ba: { pp: 320, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 390, dur: 'unas 3 h de vuelo' } } },
  bho: { name: 'Belo Horizonte', region: 'Minas Gerais', iata: 'CNF', group: 'city', f: 0.92, lodge: [48, 88, 155],
    modes: { avion_ba: { pp: 290, cross: 90, dur: 'unas 7 h en total' }, avion_mvd: { pp: 360, dur: 'unas 4 h con escala' } } },
  curitiba: { name: 'Curitiba', region: 'Paraná', iata: 'CWB', group: 'city', f: 0.90, lodge: [42, 80, 140],
    modes: { avion_ba: { pp: 260, cross: 90, dur: 'unas 7 h en total' }, avion_mvd: { pp: 330, dur: 'unas 4 h con escala' } } },
  porto: { name: 'Porto de Galinhas', region: 'Pernambuco', iata: 'REC', group: 'beach', f: 0.96, lodge: [55, 95, 165],
    modes: { avion_ba: { pp: 470, cross: 90, dur: 'unas 11 h en total' }, avion_mvd: { pp: 540, dur: 'unas 8 h con escala' } } },
  mcz: { name: 'Maceió', region: 'Alagoas', iata: 'MCZ', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 510, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 600, dur: 'unas 9 h con escala' } } },
  maragogi: { name: 'Maragogi', region: 'Alagoas', iata: 'MCZ', group: 'beach', f: 0.94, lodge: [48, 88, 155],
    modes: { avion_ba: { pp: 500, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 590, dur: 'unas 9 h con escala' } } },
  nat: { name: 'Natal', region: 'Río Grande do Norte', iata: 'NAT', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 530, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 620, dur: 'unas 10 h con escala' } } },
  pip: { name: 'Pipa', region: 'Río Grande do Norte', iata: 'NAT', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 540, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 630, dur: 'unas 10 h con escala' } } },
  trancoso: { name: 'Trancoso / Arraial d’Ajuda', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.94, lodge: [58, 105, 180],
    modes: { avion_ba: { pp: 520, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 610, dur: 'unas 9 h con escala' } } },
  ssa: { name: 'Salvador de Bahía', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.95, lodge: [45, 80, 150],
    modes: { avion_ba: { pp: 480, cross: 90, dur: 'unas 11 h en total' }, avion_mvd: { pp: 570, dur: 'unas 8 h con escala' } } },
  for: { name: 'Fortaleza / Jericoacoara', region: 'Ceará', iata: 'FOR', group: 'beach', f: 0.95, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 540, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 630, dur: 'unas 10 h con escala' } } },
  jericoacoara: { name: 'Jericoacoara', region: 'Ceará', iata: 'FOR', group: 'beach', f: 0.96, lodge: [47, 90, 160],
    modes: { avion_ba: { pp: 560, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 650, dur: 'unas 10 h con escala' } } },
  morro: { name: 'Morro de São Paulo', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.94, lodge: [48, 90, 160],
    modes: { avion_ba: { pp: 500, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 590, dur: 'unas 9 h con escala' } } },
  // Los tres siguientes salen de Bahia, del corredor de Salvador. Puerto
  // Seguro e Itacare se comparan con Trancoso: mismo tipo de pueblo de playa,
  // algo mas barato porque no son jetset. Praia do Forte con Morro: resort a
  // 100 km de la capital, un poco mas caro en alojamiento y mas barato en
  // comida que un pueblo.
  portoseguro: { name: 'Porto Seguro', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.93, lodge: [56, 102, 175],
    modes: { avion_ba: { pp: 510, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 600, dur: 'unas 9 h con escala' } } },
  itacare: { name: 'Itacaré', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.93, lodge: [54, 98, 170],
    modes: { avion_ba: { pp: 515, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 605, dur: 'unas 9 h con escala' } } },
  forte: { name: 'Praia do Forte', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.93, lodge: [50, 92, 162],
    modes: { avion_ba: { pp: 490, cross: 90, dur: 'unas 11 h en total' }, avion_mvd: { pp: 580, dur: 'unas 8 h con escala' } } },
  fernando: { name: 'Fernando de Noronha', region: 'Pernambuco', iata: 'NVT', group: 'beach', f: 1.12, lodge: [80, 145, 240],
    modes: { avion_ba: { pp: 620, cross: 90, dur: 'unas 15 h en total' }, avion_mvd: { pp: 710, dur: 'unas 11 h con escala' } } },
  fln: { name: 'Florianópolis', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.95, lodge: [50, 90, 160],
    modes: { bus: { pp: 200, dur: 'unas 22 h' }, avion_ba: { pp: 340, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 430, dur: 'unas 6 h con escala' } } },
  camboriu: { name: 'Camboriú', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.95, lodge: [52, 94, 170],
    modes: { bus: { pp: 210, dur: 'unas 22 h' }, avion_ba: { pp: 350, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 440, dur: 'unas 6 h con escala' } } },
  bombinhas: { name: 'Bombinhas', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.94, lodge: [52, 96, 170],
    modes: { bus: { pp: 220, dur: 'unas 23 h' }, avion_ba: { pp: 360, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 450, dur: 'unas 6 h con escala' } } },
  rosa: { name: 'Praia do Rosa', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.93, lodge: [54, 98, 175],
    modes: { bus: { pp: 230, dur: 'unas 23 h' }, avion_ba: { pp: 370, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 460, dur: 'unas 6 h con escala' } } },
  bcm: { name: 'Balneário Camboriú', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.96, lodge: [52, 92, 165],
    modes: { bus: { pp: 190, dur: 'unas 20 h' }, avion_ba: { pp: 330, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 420, dur: 'unas 5 h con escala' } } },
  // Costa de Santa Catarina. El bus sale mas barato segun cuanto este la parada
  // al norte del estado. Itapema es el unico que queda por ARRIBA de su
  // comparable: Camboriu era el balneario premium de la costa norte y Itapema
  // lo es hoy.
  itapema: { name: 'Itapema', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.97, lodge: [55, 98, 175],
    modes: { bus: { pp: 185, dur: 'unas 20 h' }, avion_ba: { pp: 325, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 415, dur: 'unas 5 h con escala' } } },
  garopaba: { name: 'Garopaba', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.93, lodge: [50, 94, 168],
    modes: { bus: { pp: 225, dur: 'unas 23 h' }, avion_ba: { pp: 365, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 455, dur: 'unas 6 h con escala' } } },
  ferrugem: { name: 'Ferrugem', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.92, lodge: [52, 95, 170],
    modes: { bus: { pp: 230, dur: 'unas 23 h' }, avion_ba: { pp: 375, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 465, dur: 'unas 6 h con escala' } } },
  picarras: { name: 'Piçarras', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.91, lodge: [50, 92, 165],
    modes: { bus: { pp: 240, dur: 'unas 24 h' }, avion_ba: { pp: 385, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 475, dur: 'unas 6 h con escala' } } },
  gram: { name: 'Gramado', region: 'Río Grande do Sul', iata: 'POA', group: 'nature', f: 0.88, lodge: [48, 89, 155],
    modes: { bus: { pp: 160, dur: 'unas 18 h' }, avion_ba: { pp: 300, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 380, dur: 'unas 4 h con escala' } } },
  canela: { name: 'Canela', region: 'Río Grande do Sul', iata: 'POA', group: 'nature', f: 0.88, lodge: [50, 90, 160],
    modes: { bus: { pp: 160, dur: 'unas 18 h' }, avion_ba: { pp: 300, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 380, dur: 'unas 4 h con escala' } } },
  // Litoral de Rio Grande do Sul. Se comparan con Gramado porque vuelan al
  // mismo aeropuerto, pero son balnearios de playa: mas baratos en alojamiento
  // y comida que la ciudad serrana. Canoa esta 100 km al sur de Torres, asi
  // que baja un poco mas.
  torres: { name: 'Torres', region: 'Río Grande do Sul', iata: 'POA', group: 'beach', f: 0.87, lodge: [46, 86, 152],
    modes: { bus: { pp: 165, dur: 'unas 18 h' }, avion_ba: { pp: 305, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 385, dur: 'unas 4 h con escala' } } },
  canoa: { name: 'Capão da Canoa', region: 'Río Grande do Sul', iata: 'POA', group: 'beach', f: 0.86, lodge: [44, 82, 145],
    modes: { bus: { pp: 170, dur: 'unas 19 h' }, avion_ba: { pp: 310, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 390, dur: 'unas 4 h con escala' } } },
  igu: { name: 'Foz de Iguazú', region: 'Paraná', iata: 'IGU', group: 'city', f: 0.85, lodge: [40, 75, 130],
    modes: { bus: { pp: 160, dur: 'unas 18 h' }, avion_ba: { pp: 280, cross: 90, dur: 'unas 7 h en total' }, avion_mvd: { pp: 350, dur: 'unas 5 h con escala' } } },
  rec: { name: 'Recife', region: 'Pernambuco', iata: 'REC', group: 'beach', f: 0.95, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 520, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 610, dur: 'unas 9 h con escala' } } },
  // Unico destino con aeropuerto propio que se agrega: JPA. Se compara con
  // Recife porque queda 300 km al norte y comparte el mismo corredor de vuelo.
  joaopessoa: { name: 'João Pessoa', region: 'Paraíba', iata: 'JPA', group: 'beach', f: 0.92, lodge: [44, 84, 148],
    modes: { avion_ba: { pp: 515, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 605, dur: 'unas 9 h con escala' } } },
  poa: { name: 'Porto Alegre', region: 'Río Grande do Sul', iata: 'POA', group: 'city', f: 0.85, lodge: [40, 75, 130],
    modes: { bus: { pp: 120, dur: 'unas 12 h' }, avion_ba: { pp: 250, cross: 90, dur: 'unas 6 h en total' }, avion_mvd: { pp: 310, dur: 'unas 2 h de vuelo' } } }
};
const TIERS = [
  { id: 'eco',     label: 'económico',  desc: 'Hostel u hotel simple', comfort: 1, meal: 25, local: 6,  transfer: 0.5 },
  { id: 'medio',   label: 'intermedio', desc: 'Hotel 3 estrellas',     comfort: 2, meal: 40, local: 10, transfer: 1 },
  { id: 'confort', label: 'confort',    desc: 'Hotel 4 estrellas',     comfort: 3, meal: 65, local: 18, transfer: 1.4 }
];

// Valores diarios de referencia en USD basados en precios de mercado locales.
// Se aplican por noche y por pasajero, sin factores estacionales.
const REAL_COSTS = {
  foodPerDay: { eco: 14, medio: 28, confort: 55 },
  localTransportPerDay: { standard: 9, beachSpecific: 12 },
  beachSpecificDestinations: ['buz', 'pip']
};

// Costos diarios por destino (USD por persona). Cada destino conserva sus
// propios valores para movilidad y gastronomía, sin aplicar categorías globales.
const DESTINATION_COSTS = {
  bue: { transport: { eco: 18, confort: 38 }, food: { casual: 30, moderado: 58, gourmet: 100 } },
  sao: { transport: { eco: 22, confort: 48 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  buz: { transport: { eco: 18, confort: 38 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  arraial: { transport: { eco: 14, confort: 28 }, food: { casual: 25, moderado: 45, gourmet: 75 } },
  cabo: { transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  ilha: { transport: { eco: 10, confort: 30 }, food: { casual: 28, moderado: 52, gourmet: 90 } },
  paraty: { transport: { eco: 12, confort: 26 }, food: { casual: 24, moderado: 44, gourmet: 75 } },
  ilhabela: { transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 58, gourmet: 95 } },
  ubatuba: { transport: { eco: 15, confort: 32 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  rio: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 95 } },
  bho: { transport: { eco: 14, confort: 28 }, food: { casual: 22, moderado: 42, gourmet: 75 } },
  porto: { transport: { eco: 15, confort: 32 }, food: { casual: 28, moderado: 52, gourmet: 85 } },
  mcz: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  maragogi: { transport: { eco: 13, confort: 28 }, food: { casual: 24, moderado: 45, gourmet: 75 } },
  nat: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 48, gourmet: 80 } },
  pip: { transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 55, gourmet: 90 } },
  trancoso: { transport: { eco: 20, confort: 45 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  ssa: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  for: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  jericoacoara: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  fernando: { transport: { eco: 30, confort: 75 }, food: { casual: 50, moderado: 95, gourmet: 160 } },
  fln: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  bcm: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  gram: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } },
  canela: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } },
  igu: { transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  // Angra tiene los mismos numeros que Rio de Janeiro, que es un copy-paste
  // viejo: son la misma region y casi la misma distancia al aeropuerto, asi que
  // nadie lo notaba. Al ofrecerla como destino propio se hacia visible, y es una
  // isla de resort: la comida y el traslado suben.
  angra: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 105 } },
  curitiba: { transport: { eco: 22, confort: 48 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  morro: { transport: { eco: 20, confort: 45 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  camboriu: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  bombinhas: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  rosa: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  // Costa de Santa Catarina. El transporte baja un poco respecto de Bombinhas y
  // Praia do Rosa porque son pueblos chicos con menos traslado diario, y la
  // comida tambien: no hay vida de resort.
  itapema: { transport: { eco: 15, confort: 32 }, food: { casual: 28, moderado: 54, gourmet: 92 } },
  garopaba: { transport: { eco: 15, confort: 33 }, food: { casual: 25, moderado: 50, gourmet: 86 } },
  ferrugem: { transport: { eco: 16, confort: 35 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  picarras: { transport: { eco: 16, confort: 35 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  // Bahia. Puerto Seguro e Itacare copian el perfil de Trancoso (pueblo de
  // playa con vida nocturna); Praia do Forte es resort turistico, asi que
  // comida mas cara pero traslado mas barato.
  portoseguro: { transport: { eco: 18, confort: 40 }, food: { casual: 33, moderado: 60, gourmet: 105 } },
  itacare: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 58, gourmet: 100 } },
  forte: { transport: { eco: 18, confort: 40 }, food: { casual: 34, moderado: 62, gourmet: 105 } },
  // Litoral de Rio Grande do Sul: mas barato que Gramado en las dos categorias.
  torres: { transport: { eco: 15, confort: 33 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  canoa: { transport: { eco: 14, confort: 31 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  // Recife no tenia entrada y caia al fallback de rio: por eso sus costos
  // diarios de comida y transporte eran los de Rio de Janeiro. Joao Pessoa se
  // deriva de Recife ya corregido, no del fallback.
  rec: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 82 } },
  joaopessoa: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 82 } },
  // Porto Alegre era el unico destino sin entrada, asi que caia al fallback de
  // rio y facturaba comida y traslado de Rio de Janeiro. Es una capital de
  // 1,4 M con el alojamiento mas barato del catalogo (lodge 40/75/130), asi que
  // cobrandole los numeros de Rio el total le salia mas caro que a un
  // balneario de Santa Catarina.
  //
  // Comida: entre Torres (pueblo) y Gramado (resort de la misma provincia),
  // porque es ciudad pero no es destino turistico. El Sul es la region mas cara
  // del pais en prato feito (R$ 34,90, IPF jun/2026) pero el almuerzo por kilo
  // del Mercado Publico y el bufet de Bom Fim lo mantienen barato: R$ 30-50 el
  // almuerzo, R$ 45-65 el ejecutivo, R$ 80-150 la cena con bebida.
  // Transporte: el mas barato de la tabla con Foz. Onibus/metro R$ 5,17 el
  // pasaje y taxi desde R$ 10,16.
  poa: { transport: { eco: 13, confort: 30 }, food: { casual: 27, moderado: 50, gourmet: 90 } }
};
function destinationCosts(destKey) { return DESTINATION_COSTS[destKey] || DESTINATION_COSTS.rio; }

const SEASON = {
  beach:  [1.45, 1.35, 0.95, 0.85, 0.75, 0.80, 1.15, 0.90, 0.85, 0.90, 0.95, 1.30],
  city:   [1.10, 1.00, 1.00, 1.00, 0.90, 0.90, 1.20, 0.95, 0.95, 1.00, 1.00, 1.25],
  europe: [0.85, 0.85, 0.95, 1.10, 1.10, 1.20, 1.35, 1.30, 1.10, 1.00, 0.85, 1.10]
};
const WD = [1.10, 0.98, 0.93, 0.92, 1.00, 1.12, 1.05];

/* ---------- utilidades de fecha ---------- */
function getToday() { const t = new Date(); t.setHours(12, 0, 0, 0); return t; }
function addDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parse(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
function daysBetween(a, b) { return Math.round((b - a) / 864e5); }
function hash(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; }
function noise(d, k) { return ((hash(iso(d) + k) % 1000) / 1000 - 0.5) * 0.12; }

/* ---------- estimaciones ---------- */
function advance(dep, today) { const n = daysBetween(today, dep); return n < 21 ? 1.25 : (n < 45 ? 1.10 : (n > 120 ? 0.95 : 1)); }
function flightMult(dk, dep, ret, today) {
  const g = DEST[dk].group;
  const season = SEASON[g] || SEASON.beach;
  let s = season[dep.getMonth()] * 0.6 + season[ret.getMonth()] * 0.4;
  s = 1 + (s - 1) * 0.7;
  const w = (WD[dep.getDay()] + WD[ret.getDay()]) / 2;
  const n = 1 + (noise(dep, dk) + noise(ret, dk)) / 2;
  return s * w * n * advance(dep, today);
}
function lodgingNightlyCosts(dk, ti, dep, nights) {
  const destination = DEST[dk];
  if (!destination) return [];
  const group = destination.group, season = SEASON[group] || SEASON.beach;
  const count = Math.max(0, Number(nights) || 0);
  const safeTier = Math.max(0, Math.min(destination.lodge.length - 1, Number(ti) || 0));
  const costs = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(dep, i), weekend = (date.getDay() === 5 || date.getDay() === 6) ? 1.1 : 1;
    costs.push(destination.lodge[safeTier] * season[date.getMonth()] * weekend * (1 + noise(date, dk + safeTier) * 0.6));
  }
  return costs;
}
function lodgingCost(dk, ti, dep, nights, rooms) {
  return lodgingNightlyCosts(dk, ti, dep, nights).reduce(function (sum, nightly) { return sum + nightly; }, 0) * rooms;
}

function roadtripCost(dk, kmPerLiter, fuelPriceUsd) {
  const route = ROADTRIP_ROUTES[dk];
  if (!route) return null;
  const consumption = Number(kmPerLiter);
  const safeConsumption = Number.isFinite(consumption) && consumption >= 3 && consumption <= 40 ? consumption : 12;
  const fuelPrice = Number(fuelPriceUsd) > 0 ? Number(fuelPriceUsd) : 1.2;
  const liters = Math.round((route.km * 2 / safeConsumption) * 10) / 10;
  const fuelUsd = Math.round(liters * fuelPrice);
  return { distanceKm: route.km, roundTripKm: route.km * 2, kmPerLiter: safeConsumption, liters: liters,
    fuelPriceUsd: fuelPrice, fuelUsd: fuelUsd, tollsUsd: route.tolls, totalUsd: fuelUsd + route.tolls,
    hours: route.hours, source: 'estimación de ruta ida y vuelta, combustible en Brasil y peajes' };
}

/* ---------- cálculo de una propuesta ---------- */
function calc(dk, modeId, ti, pax, dep, ret, today, quote, kmPerLiter, fuelPriceUsd, hotelTypeOverride) {
  const D = DEST[dk], roadtrip = modeId === 'auto' ? roadtripCost(dk, kmPerLiter, fuelPriceUsd) : null;
  const M = D.modes[modeId] || { dur: roadtrip ? 'unas ' + roadtrip.hours + ' h de manejo' : '' }, T = TIERS[ti], MO = MODES[modeId];
  const nights = daysBetween(dep, ret);
  const rooms = Math.ceil(pax / 2), cars = Math.ceil(pax / 4);
  const dailyCosts = destinationCosts(dk);
  const hotelType = String(hotelTypeOverride || 'intermedio');
  const hotelTypeFactor = ({ 'all-inclusive': 1.7, resort: 1.35, boutique: 1.22, economico: 0.82, confort: 1.3 })[hotelType] || 1;
  const baseHotelCost = lodgingCost(dk, ti, dep, nights, rooms);
  const baseMealCost = dailyCosts.food[T.id === 'eco' ? 'casual' : T.id === 'confort' ? 'gourmet' : 'moderado'] * nights * pax;
  const fm = roadtrip ? 1 : flightMult(dk, dep, ret, today), flight = MO.kind === 'flight';
  const realFlight = flight && quote && quote.pp > 0;
  // Tanto el precio real de la búsqueda de vuelos (por adulto) como la
  // estimación son multiplicados aquí una sola vez por la cantidad de
  // pasajeros.
  const flightPerPerson = roadtrip ? 0 : (realFlight ? quote.pp : M.pp * (flight ? fm : 1 + (fm - 1) * 0.5));
  const base = flightPerPerson * pax;
  const cross = (M.cross || 0) * pax * (1 + (fm - 1) * 0.3);
  const parts = {
    pasajes: flight ? base + cross : 0,
    bus: modeId === 'bus' ? base + cross : 0,
    alojamiento: baseHotelCost * hotelTypeFactor,
    comidas: hotelType === 'all-inclusive' ? 0 : baseMealCost,
    local: dailyCosts.transport[T.id === 'confort' ? 'confort' : 'eco'] * nights * pax,
    traslados: roadtrip || modeId === 'bus' ? 0 : cars * 2 * 25 * D.f * T.transfer * (flight ? 1 : 0.5) + (modeId === 'avion_ba' ? cars * 2 * 20 : 0),
    auto: roadtrip ? roadtrip.totalUsd : 0,
    // Los tours son opt-in: se suman despues cuando el usuario los marca, asi que
    // la propuesta base arranca en 0. Sin esta clave el desglose de la tarjeta
    // pedia parts.tours, recibia undefined y terminaba pintando "US$ NaN".
    tours: 0
  };
  let total = 0;
  Object.keys(parts).forEach(function (k) { parts[k] = Math.round(parts[k]); total += parts[k]; });
  return {
    id: modeId + '-' + ti, dk: dk, mode: modeId, modeLabel: MO.label, modeShort: MO.short,
    ti: ti, tierLabel: T.label, tierDesc: T.desc,
    parts: parts, baseHotelCost: Math.round(baseHotelCost), baseMealCost: Math.round(baseMealCost), hotelType: hotelType,
    // Solo `pasajes` puede ser 'real', y solo cuando hay una tarifa de vuelo
    // de verdad. comidas/local salen de la tabla DESTINATION_COSTS de este
    // archivo: son valores de referencia escritos a mano, sin ningun provider
    // detras. Marcaros como 'real' hacia que la app prometia un dato que no
    // tiene, y es la promesa central del producto ("cuanto cuesta REALMENTE").
    sources: { pasajes: realFlight ? 'real' : 'estimado', alojamiento: 'estimado', comidas: 'estimado',
               local: 'estimado', traslados: 'estimado', auto: 'estimado' },
    total: total, pp: Math.round(total / pax), comfort: MO.comfort + T.comfort,
    nights: nights, dur: M.dur, roadtrip: roadtrip,
    quote: realFlight ? { airline: quote.airline || null, transfers: quote.transfers == null ? null : quote.transfers,
                          exact: !!quote.exact, foundDep: quote.foundDep || null, foundRet: quote.foundRet || null } : null
  };
}

function build(S, dep, ret, today, quotes) {
  const out = [];
  const transport = String(S.transport || 'flight').toLowerCase();
  const options = Object.keys(DEST[S.dest].modes).concat('auto');
  options.forEach(function (m) {
    if (m === 'auto' && !isRoadtripAllowed(S.dest)) return;
    if (transport !== 'all' && transport === 'flight' && m !== 'avion_mvd') return;
    if (transport !== 'all' && transport === 'bus' && m !== 'bus') return;
    if (transport !== 'all' && transport === 'auto' && m !== 'auto') return;
    for (let t = 0; t < TIERS.length; t++) out.push(calc(S.dest, m, t, S.pax, dep, ret, today, quotes ? quotes[m] : null, S.kmPerLiter, S.fuelPriceUsd, S.hotelType));
  });
  out.sort(function (a, b) { return a.total - b.total; });
  return out;
}

function pick(S, list) {
  const within = list.filter(function (p) { return p.total <= S.budget; });
  if (!within.length) return { rec: list[0], fits: false };
  if (S.style === 'ahorro') return { rec: within[0], fits: true };
  if (S.style === 'comodo') {
    return { rec: within.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0], fits: true };
  }
  let best = null, bs = -1;
  within.forEach(function (p) {
    const sc = 0.5 * ((p.comfort - 2) / 4) + 0.5 * (1 - p.total / Math.max(S.budget, 1));
    if (sc > bs) { bs = sc; best = p; }
  });
  return { rec: best, fits: true };
}

/*
 * Las 15 fechas vecinas, con las mismas noches, en ISO.
 *
 * Vive aparte de seriesFor() porque el endpoint del calendario solo necesita
 * los pares de fechas: el precio del vuelo no depende del nivel de alojamiento,
 * asi que ese endpoint no tiene por qué fabricar una propuesta completa para
 * pedirlo. Haber dos lugares que deciden quais fechas son los validos haría que
 * el servidor y el clienteaniancould showear fechas distintas.
 */
function seriesDates(dep, ret, today) {
  const out = [];
  for (let s = -7; s <= 7; s++) {
    const d1 = addDays(dep, s), d2 = addDays(ret, s);
    if (daysBetween(today, d1) < 1) continue;
    out.push({ shift: s, dep: iso(d1), ret: iso(d2) });
  }
  return out;
}

/*
 * Serie "mismo viaje, otra fecha": las fechas de `seriesDates` con el total
 * estimado de cada una.
 *
 * `total` arranca como una ESTIMACIÓN: se toma el total recomendado y se le
 * suma la diferencia que el modelo predice para esa fecha. Cuando hay precio
 * real (SerpAPI) la parte de vuelo se reemplaza con `applyRealCalendar()`.
 *
 * `estFlightBase` es la porción de `total` que corresponde al pasaje estimado.
 * Se guarda explícitamente porque el recálculo necesita restar exactamente esa
 * parte y no la de hotel/comidas: si se restara el total entero, al poner el
 * precio real se perderían las noches de alojamiento de cada fecha.
 */
function seriesFor(S, rec, dep, ret, today) {
  const calcFor = function (d1, d2) {
    return calc(S.dest, rec.mode, rec.ti, S.pax, d1, d2, today, null, S.kmPerLiter, S.fuelPriceUsd, S.hotelType);
  };
  const est0 = calcFor(dep, ret);
  // La estimación del pasaje tal como la calcula `calc()` para esa fecha, con
  // `null` como quote para que no se cuele una tarifa real en la comparación.
  // Se replica la misma fórmula de la línea de flightPerPerson: para los modos
  // de vuelo el multiplicador de temporada va entero, para el bus va atenuado.
  const D = DEST[rec.dk] || {};
  const M = (D.modes && D.modes[rec.mode]) || {};
  const isFlightMode = rec.mode === 'avion_mvd' || rec.mode === 'avion_ba';
  const perPersonFor = function (d1, d2) {
    const fm = flightMult(rec.dk, d1, d2, today);
    const base = Number(M.pp) || 0;
    if (!base) return 0;
    return base * (isFlightMode ? fm : 1 + (fm - 1) * 0.5);
  };
  return seriesDates(dep, ret, today).map(function (point) {
    const est = calcFor(parse(point.dep), parse(point.ret));
    return {
      shift: point.shift, dep: point.dep, ret: point.ret,
      total: Math.max(1, rec.total + (est.total - est0.total)),
      estFlightBase: Math.round(perPersonFor(parse(point.dep), parse(point.ret)) * S.pax),
      realFlight: false, flightPP: null
    };
  });
}

/*
 * Reemplaza la parte estimada del vuelo por el precio real de cada fecha.
 *
 * El total de cada punto se recalcula como: total estimado - pasaje estimado de
 * ese punto + pasaje real. Hotel, comidas, traslados y autos no se tocan: son
 * estimaciones propias y mezclarlas con el precio real del vuelo no daría un
 * total más cierto, solo más confuso.
 *
 * Un punto sin precio real (falló, agotó tiempo o se acabaron los créditos)
 * conserva su estimación y queda con `realFlight: false`, para que la app lo
 * distinga de un precio real en lugar de pintar todo igual.
 */
function applyRealCalendar(series, calendar, pax) {
  if (!Array.isArray(series) || !calendar || !Array.isArray(calendar.puntos)) return series;
  const byShift = new Map();
  calendar.puntos.forEach(function (p) { byShift.set(Number(p.shift), p); });
  const travelers = Math.max(1, Number(pax) || 1);

  return series.map(function (point) {
    const real = byShift.get(Number(point.shift));
    if (!real || !real.real || !Number.isFinite(real.pp) || real.pp <= 0) return point;
    const estBase = Number.isFinite(point.estFlightBase) ? point.estFlightBase : 0;
    const total = Math.max(1, point.total - estBase + real.pp * travelers);
    return Object.assign({}, point, {
      total: Math.round(total),
      realFlight: true,
      flightPP: real.pp,
      exact: !!real.exact,
      airline: real.airline || null,
      priceLevel: real.priceLevel || null
    });
  });
}

function tipsFor(S, rec, list, series) {
  const out = [];
  let best = null;
  series.forEach(function (x) { if (!best || x.total < best.total) best = x; });
  if (best && best.shift !== 0 && rec.total - best.total >= 15) {
    out.push({ kind: 'fecha', save: rec.total - best.total, shift: best.shift, dep: best.dep });
  }
  let bm = null;
  list.forEach(function (p) { if (p.ti === rec.ti && p.mode !== rec.mode && p.total < rec.total && (!bm || p.total < bm.total)) bm = p; });
  if (bm && rec.total - bm.total >= 15) {
    out.push({ kind: 'ruta', save: rec.total - bm.total, title: 'Probá: ' + MODES[bm.mode].label.toLowerCase(), text: MODES[bm.mode].tip });
  }
  let bt = null;
  list.forEach(function (p) { if (p.mode === rec.mode && p.ti < rec.ti && (!bt || p.total < bt.total)) bt = p; });
  if (bt && rec.total - bt.total >= 15) {
    out.push({ kind: 'alojamiento', save: rec.total - bt.total, title: 'Alojamiento ' + TIERS[bt.ti].label,
      text: TIERS[bt.ti].desc + '. Cambia el total más de lo que parece.' });
  }
  out.sort(function (a, b) { return b.save - a.save; });
  return out.slice(0, 3);
}

/* ---------- validación de entrada ---------- */
function validate(q, today) {
  const fail = function (m) { const e = new Error(m); e.status = 400; throw e; };
  const dest = String(q.dest || '');
  if (!DEST[dest]) fail('Destino no válido.');
  const transport = String(q.transport || 'flight').toLowerCase();
  if (!['flight', 'bus', 'auto', 'roadtrip'].includes(transport)) fail('Elegí vuelo, bus o auto como transporte.');
  if (transport === 'bus' && !DEST[dest].modes.bus) fail('El bus todavía no está disponible para este destino.');
  if ((transport === 'auto' || transport === 'roadtrip') && !isRoadtripAllowed(dest)) {
    fail('Auto / Roadtrip solo está disponible para Río de Janeiro o destinos más al sur.');
  }
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(q.dep || '') || !re.test(q.ret || '')) fail('Fechas no válidas.');
  const dep = parse(q.dep), ret = parse(q.ret);
  if (isNaN(dep) || isNaN(ret)) fail('Fechas no válidas.');
  if (daysBetween(today, dep) < 1) fail('La fecha de ida tiene que ser a partir de mañana.');
  const nights = daysBetween(dep, ret);
  if (nights < 1) fail('La vuelta tiene que ser después de la ida.');
  if (nights > 30) fail('Por ahora calculamos viajes de hasta 30 noches.');
  const pax = parseInt(q.pax, 10);
  if (!(pax >= 1 && pax <= 10)) fail('La cantidad de viajeros tiene que ser entre 1 y 10.');
  let budget = Number(q.budget);
  if (!isFinite(budget) || budget < 0) budget = 0;
  budget = Math.min(budget, 1e6);
  const style = ['ahorro', 'eq', 'comodo'].indexOf(q.style) >= 0 ? q.style : 'eq';
  const kmPerLiter = Number(q.kmPerLiter);
  return { S: { dest: dest, dep: q.dep, ret: q.ret, pax: pax, budget: budget, style: style,
    transport: transport === 'roadtrip' ? 'auto' : transport,
    kmPerLiter: Number.isFinite(kmPerLiter) && kmPerLiter >= 3 && kmPerLiter <= 40 ? kmPerLiter : 12 }, dep: dep, ret: ret, nights: nights };
}

function compute(S, dep, ret, today, quotes) {
  const list = build(S, dep, ret, today, quotes);
  const alternatives = build(Object.assign({}, S, { transport: 'all' }), dep, ret, today, quotes)
    .filter(function (proposal) { return !list.some(function (selected) { return selected.id === proposal.id; }); });
  // Cuando se consultan propuestas de vuelo para Río, también dejamos
  // disponibles las alternativas en auto para mostrarlas debajo del listado.
  const roadtripList = S.transport === 'flight' && isRoadtripAllowed(S.dest)
    ? build(Object.assign({}, S, { transport: 'auto' }), dep, ret, today, null)
    : [];
  const pk = pick(S, list), rec = pk.rec;
  const cozy = list.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0];
  const series = seriesFor(S, rec, dep, ret, today);
  return {
    fits: pk.fits, recId: rec.id, cheapestId: list[0].id, cozyId: cozy.id,
    list: list, alternatives: alternatives, roadtripList: roadtripList, series: series, tips: tipsFor(S, rec, list, series)
  };
}

module.exports = { MODES, DEST, TIERS, REAL_COSTS, DESTINATION_COSTS, destinationCosts, lodgingNightlyCosts, ROADTRIP_ROUTES, DEST_COORDS, ORIGIN_COORDS, roadtripCost, getToday, addDays, iso, parse, daysBetween, calc, build, pick, seriesDates, seriesFor, applyRealCalendar, tipsFor, validate, compute };
