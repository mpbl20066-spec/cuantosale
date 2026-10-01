'use strict';
/* GENERADO. No editar a mano: corré `npm run build:transfer`.
   Fuente: data/transfer-precios.json (que a su vez documenta, por destino, de
   dónde sale el número, cuándo se verificó y cuánta confianza tiene).

   compartido: USD por persona. privado: USD por vehículo de hasta 4 personas.
   Los dos son solo ida (aeropuerto -> hotel). */
(function (root, tabla, proc) {
  root.CS_TRANSFER_PRICES = tabla;
  // De dónde sale cada precio y si es una tarifa publicada o el modelo de
  // distancia. Pocas celdas tienen tarifa publicada; el resto se declara.
  root.CS_TRANSFER_PRICES_PROVENANCE = proc;
  // La prueba de test.js lo requirea para compararlo con el modelo, asi que
  // tiene que servir tanto en el navegador como en node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = tabla;
    // enumerable: false a propósito: los validadores comparan Object.keys(cliente)
    // contra las claves del JSON, y una clave enumerable extra las rompe.
    Object.defineProperty(module.exports, 'provenance', { value: proc, enumerable: false });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, {
  buz: { name: "Búzios", iata: "GIG", modo: "car", km: 174, compartido: 30.77, privado: 86.54, compartido_brl: 160, privado_brl: 450, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":450}] },
  arraial: { name: "Arraial do Cabo", iata: "GIG", modo: "car", km: 170, compartido: 44.23, privado: 86.54, compartido_brl: 230, privado_brl: 450, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":450}] },
  cabo: { name: "Cabo Frio", iata: "GIG", modo: "car", km: 160, compartido: 44.23, privado: 86.54, compartido_brl: 230, privado_brl: 450, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":450}] },
  ilha: { name: "Ilha Grande", iata: "GIG", modo: "ferry", compartido: 53.85, privado: 86.54, compartido_brl: 280, privado_brl: 450, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":450}] },
  paraty: { name: "Paraty", iata: "GIG", modo: "car", km: 248, compartido: 76.92, privado: 115.38, compartido_brl: 400, privado_brl: 600, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":600}] },
  ilhabela: { name: "Ilhabela", iata: "GRU", modo: "car", km: 185, compartido: 24.42, privado: 507.69, compartido_brl: 127, privado_brl: 2640, escalones: [] },
  ubatuba: { name: "Ubatuba", iata: "GRU", modo: "car", km: 206, compartido: 26.92, privado: 153.85, compartido_brl: 140, privado_brl: 800, escalones: [{"min":1,"max":5,"vehiculo":"Auto","brl":800}] },
  rio: { name: "Río de Janeiro", iata: "GIG", modo: "car", km: 18, compartido: 30, privado: 21.15, compartido_brl: 156, privado_brl: 110, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":110}] },
  angra: { name: "Angra dos Reis", iata: "GIG", modo: "car", km: 139, compartido: 57.69, privado: 105.77, compartido_brl: 300, privado_brl: 550, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":550}] },
  sao: { name: "São Paulo", iata: "GRU", modo: "car", km: 26, compartido: 7.88, privado: 41, compartido_brl: 41, escalones: [] },
  porto: { name: "Porto de Galinhas", iata: "REC", modo: "car", km: 53, compartido: 8.65, privado: 41.54, compartido_brl: 45, privado_brl: 216, escalones: [] },
  mcz: { name: "Maceió", iata: "MCZ", modo: "car", km: 21, compartido: 15.38, privado: 51.92, compartido_brl: 80, privado_brl: 270, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":270}] },
  maragogi: { name: "Maragogi", iata: "MCZ", modo: "car", km: 129, compartido: 17.69, privado: 78.46, compartido_brl: 92, privado_brl: 408, escalones: [] },
  nat: { name: "Natal", iata: "NAT", modo: "car", km: 25, compartido: 5.77, privado: 30, compartido_brl: 30, escalones: [] },
  pip: { name: "Pipa", iata: "NAT", modo: "car", km: 30, compartido: 5.96, privado: 57.69, compartido_brl: 31, privado_brl: 300, escalones: [] },
  ajuda: { name: "Arraial d’Ajuda", iata: "SSA", modo: "car", km: 170, compartido: 22.69, privado: 69.23, compartido_brl: 118, privado_brl: 360, escalones: [] },
  trancoso: { name: "Trancoso", iata: "SSA", modo: "car", km: 163, compartido: 21.73, privado: 87.69, compartido_brl: 113, privado_brl: 456, escalones: [] },
  ssa: { name: "Salvador de Bahía", iata: "SSA", modo: "car", km: 24, compartido: 5.77, privado: 34.62, compartido_brl: 30, privado_brl: 180, appRideUsd: 11, escalones: [] },
  for: { name: "Fortaleza", iata: "FOR", modo: "car", km: 9, compartido: 5.77, privado: 30, compartido_brl: 30, escalones: [] },
  jericoacoara: { name: "Jericoacoara", iata: "FOR", modo: "car", km: 295, compartido: 37.5, privado: 392.31, compartido_brl: 195, privado_brl: 2040, escalones: [] },
  morro: { name: "Morro de São Paulo", iata: "SSA", modo: "car", km: 242, compartido: 31.15, privado: 35.77, compartido_brl: 162, privado_brl: 186, escalones: [] },
  portoseguro: { name: "Porto Seguro", iata: "SSA", modo: "car", km: 699, compartido: 85.58, privado: 92.31, compartido_brl: 445, privado_brl: 480, escalones: [] },
  itacare: { name: "Itacaré", iata: "SSA", modo: "car", km: 359, compartido: 45.19, privado: 242.31, compartido_brl: 235, privado_brl: 1260, escalones: [] },
  forte: { name: "Praia do Forte", iata: "SSA", modo: "car", km: 62, compartido: 9.62, privado: 46.15, compartido_brl: 50, privado_brl: 240, escalones: [] },
  fernando: { name: "Fernando de Noronha", iata: "FEN", modo: "vuelo", compartido: 18.27, privado: 108.08, compartido_brl: 95, privado_brl: 562, escalones: [] },
  fln: { name: "Florianópolis", iata: "FLN", modo: "car", km: 17, compartido: 5.77, privado: 92.31, compartido_brl: 30, privado_brl: 480, escalones: [] },
  bombinhas: { name: "Bombinhas", iata: "FLN", modo: "car", km: 89, compartido: 12.88, privado: 131.54, compartido_brl: 67, privado_brl: 684, escalones: [] },
  rosa: { name: "Praia do Rosa", iata: "FLN", modo: "car", km: 96, compartido: 13.85, privado: 133.85, compartido_brl: 72, privado_brl: 696, escalones: [] },
  bcm: { name: "Balneário Camboriú", iata: "FLN", modo: "car", km: 96, compartido: 13.85, privado: 111.92, compartido_brl: 72, privado_brl: 582, appRideUsd: 42, escalones: [] },
  itapema: { name: "Itapema", iata: "FLN", modo: "car", km: 88, compartido: 12.88, privado: 67, compartido_brl: 67, escalones: [] },
  garopaba: { name: "Garopaba", iata: "FLN", modo: "car", km: 89, compartido: 12.88, privado: 133.85, compartido_brl: 67, privado_brl: 696, escalones: [] },
  ferrugem: { name: "Ferrugem", iata: "FLN", modo: "car", km: 100, compartido: 14.23, privado: 133.85, compartido_brl: 74, privado_brl: 696, escalones: [] },
  picarras: { name: "Piçarras", iata: "FLN", modo: "car", km: 129, compartido: 17.69, privado: 64.62, compartido_brl: 92, privado_brl: 336, escalones: [] },
  gram: { name: "Gramado", iata: "POA", modo: "car", km: 109, compartido: 15.38, privado: 253.85, compartido_brl: 80, privado_brl: 1320, escalones: [] },
  canela: { name: "Canela", iata: "POA", modo: "car", km: 115, compartido: 15.96, privado: 96.92, compartido_brl: 83, privado_brl: 504, escalones: [] },
  torres: { name: "Torres", iata: "POA", modo: "car", km: 184, compartido: 24.23, privado: 92.31, compartido_brl: 126, privado_brl: 480, escalones: [] },
  canoa: { name: "Capão da Canoa", iata: "POA", modo: "car", km: 135, compartido: 18.46, privado: 103.85, compartido_brl: 96, privado_brl: 540, escalones: [] },
  rec: { name: "Recife", iata: "REC", modo: "car", km: 13, compartido: 5.77, privado: 30, compartido_brl: 30, escalones: [] },
  joaopessoa: { name: "João Pessoa", iata: "JPA", modo: "car", km: 13, compartido: 5.77, privado: 25.38, compartido_brl: 30, privado_brl: 132, escalones: [] },
  poa: { name: "Porto Alegre", iata: "POA", modo: "car", km: 9, compartido: 5.77, privado: 30, compartido_brl: 30, appRideUsd: 7, escalones: [] }
}, {
  _meta: {
      "unidad": {
        "compartido": "USD por PERSONA, solo ida (airport -> hotel).",
        "privado": "USD por VEHICULO de hasta 4 personas, solo ida. No se multiplica por los pasajeros."
      },
      "por_que_no_ida_y_vuelta": "CAMBIADO. Antes decia: 'El pasaje aereo se compra de ida y vuelta, pero el transfer se paga por trayecto. La app solo suma el de llegada.' Los precios de esta tabla SIGUEN siendo de un solo trayecto (ver 'unidad'), pero la app ahora los cobra para los dos tramos: llegada y vuelta, cada uno con su propia modalidad elegible. Es una decision de negocio, no un cambio de como se calculan los precios. Medido sobre los 44 destinos con van y 2 personas, cobrar los dos tramos sube el total del viaje entre 2,4% y 9,0% (medio 4,0%), y en ninguno supera el 10%. Para volver al comportamiento anterior: dejar los dos tramos sin elegir por defecto en public/app.js (showProposalView), y el total vuelve a la estimacion del modelo.",
      "appRide": "Campo opcional con el precio de un pedido de app (Uber/99) por VEHICULO para la misma ruta, cuando se pudo verificar. No es un transfer: no hay meet & greet ni el chofer esperando, y el precio sube con la demanda. Se deja aparte a proposito, porque meterlo como si fuera el precio del transfer privado habia subestimando el privado a menos de la mitad. Cuando este disponible suele ser la forma mas barata de llegar, asi que la app puede ofrecerlo como alternativa.",
      "modelo": {
        "compartido": "US$ 18 + US$ 0.06 por km (por persona)",
        "privado": "US$ 12 + US$ 0.62 por km (por vehiculo)",
        "para_que_sirve": "Solo para los destinos SIN precio real. Los que tienen ancla muestran el ancla, no el modelo.",
        "calibracion": "El compartido casi no crece con la distancia porque lo que se paga es el chofer y el vehiculo, repartidos entre los pasajeros: entre GIG->rio (18 km, US$ 22) y GIG->buz (174 km, US$ 29) hay 156 km de diferencia y solo 7 dolares de precio.",
        "privado_no_es_uber": "El privado es un transfer reservado (meet & greet, el chofer espera, peajes incluidos), no un pedido de app. Por eso sale mas caro que el appRide aunque el vehiculo sea el mismo. El modelo del privado se calibro con la tarifa publicada de un operador (GRU->sao, R$ 215) y con un promedio de Uber de ruta larga (POA->gram, R$ 225), y queda por debajo de los dos porque el transfert turistico de larga distancia que se encontro (GIG->buz, US$ 227-300) es un producto con excursion, no un traslado."
      }
    },
  buz: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Búzios. Privado por vehiculo: 1 a 4 personas, Auto, R$ 450. Compartido por persona: R$ 160 (Micro, 1 a 10 personas). Precio final de venta, en reales. Trayecto de 174 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 174,
      "horas": 2.7
    },
  arraial: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Arraial do Cabo. Privado por vehiculo: 1 a 4 personas, Auto, R$ 450. Compartido por persona: R$ 230 (Micro, 1 a 10 personas). Precio final de venta, en reales. Trayecto de 170 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 170,
      "horas": 2.6
    },
  cabo: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Cabo Frio. Privado por vehiculo: 1 a 4 personas, Auto, R$ 450. Compartido por persona: R$ 230 (Micro, 1 a 10 personas). Precio final de venta, en reales. Trayecto de 160 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 160,
      "horas": 2.5
    },
  ilha: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Ilha Grande. Privado por vehiculo: 1 a 4 personas, Auto, R$ 450. Compartido por persona: R$ 280 (Micro, 1 a 10 personas). Precio final de venta, en reales. No hay carretera: se llega en barco desde Rio o Angra. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "modo": "ferry"
    },
  paraty: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Paraty. Privado por vehiculo: 1 a 4 personas, Auto, R$ 600. Compartido por persona: R$ 400 (Micro, 1 a 10 personas). Precio final de venta, en reales. Trayecto de 248 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 248,
      "horas": 4
    },
  ilhabela: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GRU a Ilhabela. Compartido por persona: R$ 127 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 185 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 185,
      "horas": 3.7
    },
  ubatuba: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GRU a Ubatuba. Privado por vehiculo: 1 a 5 personas, Auto, R$ 800. Compartido por persona: R$ 140 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 206 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 206,
      "horas": 3.4
    },
  rio: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Río de Janeiro. Privado por vehiculo: 1 a 4 personas, Auto, R$ 110. Compartido por persona (base R$ 130 + 20%): R$ 156 (Auto). Precio final de venta, en reales. Trayecto de 18 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 18,
      "horas": 0.3
    },
  angra: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Angra dos Reis. Privado por vehiculo: 1 a 4 personas, Auto, R$ 550. Compartido por persona: R$ 300 (Micro, 1 a 10 personas). Precio final de venta, en reales. Trayecto de 139 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 139,
      "horas": 2.4
    },
  sao: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GRU a São Paulo. Compartido por persona: R$ 41 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 26 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 26,
      "horas": 0.5
    },
  porto: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila REC a Porto de Galinhas. Compartido por persona: R$ 45 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 53 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 53,
      "horas": 0.8
    },
  mcz: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila MCZ a Maceió. Privado por vehiculo: 1 a 4 personas, Auto, R$ 270. Compartido por persona: R$ 80 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 21 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 21,
      "horas": 0.5
    },
  maragogi: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila MCZ a Maragogi. Compartido por persona: R$ 92 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 129 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 129,
      "horas": 2.1
    },
  nat: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila NAT a Natal. Compartido por persona: R$ 30 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 25 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 25,
      "horas": 0.4
    },
  pip: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila NAT a Pipa. Compartido por persona: R$ 31 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 30 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 30,
      "horas": 0.5
    },
  ajuda: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Arraial d’Ajuda. Compartido por persona: R$ 118 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 170 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 170,
      "horas": 2.8
    },
  trancoso: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Trancoso. Compartido por persona: R$ 113 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 163 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 163,
      "horas": 2.7
    },
  ssa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Salvador de Bahía. Compartido por persona: R$ 30 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 24 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 24,
      "horas": 0.5,
      "appRideUsd": 11
    },
  for: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FOR a Fortaleza. Compartido por persona: R$ 30 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 9 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 9,
      "horas": 0.2
    },
  jericoacoara: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FOR a Jericoacoara. Compartido por persona: R$ 195 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 295 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 295,
      "horas": 5.6
    },
  morro: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Morro de São Paulo. Compartido por persona: R$ 162 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 242 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 242,
      "horas": 3.9
    },
  portoseguro: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Porto Seguro. Compartido por persona: R$ 445 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 699 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 699,
      "horas": 11.4
    },
  itacare: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Itacaré. Compartido por persona: R$ 235 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 359 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 359,
      "horas": 5.7
    },
  forte: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Praia do Forte. Compartido por persona: R$ 50 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 62 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 62,
      "horas": 1.1
    },
  fernando: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FEN a Fernando de Noronha. Compartido por persona: R$ 95 (Vuelo). Precio final de venta, en reales. No hay carretera: es una isla, se llega en vuelo corto desde REC. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "modo": "vuelo"
    },
  fln: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Florianópolis. Compartido por persona: R$ 30 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 17 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 17,
      "horas": 0.4
    },
  bombinhas: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Bombinhas. Compartido por persona: R$ 67 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 89 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 89,
      "horas": 1.5
    },
  rosa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Praia do Rosa. Compartido por persona: R$ 72 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 96 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 96,
      "horas": 1.6
    },
  bcm: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Balneário Camboriú. Compartido por persona: R$ 72 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 96 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 96,
      "horas": 1.4,
      "appRideUsd": 42
    },
  itapema: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Itapema. Compartido por persona: R$ 67 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 88 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 88,
      "horas": 1.4
    },
  garopaba: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Garopaba. Compartido por persona: R$ 67 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 89 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 89,
      "horas": 1.5
    },
  ferrugem: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Ferrugem. Compartido por persona: R$ 74 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 100 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 100,
      "horas": 1.6
    },
  picarras: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Piçarras. Compartido por persona: R$ 92 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 129 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 129,
      "horas": 1.8
    },
  gram: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Gramado. Compartido por persona: R$ 80 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 109 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 109,
      "horas": 1.9
    },
  canela: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Canela. Compartido por persona: R$ 83 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 115 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 115,
      "horas": 2.1
    },
  torres: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Torres. Compartido por persona: R$ 126 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 184 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 184,
      "horas": 2.5
    },
  canoa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Capão da Canoa. Compartido por persona: R$ 96 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 135 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 135,
      "horas": 1.8
    },
  rec: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila REC a Recife. Compartido por persona: R$ 30 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 13 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 13,
      "horas": 0.3
    },
  joaopessoa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila JPA a João Pessoa. Compartido por persona: R$ 30 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 13 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 13,
      "horas": 0.3
    },
  poa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Porto Alegre. Compartido por persona: R$ 30 (Auto, 1 a 4 personas). Precio final de venta, en reales. Trayecto de 9 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "compartido"
      ],
      "derivacion": "La modalidad privado no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 9,
      "horas": 0.2,
      "appRideUsd": 7
    }
});
