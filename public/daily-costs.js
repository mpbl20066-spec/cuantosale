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
  porto: { name: 'Porto de Galinhas', transport: { eco: 3, medio: 6, confort: 14 }, food: { casual: 22, moderado: 41, gourmet: 61 } },
  maragogi: { name: 'Maragogi', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 24, moderado: 45, gourmet: 75 } },
  jericoacoara: { name: 'Jericoacoara', transport: { eco: 4, medio: 8, confort: 18 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  buz: { name: 'Búzios', transport: { eco: 4, medio: 8, confort: 15 }, food: { casual: 35, moderado: 62, gourmet: 99 } },
  arraial: { name: 'Arraial do Cabo', transport: { eco: 2, medio: 5, confort: 11 }, food: { casual: 23, moderado: 44, gourmet: 82 } },
  cabo: { name: 'Cabo Frio', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  angra: { name: 'Angra dos Reis', transport: { eco: 4, medio: 7, confort: 13 }, food: { casual: 23, moderado: 48, gourmet: 89 } },
  paraty: { name: 'Paraty', transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 21, moderado: 42, gourmet: 74 } },
  ilha: { name: 'Ilha Grande', transport: { eco: 4, medio: 8, confort: 15 }, food: { casual: 28, moderado: 52, gourmet: 90 } },
  ubatuba: { name: 'Ubatuba', transport: { eco: 5, medio: 10, confort: 22 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  ilhabela: { name: 'Ilhabela', transport: { eco: 8, medio: 10, confort: 13 }, food: { casual: 24, moderado: 44, gourmet: 72 } },
  fln: { name: 'Florianópolis', transport: { eco: 6, medio: 13, confort: 27 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  bcm: { name: 'Balneário Camboriú', transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  bombinhas: { name: 'Bombinhas', transport: { eco: 7, medio: 11, confort: 18 }, food: { casual: 20, moderado: 43, gourmet: 83 } },
  rosa: { name: 'Praia do Rosa', transport: { eco: 4, medio: 7, confort: 13 }, food: { casual: 22, moderado: 48, gourmet: 75 } },
  itapema: { name: 'Itapema', transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 28, moderado: 54, gourmet: 92 } },
  garopaba: { name: 'Garopaba', transport: { eco: 3, medio: 7, confort: 17 }, food: { casual: 25, moderado: 50, gourmet: 86 } },
  ferrugem: { name: 'Ferrugem', transport: { eco: 3, medio: 7, confort: 15 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  picarras: { name: 'Piçarras', transport: { eco: 4, medio: 7, confort: 14 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  gram: { name: 'Gramado', transport: { eco: 5, medio: 8, confort: 13 }, food: { casual: 37, moderado: 65, gourmet: 93 } },
  canela: { name: 'Canela', transport: { eco: 5, medio: 8, confort: 14 }, food: { casual: 24, moderado: 42, gourmet: 54 } },
  torres: { name: 'Torres', transport: { eco: 3, medio: 6, confort: 12 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  canoa: { name: 'Capão da Canoa', transport: { eco: 3, medio: 6, confort: 12 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  fernando: { name: 'Fernando de Noronha', transport: { eco: 4, medio: 12, confort: 34 }, food: { casual: 50, moderado: 95, gourmet: 160 } },
  pip: { name: 'Pipa', transport: { eco: 3, medio: 6, confort: 12 }, food: { casual: 17, moderado: 41, gourmet: 73 } },
  trancoso: { name: 'Trancoso', transport: { eco: 5, medio: 13, confort: 33 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  ajuda: { name: 'Arraial d’Ajuda', transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 19, moderado: 35, gourmet: 57 } },
  caraiva: { name: 'Caraíva', transport: { eco: 2, medio: 5, confort: 12 }, food: { casual: 32, moderado: 62, gourmet: 108 } },
  morro: { name: 'Morro de São Paulo', transport: { eco: 1, medio: 4, confort: 15 }, food: { casual: 19, moderado: 52, gourmet: 75 } },
  portoseguro: { name: 'Porto Seguro', transport: { eco: 4, medio: 8, confort: 17 }, food: { casual: 33, moderado: 60, gourmet: 105 } },
  itacare: { name: 'Itacaré', transport: { eco: 5, medio: 9, confort: 15 }, food: { casual: 32, moderado: 58, gourmet: 100 } },
  forte: { name: 'Praia do Forte', transport: { eco: 3, medio: 6, confort: 13 }, food: { casual: 19, moderado: 40, gourmet: 74 } },
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
      "fuente": "Grupo Dicas (2026, ticket medio por persona): Barcaxeira y Farofa Fina R$80-120, Munganga R$100-140, Peixe na Telha R$150-200, Beijupirá R$200-250. Quanto Custa Viajar (2025): restaurante medio R$100-180 por persona, desayuno en panaderia desde R$20. O Pescador ejecutivo ~R$40, self-service R$35. Uber Ipojuca (página oficial): Rua da Esperança R$18, Maracaípe R$20. El centro se recorre a pie. Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 15/20/24, almoço 23,50/32/38,40, jantar 26/34,50/50.",
      "confianza": "media",
      "verificado": "2026-10-12"
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
      "fuente": "Quanto Custa Viajar (2025): PF en Búzios Grill desde R$29; salgados y jugo en Trigo & Cia por menos de R$20; Místico ticket medio R$150, Zuza Bistrô R$120. Brasil Show Turismo (24/05/2026): barracas y por kilo R$40-60, restaurantes medios de la Rua das Pedras R$80-120 por persona, premium R$150-250. Uber (página oficial Búzios): UberX R$20-22 a Ferradura, João Fernandes y Porto da Barra. Vans Cooper Búzios/Coopergeribá R$5 (Viaje na Viagem). Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 18,04/26/38, almoço 36/49/65, jantar 48/56/78.",
      "confianza": "media",
      "verificado": "2026-10-12",
      "nota": "Las playas estan dispersas y el taxi es de los mas caros de la costa (sin app fuerte): el traslado diario sube respecto del promedio. Balneario mas caro de Rio de Janeiro, por eso tambien sube la comida."
    },
  arraial: {
      "fuente": "Self-service sin balanza R$34,99 en Praia Grande (2026) y Mandacarú R$30 (Tripadvisor). Tio Dorp platos R$40-80, filé de pescado R$75, pulpo R$135; Sol na Cozinha R$50-90 (Classe Turista / Esse Mundo é Nosso). Ómnibus municipal R$2,00 (Diário do Transporte, 25/02/2026). Uber (página oficial): Praia Grande R$16, Praia dos Anjos R$15. Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 10,60/16,60/24,80, almoço 26,40/34,60/54, jantar 30,60/42/70,80.",
      "confianza": "media",
      "verificado": "2026-10-12"
    },
  cabo: {
      "fuente": "Numbeo Cabo Frio: comida barata R$30, cena media para 2 R$200. Wise: comida en restaurante economico R$35. Reparto Brasil: comida en restau USD 6,68.",
      "confianza": "media",
      "verificado": "2026-09-27"
    },
  angra: {
      "fuente": "Quanto Custa Viajar (sep/2025): quentinha en el centro R$25-40, por kilo R$60-80/kg, petiscos de playa R$20-35, plato individual R$45-70, chope R$15-22, cena frente al mar R$250-400 por persona. Ómnibus municipal tarifa A R$5,80 (RJ Costa Verde, 07/03/2026). Uber (página oficial): Rodoviária R$20, Praia Grande R$25. Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 14,40/19,80/25, almoço 25,20/37,40/60,20, jantar 29,80/44,60/78,20.",
      "confianza": "media",
      "verificado": "2026-10-12"
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
      "fuente": "Real Seguro Viagem (31/08/2026): executivo en Vila y Perequê R$30-45, hamburguesas y petiscos R$25-40, mariscos para dos R$120-250. Carpe Mundi (oct/2024): Cheiro Verde PF R$31,50, Capitano R$76, Marakuthai R$76-88. Ómnibus Expresso Fênix: R$4,80 con tarjeta, R$10 en efectivo (Diário do Transporte, 23/01/2026); se toma el de efectivo. Balsa gratis a pie. Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 10,56/12,60/18,06, almoço 27,60/38,40/54, jantar 33,96/42,96/58,92.",
      "confianza": "media",
      "verificado": "2026-10-12"
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
      "fuente": "Quanto Custa Viajar: Coma Bem R$24, buffet libre Mandalas R$48, ejecutivo Mar de Fora R$85, Baiuca Gastrobar R$60-90 por plato, Berro d’Água R$90 por persona, Casa da Lagosta desde R$130, chope desde R$18. Uber (página oficial Bombinhas): UberX promedio R$23, a Sepultura R$18, Morro do Macaco R$24, Uber Moto R$18. Sin bus municipal con tarifa publicada. Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 9,60/14,40/24, almoço 21,60/36/54, jantar 28,80/40,80/73,20.",
      "confianza": "media",
      "verificado": "2026-10-12"
    },
  rosa: {
      "fuente": "Informe Floripa (16/08/2026): Festival Del Vino de Praia do Rosa, platos a R$89. Tripadvisor (Lua Marinha): unos R$350 para dos. Almuerzo PF y chope tomados de Bombinhas (R$36 y R$18), el destino con datos mas cercano. Uber (página Imbituba): UberX a Praia do Rosa R$22; las apps tienen esperas largas (TNH1). El pueblo se recorre a pie.",
      "confianza": "media",
      "verificado": "2026-10-12"
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
      "fuente": "Quanto Custa Viajar (26/12/2025): Dona Lourdes R$22-38, Torre Café R$28-50, ejecutivo Pastasciutta R$35-55, Galeto Itália y Nonno Mio R$40-70, secuencia de fondue R$120-180. Melhores Destinos (oct/2025): fondue Carlito’s R$79, St. Gallen R$99, Le Petit Clos R$165; café colonial R$100-120. Ómnibus Gramado-Canela línea 6152 R$6,40 (Viaje na Viagem, jun/2025). Uber (página oficial): Lago Negro R$13, Rua Coberta R$14, Snowland R$21. Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 15/18,50/21, almoço 32/46/60, jantar 62/74/90.",
      "confianza": "media",
      "verificado": "2026-10-12"
    },
  canela: {
      "fuente": "Quanto Custa Viajar: ejecutivo de almuerzo R$35-60, self-service o buffet R$50-80, cafés R$25-60, café colonial R$80-120, secuencia de fondue R$100-160. Grupo Dicas: buffet casero R$35-50, churrascarias R$80-150. Ómnibus Gramado-Canela R$6,40. Uber (página oficial Canela): Rodoviária R$13, Catedral de Pedra R$18, Alpen Park R$18, Rua Coberta R$26. La tabla por comida de Quanto Custa Viajar para Canela no se usa: la cena sale mas barata que el almuerzo en los tres niveles.",
      "confianza": "media",
      "verificado": "2026-10-12"
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
      "fuente": "Elas Viajando (abr/2025): self-service sin balanza R$15-35, ~R$30 en el centrinho. Quanto Custa Viajar (oct/2025): plato de pescado o camarón R$65-95, moqueca para dos R$160-220, tapioca R$20-35, long neck R$12-18. Viajar é um Prazer: Duna by Toca desde R$100, caipirinha R$23. Uber Tibau do Sul (página oficial): Praia do Amor R$14, Madeiro R$16. El pueblo se recorre a pie. Quanto Custa Viajar, tabla por comida (bajo costo/economico/confort, R$): café 9,60/16,80/22,80, almoço 18/27,60/45,60, jantar 24/42/66.",
      "confianza": "media",
      "verificado": "2026-10-12",
      "nota": "Pueblo chico y caminable: el centro, la playa y los restaurantes se recorren a pie. Transporte diario bajo; solo se suman taxis/mototaxi a Chapadao, Madeiro o Sibauma.",
      "fuenteMedio": "2026-09-30, ajuste de criterio. La media geometrica de 4 y 15 da 8, pero ese calculo supone que el nivel medio esta a mitad de camino entre el que no se mueve y el que se mueve mucho. Pipa no es simetrica: el pueblo es chico y caminable, asi que el nivel eco es real, pero el viajero medio igual toma mototaxi a Chapadao, Madeiro o Sibauma, que quedan fuera del pueblo. El medio queda por encima de la media geometrica y no por debajo. +-1 dia de diferencia, no cambia una decision de presupuesto, pero la formula tiene que saber que este numero se aparto a mano."
    },
  trancoso: {
      "fuente": "Instagram Trancoso: en las playas el consumo va de R$100 a R$150 por mesa, la cerveza Brahma desde R$12. viagenselugaress: restaurantes y beach clubs elevados, de R$120 a R$300 por persona. TikTok Porto Seguro: almuerzo a la voluntad desde R$19,90.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "nota": "Pueblo de playa con vida nocturna y jetset, el mas caro de Bahia despues de Salvador. El contraste entre el almuerzo a R$19,90 y la cena en la playa a R$150 por mesa es el rango real."
    },
  ajuda: {
      "fuente": "Viciada em Viajar (feb/2024): Rabanete por kilo R$90/kg, esfiha R$10, moqueca individual de camarón en La Plage R$68, taxi minimo R$30, van Pitinga-centro R$5. Pé na Estrada (ene/2024): ejecutivo Cantinho Mineiro desde R$18, pizza grande Paolo R$39. Viaje na Viagem: comida o cena R$45-90 con servicio, mariscos en Praia do Espelho R$85-140 por plato. Melhores Destinos: van R$5-7.",
      "confianza": "media",
      "verificado": "2026-10-12"
    },
  caraiva: {
      "fuente": "Sin fuente publica de precios para Caraiva. Referencias: Trancoso (comida) y Morro de São Paulo (traslado, otra vila sin autos). Canoa para cruzar el rio: R$5 a R$10 por tramo.",
      "confianza": "baja",
      "verificado": "2026-10-17",
      "nota": "Vila sin autos del otro lado del rio Caraiva: calles de arena, se camina a todos lados. No hay fuente publica con precios de este destino; tratarlo como estimacion hasta que se revisen cartas.",
      "derivacion": "Derivado de Trancoso (misma costa, mismo publico): la comida baja un escalon porque en la vila no hay beach clubs de lujo como en el Quadrado (38/70/120 -> 32/62/108). El traslado es el de Morro de São Paulo, la otra vila sin autos del catalogo, con el confort algo mas bajo: adentro de la vila se camina, y el gasto es la canoa para cruzar el rio (R$5 a R$10 por tramo) y alguna carroza o buggy a Espelho o Corumbau."
    },
  morro: {
      "fuente": "Morro de São Paulo Catamarã (oct/2024): PF Papoula R$29, PF Banana Blue R$35, Boteco do Conde desde R$25, menú del día ~R$60. Bossa Nova Bistrô (carta en su sitio): camarão ao limone R$82, frutos do mar R$92, moqueca de camarón R$219. Minha Louca Paixão moqueca para dos R$165,99. Catraca Livre: tapioca R$8-12. Pueblo sin autos: de la Primera a la Cuarta Praia a pie; taxi/tractor a la Quinta Praia desde R$80 por vehículo, barco a Gamboa R$4 (Melhores Destinos).",
      "confianza": "media",
      "verificado": "2026-10-12"
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
      "fuente": "Esse Mundo é Nosso: Judite 20 mini acarajés R$30, Tango Café tapioca desde R$17,90, Sabor da Vila moqueca de pescado R$135 y de camarón R$160, Souza Bar carne de sol R$55, Farol (Tamar) risotto R$85, Il Cantuccio pescados desde R$60, cerveza R$10-12. Quanto Custa Viajar: restaurante simple desde R$40, sofisticado R$120-200. Uber Mata de São João (página oficial): Praça ACM R$18, Praia do Lord R$20, Tamar R$32. El pueblo se recorre a pie.",
      "confianza": "media",
      "verificado": "2026-10-12"
    }
});
