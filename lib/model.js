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
  fln: { km: 1245, tolls: 42, hours: 17 }, rio: { km: 2355, tolls: 120, hours: 31.5 },
  buz: { km: 2050, tolls: 128, hours: 25 },
  ssa: { km: 3300, tolls: 205, hours: 40 }, sao: { km: 2050, tolls: 132, hours: 25 },
  poa: { km: 800, tolls: 55, hours: 11.6 }, rec: { km: 4500, tolls: 270, hours: 54 },
  for: { km: 5100, tolls: 300, hours: 62 }, mcz: { km: 4100, tolls: 245, hours: 49 },
  nat: { km: 4700, tolls: 280, hours: 57 }, pip: { km: 4750, tolls: 282, hours: 58 },
  // Litoral y norte de Santa Catarina. Todos por arriba de 1100 km: son
  // destinos de un día largo de manejar, no de un fin de semana corto.
  bcm: { km: 1310, tolls: 40, hours: 17.8 },
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
const ROADTRIP_ALLOWED_DESTINATIONS = new Set(['fln', 'bcm', 'gram', 'canela', 'poa', 'bombinhas', 'rosa', 'garopaba', 'ferrugem', 'picarras', 'itapema', 'torres', 'canoa']);
// Rio no esta en la lista a proposito: Montevideo-Rio son 2.355 km y 2.355 no es
// un viaje que se ofrece, es un tramo. Se saca de la whitelist --que es lo que
// hace que la opcion exista-- y no de ROADTRIP_ROUTES, que sigue alimentando las
// distancias entre paradas de un viaje combinado.
// Coordenadas aproximadas del centro de cada destino. Antes vivían solo los
// que tenían roadtrip, para comprobar que ninguna ruta por carretera sea más
// corta que su línea recta (ver test.js). Ahora también las usa el traslado
// entre paradas de un viaje combinado, que sale de la distancia entre las dos.
//
// Son coordenadas de centro de pueblo, al grado, no de punto exacto: alcanzan
// para estimar cuántos kilómetros y cuántas horas hay entre dos paradas, que es
// lo que necesita el traslado. No sirven para rutear.
const DEST_COORDS = {
  rio: { lat: -22.9068, lng: -43.1729 },
  fln: { lat: -27.5954, lng: -48.5480 }, bcm: { lat: -26.9906, lng: -48.6349 },
  gram: { lat: -29.3747, lng: -50.8764 },
  canela: { lat: -29.3667, lng: -50.8167 },
  poa: { lat: -30.0346, lng: -51.2177 }, bombinhas: { lat: -27.1500, lng: -48.4833 },
  rosa: { lat: -28.1167, lng: -48.6167 },
  // Paradas del litoral sur, todas sobre el corredor de la BR-101 desde
  // Montevideo. Coordenadas del centro del pueblo, aproximadas al grado, que es
  // lo que necesita la comprobacion de que la ruta por carretera no sea mas
  // corta que la linea recta.
  garopaba: { lat: -28.0236, lng: -48.6069 }, ferrugem: { lat: -28.1500, lng: -48.6000 },
  picarras: { lat: -26.7639, lng: -48.6717 }, itapema: { lat: -27.1000, lng: -48.6700 },
  torres: { lat: -29.3344, lng: -49.7336 }, canoa: { lat: -29.7508, lng: -50.0211 },
  // Costa de Rio de Janeiro. buz, arraial y cabo comparten el corredor de la
  // RJ-124 y el mismo aeropuerto (GIG), asi que combinarlos es un traslado
  // corto por tierra sin cambiar de vuelo. Verificadas contra Nominatim.
  buz: { lat: -22.7759, lng: -41.9455 }, arraial: { lat: -22.9663, lng: -42.0244 },
  cabo: { lat: -22.8804, lng: -42.0189 },
  // Costa Verde. paraty, angra e ilha cuelgan del mismo puerto; ilhabela y
  // ubatuba son del lado de Sao Paulo, al otro lado de la bahia.
  paraty: { lat: -23.2196, lng: -44.7154 }, angra: { lat: -23.1555, lng: -44.2345 },
  // Ilha Grande no aparece en el geocodificador (la isla no es un nucleo
  // urbano con punto). Va el centro de la isla, que es lo que importa: de ahi
  // sale el ferry.
  ilha: { lat: -23.1408, lng: -44.1967 },
  ilhabela: { lat: -23.8166, lng: -45.3687 }, ubatuba: { lat: -23.4332, lng: -45.0834 },
  // Ciudades del interior y el Planalto. No estaban porque no hay roadtrip ni
  // traslado combinado, pero el transfer desde el aeropuerto las necesita igual.
  // Geocodificadas con Nominatim, centro de la ciudad.
  sao: { lat: -23.5506507, lng: -46.6333824 },
  // Bahia. Las cuatro que estan al sur de Salvador. Las coordenadas que se
  // pusieron de memoria fallaban por 70 a 150 km: Praia do Forte quedaba a 3 km
  // de Salvador cuando va por ruta a 60.
  ssa: { lat: -12.9822, lng: -38.4813 }, portoseguro: { lat: -16.4435, lng: -39.0643 },
  forte: { lat: -12.5775, lng: -38.0064 }, morro: { lat: -13.3775, lng: -38.9160 },
  itacare: { lat: -14.2779, lng: -38.9956 },
  /* Arraial d'Ajuda, el pueblo al este de Trancoso. La coordenada es la que
     devuelve Nominatim con "Arraial d'Ajuda, Bahia": 7 km de Trancoso, que es lo
     que hace que los dos se puedan combinar y que el par sea corto. */
  ajuda: { lat: -16.49041, lng: -39.17713 },
  /* Trancoso: la coordenada estaba mal desde siempre. -12.7833,-39.1167 no es
     ningun pueblo de Bahia: cae en el interior, a 421 km de Trancoso y a 407 de
     Porto Seguro. La del geo, -16.4832,-39.08369, esta a 15 km de Trancoso y es
     la que devuelve Nominatim con "Trancoso, Porto Seguro, Bahia".

     Con la anterior, todo par con trancoso salia mal cotizado: el destino
     ofrece Salvador + Arraial d'Ajuda / Trancoso, y la distancia que se
     informaba era la de un punto equivocado a 407 km. */
  trancoso: { lat: -16.4832, lng: -39.08369 },
  // Nordeste. Porto de Galinhas y Maragogi tambien venian mal de memoria.
  rec: { lat: -8.0585, lng: -34.8848 }, porto: { lat: -8.5047, lng: -35.0050 },
  maragogi: { lat: -9.0118, lng: -35.2225 }, mcz: { lat: -9.6477, lng: -35.7339 },
  joaopessoa: { lat: -7.1216, lng: -34.8820 }, nat: { lat: -5.8193, lng: -35.2126 },
  /* Pipa: la coordenada es la de la villa, en Tibau do Sul, y es la misma que
     devuelve Nominatim (data/destinos-geo.json). El comentario de antes decia
     que el valor del modelo era la playa y el del geocoder la sede, separados
     50 km, y era al reves: lo unico que cambio fue la latitud de -5.7789 a
     -6.23726, que es la de la villa.

     Why importa: DEST_COORDS decide que dos destinos se pueden combinar, y con
     -5.7789 Pipa cae a 12 km de Natal. Pipa esta a 70 km de Natal por carretera
     (se baja por la borboreta y se sigue 50 km). Con la coordenada de la sede,
     la distancia de linea recta era un tercio de la real y por eso el par
     "Pipa + Jeri" pasaba por 988 km cuando de verdad son 690, y "Pipa +
     Fortaleza" por 630 cuando son 630 de verdad. El par se ofrecia con un
     traslado subestimado. */
  pip: { lat: -6.23726, lng: -35.04416 }, for: { lat: -3.7932, lng: -38.5280 },
  /* Jericoacoara: Nominatim devuelve primero Jijoca de Jericoacoara, que es la
     sede del municipio y no la villa. El punto que interesa es la playa, en
     "Vila de Jericoacoara". El geo tiene la sede (la que devuelve el
     geocoder) y el modelo la villa: 15 km de diferencia, dentro de lo que
     tolera el filtro de fotos, asi que aca la ultima palabra es la del modelo. */
  jericoacoara: { lat: -2.7965483, lng: -40.5187024 },
  /* Fernando de Noronha estaba sin coordenada. No rompia nada visible porque es
     una isla a 350 km de tierra firme y no se combina con nadie, asi que
     comboTransfer() devolvia null y el destino no ofrecia pares. Lo que si
     rompia era el filtro de fotos, que necesita la coordenada para descartar
     un homonimo, y el archivo de datos ya la tenia. */
  fernando: { lat: -3.85375, lng: -32.4198 }
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
  trancoso: { name: 'Trancoso', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.94, lodge: [58, 105, 180],
    modes: { avion_ba: { pp: 520, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 610, dur: 'unas 9 h con escala' } } },
  ssa: { name: 'Salvador de Bahía', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.95, lodge: [45, 80, 150],
    modes: { avion_ba: { pp: 480, cross: 90, dur: 'unas 11 h en total' }, avion_mvd: { pp: 570, dur: 'unas 8 h con escala' } } },
  /* El nombre es solo "Fortaleza". Antes decia "Fortaleza / Jericoacoara" con
     una barra, y las dos ya son destinos separados con costos, traslados y
     actividades propias: Jericoacoara entro como clave propia y hay tres pares
     que la offering (Fortaleza + Jeri, Natal + Jeri, Pipa + Jeri). Un nombre
     con dos ciudades no dice a cual de las dos pertenece el precio, y hacia que
     la card de un destino solo pareciera un par.

     Ojo con la barra: server.js hotelRecommendations() parte el nombre por "/"
     para buscar en Booking, porque Booking no la entiende. Ese split sigue
     haciendo falta para otros destinos (trancoso es "Arraial d'Ajuda /
     Trancoso"), no solo por este. */
  for: { name: 'Fortaleza', region: 'Ceará', iata: 'FOR', group: 'beach', f: 0.95, lodge: [45, 85, 150],
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
  /* Arraial d'Ajuda era el otro pueblo de la entrada "Trancoso / Arraial d'Ajuda":
     dos nombres, una clave, y el precio era el de Trancoso. Son 7 km, el mismo
     vuelo por SSA y la misma guia, asi que se ofrece como lo que es: el par
     "Trancoso + Arraial", que es el viaje tipico de esa costa. Trancoso queda
     solo y con su nombre.

     Los numeros salen de los de Trancoso con el ajuste que corresponde a un
     pueblo un poco mas chico y mas barato: la comida baja un escalon (37/68/115
     contra 38/70/120) y el alojamiento tambien, pero menos. El vuelo es el
     mismo: SSA, y por eso los dos siguen siendo un par, no dos viajes. */
  ajuda: { name: 'Arraial d’Ajuda', region: 'Bahía', iata: 'SSA', group: 'beach', f: 0.93, lodge: [52, 96, 168],
    modes: { avion_ba: { pp: 505, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 595, dur: 'unas 9 h con escala' } } },
  fernando: { name: 'Fernando de Noronha', region: 'Pernambuco', iata: 'FEN', group: 'beach', f: 1.12, lodge: [80, 145, 240],
    modes: { avion_ba: { pp: 620, cross: 90, dur: 'unas 15 h en total' }, avion_mvd: { pp: 710, dur: 'unas 11 h con escala' } } },
  fln: { name: 'Florianópolis', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.95, lodge: [50, 90, 160],
    modes: { bus: { pp: 200, dur: 'unas 22 h' }, avion_ba: { pp: 340, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 430, dur: 'unas 6 h con escala' } } },
  bombinhas: { name: 'Bombinhas', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.94, lodge: [52, 96, 170],
    modes: { avion_ba: { pp: 360, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 450, dur: 'unas 6 h con escala' } } },
  rosa: { name: 'Praia do Rosa', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.93, lodge: [54, 98, 175],
    modes: { avion_ba: { pp: 370, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 460, dur: 'unas 6 h con escala' } } },
  bcm: { name: 'Balneário Camboriú', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.96, lodge: [52, 92, 165],
    modes: { avion_ba: { pp: 330, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 420, dur: 'unas 5 h con escala' } } },
  // Costa de Santa Catarina. El bus sale mas barato segun cuanto este la parada
  // al norte del estado. Itapema es el unico que queda por ARRIBA de su
  // comparable: Camboriu era el balneario premium de la costa norte y Itapema
  // lo es hoy.
  itapema: { name: 'Itapema', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.97, lodge: [55, 98, 175],
    modes: { avion_ba: { pp: 325, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 415, dur: 'unas 5 h con escala' } } },
  garopaba: { name: 'Garopaba', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.93, lodge: [50, 94, 168],
    modes: { avion_ba: { pp: 365, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 455, dur: 'unas 6 h con escala' } } },
  ferrugem: { name: 'Ferrugem', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.92, lodge: [52, 95, 170],
    modes: { avion_ba: { pp: 375, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 465, dur: 'unas 6 h con escala' } } },
  picarras: { name: 'Piçarras', region: 'Santa Catarina', iata: 'FLN', group: 'beach', f: 0.91, lodge: [50, 92, 165],
    modes: { avion_ba: { pp: 385, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 475, dur: 'unas 6 h con escala' } } },
  gram: { name: 'Gramado', region: 'Río Grande do Sul', iata: 'POA', group: 'nature', f: 0.88, lodge: [48, 89, 155],
    modes: { avion_ba: { pp: 300, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 380, dur: 'unas 4 h con escala' } } },
  canela: { name: 'Canela', region: 'Río Grande do Sul', iata: 'POA', group: 'nature', f: 0.88, lodge: [50, 90, 160],
    modes: { avion_ba: { pp: 300, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 380, dur: 'unas 4 h con escala' } } },
  // Litoral de Rio Grande do Sul. Se comparan con Gramado porque vuelan al
  // mismo aeropuerto, pero son balnearios de playa: mas baratos en alojamiento
  // y comida que la ciudad serrana. Canoa esta 100 km al sur de Torres, asi
  // que baja un poco mas.
  torres: { name: 'Torres', region: 'Río Grande do Sul', iata: 'POA', group: 'beach', f: 0.87, lodge: [46, 86, 152],
    modes: { avion_ba: { pp: 305, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 385, dur: 'unas 4 h con escala' } } },
  canoa: { name: 'Capão da Canoa', region: 'Río Grande do Sul', iata: 'POA', group: 'beach', f: 0.86, lodge: [44, 82, 145],
    modes: { avion_ba: { pp: 310, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 390, dur: 'unas 4 h con escala' } } },
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
  poa: { transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 27, moderado: 50, gourmet: 90 } },
  rio: { transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 28, moderado: 55, gourmet: 95 } },
  sao: { transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  ssa: { transport: { eco: 5, medio: 8, confort: 14 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  for: { transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 26, moderado: 47, gourmet: 83 } },
  nat: { transport: { eco: 4, medio: 8, confort: 15 }, food: { casual: 26, moderado: 48, gourmet: 80 } },
  mcz: { transport: { eco: 3, medio: 7, confort: 15 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  rec: { transport: { eco: 3, medio: 6, confort: 14 }, food: { casual: 25, moderado: 48, gourmet: 82 } },
  joaopessoa: { transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 26, moderado: 44, gourmet: 71 } },
  porto: { transport: { eco: 5, medio: 9, confort: 17 }, food: { casual: 24, moderado: 43, gourmet: 73 } },
  maragogi: { transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 24, moderado: 45, gourmet: 75 } },
  jericoacoara: { transport: { eco: 4, medio: 8, confort: 18 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  buz: { transport: { eco: 4, medio: 9, confort: 19 }, food: { casual: 34, moderado: 59, gourmet: 104 } },
  arraial: { transport: { eco: 4, medio: 7, confort: 12 }, food: { casual: 23, moderado: 41, gourmet: 78 } },
  cabo: { transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  angra: { transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 25, moderado: 45, gourmet: 85 } },
  paraty: { transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 21, moderado: 42, gourmet: 74 } },
  ilha: { transport: { eco: 4, medio: 8, confort: 15 }, food: { casual: 28, moderado: 52, gourmet: 90 } },
  ubatuba: { transport: { eco: 5, medio: 10, confort: 22 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  ilhabela: { transport: { eco: 6, medio: 11, confort: 22 }, food: { casual: 26, moderado: 48, gourmet: 83 } },
  fln: { transport: { eco: 6, medio: 13, confort: 27 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  bcm: { transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  bombinhas: { transport: { eco: 5, medio: 10, confort: 19 }, food: { casual: 23, moderado: 46, gourmet: 86 } },
  rosa: { transport: { eco: 3, medio: 8, confort: 19 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  itapema: { transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 28, moderado: 54, gourmet: 92 } },
  garopaba: { transport: { eco: 3, medio: 7, confort: 17 }, food: { casual: 25, moderado: 50, gourmet: 86 } },
  ferrugem: { transport: { eco: 3, medio: 7, confort: 15 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  picarras: { transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  gram: { transport: { eco: 5, medio: 10, confort: 19 }, food: { casual: 33, moderado: 59, gourmet: 102 } },
  canela: { transport: { eco: 5, medio: 10, confort: 22 }, food: { casual: 31, moderado: 56, gourmet: 97 } },
  torres: { transport: { eco: 3, medio: 6, confort: 12 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  canoa: { transport: { eco: 3, medio: 6, confort: 12 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  fernando: { transport: { eco: 4, medio: 12, confort: 34 }, food: { casual: 50, moderado: 95, gourmet: 160 } },
  pip: { transport: { eco: 4, medio: 9, confort: 15 }, food: { casual: 23, moderado: 45, gourmet: 82 } },
  trancoso: { transport: { eco: 5, medio: 13, confort: 33 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  ajuda: { transport: { eco: 5, medio: 10, confort: 20 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  morro: { transport: { eco: 4, medio: 8, confort: 16 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  portoseguro: { transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 33, moderado: 60, gourmet: 105 } },
  itacare: { transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 32, moderado: 58, gourmet: 100 } },
  forte: { transport: { eco: 3, medio: 7, confort: 15 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
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

/* ---------- traslado entre dos paradas del mismo viaje ---------- */

// Distancia en linea recta entre dos destinos, en km.
function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 10) / 10;
}

// Sinuosidad de la ruta contra la linea recta. No es una constante: la RJ-124
// entre Búzios y Arraial va por la sierra y son 60 km de ruta contra 23 de
// linea recta (2,6), mientras que la BR-101 de Salvador a Praia do Forte va
// pegada a la costa y son 70 contra 68 (1,02). Un solo factor no puede
// acertar las dos, asi que se usa 1,45 como promedio y el combustible queda
// como dato informativo, no como el precio que se cobra.
const COMBO_SINUOSITY = 1.45;
// Base del traslado, por pasajero. Es el mismo piso que usa transferConfig() para
// el traslado del aeropuerto (OFFICIAL_TRANSFER_PRICE_USD, 35 por defecto): los
// $30 que tenia hardcodeados el caso Búzios-Arraial eran precio de servicio, no
// combustible. Calibrar una cuenta de nafta contra un numero de servicio no
// tiene sentido.
const COMBO_TRANSFER_BASE_USD = 35;
// Distancia a la que el traslado entre paradas vale lo mismo que uno de
// aeropuerto. Es la de arriba de la interpolacion: ver COMBO_TRANSFER_MIN_USD
// y COMBO_TRANSFER_FULL_USD, que son los dos extremos de la curva.
const COMBO_TRANSFER_FULL_KM = 300;

/* El PISO del traslado entre paradas, por pasajero: lo que cuesta subir a una
   van y bajar con la valija, sin importar cuantos km haya.

   Antes la formula era COMBO_TRANSFER_BASE_USD * (0,6 + 0,4 * (km/300)^0,6) y
   ese 0,6 inicial era el piso implicito. El problema es que el 0,6 se comia
   casi toda la base: a 7 km el termino de distancia vale 0,11, asi que el
   precio salia a 0,64 del base. Medido sobre los 110 pares del menu, los 18 mas
   cortos (de 6 a 37 km) caian entre $12 y $25 por persona: trece dolares de
   diferencia en 31 km. Y la app ponia los km al lado del precio, asi que el
   numero no media lo que la etiqueta decia.

   Ahora el piso es un numero explicito y el rango va de ahi hasta el base, asi
   que las dos constantes dicen algo:

     - a COMBO_TRANSFER_MIN_KM (casi 0 km) sale COMBO_TRANSFER_MIN_USD, el piso;
     - a COMBO_TRANSFER_FULL_KM (300 km) sale COMBO_TRANSFER_BASE_USD, que es
       lo que cuesta un traslado de aeropuerto.

   Entre medio se interpola con raiz 0,6, que es lo mismo que usaba la formula
   vieja: suave al principio y contenida en los tramos largos, para que un
   transfer de 1.000 km no salga el doble que uno de 30. */
const COMBO_TRANSFER_MIN_USD = 12;
// La distancia a la que el traslado vale lo que uno de aeropuerto. Antes decia
// COMBO_TRANSFER_BASE_USD y 300, y la cuenta de arriba lo cumplia a medias: el
// 0,6 inicial hacia que a 300 km saliera $37 en vez de $35.
const COMBO_TRANSFER_FULL_USD = 35;
// Precio del pasaje de ferry, por pasajero. Ilha Grande no tiene carretera:
// se llega en barco desde Rio o Angra. Un pasaje cuesta del orden de US$ 10-12,
// muy por debajo de un transfer, asi que el ferry no se escala con distancia.
const COMBO_FERRY_USD = 12;
// Cuanto tarda el ferry, fijo: son 90 minutos por la bahía, no 30 km por ruta.
const COMBO_FERRY_HOURS = 1.5;
// Ilha Grande es la unica parada del catalogo sin acceso por carretera.
const COMBO_FERRY_ONLY = new Set(['ilha']);
/* Destinos donde no hay un camino que valga: se llega en vuelo o en barco y la
   distancia entre dos de ellos no se mide en linea recta por tierra.

   Fernando de Noronha es el caso. Esta a 350 km de la costa mas cercana y al
   otro lado de Natal, asi que de Natal son 379 km de linea recta y de Recife
   541: los dos pasan el filtro de COMBO_MAX_KM y el par salia offered, cuando
   en realidad no hay carretera, solo un vuelo que la app no cotiza como traslado.

   Sin coordenada, esto no pasaba: comboTransfer devolvia null antes de mirar la
   distancia. Por eso el mismo fix que le agrego la coordenada (para el filtro de
   fotos) destapo esto. La distancia en linea recta es la correcta entre dos
   puntos cualesquiera, pero no sirve para decidir si se puede manejar de uno al
   otro cuando hay agua en el medio. */
const COMBO_SIN_CARRETERA = new Set(['fernando']);
// Techo de sanity, NO la regla de alcance. Lo que se ofrece es lo que declaran
// las subcategorias con secondKey; este numero solo corta lo absurdo, como
// Florianopolis con Fortaleza (2400 km) o Porto Seguro con Natal.
//
// Medido sobre los 86 pares que si declaran grupo regional: el mas largo es
// Maceio-Fortaleza a 1045 km de ruta. Con 420 km de techo, que era el primer
// valor que probé, se rechazaban 18 de los 86, casi todos del Nordeste y Bahia.
const COMBO_MAX_KM = 1100;

/* Piso, no techo: dos paradas mas cerca que esto no son un viaje de dos
   paradas. Ver el corte en comboTransfer(). */
const COMBO_MIN_KM = 3;

/**
 * Traslado de la primera parada a la segunda: un solo tramo, no ida y vuelta.
 * Devuelve null si el par no es combinable: destino sin coordenadas, el mismo
 * destino dos veces, alguno sin carretera (COMBO_SIN_CARRETERA), o mas lejos
 * que COMBO_MAX_KM.
 *
 * El precio es un transfer por pasajero escalado por distancia. El combustible
 * y los peajes se calculan aparte y se devuelven como dato, para quien quiera
 * manejar por su cuenta: el precio de un transfer y el de Handle no son lo
 * mismo y conviene mostrarlos distintos.
 */
function comboTransfer(fromKey, toKey, pax, kmPerLiter, fuelPriceUsd) {
  if (!DEST[fromKey] || !DEST[toKey]) return null;
  if (fromKey === toKey) return null;
  // Sin carretera no hay un solo tramo que estimar. Va antes de la distancia
  // porque la distancia en linea recta pasa el filtro y daria un par que no se
  // puede cotizar como traslado.
  if (COMBO_SIN_CARRETERA.has(fromKey) || COMBO_SIN_CARRETERA.has(toKey)) return null;
  const a = DEST_COORDS[fromKey], b = DEST_COORDS[toKey];
  if (!a || !b) return null;
  const people = Math.max(1, Number(pax) || 1);

  const straight = haversineKm(a, b);
  const km = Math.round(straight * COMBO_SINUOSITY);
  if (km > COMBO_MAX_KM) return null;
  /* Dos paradas a menos de 3 km no son dos paradas. Balneário Camboriú y
     Camboriú estan a 270 metros: el balneario es el distrito de playa dentro de
     la ciudad, y el par se ofrecia como "Sumá una segunda parada" con un
     traslado de 0 dolares. 0 km es una distancia valida para la matematica, asi
     que el filtro de arriba no lo podia ver; hace falta el corte explicito.

     El piso es 3 km y no 20 porque hay pares cortos y de verdad: Trancoso y
     Arraial d'Ajuda son 15, Porto Seguro y Arraial 19. Con 20 el filtro se
     comia los tres. */
  if (km < COMBO_MIN_KM) return null;

  const fromName = DEST[fromKey].name, toName = DEST[toKey].name;
  const base = { from: fromKey, to: toKey, fromName: fromName, toName: toName,
    straightKm: straight, distanceKm: km, pax: people };

  // Ferry: si cualquiera de las dos paradas es Ilha Grande, el tramo se hace en
  // barco. No hay ni ruta terrestre ni horas de ruta que estimar.
  if (COMBO_FERRY_ONLY.has(fromKey) || COMBO_FERRY_ONLY.has(toKey)) {
    const otherKey = COMBO_FERRY_ONLY.has(fromKey) ? toKey : fromKey;
    return Object.assign(base, {
      mode: 'ferry', hours: COMBO_FERRY_HOURS,
      perPaxUsd: COMBO_FERRY_USD, totalUsd: COMBO_FERRY_USD * people,
      driveFuelUsd: null, driveTollsUsd: null, driveTotalUsd: null,
      label: 'Ferry entre ' + fromName + ' y ' + DEST[otherKey].name + ' (estimado, un pasaje por persona)',
      source: 'pasaje de ferry estimado. Ilha Grande no tiene acceso por carretera'
    });
  }

  // Interpolacion entre el piso (cerca de 0 km) y el tope (a 300 km), con raiz
  // 0,6 para que los tramos cortos no peguen contra el piso de golpe y los
  // largos no se dispare. Con la formula vieja el 0,6 inicial del base hacia que
  // a 300 km salieran $37 en vez de $35, y a 7 km el numero no dependia de la
  // distancia: ver el comentario de COMBO_TRANSFER_MIN_USD.
  const t = Math.pow(km / COMBO_TRANSFER_FULL_KM, 0.6);
  const perPax = Math.round(COMBO_TRANSFER_MIN_USD + (COMBO_TRANSFER_FULL_USD - COMBO_TRANSFER_MIN_USD) * t);

  // Combustible y peaje de quien maneja con auto alquilado. No es el precio que
  // se cobra: es el dato para comparar contra el transfer.
  const consumption = Number(kmPerLiter);
  const safeConsumption = Number.isFinite(consumption) && consumption >= 3 && consumption <= 40 ? consumption : 12;
  const fuelPrice = Number(fuelPriceUsd) > 0 ? Number(fuelPriceUsd) : 1.2;
  const liters = Math.round((km / safeConsumption) * 10) / 10;
  const driveFuelUsd = Math.round(liters * fuelPrice);
  const driveTollsUsd = Math.round(km * 0.03);

  return Object.assign(base, {
    mode: 'car', hours: Math.round((km / 55) * 10) / 10,
    perPaxUsd: perPax, totalUsd: perPax * people,
    driveFuelUsd: driveFuelUsd, driveTollsUsd: driveTollsUsd,
    driveTotalUsd: driveFuelUsd + driveTollsUsd,
    label: 'Traslado entre ' + fromName + ' y ' + toName + ' (estimado, ' + perPax + ' por persona)',
    source: 'transfer por pasajero, escalado por distancia. Combustible y peaje aparte, para quien Maneja'
  });
}

/* ---------- transfer desde el aeropuerto de llegada ---------- */
// GENERADO por `npm run build:transfer`. No editar a mano: la fuente es
// data/transfer-precios.json, que ademas documenta de donde sale cada numero.
//
// ESTA TABLA REEMPLAZA TRES FUENTES DE VERDAD CONFLICTANTES que tenia la app:
//   - las cards de public/app.js mostraban 30 (compartido) y 150 (privado),
//     escritos a mano e iguales para los 44 destinos;
//   - getSelectedTransferAmount() en public/app.js repetia esos dos numeros;
//   - transferConfig() en server.js usaba OFFICIAL_TRANSFER_PRICE_USD (35) POR
//     PASAJERO, o sea 70 para dos personas contra los 30 de la card.
//
// Ademas los tres eran el mismo numero para todos los destinos, y no puede ser:
// de GIG a Rio hay 18 km y de GIG a Buzios hay 174 por la RJ-124.
//
// La tabla viene con `modo`, que es lo que hace que dos destinos no se coticen
// como una van: ilha no tiene carretera (se llega en barco) y fernando es una
// isla a 350 km de la costa (se llega en vuelo desde REC). Antes la app ofrecia
// una van para los dos.
const TRANSFER_PRICES = {
  buz: { iata: "GIG", modo: "car", km: 174, compartido: 0, privado: 86.54, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Auto","brl":541}] },
  arraial: { iata: "GIG", modo: "car", km: 170, compartido: 0, privado: 86.54, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Auto","brl":541}] },
  cabo: { iata: "GIG", modo: "car", km: 160, compartido: 0, privado: 86.54, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Auto","brl":541}] },
  ilha: { iata: "GIG", modo: "ferry", compartido: 0, privado: 86.54, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Van","brl":541}] },
  paraty: { iata: "GIG", modo: "car", km: 248, compartido: 0, privado: 115.38, compartidoConsultar: true, escalones: [] },
  ilhabela: { iata: "GRU", modo: "car", km: 185, compartido: 0, privado: 127, compartidoConsultar: true, escalones: [] },
  ubatuba: { iata: "GRU", modo: "car", km: 206, compartido: 0, privado: 153.85, compartidoConsultar: true, escalones: [] },
  rio: { iata: "GIG", modo: "car", km: 18, compartido: 0, privado: 45, compartidoConsultar: true, escalones: [] },
  angra: { iata: "GIG", modo: "car", km: 139, compartido: 0, privado: 105.77, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":483},{"min":5,"max":5,"vehiculo":"Auto","brl":598},{"min":6,"max":6,"vehiculo":"Auto","brl":656}] },
  sao: { iata: "GRU", modo: "car", km: 26, compartido: 0, privado: 41, compartidoConsultar: true, escalones: [] },
  porto: { iata: "REC", modo: "car", km: 53, compartido: 30, privado: 45, escalones: [] },
  mcz: { iata: "MCZ", modo: "car", km: 21, compartido: 28.27, privado: 51.92, escalones: [] },
  maragogi: { iata: "MCZ", modo: "car", km: 129, compartido: 64.23, privado: 92, escalones: [] },
  nat: { iata: "NAT", modo: "car", km: 25, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  pip: { iata: "NAT", modo: "car", km: 30, compartido: 0, privado: 31, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":288}] },
  ajuda: { iata: "SSA", modo: "car", km: 170, compartido: 0, privado: 118, compartidoConsultar: true, escalones: [] },
  trancoso: { iata: "SSA", modo: "car", km: 163, compartido: 0, privado: 113, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":437}] },
  ssa: { iata: "SSA", modo: "car", km: 24, compartido: 0, privado: 30, appRideUsd: 11, compartidoConsultar: true, escalones: [] },
  for: { iata: "FOR", modo: "car", km: 9, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  jericoacoara: { iata: "FOR", modo: "car", km: 295, compartido: 55.38, privado: 195, escalones: [{"min":1,"max":6,"vehiculo":"4 x 4","brl":1955}] },
  morro: { iata: "SSA", modo: "car", km: 242, compartido: 0, privado: 162, compartidoConsultar: true, escalones: [] },
  portoseguro: { iata: "SSA", modo: "car", km: 699, compartido: 0, privado: 445, compartidoConsultar: true, escalones: [] },
  itacare: { iata: "SSA", modo: "car", km: 359, compartido: 0, privado: 235, compartidoConsultar: true, escalones: [] },
  forte: { iata: "SSA", modo: "car", km: 62, compartido: 30.77, privado: 50, escalones: [] },
  fernando: { iata: "FEN", modo: "vuelo", compartido: 0, privado: 95, soloPrivado: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":538},{"min":5,"max":6,"vehiculo":"Auto","brl":966},{"min":6,"max":12,"vehiculo":"Van","brl":1739}] },
  fln: { iata: "FLN", modo: "car", km: 17, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  bombinhas: { iata: "FLN", modo: "car", km: 89, compartido: 0, privado: 67, compartidoConsultar: true, escalones: [] },
  rosa: { iata: "FLN", modo: "car", km: 96, compartido: 0, privado: 72, compartidoConsultar: true, escalones: [] },
  bcm: { iata: "FLN", modo: "car", km: 96, compartido: 0, privado: 72, appRideUsd: 42, compartidoConsultar: true, escalones: [] },
  itapema: { iata: "FLN", modo: "car", km: 88, compartido: 0, privado: 67, compartidoConsultar: true, escalones: [] },
  garopaba: { iata: "FLN", modo: "car", km: 89, compartido: 0, privado: 67, compartidoConsultar: true, escalones: [] },
  ferrugem: { iata: "FLN", modo: "car", km: 100, compartido: 0, privado: 74, compartidoConsultar: true, escalones: [] },
  picarras: { iata: "FLN", modo: "car", km: 129, compartido: 0, privado: 92, compartidoConsultar: true, escalones: [] },
  gram: { iata: "POA", modo: "car", km: 109, compartido: 0, privado: 80, appRideUsd: 43, compartidoConsultar: true, escalones: [] },
  canela: { iata: "POA", modo: "car", km: 115, compartido: 0, privado: 83, compartidoConsultar: true, escalones: [] },
  torres: { iata: "POA", modo: "car", km: 184, compartido: 0, privado: 126, compartidoConsultar: true, escalones: [] },
  canoa: { iata: "POA", modo: "car", km: 135, compartido: 0, privado: 96, compartidoConsultar: true, escalones: [] },
  rec: { iata: "REC", modo: "car", km: 13, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  joaopessoa: { iata: "JPA", modo: "car", km: 13, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  poa: { iata: "POA", modo: "car", km: 9, compartido: 0, privado: 30, appRideUsd: 7, compartidoConsultar: true, escalones: [] },
};
// Precio de una modalidad de transfer para un destino. `modo` es 'shared' o
// 'private'. Devuelve null si el destino no esta en la tabla, para que el que
// llama decida si cae a un estimado o no muestra nada.
function transferPrice(destKey, modo) {
  const t = TRANSFER_PRICES[String(destKey || '').toLowerCase()];
  if (!t) return null;
  return modo === 'private' ? t.privado : t.compartido;
}
// Precio del transfer PRIVADO para una cantidad de personas: el escalon mas barato
// cuyo rango [min, max] incluye a `pax`. Devuelve { brl, vehiculo } (BRL por
// vehiculo) o null cuando no hay precio para esa cantidad (sin escalones
// cargados, o mas personas que el ultimo escalon): la app muestra "Consultar".
// public/app.js tiene la misma cuenta en privadoPorPax(); test.js las compara.
function transferPrivadoPara(destKey, pax) {
  const t = TRANSFER_PRICES[String(destKey || '').toLowerCase()];
  const n = Math.max(1, Math.floor(Number(pax)) || 1);
  let mejor = null;
  for (const e of (t && t.escalones) || []) {
    if (n >= e.min && n <= e.max && (!mejor || e.brl < mejor.brl)) mejor = { brl: e.brl, vehiculo: e.vehiculo };
  }
  return mejor;
}
// Las dos modalidades de un destino, con el contexto (kilometros, si es ferry o
// vuelo, y el precio de un pedido de app cuando se pudo verificar). Es lo que
// consume el server para mandar el meta.officialTransfer y lo que dibuja las
// cards del cliente.
function transferOptions(destKey) {
  const key = String(destKey || '').toLowerCase();
  const t = TRANSFER_PRICES[key];
  if (!t || !DEST[key]) return null;
  return {
    destino: key, nombre: DEST[key].name, iata: t.iata, modo: t.modo,
    km: t.km == null ? null : t.km,
    compartido: t.compartido, privado: t.privado,
    // Un destino sin van compartida (fernando, que es una isla) tiene compartido
    // en 0 y esto en true. La UI lo usa para no ofrecer una opcion que no existe.
    soloPrivado: !!t.soloPrivado,
    // Sin precio de compartido cargado: la UI dice "Consultar" (no es una isla).
    compartidoConsultar: !!t.compartidoConsultar,
    escalones: t.escalones || [],
    appRideUsd: t.appRideUsd == null ? null : t.appRideUsd
  };
}

function roadtripCost(dk, kmPerLiter, fuelPriceUsd) {  const route = ROADTRIP_ROUTES[dk];
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
    // El transporte local tiene tres niveles (eco / medio / confort) desde que se
  // agrego el medio, asi que el tier de la propuesta elige uno y no cae al de
  // al lado. Antes eran dos y el tier intermedio usaba "eco", que lo hacia tan
  // barato como el mas barato: una propuesta Equilibrada con hotel de 4 estrellas
  // se movia en omnibus.
  local: dailyCosts.transport[T.id === 'confort' ? 'confort' : T.id === 'medio' ? 'medio' : 'eco'] * nights * pax,
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
    out.push({ kind: 'ruta', id: bm.id, save: rec.total - bm.total, title: 'Probá: ' + MODES[bm.mode].label.toLowerCase(), text: MODES[bm.mode].tip });
  }
  let bt = null;
  list.forEach(function (p) { if (p.mode === rec.mode && p.ti < rec.ti && (!bt || p.total < bt.total)) bt = p; });
  if (bt && rec.total - bt.total >= 15) {
    out.push({ kind: 'alojamiento', id: bt.id, save: rec.total - bt.total, title: 'Alojamiento ' + TIERS[bt.ti].label,
      text: TIERS[bt.ti].desc + '. Cambia el total más de lo que parece.' });
  }
  out.sort(function (a, b) { return b.save - a.save; });
  return out.slice(0, 3);
}

/* ---------- validación de entrada ---------- */
function validate(q, today) {
  const fail = function (m) { const e = new Error(m); e.status = 400; throw e; };
  // 'camboriu' se fusiono con 'bcm' (era la misma ciudad): los viajes guardados y los links
  // viejos con ese destino siguen funcionando.
  const dest = String(q.dest || '') === 'camboriu' ? 'bcm' : String(q.dest || '');
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

module.exports = { MODES, DEST, TIERS, REAL_COSTS, DESTINATION_COSTS, destinationCosts, lodgingNightlyCosts, ROADTRIP_ROUTES, DEST_COORDS, ORIGIN_COORDS, isRoadtripAllowed, roadtripCost, getToday, addDays, iso, parse, daysBetween, calc, build, pick, seriesDates, seriesFor, applyRealCalendar, comboTransfer, haversineKm, COMBO_MAX_KM, COMBO_FERRY_ONLY, tipsFor, validate, compute, TRANSFER_PRICES, transferPrice, transferPrivadoPara, transferOptions };
