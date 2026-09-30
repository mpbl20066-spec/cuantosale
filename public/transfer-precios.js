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
  buz: { name: "Búzios", iata: "GIG", modo: "car", km: 174, compartido: 0, privado: 86.54, privado_brl: 450, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Auto","brl":541}] },
  arraial: { name: "Arraial do Cabo", iata: "GIG", modo: "car", km: 170, compartido: 0, privado: 86.54, privado_brl: 450, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Auto","brl":541}] },
  cabo: { name: "Cabo Frio", iata: "GIG", modo: "car", km: 160, compartido: 0, privado: 86.54, privado_brl: 450, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Auto","brl":541}] },
  ilha: { name: "Ilha Grande", iata: "GIG", modo: "ferry", compartido: 0, privado: 86.54, privado_brl: 450, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":426},{"min":5,"max":6,"vehiculo":"Van","brl":541}] },
  paraty: { name: "Paraty", iata: "GIG", modo: "car", km: 248, compartido: 0, privado: 115.38, privado_brl: 600, compartidoConsultar: true, escalones: [] },
  ilhabela: { name: "Ilhabela", iata: "GRU", modo: "car", km: 185, compartido: 0, privado: 127, compartidoConsultar: true, escalones: [] },
  ubatuba: { name: "Ubatuba", iata: "GRU", modo: "car", km: 206, compartido: 0, privado: 153.85, privado_brl: 800, compartidoConsultar: true, escalones: [] },
  rio: { name: "Río de Janeiro", iata: "GIG", modo: "car", km: 18, compartido: 0, privado: 45, compartidoConsultar: true, escalones: [] },
  angra: { name: "Angra dos Reis", iata: "GIG", modo: "car", km: 139, compartido: 0, privado: 105.77, privado_brl: 550, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":483},{"min":5,"max":5,"vehiculo":"Auto","brl":598},{"min":6,"max":6,"vehiculo":"Auto","brl":656}] },
  sao: { name: "São Paulo", iata: "GRU", modo: "car", km: 26, compartido: 0, privado: 41, compartidoConsultar: true, escalones: [] },
  porto: { name: "Porto de Galinhas", iata: "REC", modo: "car", km: 53, compartido: 30, privado: 45, compartido_brl: 156, escalones: [] },
  mcz: { name: "Maceió", iata: "MCZ", modo: "car", km: 21, compartido: 28.27, privado: 51.92, compartido_brl: 147, privado_brl: 270, escalones: [] },
  maragogi: { name: "Maragogi", iata: "MCZ", modo: "car", km: 129, compartido: 64.23, privado: 92, compartido_brl: 334, escalones: [] },
  nat: { name: "Natal", iata: "NAT", modo: "car", km: 25, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  pip: { name: "Pipa", iata: "NAT", modo: "car", km: 30, compartido: 0, privado: 31, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":288}] },
  ajuda: { name: "Arraial d’Ajuda", iata: "SSA", modo: "car", km: 170, compartido: 0, privado: 118, compartidoConsultar: true, escalones: [] },
  trancoso: { name: "Trancoso", iata: "SSA", modo: "car", km: 163, compartido: 0, privado: 113, compartidoConsultar: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":437}] },
  ssa: { name: "Salvador de Bahía", iata: "SSA", modo: "car", km: 24, compartido: 0, privado: 30, appRideUsd: 11, compartidoConsultar: true, escalones: [] },
  for: { name: "Fortaleza", iata: "FOR", modo: "car", km: 9, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  jericoacoara: { name: "Jericoacoara", iata: "FOR", modo: "car", km: 295, compartido: 55.38, privado: 195, compartido_brl: 288, escalones: [{"min":1,"max":6,"vehiculo":"4 x 4","brl":1955}] },
  morro: { name: "Morro de São Paulo", iata: "SSA", modo: "car", km: 242, compartido: 0, privado: 162, compartidoConsultar: true, escalones: [] },
  portoseguro: { name: "Porto Seguro", iata: "SSA", modo: "car", km: 699, compartido: 0, privado: 445, compartidoConsultar: true, escalones: [] },
  itacare: { name: "Itacaré", iata: "SSA", modo: "car", km: 359, compartido: 0, privado: 235, compartidoConsultar: true, escalones: [] },
  forte: { name: "Praia do Forte", iata: "SSA", modo: "car", km: 62, compartido: 30.77, privado: 50, compartido_brl: 160, escalones: [] },
  fernando: { name: "Fernando de Noronha", iata: "FEN", modo: "vuelo", compartido: 0, privado: 95, soloPrivado: true, escalones: [{"min":1,"max":4,"vehiculo":"Auto","brl":538},{"min":5,"max":6,"vehiculo":"Auto","brl":966},{"min":6,"max":12,"vehiculo":"Van","brl":1739}] },
  fln: { name: "Florianópolis", iata: "FLN", modo: "car", km: 17, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  bombinhas: { name: "Bombinhas", iata: "FLN", modo: "car", km: 89, compartido: 0, privado: 67, compartidoConsultar: true, escalones: [] },
  rosa: { name: "Praia do Rosa", iata: "FLN", modo: "car", km: 96, compartido: 0, privado: 72, compartidoConsultar: true, escalones: [] },
  bcm: { name: "Balneário Camboriú", iata: "FLN", modo: "car", km: 96, compartido: 0, privado: 72, appRideUsd: 42, compartidoConsultar: true, escalones: [] },
  itapema: { name: "Itapema", iata: "FLN", modo: "car", km: 88, compartido: 0, privado: 67, compartidoConsultar: true, escalones: [] },
  garopaba: { name: "Garopaba", iata: "FLN", modo: "car", km: 89, compartido: 0, privado: 67, compartidoConsultar: true, escalones: [] },
  ferrugem: { name: "Ferrugem", iata: "FLN", modo: "car", km: 100, compartido: 0, privado: 74, compartidoConsultar: true, escalones: [] },
  picarras: { name: "Piçarras", iata: "FLN", modo: "car", km: 129, compartido: 0, privado: 92, compartidoConsultar: true, escalones: [] },
  gram: { name: "Gramado", iata: "POA", modo: "car", km: 109, compartido: 0, privado: 80, appRideUsd: 43, compartidoConsultar: true, escalones: [] },
  canela: { name: "Canela", iata: "POA", modo: "car", km: 115, compartido: 0, privado: 83, compartidoConsultar: true, escalones: [] },
  torres: { name: "Torres", iata: "POA", modo: "car", km: 184, compartido: 0, privado: 126, compartidoConsultar: true, escalones: [] },
  canoa: { name: "Capão da Canoa", iata: "POA", modo: "car", km: 135, compartido: 0, privado: 96, compartidoConsultar: true, escalones: [] },
  rec: { name: "Recife", iata: "REC", modo: "car", km: 13, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
  joaopessoa: { name: "João Pessoa", iata: "JPA", modo: "car", km: 13, compartido: 0, privado: 30, compartidoConsultar: true, escalones: [] },
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
      "fuente": "Compartido, confianza alta: inbuzios.com.br publica \"Transfer Aeroporto Galeao GIG x Buzios a partir de R$ 150,00\", y RIOgaleao Digital (galeon.com.br, el operador del propio aeropuerto) confirma la misma tarifa. CheckMyBus lista el shuttle BUZIOS TRANSFER en US$ 30. Son 174 km por la RJ-124, el mismo tramo que devuelve OSRM. El destino queda en confianza media y no alta porque el PRIVADO es derivado del modelo: el precio que se encontro (US$ 227-300 por grupo de hasta 3, GetYourGuide) es un producto turistico que incluye excursion, no un traslado pelado.",
      "confianza": "media",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "derivacion": "El privado sale del modelo de distancia (compartido = 18 + 0.06*km; privado = 12 + 0.62*km). Con los 174 km de OSRM da US$ 30 y US$ 120.",
      "km": 174,
      "horas": 2.7
    },
  arraial: {
      "fuente": "Sin precio real para esta ruta. Los km (170) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "alta",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 170 km de OSRM: US$ 30 compartido y US$ 117 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 170,
      "horas": 2.6
    },
  cabo: {
      "fuente": "Sin precio real para esta ruta. Los km (160) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "alta",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 160 km de OSRM: US$ 30 compartido y US$ 111 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 160,
      "horas": 2.5
    },
  ilha: {
      "fuente": "GetYourGuide: \"GIG: Shared van transfer from Galeao Airport to Abraao Village, Ilha Grande\", 4 horas, desde US$ 48. Es van + barco, no solo van. No existe un transfer de carretera a Ilha Grande, y el modelo ya lo sabia (COMBO_FERRY_ONLY en lib/model.js); lo que faltaba era que la app ofreciera una van.",
      "confianza": "media",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "derivacion": "El PRIVADO sale del modelo de distancia, no de una tarifa. No se encontro un transfer privado a Ilha Grande con precio publicado; el unico dato real (US$ 48) es el compartido con barco.",
      "modo": "ferry"
    },
  paraty: {
      "fuente": "Sin precio real para esta ruta. Los km (248) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "alta",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 248 km de OSRM: US$ 35 compartido y US$ 166 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 248,
      "horas": 4
    },
  ilhabela: {
      "fuente": "Sin precio real para esta ruta. Los km (185) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 185 km de OSRM: US$ 30 compartido y US$ 127 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 185,
      "horas": 3.7
    },
  ubatuba: {
      "fuente": "Sin precio real para esta ruta. Los km (206) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "media",
      "verificado": "2026-09-29",
      "real": [
        "privado"
      ],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 206 km de OSRM: US$ 30 compartido y US$ 140 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 206,
      "horas": 3.4
    },
  rio: {
      "fuente": "GetYourGuide: \"Rio Galeao Airport (GIG): Shuttle Transfer to/from Hotels\" desde US$ 19 y \"Shared Transfer From Rio De Janeiro Airport to Hotels\" desde US$ 26 (se toma US$ 22 como punto medio). Privado: \"Private Transfer to/from GIG Airport\" desde US$ 18 (sedan) y \"Galeao x Copacabana/Ipanema\" desde US$ 139 por grupo de 4. suntransfers publica privado a Barra da Tijuca desde EUR 26,44. Se usa US$ 45 para el privado: un sedan con meet & greet, no la van premium.",
      "confianza": "media",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "km": 18,
      "horas": 0.3
    },
  angra: {
      "fuente": "Sin precio real para esta ruta. Los km (139) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "alta",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 139 km de OSRM: US$ 25 compartido y US$ 98 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 139,
      "horas": 2.4
    },
  sao: {
      "fuente": "portalgruairport.com.br (Portal GRU Airport) publica el \"Transfer Executivo CHM\" privativo Guarulhos -> Sao Paulo en \"Preco estimado R$ 215\", sedan hasta 4 pasajeros, 25 km. airporttransferportal dice que el privado GRU -> centro de Sao Paulo va \"from EUR 74 for 2 passengers\" y que el precio es el mismo con 30 o con 90 minutos de transito (BRL 180-280). Es el ancla privada mas limpia que hay: un operador que publica la tarifa. El compartido sale del modelo.",
      "confianza": "media",
      "verificado": "2026-09-27",
      "real": [
        "privado"
      ],
      "derivacion": "El compartido sale del modelo de distancia (compartido = 18 + 0.06*km; privado = 12 + 0.62*km). Con los 26 km de OSRM da US$ 20 y US$ 30.",
      "km": 26,
      "horas": 0.5
    },
  porto: {
      "fuente": "Sin precio real para esta ruta. Los km (53) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 53 km de OSRM: US$ 20 compartido y US$ 45 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 53,
      "horas": 0.8
    },
  mcz: {
      "fuente": "Sin precio real para esta ruta. Los km (21) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "alta",
      "verificado": "2026-09-29",
      "real": [
        "compartido",
        "privado"
      ],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 21 km de OSRM: US$ 20 compartido y US$ 30 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 21,
      "horas": 0.5
    },
  maragogi: {
      "fuente": "Sin precio real para esta ruta. Los km (129) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 129 km de OSRM: US$ 25 compartido y US$ 92 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 129,
      "horas": 2.1
    },
  nat: {
      "fuente": "Sin precio real para esta ruta. Los km (25) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 25 km de OSRM: US$ 20 compartido y US$ 30 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 25,
      "horas": 0.4
    },
  pip: {
      "fuente": "Sin precio real para esta ruta. Los km (30) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 30 km de OSRM: US$ 20 compartido y US$ 31 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 30,
      "horas": 0.5
    },
  ajuda: {
      "fuente": "Sin precio real para esta ruta. Los km salen de OSRM: 170 desde SSA, 7 mas que Trancoso porque Arraial esta 7 km mas adelante por la misma ruta. Los dos precios salen del modelo de distancia de _meta.modelo.",
      "confianza": "baja",
      "verificado": "2026-09-29",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 170 km de OSRM: US$ 30 compartido y US$ 118 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 170,
      "horas": 2.8
    },
  trancoso: {
      "fuente": "Sin precio real para esta ruta. Los km (163) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 163 km de OSRM: US$ 30 compartido y US$ 113 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 163,
      "horas": 2.7
    },
  ssa: {
      "fuente": "Uber publica SSA -> Salvador en R$ 54-55 (27 min, 20 km) con UberX, R$ 72 con Comfort y R$ 95 con Black. El UberX va a appRide. Para el compartido no hay fuente: los numeros de Uber que se encontraron son todos por vehiculo y meterlos como si fueran por persona subestimaba el precio a la mitad.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "El compartido y el privado sale del modelo de distancia (compartido = 18 + 0.06*km; privado = 12 + 0.62*km). Con los 24 km de OSRM da US$ 20 y US$ 30.",
      "km": 24,
      "horas": 0.5,
      "appRideUsd": 11
    },
  for: {
      "fuente": "Sin precio real para esta ruta. Los km (9) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 9 km de OSRM: US$ 20 compartido y US$ 30 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 9,
      "horas": 0.2
    },
  jericoacoara: {
      "fuente": "Sin precio real para esta ruta. Los km (295) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 295 km de OSRM: US$ 35 compartido y US$ 195 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 295,
      "horas": 5.6
    },
  morro: {
      "fuente": "Sin precio real para esta ruta. Los km (242) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 242 km de OSRM: US$ 35 compartido y US$ 162 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 242,
      "horas": 3.9
    },
  portoseguro: {
      "fuente": "Sin precio real para esta ruta. Los km (699) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 699 km de OSRM: US$ 60 compartido y US$ 445 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 699,
      "horas": 11.4
    },
  itacare: {
      "fuente": "Sin precio real para esta ruta. Los km (359) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 359 km de OSRM: US$ 40 compartido y US$ 235 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 359,
      "horas": 5.7
    },
  forte: {
      "fuente": "Sin precio real para esta ruta. Los km (62) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 62 km de OSRM: US$ 20 compartido y US$ 50 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 62,
      "horas": 1.1
    },
  fernando: {
      "fuente": "Sin fuente directa de precio. Lo habitual es salir en vuelo desde REC, no en van. El valor es una estimacion para una hora de vuelo en una isla donde todo es caro, no el dato de un operador.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "No hay carretera ni ferry comercial: se llega en vuelo desde REC. El precio sale de una estimacion propia, no de una tarifa publicada. Ver la nota sobre NVT/FEN en _meta.aeropuertoErrores: el codigo de esta isla es FEN, no NVT.",
      "modo": "vuelo",
      "soloPrivado": true
    },
  fln: {
      "fuente": "Sin precio real para esta ruta. Los km (17) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 17 km de OSRM: US$ 20 compartido y US$ 30 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 17,
      "horas": 0.4
    },
  bombinhas: {
      "fuente": "Sin precio real para esta ruta. Los km (89) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 89 km de OSRM: US$ 25 compartido y US$ 67 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 89,
      "horas": 1.5
    },
  rosa: {
      "fuente": "Sin precio real para esta ruta. Los km (96) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 96 km de OSRM: US$ 25 compartido y US$ 72 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 96,
      "horas": 1.6
    },
  bcm: {
      "fuente": "Uber publica FLN -> Balneario Camboriu con precio medio R$ 216, 100 km, 1,7 h. Son los mismos 96 km que da OSRM, asi que el valor sirve para bcm, camboriu e itapema. OJO: el precio de Uber es POR VEHICULO y es un pedido por app, no un transfer reservado, asi que va en appRide y no como ancla del privado. TourFacil tiene el \"Transfer Aeroporto Florianopolis para Balneario Camboriu\", que solo sale con dos reservas minimas, o sea compartido, pero no publica tarifa.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "El compartido y el privado sale del modelo de distancia (compartido = 18 + 0.06*km; privado = 12 + 0.62*km). Con los 96 km de OSRM da US$ 25 y US$ 72.",
      "km": 96,
      "horas": 1.4,
      "appRideUsd": 42
    },
  itapema: {
      "fuente": "Sin precio real para esta ruta. Los km (88) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 88 km de OSRM: US$ 25 compartido y US$ 67 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 88,
      "horas": 1.4
    },
  garopaba: {
      "fuente": "Sin precio real para esta ruta. Los km (89) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 89 km de OSRM: US$ 25 compartido y US$ 67 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 89,
      "horas": 1.5
    },
  ferrugem: {
      "fuente": "Sin precio real para esta ruta. Los km (100) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 100 km de OSRM: US$ 25 compartido y US$ 74 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 100,
      "horas": 1.6
    },
  picarras: {
      "fuente": "Sin precio real para esta ruta. Los km (129) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 129 km de OSRM: US$ 25 compartido y US$ 92 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 129,
      "horas": 1.8
    },
  gram: {
      "fuente": "Uber publica POA -> Gramado con precio medio R$ 225, por vehiculo. Los 109 km de OSRM coinciden con el tramo, asi que el mismo valor sirve para gram y canela.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "El compartido y el privado sale del modelo de distancia (compartido = 18 + 0.06*km; privado = 12 + 0.62*km). Con los 109 km de OSRM da US$ 25 y US$ 80.",
      "km": 109,
      "horas": 1.9,
      "appRideUsd": 43
    },
  canela: {
      "fuente": "Sin precio real para esta ruta. Los km (115) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 115 km de OSRM: US$ 25 compartido y US$ 83 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 115,
      "horas": 2.1
    },
  torres: {
      "fuente": "Sin precio real para esta ruta. Los km (184) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 184 km de OSRM: US$ 30 compartido y US$ 126 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 184,
      "horas": 2.5
    },
  canoa: {
      "fuente": "Sin precio real para esta ruta. Los km (135) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 135 km de OSRM: US$ 25 compartido y US$ 96 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 135,
      "horas": 1.8
    },
  rec: {
      "fuente": "Sin precio real para esta ruta. Los km (13) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 13 km de OSRM: US$ 20 compartido y US$ 30 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 13,
      "horas": 0.3
    },
  joaopessoa: {
      "fuente": "Sin precio real para esta ruta. Los km (13) salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver \"derivacion\".",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "Sin ancla de precio. Sale del modelo de distancia con 13 km de OSRM: US$ 20 compartido y US$ 30 privado. Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.",
      "km": 13,
      "horas": 0.3
    },
  poa: {
      "fuente": "Uber publica POA <-> Porto Alegre en R$ 37 (18 min), por vehiculo.",
      "confianza": "baja",
      "verificado": "2026-09-27",
      "real": [],
      "derivacion": "El compartido y el privado sale del modelo de distancia (compartido = 18 + 0.06*km; privado = 12 + 0.62*km). Con los 9 km de OSRM da US$ 20 y US$ 30.",
      "km": 9,
      "horas": 0.2,
      "appRideUsd": 7
    }
});
