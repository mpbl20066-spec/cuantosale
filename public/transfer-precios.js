'use strict';
/* GENERADO. No editar a mano: corré `npm run build:transfer`.
   Fuente: data/transfer-precios.json (que a su vez documenta, por destino, de
   dónde sale el número, cuándo se verificó y cuánta confianza tiene).

   compartido: USD por persona. privado: USD por vehículo de hasta 4 personas.
   Los dos son solo ida (aeropuerto -> hotel). */
(function (root, tabla) {
  root.CS_TRANSFER_PRICES = tabla;
  // La prueba de test.js lo requirea para compararlo con el modelo, asi que
  // tiene que servir tanto en el navegador como en node.
  if (typeof module !== 'undefined' && module.exports) module.exports = tabla;
})(typeof globalThis !== 'undefined' ? globalThis : this, {
  bue: { name: "Buenos Aires", iata: "EZE", modo: "car", km: 32, compartido: 20, privado: 32 },
  buz: { name: "Búzios", iata: "GIG", modo: "car", km: 174, compartido: 29, privado: 120 },
  arraial: { name: "Arraial do Cabo", iata: "GIG", modo: "car", km: 170, compartido: 30, privado: 117 },
  cabo: { name: "Cabo Frio", iata: "GIG", modo: "car", km: 160, compartido: 30, privado: 111 },
  ilha: { name: "Ilha Grande", iata: "GIG", modo: "ferry", compartido: 48, privado: 130 },
  paraty: { name: "Paraty", iata: "GIG", modo: "car", km: 248, compartido: 35, privado: 166 },
  ilhabela: { name: "Ilhabela", iata: "GRU", modo: "car", km: 185, compartido: 30, privado: 127 },
  ubatuba: { name: "Ubatuba", iata: "GRU", modo: "car", km: 206, compartido: 30, privado: 140 },
  rio: { name: "Río de Janeiro", iata: "GIG", modo: "car", km: 18, compartido: 22, privado: 45 },
  angra: { name: "Angra dos Reis", iata: "GIG", modo: "car", km: 139, compartido: 25, privado: 98 },
  sao: { name: "São Paulo", iata: "GRU", modo: "car", km: 26, compartido: 20, privado: 41 },
  bho: { name: "Belo Horizonte", iata: "CNF", modo: "car", km: 40, compartido: 20, privado: 37 },
  curitiba: { name: "Curitiba", iata: "CWB", modo: "car", km: 17, compartido: 20, privado: 30 },
  porto: { name: "Porto de Galinhas", iata: "REC", modo: "car", km: 53, compartido: 20, privado: 45 },
  mcz: { name: "Maceió", iata: "MCZ", modo: "car", km: 21, compartido: 20, privado: 30 },
  maragogi: { name: "Maragogi", iata: "MCZ", modo: "car", km: 129, compartido: 25, privado: 92 },
  nat: { name: "Natal", iata: "NAT", modo: "car", km: 25, compartido: 20, privado: 30 },
  pip: { name: "Pipa", iata: "NAT", modo: "car", km: 30, compartido: 20, privado: 31 },
  trancoso: { name: "Trancoso / Arraial d’Ajuda", iata: "SSA", modo: "car", km: 163, compartido: 30, privado: 113 },
  ssa: { name: "Salvador de Bahía", iata: "SSA", modo: "car", km: 24, compartido: 20, privado: 30, appRideUsd: 11 },
  for: { name: "Fortaleza / Jericoacoara", iata: "FOR", modo: "car", km: 9, compartido: 20, privado: 30 },
  jericoacoara: { name: "Jericoacoara", iata: "FOR", modo: "car", km: 295, compartido: 35, privado: 195 },
  morro: { name: "Morro de São Paulo", iata: "SSA", modo: "car", km: 242, compartido: 35, privado: 162 },
  portoseguro: { name: "Porto Seguro", iata: "SSA", modo: "car", km: 699, compartido: 60, privado: 445 },
  itacare: { name: "Itacaré", iata: "SSA", modo: "car", km: 359, compartido: 40, privado: 235 },
  forte: { name: "Praia do Forte", iata: "SSA", modo: "car", km: 62, compartido: 20, privado: 50 },
  fernando: { name: "Fernando de Noronha", iata: "FEN", modo: "vuelo", compartido: 0, privado: 95, soloPrivado: true },
  fln: { name: "Florianópolis", iata: "FLN", modo: "car", km: 17, compartido: 20, privado: 30 },
  camboriu: { name: "Camboriú", iata: "FLN", modo: "car", km: 96, compartido: 25, privado: 72 },
  bombinhas: { name: "Bombinhas", iata: "FLN", modo: "car", km: 89, compartido: 25, privado: 67 },
  rosa: { name: "Praia do Rosa", iata: "FLN", modo: "car", km: 96, compartido: 25, privado: 72 },
  bcm: { name: "Balneário Camboriú", iata: "FLN", modo: "car", km: 96, compartido: 25, privado: 72, appRideUsd: 42 },
  itapema: { name: "Itapema", iata: "FLN", modo: "car", km: 88, compartido: 25, privado: 67 },
  garopaba: { name: "Garopaba", iata: "FLN", modo: "car", km: 89, compartido: 25, privado: 67 },
  ferrugem: { name: "Ferrugem", iata: "FLN", modo: "car", km: 100, compartido: 25, privado: 74 },
  picarras: { name: "Piçarras", iata: "FLN", modo: "car", km: 129, compartido: 25, privado: 92 },
  gram: { name: "Gramado", iata: "POA", modo: "car", km: 109, compartido: 25, privado: 80, appRideUsd: 43 },
  canela: { name: "Canela", iata: "POA", modo: "car", km: 115, compartido: 25, privado: 83 },
  torres: { name: "Torres", iata: "POA", modo: "car", km: 184, compartido: 30, privado: 126 },
  canoa: { name: "Capão da Canoa", iata: "POA", modo: "car", km: 135, compartido: 25, privado: 96 },
  igu: { name: "Foz de Iguazú", iata: "IGU", modo: "car", km: 14, compartido: 20, privado: 30, appRideUsd: 8 },
  rec: { name: "Recife", iata: "REC", modo: "car", km: 13, compartido: 20, privado: 30 },
  joaopessoa: { name: "João Pessoa", iata: "JPA", modo: "car", km: 13, compartido: 20, privado: 30 },
  poa: { name: "Porto Alegre", iata: "POA", modo: "car", km: 9, compartido: 20, privado: 30, appRideUsd: 7 }
});
