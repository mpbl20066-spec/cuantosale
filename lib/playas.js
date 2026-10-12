/*
 * Playas y centro de cada destino, para decir de cada hotel en que playa esta y
 * a cuanto queda del centro.
 *
 * Booking manda la latitud y la longitud de cada alojamiento. Con eso se calcula
 * la playa MAS CERCANA de la lista de abajo (si queda a menos de PLAYA_MAX_KM) y
 * la distancia en linea recta al centro. No es distancia caminando ni en auto:
 * es una referencia para comparar hoteles, y la tarjeta la rotula "en línea
 * recta".
 *
 * Las coordenadas son aproximadas (precision de 1 a 2 km, suficiente para
 * asignar la playa mas cercana). Un destino que no figura aca (Sao Paulo,
 * Gramado, Porto Alegre...) no tiene filtro de playa: el hotel se muestra igual,
 * solo sin esa linea.
 *
 * Las ciudades sin playa (Sao Paulo, Gramado, Canela, Porto Alegre) tienen
 * "zonas" en lugar de playas: barrios. El hotel lleva "barrio" (el mas
 * cercano, a ZONA_MAX_KM o menos) y nunca "playa", para que ninguna pantalla
 * diga "a 800 m de la playa" en Sao Paulo.
 */
'use strict';

const PLAYA_MAX_KM = 2.5;
const ZONA_MAX_KM = 3;

const DESTINOS = {
  fln: { centro: { name: 'Centro', lat: -27.5954, lng: -48.5480 }, playas: [
    { name: 'Canasvieiras', lat: -27.4296, lng: -48.4602 }, { name: 'Jurerê', lat: -27.4389, lng: -48.4992 },
    { name: 'Ingleses', lat: -27.4367, lng: -48.3856 }, { name: 'Santinho', lat: -27.4656, lng: -48.3762 },
    { name: 'Praia Brava', lat: -27.3976, lng: -48.4158 }, { name: 'Barra da Lagoa', lat: -27.5748, lng: -48.4258 },
    { name: 'Praia Mole', lat: -27.6034, lng: -48.4370 },
    { name: 'Campeche', lat: -27.6859, lng: -48.4805 }, { name: 'Armação', lat: -27.7444, lng: -48.5064 },
    { name: 'Daniela', lat: -27.4480, lng: -48.5310 }, { name: 'Ponta das Canas', lat: -27.3940, lng: -48.4370 },
    { name: 'Cachoeira do Bom Jesus', lat: -27.4190, lng: -48.4290 }, { name: 'Lagoa da Conceição', lat: -27.6000, lng: -48.4740 },
    { name: 'Joaquina', lat: -27.6290, lng: -48.4490 }, { name: 'Morro das Pedras', lat: -27.7170, lng: -48.4990 },
    { name: 'Pântano do Sul', lat: -27.7790, lng: -48.5080 }] },
  buz: { centro: { name: 'Orla Bardot', lat: -22.7469, lng: -41.8800 }, playas: [
    { name: 'Orla Bardot / Ossos', lat: -22.7475, lng: -41.8795 }, { name: 'João Fernandes', lat: -22.7417, lng: -41.8696 },
    { name: 'Ferradura', lat: -22.7641, lng: -41.8864 }, { name: 'Geribá', lat: -22.7780, lng: -41.9008 },
    { name: 'Manguinhos', lat: -22.7652, lng: -41.9250 },
    { name: 'Tartaruga', lat: -22.7540, lng: -41.8710 }, { name: 'Azeda / Azedinha', lat: -22.7420, lng: -41.8770 },
    { name: 'Brava / Olho de Boi', lat: -22.7690, lng: -41.8700 }, { name: 'Ferradurinha', lat: -22.7720, lng: -41.8890 },
    { name: 'Tucuns', lat: -22.7890, lng: -41.9300 }, { name: 'Rasa', lat: -22.7350, lng: -41.9580 },
    { name: 'José Gonçalves', lat: -22.8020, lng: -41.9120 }] },
  arraial: { centro: { name: 'Centro', lat: -22.9660, lng: -42.0270 }, playas: [
    { name: 'Praia Grande', lat: -22.9699, lng: -42.0200 }, { name: 'Praia dos Anjos', lat: -22.9736, lng: -42.0190 },
    { name: 'Prainhas do Pontal', lat: -22.9688, lng: -41.9994 }, { name: 'Forno', lat: -22.9620, lng: -42.0127 }] },
  cabo: { centro: { name: 'Centro', lat: -22.8790, lng: -42.0190 }, playas: [
    { name: 'Praia do Forte', lat: -22.8859, lng: -42.0073 }, { name: 'Peró', lat: -22.8490, lng: -41.9930 },
    { name: 'Praia das Conchas', lat: -22.8770, lng: -42.0170 }] },
  rio: { centro: { name: 'Centro', lat: -22.9068, lng: -43.1729 }, playas: [
    { name: 'Leme', lat: -22.9620, lng: -43.1700 }, { name: 'Copacabana', lat: -22.9711, lng: -43.1822 },
    { name: 'Ipanema', lat: -22.9868, lng: -43.2053 }, { name: 'Leblon', lat: -22.9860, lng: -43.2250 },
    { name: 'São Conrado', lat: -22.9997, lng: -43.2730 }, { name: 'Barra da Tijuca', lat: -23.0100, lng: -43.3650 },
    { name: 'Recreio', lat: -23.0260, lng: -43.4700 },
    { name: 'Botafogo', lat: -22.9470, lng: -43.1820 }, { name: 'Flamengo', lat: -22.9320, lng: -43.1730 }] },
  porto: { centro: { name: 'Vila de Porto de Galinhas', lat: -8.5055, lng: -35.0020 }, playas: [
    { name: 'Porto de Galinhas', lat: -8.5060, lng: -35.0000 }, { name: 'Muro Alto', lat: -8.4620, lng: -34.9930 },
    { name: 'Maracaípe', lat: -8.5330, lng: -35.0050 },
    { name: 'Cupe', lat: -8.4840, lng: -34.9970 }, { name: 'Serrambi', lat: -8.5650, lng: -35.0130 }] },
  mcz: { centro: { name: 'Centro', lat: -9.6658, lng: -35.7353 }, playas: [
    { name: 'Pajuçara', lat: -9.6680, lng: -35.7145 }, { name: 'Ponta Verde', lat: -9.6642, lng: -35.7044 },
    { name: 'Jatiúca', lat: -9.6500, lng: -35.6990 }, { name: 'Cruz das Almas', lat: -9.6350, lng: -35.6900 },
    { name: 'Jacarecica', lat: -9.6180, lng: -35.6750 },
    { name: 'Guaxuma', lat: -9.6000, lng: -35.6650 }, { name: 'Garça Torta', lat: -9.5890, lng: -35.6560 },
    { name: 'Riacho Doce', lat: -9.5720, lng: -35.6440 }] },
  maragogi: { centro: { name: 'Centro', lat: -9.0122, lng: -35.2225 }, playas: [
    { name: 'Praia de Maragogi', lat: -9.0110, lng: -35.2210 }, { name: 'Peroba', lat: -9.0430, lng: -35.2420 }] },
  nat: { centro: { name: 'Centro', lat: -5.7945, lng: -35.2110 }, playas: [
    { name: 'Ponta Negra', lat: -5.8770, lng: -35.1760 }, { name: 'Areia Preta', lat: -5.7900, lng: -35.1880 },
    { name: 'Praia do Meio', lat: -5.7760, lng: -35.1980 }, { name: 'Praia dos Artistas', lat: -5.7780, lng: -35.1950 },
    { name: 'Via Costeira', lat: -5.8350, lng: -35.1840 }] },
  pip: { centro: { name: 'Centro de Pipa', lat: -6.2280, lng: -35.0500 }, playas: [
    { name: 'Pipa (centro)', lat: -6.2280, lng: -35.0460 }, { name: 'Praia do Amor', lat: -6.2350, lng: -35.0440 },
    { name: 'Golfinhos', lat: -6.2420, lng: -35.0390 }, { name: 'Madeiro', lat: -6.2530, lng: -35.0380 }] },
  trancoso: { centro: { name: 'Quadrado', lat: -16.5917, lng: -39.0957 }, playas: [
    { name: 'Nativos', lat: -16.5940, lng: -39.0880 }, { name: 'Coqueiros', lat: -16.6060, lng: -39.0890 }] },
  ssa: { centro: { name: 'Pelourinho', lat: -12.9714, lng: -38.5108 }, playas: [
    { name: 'Barra', lat: -13.0100, lng: -38.5330 }, { name: 'Ondina', lat: -13.0100, lng: -38.5090 },
    { name: 'Rio Vermelho', lat: -13.0100, lng: -38.4920 }, { name: 'Itapuã', lat: -12.9570, lng: -38.3540 },
    { name: 'Stella Maris', lat: -12.9410, lng: -38.3290 },
    { name: 'Amaralina', lat: -13.0110, lng: -38.4700 }, { name: 'Pituba', lat: -13.0010, lng: -38.4560 },
    { name: 'Jaguaribe', lat: -12.9750, lng: -38.3990 }] },
  for: { centro: { name: 'Centro', lat: -3.7275, lng: -38.5275 }, playas: [
    { name: 'Iracema', lat: -3.7190, lng: -38.5110 }, { name: 'Meireles', lat: -3.7260, lng: -38.4930 },
    { name: 'Mucuripe', lat: -3.7230, lng: -38.4760 }, { name: 'Praia do Futuro', lat: -3.7420, lng: -38.4440 }] },
  jericoacoara: { centro: { name: 'Centro de Jeri', lat: -2.7970, lng: -40.5130 }, playas: [
    { name: 'Praia de Jericoacoara', lat: -2.7930, lng: -40.5130 }, { name: 'Malhada', lat: -2.7980, lng: -40.4900 }] },
  morro: { centro: { name: 'Vila', lat: -13.3820, lng: -38.9160 }, playas: [
    { name: 'Primeira Praia', lat: -13.3790, lng: -38.9150 }, { name: 'Segunda Praia', lat: -13.3860, lng: -38.9120 },
    { name: 'Terceira Praia', lat: -13.3940, lng: -38.9070 }, { name: 'Quarta Praia', lat: -13.4030, lng: -38.9000 }] },
  portoseguro: { centro: { name: 'Centro', lat: -16.4435, lng: -39.0645 }, playas: [
    { name: 'Taperapuã', lat: -16.4270, lng: -39.0640 }, { name: 'Curuípe', lat: -16.4050, lng: -39.0630 },
    { name: 'Mundaí', lat: -16.3700, lng: -39.0480 }] },
  ajuda: { centro: { name: 'Centro de Arraial d’Ajuda', lat: -16.4540, lng: -39.0750 }, playas: [
    { name: 'Mucugê', lat: -16.4620, lng: -39.0620 }, { name: 'Pitinga', lat: -16.4790, lng: -39.0560 },
    { name: 'Taípe', lat: -16.5300, lng: -39.0760 }] },
  itacare: { centro: { name: 'Centro', lat: -14.2780, lng: -38.9965 }, playas: [
    { name: 'Concha', lat: -14.2760, lng: -38.9930 }, { name: 'Tiririca', lat: -14.2830, lng: -38.9930 },
    { name: 'Resende', lat: -14.2950, lng: -38.9930 }] },
  forte: { centro: { name: 'Vila de Praia do Forte', lat: -12.5775, lng: -38.0063 }, playas: [
    { name: 'Praia do Forte', lat: -12.5740, lng: -38.0020 }, { name: 'Papa Gente', lat: -12.5880, lng: -37.9990 }] },
  joaopessoa: { centro: { name: 'Centro', lat: -7.1150, lng: -34.8630 }, playas: [
    { name: 'Tambaú', lat: -7.1120, lng: -34.8230 }, { name: 'Cabo Branco', lat: -7.1290, lng: -34.8170 },
    { name: 'Manaíra', lat: -7.0950, lng: -34.8300 }, { name: 'Bessa', lat: -7.0700, lng: -34.8270 }] },
  rec: { centro: { name: 'Centro', lat: -8.0630, lng: -34.8710 }, playas: [
    { name: 'Boa Viagem', lat: -8.1190, lng: -34.8990 }, { name: 'Pina', lat: -8.0900, lng: -34.8810 }] },
  bcm: { centro: { name: 'Centro', lat: -26.9930, lng: -48.6350 }, playas: [
    { name: 'Praia Central', lat: -26.9930, lng: -48.6340 }, { name: 'Praia de Laranjeiras', lat: -27.0180, lng: -48.6180 },
    { name: 'Praia dos Amores', lat: -26.9850, lng: -48.6330 },
    { name: 'Praia Brava', lat: -26.9500, lng: -48.6270 }, { name: 'Barra Sul', lat: -27.0020, lng: -48.6250 },
    { name: 'Taquaras', lat: -27.0310, lng: -48.5880 }] },
  bombinhas: { centro: { name: 'Centro', lat: -27.1465, lng: -48.4775 }, playas: [
    { name: 'Bombas', lat: -27.1410, lng: -48.4770 }, { name: 'Bombinhas', lat: -27.1500, lng: -48.4830 },
    { name: 'Mariscal', lat: -27.1690, lng: -48.4540 }, { name: 'Quatro Ilhas', lat: -27.1730, lng: -48.4690 },
    { name: 'Canto Grande', lat: -27.1840, lng: -48.5060 }, { name: 'Zimbros', lat: -27.2070, lng: -48.5250 }] },
  itapema: { centro: { name: 'Centro', lat: -27.0890, lng: -48.6150 }, playas: [
    { name: 'Praia Central (Itapema)', lat: -27.0910, lng: -48.6100 }, { name: 'Meia Praia', lat: -27.1270, lng: -48.6100 }] },
  garopaba: { centro: { name: 'Centro', lat: -28.0275, lng: -48.6240 }, playas: [
    { name: 'Garopaba', lat: -28.0260, lng: -48.6140 }, { name: 'Silveira', lat: -28.0500, lng: -48.6130 }] },
  ferrugem: { centro: { name: 'Ferrugem', lat: -28.0870, lng: -48.6230 }, playas: [
    { name: 'Ferrugem', lat: -28.0780, lng: -48.6110 }] },
  rosa: { centro: { name: 'Praia do Rosa', lat: -28.1290, lng: -48.6420 }, playas: [
    { name: 'Praia do Rosa', lat: -28.1290, lng: -48.6370 }, { name: 'Ouvidor', lat: -28.1100, lng: -48.6250 }] },
  picarras: { centro: { name: 'Centro', lat: -26.7640, lng: -48.6720 }, playas: [
    { name: 'Praia de Piçarras', lat: -26.7610, lng: -48.6630 }] },
  torres: { centro: { name: 'Centro', lat: -29.3374, lng: -49.7300 }, playas: [
    { name: 'Praia Grande', lat: -29.3380, lng: -49.7200 }, { name: 'Praia da Cal', lat: -29.3500, lng: -49.7150 },
    { name: 'Guarita', lat: -29.3540, lng: -49.7250 }] },
  canoa: { centro: { name: 'Centro', lat: -29.7510, lng: -50.0210 }, playas: [
    { name: 'Capão da Canoa', lat: -29.7440, lng: -50.0100 }] },
  ubatuba: { centro: { name: 'Centro', lat: -23.4335, lng: -45.0835 }, playas: [
    { name: 'Praia Grande', lat: -23.4680, lng: -45.0590 }, { name: 'Perequê-Açu', lat: -23.4330, lng: -45.0700 },
    { name: 'Itamambuca', lat: -23.4020, lng: -44.9990 },
    { name: 'Toninhas', lat: -23.4920, lng: -45.0750 }, { name: 'Enseada', lat: -23.4960, lng: -45.0880 },
    { name: 'Lázaro', lat: -23.5100, lng: -45.1380 }] },
  ilhabela: { centro: { name: 'Vila', lat: -23.7780, lng: -45.3570 }, playas: [
    { name: 'Perequê', lat: -23.7836, lng: -45.3596 }, { name: 'Itaquanduba', lat: -23.8122, lng: -45.3660 },
    { name: 'Feiticeira', lat: -23.8350, lng: -45.3870 }, { name: 'Curral', lat: -23.8670, lng: -45.4180 }] },
  paraty: { centro: { name: 'Centro Histórico', lat: -23.2178, lng: -44.7131 }, playas: [
    { name: 'Pontal', lat: -23.2215, lng: -44.7135 }, { name: 'Jabaquara', lat: -23.2560, lng: -44.6900 }] },
  ilha: { centro: { name: 'Vila do Abraão', lat: -23.1369, lng: -44.1710 }, playas: [
    { name: 'Abraão', lat: -23.1369, lng: -44.1710 }, { name: 'Lopes Mendes', lat: -23.1660, lng: -44.1420 }] },
  angra: { centro: { name: 'Centro', lat: -23.0067, lng: -44.3180 }, playas: [
    { name: 'Praia do Anil', lat: -23.0070, lng: -44.3150 }] },
  sao: { centro: { name: 'Praça da Sé', lat: -23.5503, lng: -46.6339 }, playas: [], zonas: [
    { name: 'Centro / República', lat: -23.5440, lng: -46.6430 }, { name: 'Liberdade', lat: -23.5580, lng: -46.6350 },
    { name: 'Avenida Paulista', lat: -23.5614, lng: -46.6559 }, { name: 'Jardins', lat: -23.5670, lng: -46.6670 },
    { name: 'Pinheiros', lat: -23.5670, lng: -46.6930 }, { name: 'Vila Madalena', lat: -23.5530, lng: -46.6910 },
    { name: 'Itaim Bibi', lat: -23.5840, lng: -46.6800 }, { name: 'Vila Olímpia', lat: -23.5950, lng: -46.6860 },
    { name: 'Moema', lat: -23.6010, lng: -46.6650 }, { name: 'Brooklin / Berrini', lat: -23.6100, lng: -46.6950 },
    { name: 'Aeropuerto de Guarulhos', lat: -23.4350, lng: -46.4730 }] },
  gram: { centro: { name: 'Rua Coberta', lat: -29.3786, lng: -50.8747 }, playas: [], zonas: [
    { name: 'Centro', lat: -29.3786, lng: -50.8747 }, { name: 'Lago Negro', lat: -29.3930, lng: -50.8720 },
    { name: 'Avenida das Hortênsias', lat: -29.3810, lng: -50.8560 }, { name: 'Bavária', lat: -29.3680, lng: -50.8820 }] },
  canela: { centro: { name: 'Catedral de Pedra', lat: -29.3650, lng: -50.8130 }, playas: [], zonas: [
    { name: 'Centro', lat: -29.3650, lng: -50.8130 }, { name: 'Camino al Caracol', lat: -29.3350, lng: -50.8300 }] },
  poa: { centro: { name: 'Centro Histórico', lat: -30.0300, lng: -51.2280 }, playas: [], zonas: [
    { name: 'Centro Histórico', lat: -30.0300, lng: -51.2280 }, { name: 'Cidade Baixa', lat: -30.0400, lng: -51.2200 },
    { name: 'Menino Deus', lat: -30.0510, lng: -51.2240 }, { name: 'Moinhos de Vento', lat: -30.0250, lng: -51.2030 },
    { name: 'Petrópolis / Bela Vista', lat: -30.0400, lng: -51.1900 }, { name: 'Aeropuerto', lat: -29.9940, lng: -51.1710 }] },
  fernando: { centro: { name: 'Vila dos Remédios', lat: -3.8540, lng: -32.4240 }, playas: [
    { name: 'Praia do Porto', lat: -3.8460, lng: -32.4040 }, { name: 'Conceição', lat: -3.8560, lng: -32.4200 }] }
};

function km(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function tienePlayas(destKey) {
  return !!(DESTINOS[destKey] && DESTINOS[destKey].playas.length);
}

/* Donde queda un hotel. Devuelve null si no hay coordenadas o el destino no
   esta en la tabla. `playa` queda en null si la mas cercana esta a mas de
   PLAYA_MAX_KM: decir "en Copacabana" de un hotel a 6 km seria mentira. */
function ubicacionDeHotel(destKey, lat, lng) {
  const destino = DESTINOS[destKey];
  lat = Number(lat); lng = Number(lng);
  if (!destino || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const punto = { lat: lat, lng: lng };
  let mejor = null;
  if (destino.zonas) {
    destino.zonas.forEach(function (zona) {
      const d = km(punto, zona);
      if (!mejor || d < mejor.km) mejor = { name: zona.name, km: d };
    });
    return {
      playa: null, playaKm: null,
      barrio: mejor && mejor.km <= ZONA_MAX_KM ? mejor.name : null,
      centroKm: Math.round(km(punto, destino.centro) * 10) / 10,
      centroNombre: destino.centro.name
    };
  }
  destino.playas.forEach(function (playa) {
    const d = km(punto, playa);
    if (!mejor || d < mejor.km) mejor = { name: playa.name, km: d };
  });
  const cerca = mejor && mejor.km <= PLAYA_MAX_KM;
  return {
    playa: cerca ? mejor.name : null,
    playaKm: cerca ? Math.round(mejor.km * 10) / 10 : null,
    centroKm: Math.round(km(punto, destino.centro) * 10) / 10,
    centroNombre: destino.centro.name
  };
}

/* Las playas del destino, en el orden de la tabla, para armar el filtro. */
function nombresDePlayas(destKey) {
  return DESTINOS[destKey] ? DESTINOS[destKey].playas.map(function (p) { return p.name; }) : [];
}

/* Los barrios de una ciudad sin playa, para el filtro de zona. */
function nombresDeZonas(destKey) {
  return DESTINOS[destKey] && DESTINOS[destKey].zonas ? DESTINOS[destKey].zonas.map(function (z) { return z.name; }) : [];
}

/* El centro del destino, o null. Lo usa la regla hiperlocal de la Guia Secreta
   (lib/guias.js) para medir cada playa contra el mismo punto que la tarjeta
   del hotel. */
function centroDe(destKey) {
  return DESTINOS[destKey] ? DESTINOS[destKey].centro : null;
}

module.exports = { ubicacionDeHotel, nombresDePlayas, nombresDeZonas, tienePlayas, centroDe, km, PLAYA_MAX_KM };
