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
  buz: { name: "Búzios", iata: "GIG", modo: "car", km: 174, compartido: 57.69, privado: 85.38, compartido_brl: 300, privado_brl: 444, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":444},{"min":5,"max":6,"vehiculo":"Auto","brl":564}] },
  arraial: { name: "Arraial do Cabo", iata: "GIG", modo: "car", km: 170, compartido: 60, privado: 85.38, compartido_brl: 312, privado_brl: 444, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":444},{"min":5,"max":6,"vehiculo":"Auto","brl":564}] },
  cabo: { name: "Cabo Frio", iata: "GIG", modo: "car", km: 160, compartido: 60, privado: 85.38, compartido_brl: 312, privado_brl: 444, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":444},{"min":5,"max":6,"vehiculo":"Auto","brl":564}] },
  ilha: { name: "Ilha Grande", iata: "GIG", modo: "ferry", compartido: 0, privado: 85.38, privado_brl: 444, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":444},{"min":5,"max":6,"vehiculo":"Van","brl":564}] },
  paraty: { name: "Paraty", iata: "GIG", modo: "car", km: 248, compartido: 73.85, privado: 265.38, compartido_brl: 384, privado_brl: 1380, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":1380}] },
  ilhabela: { name: "Ilhabela", iata: "GRU", modo: "car", km: 185, compartido: 0, privado: 507.69, privado_brl: 2640, compartidoConsultar: true, escalones: [{"min":1,"max":3,"vehiculo":"Auto","brl":2640}] },
  ubatuba: { name: "Ubatuba", iata: "GRU", modo: "car", km: 206, compartido: 0, privado: 184.62, privado_brl: 960, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":960}] },
  rio: { name: "Río de Janeiro", iata: "GIG", modo: "car", km: 18, compartido: 0, privado: 45, compartidoConsultar: true, escalones: [] },
  angra: { name: "Angra dos Reis", iata: "GIG", modo: "car", km: 139, compartido: 69.23, privado: 96.92, compartido_brl: 360, privado_brl: 504, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":504},{"min":5,"max":5,"vehiculo":"Auto","brl":624},{"min":6,"max":6,"vehiculo":"Auto","brl":684}] },
  sao: { name: "São Paulo", iata: "GRU", modo: "car", km: 26, compartido: 0, privado: 41, compartidoConsultar: true, escalones: [] },
  porto: { name: "Porto de Galinhas", iata: "REC", modo: "car", km: 53, compartido: 31.35, privado: 41.54, compartido_brl: 163, privado_brl: 216, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":216},{"min":5,"max":6,"vehiculo":"Van","brl":324}] },
  mcz: { name: "Maceió", iata: "MCZ", modo: "car", km: 21, compartido: 29.62, privado: 143.08, compartido_brl: 154, privado_brl: 744, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":744}] },
  maragogi: { name: "Maragogi", iata: "MCZ", modo: "car", km: 129, compartido: 66.92, privado: 78.46, compartido_brl: 348, privado_brl: 408, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":408}] },
  nat: { name: "Natal", iata: "NAT", modo: "car", km: 25, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  pip: { name: "Pipa", iata: "NAT", modo: "car", km: 30, compartido: 0, privado: 57.69, privado_brl: 300, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":300},{"min":5,"max":6,"vehiculo":"Van","brl":300}] },
  ajuda: { name: "Arraial d’Ajuda", iata: "SSA", modo: "car", km: 170, compartido: 0, privado: 69.23, privado_brl: 360, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":360}] },
  trancoso: { name: "Trancoso", iata: "SSA", modo: "car", km: 163, compartido: 0, privado: 87.69, privado_brl: 456, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":456}] },
  ssa: { name: "Salvador de Bahía", iata: "SSA", modo: "car", km: 24, compartido: 0, privado: 34.62, privado_brl: 180, appRideUsd: 11, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":180}] },
  for: { name: "Fortaleza", iata: "FOR", modo: "car", km: 9, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  jericoacoara: { name: "Jericoacoara", iata: "FOR", modo: "car", km: 295, compartido: 57.69, privado: 392.31, compartido_brl: 300, privado_brl: 2040, escalones: [{"min":1,"max":6,"vehiculo":"4 x 4","brl":2040}] },
  morro: { name: "Morro de São Paulo", iata: "SSA", modo: "car", km: 242, compartido: 0, privado: 35.77, privado_brl: 186, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":186}] },
  portoseguro: { name: "Porto Seguro", iata: "SSA", modo: "car", km: 699, compartido: 0, privado: 92.31, privado_brl: 480, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":480}] },
  itacare: { name: "Itacaré", iata: "SSA", modo: "car", km: 359, compartido: 0, privado: 242.31, privado_brl: 1260, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":1260}] },
  forte: { name: "Praia do Forte", iata: "SSA", modo: "car", km: 62, compartido: 32.12, privado: 46.15, compartido_brl: 167, privado_brl: 240, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":240}] },
  fernando: { name: "Fernando de Noronha", iata: "FEN", modo: "vuelo", compartido: 0, privado: 108.08, privado_brl: 562, soloPrivado: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":562},{"min":5,"max":6,"vehiculo":"Auto","brl":1008},{"min":6,"max":12,"vehiculo":"Van","brl":1814}] },
  fln: { name: "Florianópolis", iata: "FLN", modo: "car", km: 17, compartido: 57.69, privado: 92.31, compartido_brl: 300, privado_brl: 480, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":480}] },
  bombinhas: { name: "Bombinhas", iata: "FLN", modo: "car", km: 89, compartido: 34.42, privado: 131.54, compartido_brl: 179, privado_brl: 684, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":684}] },
  rosa: { name: "Praia do Rosa", iata: "FLN", modo: "car", km: 96, compartido: 48.46, privado: 133.85, compartido_brl: 252, privado_brl: 696, escalones: [{"min":1,"max":3,"vehiculo":"Auto","brl":696},{"min":4,"max":12,"vehiculo":"Van","brl":1380}] },
  bcm: { name: "Balneário Camboriú", iata: "FLN", modo: "car", km: 96, compartido: 38.85, privado: 111.92, compartido_brl: 202, privado_brl: 582, appRideUsd: 42, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":582}] },
  itapema: { name: "Itapema", iata: "FLN", modo: "car", km: 88, compartido: 0, privado: 67, compartidoConsultar: true, escalones: [] },
  garopaba: { name: "Garopaba", iata: "FLN", modo: "car", km: 89, compartido: 48.46, privado: 133.85, compartido_brl: 252, privado_brl: 696, escalones: [{"min":1,"max":3,"vehiculo":"Auto","brl":696},{"min":4,"max":12,"vehiculo":"Van","brl":1380}] },
  ferrugem: { name: "Ferrugem", iata: "FLN", modo: "car", km: 100, compartido: 48.46, privado: 133.85, compartido_brl: 252, privado_brl: 696, escalones: [{"min":1,"max":3,"vehiculo":"Auto","brl":696},{"min":4,"max":12,"vehiculo":"Van","brl":1380}] },
  picarras: { name: "Piçarras", iata: "FLN", modo: "car", km: 129, compartido: 0, privado: 64.62, privado_brl: 336, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":336}] },
  gram: { name: "Gramado", iata: "POA", modo: "car", km: 109, compartido: 20.77, privado: 253.85, compartido_brl: 108, privado_brl: 1320, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":1320}] },
  canela: { name: "Canela", iata: "POA", modo: "car", km: 115, compartido: 0, privado: 96.92, privado_brl: 504, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":504}] },
  torres: { name: "Torres", iata: "POA", modo: "car", km: 184, compartido: 0, privado: 92.31, privado_brl: 480, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":480}] },
  canoa: { name: "Capão da Canoa", iata: "POA", modo: "car", km: 135, compartido: 0, privado: 103.85, privado_brl: 540, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":540}] },
  rec: { name: "Recife", iata: "REC", modo: "car", km: 13, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  joaopessoa: { name: "João Pessoa", iata: "JPA", modo: "car", km: 13, compartido: 0, privado: 25.38, privado_brl: 132, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":132}] },
  poa: { name: "Porto Alegre", iata: "POA", modo: "car", km: 9, compartido: 0, privado: 30, appRideUsd: 7, compartidoConsultar: true, escalones: [] }
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
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Búzios. Privado por vehiculo (base R$ 370 + 20% y R$ 470 + 20%): 1 a 4 personas, Auto, R$ 444; 5 a 6 personas, Auto, R$ 564. Compartido por persona (base R$ 250 + 20%): R$ 300 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 174 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
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
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Arraial do Cabo. Privado por vehiculo (base R$ 370 + 20% y R$ 470 + 20%): 1 a 4 personas, Auto, R$ 444; 5 a 6 personas, Auto, R$ 564. Compartido por persona (base R$ 260 + 20%): R$ 312 (Van). Los precios ya incluyen la comision. Trayecto de 170 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
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
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Cabo Frio. Privado por vehiculo (base R$ 370 + 20% y R$ 470 + 20%): 1 a 4 personas, Auto, R$ 444; 5 a 6 personas, Auto, R$ 564. Compartido por persona (base R$ 260 + 20%): R$ 312 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 160 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
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
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Ilha Grande. Privado por vehiculo (base R$ 370 + 20% y R$ 470 + 20%): 1 a 4 personas, Auto, R$ 444; 5 a 6 personas, Van, R$ 564. Los precios ya incluyen la comision. No hay carretera: se llega en barco desde Rio o Angra. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "modo": "ferry"
    },
  paraty: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Paraty. Privado por vehiculo (base R$ 1150 + 20%): 1 a 4 personas, Auto, R$ 1380. Compartido por persona (base R$ 320 + 20%): R$ 384 (Van, 1 a 6 personas). Los precios ya incluyen la comision. Trayecto de 248 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
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
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GRU a Ilhabela. Privado por vehiculo (base R$ 2200 + 20%): 1 a 3 personas, Auto, R$ 2640. Los precios ya incluyen la comision. Trayecto de 185 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 185,
      "horas": 3.7
    },
  ubatuba: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GRU a Ubatuba. Privado por vehiculo (base R$ 800 + 20%): 1 a 4 personas, Auto, R$ 960. Los precios ya incluyen la comision. Trayecto de 206 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 206,
      "horas": 3.4
    },
  rio: {
      "fuente": "Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). Los 18 km de OSRM. El precio real de las dos modalidades se confirma con la agencia al reservar.",
      "confianza": "baja",
      "verificado": "2026-10-01",
      "real": [],
      "derivacion": "Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene precio cargado y la app muestra \"Consultar\" en las dos: no es que sean gratis, es que el precio se confirma al reservar. La distancia (18 km de OSRM) no alcanza para calcular un precio de mercado.",
      "km": 18,
      "horas": 0.3
    },
  angra: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila GIG a Angra dos Reis. Privado por vehiculo (base R$ 420 + 20% y R$ 520 + 20% y R$ 570 + 20%): 1 a 4 personas, Auto, R$ 504; 5 personas, Auto, R$ 624; 6 personas, Auto, R$ 684. Compartido por persona (base R$ 300 + 20%): R$ 360 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 139 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
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
      "fuente": "Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). Los 26 km de OSRM. El precio real de las dos modalidades se confirma con la agencia al reservar.",
      "confianza": "baja",
      "verificado": "2026-10-01",
      "real": [],
      "derivacion": "Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene precio cargado y la app muestra \"Consultar\" en las dos: no es que sean gratis, es que el precio se confirma al reservar. La distancia (26 km de OSRM) no alcanza para calcular un precio de mercado.",
      "km": 26,
      "horas": 0.5
    },
  porto: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila REC a Porto de Galinhas. Privado por vehiculo (base R$ 180 + 20% y R$ 270 + 20%): 1 a 4 personas, Auto, R$ 216; 5 a 6 personas, Van, R$ 324. Compartido por persona (base R$ 136 + 20%): R$ 163 (Van, 1 a 6 personas). Los precios ya incluyen la comision. Trayecto de 53 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 53,
      "horas": 0.8
    },
  mcz: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila MCZ a Maceió. Privado por vehiculo (base R$ 620 + 20%): 1 a 4 personas, Auto, R$ 744. Compartido por persona (base R$ 128 + 20%): R$ 154 (Van, 1 a 15 personas). Los precios ya incluyen la comision. Trayecto de 21 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
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
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila MCZ a Maragogi. Privado por vehiculo (base R$ 340 + 20%): 1 a 4 personas, Auto, R$ 408. Compartido por persona (base R$ 290 + 20%): R$ 348 (Van, 1 a 6 personas). Los precios ya incluyen la comision. Trayecto de 129 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 129,
      "horas": 2.1
    },
  nat: {
      "fuente": "Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). Los 25 km de OSRM. El precio real de las dos modalidades se confirma con la agencia al reservar.",
      "confianza": "baja",
      "verificado": "2026-10-01",
      "real": [],
      "derivacion": "Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene precio cargado y la app muestra \"Consultar\" en las dos: no es que sean gratis, es que el precio se confirma al reservar. La distancia (25 km de OSRM) no alcanza para calcular un precio de mercado.",
      "km": 25,
      "horas": 0.4
    },
  pip: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila NAT a Pipa. Privado por vehiculo (base R$ 250 + 20% y R$ 250 + 20%): 1 a 4 personas, Auto, R$ 300; 5 a 6 personas, Van, R$ 300. Los precios ya incluyen la comision. Trayecto de 30 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 30,
      "horas": 0.5
    },
  ajuda: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Arraial d’Ajuda. Privado por vehiculo (base R$ 300 + 20%): 1 a 4 personas, Auto, R$ 360. Los precios ya incluyen la comision. Trayecto de 170 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 170,
      "horas": 2.8
    },
  trancoso: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Trancoso. Privado por vehiculo (base R$ 380 + 20%): 1 a 4 personas, Auto, R$ 456. Los precios ya incluyen la comision. Trayecto de 163 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 163,
      "horas": 2.7
    },
  ssa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Salvador de Bahía. Privado por vehiculo (base R$ 150 + 20%): 1 a 4 personas, Auto, R$ 180. Los precios ya incluyen la comision. Trayecto de 24 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 24,
      "horas": 0.5,
      "appRideUsd": 11
    },
  for: {
      "fuente": "Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). Los 9 km de OSRM. El precio real de las dos modalidades se confirma con la agencia al reservar.",
      "confianza": "baja",
      "verificado": "2026-10-01",
      "real": [],
      "derivacion": "Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene precio cargado y la app muestra \"Consultar\" en las dos: no es que sean gratis, es que el precio se confirma al reservar. La distancia (9 km de OSRM) no alcanza para calcular un precio de mercado.",
      "km": 9,
      "horas": 0.2
    },
  jericoacoara: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FOR a Jericoacoara. Privado por vehiculo (base R$ 1700 + 20%): 1 a 6 personas, 4 x 4, R$ 2040. Compartido por persona (base R$ 250 + 20%): R$ 300 (4 x 4, 2 a 5 personas). Los precios ya incluyen la comision. Trayecto de 295 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 295,
      "horas": 5.6
    },
  morro: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Morro de São Paulo. Privado por vehiculo (base R$ 155 + 20%): 1 a 4 personas, Auto, R$ 186. Los precios ya incluyen la comision. Trayecto de 242 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 242,
      "horas": 3.9
    },
  portoseguro: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Porto Seguro. Privado por vehiculo (base R$ 400 + 20%): 1 a 4 personas, Auto, R$ 480. Los precios ya incluyen la comision. Trayecto de 699 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 699,
      "horas": 11.4
    },
  itacare: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Itacaré. Privado por vehiculo (base R$ 1050 + 20%): 1 a 4 personas, Auto, R$ 1260. Los precios ya incluyen la comision. Trayecto de 359 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 359,
      "horas": 5.7
    },
  forte: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila SSA a Praia do Forte. Privado por vehiculo (base R$ 200 + 20%): 1 a 4 personas, Auto, R$ 240. Compartido por persona (base R$ 139 + 20%): R$ 167 (Van, 1 a 6 personas). Los precios ya incluyen la comision. Trayecto de 62 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 62,
      "horas": 1.1
    },
  fernando: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FEN a Fernando de Noronha. Privado por vehiculo (base R$ 468 + 20% y R$ 840 + 20% y R$ 1512 + 20%): 1 a 4 personas, Auto, R$ 562; 5 a 6 personas, Auto, R$ 1008; 6 a 12 personas, Van, R$ 1814. Los precios ya incluyen la comision. No hay carretera: es una isla, se llega en vuelo corto desde REC. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "modo": "vuelo",
      "soloPrivado": true
    },
  fln: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Florianópolis. Privado por vehiculo (base R$ 400 + 20%): 1 a 4 personas, Auto, R$ 480. Compartido por persona (base R$ 250 + 20%): R$ 300 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 17 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 17,
      "horas": 0.4
    },
  bombinhas: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Bombinhas. Privado por vehiculo (base R$ 570 + 20%): 1 a 4 personas, Auto, R$ 684. Compartido por persona (base R$ 149 + 20%): R$ 179 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 89 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 89,
      "horas": 1.5
    },
  rosa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Praia do Rosa. Privado por vehiculo (base R$ 580 + 20% y R$ 1150 + 20%): 1 a 3 personas, Auto, R$ 696; 4 a 12 personas, Van, R$ 1380. Compartido por persona (base R$ 210 + 20%): R$ 252 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 96 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 96,
      "horas": 1.6
    },
  bcm: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Balneário Camboriú. Privado por vehiculo (base R$ 485 + 20%): 1 a 4 personas, Auto, R$ 582. Compartido por persona (base R$ 168 + 20%): R$ 202 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 96 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 96,
      "horas": 1.4,
      "appRideUsd": 42
    },
  itapema: {
      "fuente": "Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). Los 88 km de OSRM. El precio real de las dos modalidades se confirma con la agencia al reservar.",
      "confianza": "baja",
      "verificado": "2026-10-01",
      "real": [],
      "derivacion": "Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene precio cargado y la app muestra \"Consultar\" en las dos: no es que sean gratis, es que el precio se confirma al reservar. La distancia (88 km de OSRM) no alcanza para calcular un precio de mercado.",
      "km": 88,
      "horas": 1.4
    },
  garopaba: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Garopaba. Privado por vehiculo (base R$ 580 + 20% y R$ 1150 + 20%): 1 a 3 personas, Auto, R$ 696; 4 a 12 personas, Van, R$ 1380. Compartido por persona (base R$ 210 + 20%): R$ 252 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 89 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 89,
      "horas": 1.5
    },
  ferrugem: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Ferrugem. Privado por vehiculo (base R$ 580 + 20% y R$ 1150 + 20%): 1 a 3 personas, Auto, R$ 696; 4 a 12 personas, Van, R$ 1380. Compartido por persona (base R$ 210 + 20%): R$ 252 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 100 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 100,
      "horas": 1.6
    },
  picarras: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila FLN a Piçarras. Privado por vehiculo (base R$ 280 + 20%): 1 a 4 personas, Auto, R$ 336. Los precios ya incluyen la comision. Trayecto de 129 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 129,
      "horas": 1.8
    },
  gram: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Gramado. Privado por vehiculo (base R$ 1100 + 20%): 1 a 4 personas, Auto, R$ 1320. Compartido por persona (base R$ 90 + 20%): R$ 108 (Van, 1 a 12 personas). Los precios ya incluyen la comision. Trayecto de 109 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado",
        "compartido"
      ],
      "km": 109,
      "horas": 1.9
    },
  canela: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Canela. Privado por vehiculo (base R$ 420 + 20%): 1 a 4 personas, Auto, R$ 504. Los precios ya incluyen la comision. Trayecto de 115 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 115,
      "horas": 2.1
    },
  torres: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Torres. Privado por vehiculo (base R$ 400 + 20%): 1 a 4 personas, Auto, R$ 480. Los precios ya incluyen la comision. Trayecto de 184 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 184,
      "horas": 2.5
    },
  canoa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila POA a Capão da Canoa. Privado por vehiculo (base R$ 450 + 20%): 1 a 4 personas, Auto, R$ 540. Los precios ya incluyen la comision. Trayecto de 135 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 135,
      "horas": 1.8
    },
  rec: {
      "fuente": "Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). Los 13 km de OSRM. El precio real de las dos modalidades se confirma con la agencia al reservar.",
      "confianza": "baja",
      "verificado": "2026-10-01",
      "real": [],
      "derivacion": "Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene precio cargado y la app muestra \"Consultar\" en las dos: no es que sean gratis, es que el precio se confirma al reservar. La distancia (13 km de OSRM) no alcanza para calcular un precio de mercado.",
      "km": 13,
      "horas": 0.3
    },
  joaopessoa: {
      "fuente": "Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila JPA a João Pessoa. Privado por vehiculo (base R$ 110 + 20%): 1 a 4 personas, Auto, R$ 132. Los precios ya incluyen la comision. Trayecto de 13 km de OSRM. Un solo trayecto (aeropuerto a hotel), en reales.",
      "confianza": "alta",
      "verificado": "2026-10-01",
      "real": [
        "privado"
      ],
      "derivacion": "La modalidad compartido no tiene fila con precio en la planilla: la app muestra \"Consultar\". La otra sale de la fila citada, con su precio real.",
      "km": 13,
      "horas": 0.3
    },
  poa: {
      "fuente": "Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). Los 9 km de OSRM. El precio real de las dos modalidades se confirma con la agencia al reservar.",
      "confianza": "baja",
      "verificado": "2026-10-01",
      "real": [],
      "derivacion": "Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene precio cargado y la app muestra \"Consultar\" en las dos: no es que sean gratis, es que el precio se confirma al reservar. La distancia (9 km de OSRM) no alcanza para calcular un precio de mercado.",
      "km": 9,
      "horas": 0.2,
      "appRideUsd": 7
    }
});
