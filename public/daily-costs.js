'use strict';
/* GENERADO. No editar a mano: corré `npm run build:costos`.
   Fuente: data/costos-diarios.json (que a su vez documenta, por destino, de
   dónde sale el número, cuándo se verificó y cuánta confianza tiene). */
(function (root, tabla, proc) {
  root.CS_DESTINATION_DAILY_COSTS = tabla;
  // La procedencia de cada número: de dónde sale, cuándo se verificó y cuánta
  // confianza tiene. Va aparte para no ensuciar las claves de la tabla.
  root.CS_DESTINATION_DAILY_COSTS_PROVENANCE = proc;
  // La prueba de test.js lo requirea para compararlo con el modelo, asi que
  // tiene que servir tanto en el navegador como en node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = tabla;
    // enumerable: false a propósito. Object.keys() tiene que seguir devolviendo
    // solo destinos, o los validadores ven una clave de más.
    Object.defineProperty(module.exports, 'provenance', { value: proc, enumerable: false });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, {
  poa: { name: 'Porto Alegre', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 27, moderado: 50, gourmet: 90 } },
  rio: { name: 'Río de Janeiro', transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 28, moderado: 55, gourmet: 95 } },
  sao: { name: 'São Paulo', transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  ssa: { name: 'Salvador de Bahía', transport: { eco: 5, medio: 8, confort: 14 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  for: { name: 'Fortaleza', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 26, moderado: 47, gourmet: 83 } },
  nat: { name: 'Natal', transport: { eco: 4, medio: 8, confort: 15 }, food: { casual: 26, moderado: 48, gourmet: 80 } },
  mcz: { name: 'Maceió', transport: { eco: 3, medio: 7, confort: 15 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  rec: { name: 'Recife', transport: { eco: 3, medio: 6, confort: 14 }, food: { casual: 25, moderado: 48, gourmet: 82 } },
  joaopessoa: { name: 'João Pessoa', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 26, moderado: 44, gourmet: 71 } },
  porto: { name: 'Porto de Galinhas', transport: { eco: 5, medio: 9, confort: 17 }, food: { casual: 24, moderado: 43, gourmet: 73 } },
  maragogi: { name: 'Maragogi', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 24, moderado: 45, gourmet: 75 } },
  jericoacoara: { name: 'Jericoacoara', transport: { eco: 4, medio: 8, confort: 18 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  buz: { name: 'Búzios', transport: { eco: 4, medio: 9, confort: 19 }, food: { casual: 34, moderado: 59, gourmet: 104 } },
  arraial: { name: 'Arraial do Cabo', transport: { eco: 4, medio: 7, confort: 12 }, food: { casual: 23, moderado: 41, gourmet: 78 } },
  cabo: { name: 'Cabo Frio', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  angra: { name: 'Angra dos Reis', transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 25, moderado: 45, gourmet: 85 } },
  paraty: { name: 'Paraty', transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 21, moderado: 42, gourmet: 74 } },
  ilha: { name: 'Ilha Grande', transport: { eco: 4, medio: 8, confort: 15 }, food: { casual: 28, moderado: 52, gourmet: 90 } },
  ubatuba: { name: 'Ubatuba', transport: { eco: 5, medio: 10, confort: 22 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  ilhabela: { name: 'Ilhabela', transport: { eco: 6, medio: 11, confort: 22 }, food: { casual: 26, moderado: 48, gourmet: 83 } },
  fln: { name: 'Florianópolis', transport: { eco: 6, medio: 13, confort: 27 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  bcm: { name: 'Balneário Camboriú', transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  bombinhas: { name: 'Bombinhas', transport: { eco: 5, medio: 10, confort: 19 }, food: { casual: 23, moderado: 46, gourmet: 86 } },
  rosa: { name: 'Praia do Rosa', transport: { eco: 3, medio: 8, confort: 19 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  itapema: { name: 'Itapema', transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 28, moderado: 54, gourmet: 92 } },
  garopaba: { name: 'Garopaba', transport: { eco: 3, medio: 7, confort: 17 }, food: { casual: 25, moderado: 50, gourmet: 86 } },
  ferrugem: { name: 'Ferrugem', transport: { eco: 3, medio: 7, confort: 15 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  picarras: { name: 'Piçarras', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  gram: { name: 'Gramado', transport: { eco: 5, medio: 10, confort: 19 }, food: { casual: 33, moderado: 59, gourmet: 102 } },
  canela: { name: 'Canela', transport: { eco: 5, medio: 10, confort: 22 }, food: { casual: 31, moderado: 56, gourmet: 97 } },
  torres: { name: 'Torres', transport: { eco: 3, medio: 6, confort: 12 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  canoa: { name: 'Capão da Canoa', transport: { eco: 3, medio: 6, confort: 12 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  fernando: { name: 'Fernando de Noronha', transport: { eco: 4, medio: 12, confort: 34 }, food: { casual: 50, moderado: 95, gourmet: 160 } },
  pip: { name: 'Pipa', transport: { eco: 4, medio: 9, confort: 15 }, food: { casual: 23, moderado: 45, gourmet: 82 } },
  trancoso: { name: 'Trancoso', transport: { eco: 5, medio: 13, confort: 33 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  ajuda: { name: 'Arraial d’Ajuda', transport: { eco: 5, medio: 10, confort: 20 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  morro: { name: 'Morro de São Paulo', transport: { eco: 4, medio: 8, confort: 16 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  portoseguro: { name: 'Porto Seguro', transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 33, moderado: 60, gourmet: 105 } },
  itacare: { name: 'Itacaré', transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 32, moderado: 58, gourmet: 100 } },
  forte: { name: 'Praia do Forte', transport: { eco: 3, medio: 7, confort: 15 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
}, {
  _meta: {
      "confianza": {
        "alta": "Hay una fuente directa y reciente para ESE destino (Numbeo con datos suficientes, o precios de carta revisados).",
        "media": "Hay fuente para el destino, pero de pocos colaboradores o algo vieja; o varias fuentes que coinciden.",
        "baja": "NO hay fuente publica para el destino. El valor esta DERIVADO de otro destino similar, con el ajuste escrito en 'derivacion'. Tratarlo como conjetura."
      },
      "aviso": "Estos valores los estima el modelo, no vienen de un provider. Por eso calc() los marca sources.comidas = 'estimado'. Un scraper de precios reales seria el unico modo de que dejen de ser estimaciones.",
      "unidad": "USD por persona por NOCHE (se aplica como valor * noches * pasajeros). No es el precio de una comida: es lo que gasta un turista en comer durante un dia completo."
    },
  poa: {
      "fuente": "Numbeo Porto Alegre (2026): comida barata R$40, cena media para 2 R$200. CityCost: USD 7,72 / 39,29. quantocustaviajar: almuerzo por kilo R$30-50, ejecutivo R$45-65, cena con bebida R$80-150. Traslado: pasaje R$5,17, taxi desde R$10,16.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Puesto entre Torres (pueblo) y Gramado (resort) de la misma provincia: es ciudad pero no es destino turistico. El Sur es la region mas cara del pais en PF (R$34,90, IPF ACSP jun/2026), pero el Mercado Publico y Bom Fim lo mantienen barato."
    },
  rio: {
      "fuente": "Numbeo Rio de Janeiro: comida barata R$37,50, cena media para 2 R$200. Pack Lightly: comida callejera R$8-15, por kilo R$20-40, media R$40-90. food&drink para 14 dias: USD 308/770/1540.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Metro, VLT, buses y apps baratos y frecuentes: el traslado diario es de los mas eficientes del catalogo. La Zona Sur sube bastante en comida por encima de este valor."
    },
  sao: {
      "fuente": "Serasa (jun/2026): self-service por kilo R$86,86 medio de la ciudad, PF R$38,65. Restaurante casual R$50-120. Numbeo/Tolatam (may/2026): cena media para 2 R$200-350. world-prices: comida en restau R$40.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "La mas cara del pais junto con Curitiba, y con el PF mas caro entre las capitales: el promedio por kilo de la ciudad es R$86,86, un 30% mas que el PF nacional."
    },
  ssa: {
      "fuente": "pack-lightly: PF en el Mercado Sao Joaquim desde R$18, por kilo R$20-40, moqueca en el mercado USD 6 y a la calle USD 15. latamtravellers: acaraje R$10-20, moqueca en restaurante de barrio USD 10-16, por kilo R$33-57.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Es de los mas baratos de Brasil junto con la costa del Nordeste. El dato de Salvador es de los mas solidos: varias fuentes independientes coinciden."
    },
  for: {
      "fuente": "infobrazil.org la marca como la ciudad-playa mas barata de Brasil (-15% de recargo). Cesta basica de O POVO + Procon Fortaleza (ago/2026): R$630,71, la mas cara del Nordeste, pero con mucho super barato (Atacadao). || 2026-09-30, busqueda de precios: Numbeo Fortaleza (sep/2026, 30 colaboradores): comida barata R$30, cena media para 2 R$163,46, bus R$4,75, taxi bajada R$7 + R$4,06/km. Promediado con quantocustaviajar Fortaleza (abr/2025): R$92/122/163 por dia.",
      "confianza": "media",
      "verificado": "2026-09-30",
      "derivacion": "Comparte valores con jericoacoara (mismo estado y mismo aeropuerto, IATA FOR). El dato de la cesta basica apunta a que Fortaleza deberia ser MAS BARATA de lo que esta aca, no mas cara: el indice de recargo -15% de infobrazil es del gasto turistico total, no solo de comida. Conviene revisar."
    },
  nat: {
      "fuente": "falazuki Natal (2026): almuerzo por quilo R$22-40, cena casual R$35-75, delivery R$24-46. O POVO + Procon (ago/2026): cesta basica R$572,66, la mas barata del Nordeste.",
      "confianza": "media",
      "verificado": "2026-09-27"
    },
  mcz: {
      "fuente": "falazuki Maceio (2026): almuerzo por quilo R$20-36, cena casual R$30-65, delivery R$22-42. O POVO + Procon Maceio (ago/2026): cesta basica R$599,81, segunda mas economica del Nordeste.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Maceio aparece como una de las ciudades-playa mas baratas (infobrazil: -15%)."
    },
  rec: {
      "fuente": "falazuki Recife (2026): almuerzo por quilo R$24-44, cena casual R$38-80, delivery R$26-50, marmita R$15-25.",
      "confianza": "media",
      "verificado": "2026-09-27"
    },
  joaopessoa: {
      "fuente": "O POVO + Procon Joao Pessoa (mar/2026): cesta basica R$538,67, la mas barata del Nordeste, con la mayor dispersion entre supermercados (R$377 a R$507 en la misma cadena). || 2026-09-30, busqueda de precios: Numbeo Joao Pessoa (jun/2026, 20 colaboradores): comida barata R$35, cena media para 2 R$150. quantocustaviajar (R$52/61/82 por dia) se descarto por inconsistente.",
      "confianza": "media",
      "verificado": "2026-09-30",
      "derivacion": "Copia de rec. Joao Pessoa esta 300 km al norte y comparte corredor de vuelo, pero su cesta basica es R$92 mas barata, asi que deberia estar un poco por DEBAJO de Recife, no igual."
    },
  porto: {
      "fuente": "Se buscaron precios de restaurante de Porto de Galinhas. Lo que hay publicado es sobre el resort con todo incluido, que no separa la comida: el costo real depende de si el hotel es all-inclusive o no, y la app calcula el hotel aparte. Por eso el numero no se puede derivar. Se lo pone un poco por encima de Recife (28 contra 25) porque el perfil de gasto es de resort de playa. || 2026-09-30, busqueda de precios: quantocustaviajar.com (comida diaria por persona, nivel bajo/economico/confort, en R$). Sirve de indice relativo frente a Rio y Salvador; subestima pueblos caros, por eso se promedia con el valor previo. Datos: R$64.5/86.5/112.4 por dia.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "derivacion": "Resort de playa con todo incluido en la zona, asi que se pone por encima de Recife. Pero no hay dato: el precio real depende de si el hotel es all-inclusive o no, y la app calcula el hotel aparte."
    },
  maragogi: {
      "fuente": "brviaje24 Maragogi (2026): PF R$25-40, self-service R$65-95 el kilo, porcion de camarao R$60-130, drinks R$28-45. Reporte de 2 dias: R$186 por persona incluyendo alojamiento, desayuno y las dos comidas.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "De los mas baratos: el reporte de 2 dias con alojamiento y comidas da R$186 por persona."
    },
  jericoacoara: {
      "fuente": "TikTok de precios en Jericoacoara (2026): baiao de dois R$98, crepe de carne seca R$48, picanha R$93, ceviche R$73, drink R$45. Instagram (2026): picanha R$93, ceviche R$73, R$9,90 picanha trinchada.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "La villa no admite autos y se camina. El traslado diario es bajo; los buggies a Pedra Furada o Lagoa Azul son una excursion aparte. Barato en la playa pero caro en restaurante."
    },
  buz: {
      "fuente": "Se buscaron cartas de restaurante y guias de Búzios. Hay datos de la region: PF R$30-40, por kilo R$40-70, churrascaria rodizio R$120-250, caipirinha R$20-40, que son rangos de pueblo de playa con vida nocturna. Búzios es el balneario mas caro de Rio de Janeiro y por eso esta por encima de la media del Nordeste. Sin carta propia de la ciudad: el valor coincide con Fortaleza y Jericoacoara. || 2026-09-30, busqueda de precios: quantocustaviajar.com (comida diaria por persona, nivel bajo/economico/confort, en R$). Sirve de indice relativo frente a Rio y Salvador; subestima pueblos caros, por eso se promedia con el valor previo. Datos: R$102.04/131/181 por dia. Menus ejecutivos R$49,90, PF R$25-35, casas de R$60 por persona.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "nota": "Las playas estan dispersas y el taxi es de los mas caros de la costa (sin app fuerte): el traslado diario sube respecto del promedio. Balneario mas caro de Rio de Janeiro, por eso tambien sube la comida.",
      "derivacion": "Sin dato especifico de Búzios. Copia práctica de for/jericoacoara. Búzios es pueblo de playa con vida nocturna, asi que la escala es plausible, pero deberia ser un poco mas caro que el promedioNordeste: es el balneario mas caro de Rio de Janeiro."
    },
  arraial: {
      "fuente": "Se buscaron cartas de restaurante de la region de Lagos, guias de viaje y comparadores de costo de vida. Lo unico que aparece es el distrito turistico Arraial do Cabo como conjunto, que es mas caro que Cabo Frio porque tiene las mejores playas. No hay precio publicado para el pueblo, asi que el valor es una copia de Cabo Frio. || 2026-09-30, busqueda de precios: quantocustaviajar.com (comida diaria por persona, nivel bajo/economico/confort, en R$). Sirve de indice relativo frente a Rio y Salvador; subestima pueblos caros, por eso se promedia con el valor previo. Datos: R$67.6/93.2/149.6 por dia.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "derivacion": "Copia de cabo. Ambos son balnearios de la.region de Lagos (RJ) con economia turistica. Sin dato propio."
    },
  cabo: {
      "fuente": "Numbeo Cabo Frio: comida barata R$30, cena media para 2 R$200. Wise: comida en restaurante economico R$35. Reparto Brasil: comida en restau USD 6,68.",
      "confianza": "media",
      "verificado": "2026-09-27"
    },
  angra: {
      "fuente": "Numbeo Angra dos Reis: comida barata R$37,50, cena media para 2 R$170, McMenu R$27,50, cerveza de tirada R$12,40, capuchino R$8, pasaje de transporte R$6. || 2026-09-30, busqueda de precios: quantocustaviajar Angra (sep/2025): R$69/102/163 por dia, promediado con la estimacion de Numbeo ya citada.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "nota": "OJO con este dato: Numbeo marca 28 entradas pero SOLO 6 colaboradores unicos y la ultima actualizacion es de abril de 2025. Es crowdsourced finito: sirve como orden de magnitud, no como precio. Por eso la confianza es baja pese a que haya fuente directa."
    },
  paraty: {
      "fuente": "Wise Paraty (2026): comida en restaurante economico R$35. hosteldavila Paraty: por quilo o PF R$40-55 por persona, bien servido, fuera del quadrilatero historico.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "El dato dice que Paraty es barato: R$35-55 por comida. Con el rango actual (R$125 por dia completo en casual) queda alto para un PF a R$40-55. Bajar casual a 21 seria mas fiel a la fuente, pero no se cambio sin revisar el resto de la escala."
    },
  ilha: {
      "fuente": "Instagram/reels de Isla Grande (2026): comidas desde R$40 por persona, completas en restaurante beira-mar R$150, platos desde R$35,90.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "La isla se llega solo por ferry y todo se sube, asi que el traslado diario es el mas bajo del catalogo: la gente se queda caminando en la Vila do Abraao."
    },
  ubatuba: {
      "fuente": "TikTok/reels Ubatuba (jul/2026): self-service R$17,90-23,90 (Nino's, Rua Conceicao, 61), PF R$25-33, por quilo R$55-69, marmitex R$28.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Los precios de comida rapida son de los mas baratos del litoral de Sao Paulo, lo que sugiere que casual 25 (R$130/dia) esta alto. Con PF a R$25-33 y self-service a R$23,90, un dia completo da R$60-90, o sea USD 12-17."
    },
  ilhabela: {
      "fuente": "Se buscaron precios de restaurante. Lo que hay es una lista de comida economica en Ilhabela (Wanderlog) que recomienda un self-service frente al foro, y el relato de un turista que vivio un mes sin gastar mucho usando transporte publico, pero ninguno con precios. La isla se llega solo por ferry, como Ilha Grande, asi que el costo viene de ahi con un recargo por turismo de verano. || 2026-09-30, busqueda de precios: quantocustaviajar.com (comida diaria por persona, nivel bajo/economico/confort, en R$). Sirve de indice relativo frente a Rio y Salvador; subestima pueblos caros, por eso se promedia con el valor previo. Datos: R$72.12/93.96/130.98 por dia.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "derivacion": "Ilhabela es la segunda isla de Sao Paulo, accesible solo por ferry (como Ilha Grande). Copia de ilha con un poco mas: la isla es mas grande y el turismo es mas caro, pero no hay dato de precios."
    },
  fln: {
      "fuente": "world-prices Florianopolis (2026): comida en restau barato R$35, cena media para 2 R$204, capuchino R$11,4, cerveza R$12. Pack Lightly: PF R$30-40, por kilo R$40-70.",
      "confianza": "media",
      "verificado": "2026-09-27"
    },
  bcm: {
      "fuente": "milione.net (2025): precios estimados para Florianopolis y Balneario Camboriu, PF R$30-40, combos desde R$50-80, media R$80-100.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "La fuente es de 2025 y agrupa Camboriu con Florianopolis. El lodging de Balneario (52/92/165) esta por encima del de Floripa (50/90/160) porque es el balneario premium de la costa norte; la comida tambien deberia ir un poco mas arriba."
    },
  bombinhas: {
      "fuente": "Se buscaron cartas de restaurante, precios de pousada y comparadores. Lo que hay publicado es de hospedaje en general: el balneario familiar de Santa Catarina, a 120 km de Floripa por la BR-101, con un pueblo chico y sin vida de resort. El lodging del catalogo ya lo pone por arriba de Floripa (52/96/170 contra 50/90/160), asi que la comida tambien. || 2026-09-30, busqueda de precios: quantocustaviajar.com (comida diaria por persona, nivel bajo/economico/confort, en R$). Sirve de indice relativo frente a Rio y Salvador; subestima pueblos caros, por eso se promedia con el valor previo. Datos: R$60/91.2/151.2 por dia.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "derivacion": "Copia de fln. Bombinhas esta en el mismo corredor de la BR-101 y a 120 km de Floripa, con un pueblo mas chico y precios algo mas bajos: el lodging va 52/96/170 contra 50/90/160, o sea que esta CARO y la comida tambien. Es el balneario familiar de la zona."
    },
  rosa: {
      "fuente": "Se buscaron precios de restaurante y de pousada. Praia do Rosa esta en el mismo corredor de la BR-101 a 80 km al norte de la capital de Santa Catarina, con un pueblo aun mas chico que Bombinhas. No hay dato propio: el valor es copia de Florianopolis.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "derivacion": "Copia de fln. Pueblo chico al norte del estado, a 80 km de la capital de Santa Catarina."
    },
  itapema: {
      "fuente": "RestaurantGuru Sabor de Casa Itapema (2026): buffet y marmitas R$20-40. Carta de Boka's Itapema (Meia Praia): rodizio R$119,90 por persona, camarao a la milanesa 1/4 R$240, filet mignon a la parmegiana 1/4 R$265, arranho de pescado con camarao R$160, salmon R$225.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Es el unico de la costa de Santa Catarina que queda por ARRIBA de su comparable: Camboriu era el balneario premium de la costa norte y Itapema lo es hoy. Se sube por el tramo alto de la carta (pescados), no por el buffet barato."
    },
  garopaba: {
      "fuente": "RestaurantGuru Garopaba (2026): Restaurante Bertussi buffet R$40-60 y R$60-80, Sambura R$40-60, Budega pizzeria R$20-40.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Se baja respecto de Camboriu porque no hay vida de resort, aunque el pueblo de playa con mas movimiento de la zona."
    },
  ferrugem: {
      "fuente": "RestaurantGuru (2026): Sambura (Praia da Ferrugem) comida casera, dos adultos y un nino R$120 en total; Tucano Ferrugem R$52-130 por persona; Budega R$20-40.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Mas cara que Garopaba: es el balneario de moda de la zona. El dato de R$120 para una familia de 3 con la cena da unos R$40 por adulto."
    },
  picarras: {
      "fuente": "RestaurantGuro Piñarras (2026): Fogao de Lenha R$20-40 y R$40-60 en buffet, Restaurante do Zezinho R$20-40 y R$80-100.",
      "confianza": "media",
      "verificado": "2026-09-27"
    },
  gram: {
      "fuente": "Se buscaron cartas de restaurante de Gramado y comparadores de costo de vida. El dato solido que hay es regional, no de la ciudad: el IPF de la ACSP (jun/2026) da R$34,90 para el plato feito del Sur, la region mas cara del pais, frente a R$31,90 del promedio nacional. Los agregadores la ponen entre las ciudades mas caras de la region, con la misma combinacion de almuerzo caro y cena de resort. No hay carta propia: el valor es copia de Canela. || 2026-09-30, busqueda de precios: quantocustaviajar.com (comida diaria por persona, nivel bajo/economico/confort, en R$). Sirve de indice relativo frente a Rio y Salvador; subestima pueblos caros, por eso se promedia con el valor previo. Datos: R$109/138.5/171 por dia.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "derivacion": "Copia de canela. Ambas vuelan a POA y son destinos turisticos de la misma provincia, con la misma combinacion de PF caro y cena de resort. Gramado es mas caro como alojamiento (48/89/155 contra 50/90/160, parecido)."
    },
  canela: {
      "fuente": "Se buscaron cartas de restaurante de Canela. Comparte aeropuerto (POA) con Gramado y esta 15 km, asi que comparten el mismo mercado turistico y los mismos precios. Canela es mas chica y con mas hoteleria de temporada. No hay dato propio: el valor es copia de Gramado. || 2026-09-30, busqueda de precios: quantocustaviajar Canela da R$51/64/76 por dia, valor inverosimil porque excluye fondue (R$100-160) y cafe colonial (R$80-120). Se deriva de Gramado (15 km) con -5%.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "derivacion": "Copia de gram. Canela esta 15 km de Gramado y comparte el mercado turistico."
    },
  torres: {
      "fuente": "RestaurantGuru Torres (2026): Oasis do Alemao R$20-40, Becco dos Sabores R$40-60 al almuerzo y R$80-100 a la cena, Mariskao R$60-80, Beira Rio R$80-200. Carta de Recanto Gaucho Torres: rodizio R$119,95 de 2 a 6, R$149,95 sabado, R$159,95 domingo.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "El rodizio de fines de semana en el balneario llega a R$160, casi el doble que entre semana. Es la primera parada del litoral del Sur viniendo de Montevideo."
    },
  canoa: {
      "fuente": "digitei Capao da Canoa (2026): Xis do Alemao R$20-35, Galeteria Beira Mar R$40-60, pasteleria R$15-30, Casa do Marisco R$80-120, churrascaria R$70-100, La Famiglia R$60-90. riograndedosulturismo: rodizio R$60, plato del dia R$25, parmegiana R$45 para dos.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "100 km al sur de Torres, asi que baja un poco: mismo mercado, precios mas bajos."
    },
  fernando: {
      "fuente": "malaprontanoronha (2026): quentinhas R$25-35, restaurante do Valdenio R$30, tapioca da Babalu R$13-18, self-service R$27-35; carta de restaurante medio R$70-100; premium R$150-250; los mas caros (Mesa da Ana, Pousada Maravilha) R$250-400. Presupuesto diario: economico R$50-80, medio R$180-250. Infobrazil: +60%, el destino mas caro de Brasil.",
      "confianza": "alta",
      "verificado": "2026-09-27",
      "nota": "El mejor documentado de todo el catalogo, y con razon: todo llega por barco o avion desde Recife, 540 km. Mas la TPA y el ingreso al parque, que se cobran aparte."
    },
  pip: {
      "fuente": "Se buscaron cartas de restaurante de Pipa. Lo unico con precio es un menu de entrada, plato principal y postre a R$94,90 en La Tolentino. Pipa es pueblo de surf con vida nocturna, del mismo tipo que Jericoacoara. Sin dato de PF ni de street food: el valor es el de Natal con recargo por la vida nocturna, y el unico precio publicado confirma que la cena esta por encima de la media de Natal. || 2026-09-30, busqueda de precios: quantocustaviajar.com (comida diaria por persona, nivel bajo/economico/confort, en R$). Sirve de indice relativo frente a Rio y Salvador; subestima pueblos caros, por eso se promedia con el valor previo. Datos: R$51.6/86.4/134.4 por dia. El unico precio de carta (menu R$94,90) indica cena cara, por eso pesa el valor previo.",
      "confianza": "baja",
      "verificado": "2026-09-30",
      "nota": "Pueblo chico y caminable: el centro, la playa y los restaurantes se recorren a pie. Transporte diario bajo; solo se suman taxis/mototaxi a Chapadao, Madeiro o Sibauma.",
      "derivacion": "Pipa es un pueblo de surf con vida nocturna, del mismo tipo que Jericoacoara pero en Rio Grande do Norte. Copia de nat con recargo por la vida nocturna. Lo que si hay dato (un menu de R$94,90 en un restaurante de la zona) sugiere que la cena es mas cara que la media de Natal, que es lo que ya se refleja.",
      "fuenteMedio": "2026-09-30, ajuste de criterio. La media geometrica de 4 y 15 da 8, pero ese calculo supone que el nivel medio esta a mitad de camino entre el que no se mueve y el que se mueve mucho. Pipa no es simetrica: el pueblo es chico y caminable, asi que el nivel eco es real, pero el viajero medio igual toma mototaxi a Chapadao, Madeiro o Sibauma, que quedan fuera del pueblo. El medio queda por encima de la media geometrica y no por debajo. +-1 dia de diferencia, no cambia una decision de presupuesto, pero la formula tiene que saber que este numero se aparto a mano."
    },
  trancoso: {
      "fuente": "Instagram Trancoso: en las playas el consumo va de R$100 a R$150 por mesa, la cerveza Brahma desde R$12. viagenselugaress: restaurantes y beach clubs elevados, de R$120 a R$300 por persona. TikTok Porto Seguro: almuerzo a la voluntad desde R$19,90.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Pueblo de playa con vida nocturna y jetset, el mas caro de Bahia despues de Salvador. El contraste entre el almuerzo a R$19,90 y la cena en la playa a R$150 por mesa es el rango real."
    },
  ajuda: {
      "fuente": "No hay dato propio de Arraial d'Ajuda. Se deriva de Trancoso, que esta a 7 km por la misma costa y con la misma balsa: mismo tipo de pueblo, misma escala de beach clubs. Instagram y TikTok de la zona de Porto Seguro arman el mismo rango que el de Trancoso.",
      "confianza": "baja",
      "verificado": "2026-09-29",
      "derivacion": "Copia de trancoso con un escalon menos. Arraial d'Ajuda es el pueblo mas chico de los dos y sin la vida nocturna de Trancoso, asi que come un poco mejor, pero la diferencia es chica: son 7 km. Si Trancoso esta bien calibrado, Arraial tambien."
    },
  morro: {
      "fuente": "Se buscaron cartas de restaurante y guias de la Bahia. Morro de Sao Paulo es un pueblo de playa a una hora por tierra de Salvador, con muelle y vida nocturna, del mismo tipo que Trancoso. Lo unico publicado que se le acerca es un menu de almuerzo en la praia a R$55 por persona y una cena de happy hour a R$99 para dos, que es la misma escala de Trancoso. No hay dato propio: el valor es copia de Trancoso.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "derivacion": "Copia de trancoso. Mismo tipo: pueblo de playa de Bahia con vida nocturna y sofisticado, a una hora por tierra de Salvador. Si Trancoso esta bien calibrado, Morro tambien."
    },
  portoseguro: {
      "fuente": "TikTok/reels Porto Seguro (2026): almuerzo a la voluntad desde R$19,90 en varios restaurantes; consumacion en las cabanas de la playa de R$100 a R$150 por mesa. Instagram: las barracas de Playa do Espelho cobran minimo R$100 por persona.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Puerto Seguro es el distrito que contiene a Trancoso. Barata de dia (almuerzo a R$19,90) y cara de noche en la playa. Bajado respecto de Trancoso porque el pueblo en si es mas familiero y menos jetset."
    },
  itacare: {
      "fuente": "Instagram/TikTok Itacare (2026): se encuentra almuerzo por menos de R$30; en la playa R$80 por persona. Hay un Txai Resort (Relais Chateaux) en la playa.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Pueblo de surf, menos jet-set que Trancoso, asi que va un poco por debajo."
    },
  forte: {
      "fuente": "Instagram Praia do Forte (2026): la moqueca de la zona con muy buenos precios; hay un Iberostar Selection de 5 estrellas all-inclusive.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "derivacion": "Resort turistico a 100 km de la capital de Bahia. Comida mas cara que un pueblo de playa pero traslado mas barato, porque esta todo concentrado. Copia de portoseguro con un poco mas."
    }
});
