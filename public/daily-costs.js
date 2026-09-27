'use strict';
/* GENERADO. No editar a mano: corré `npm run build:costos`.
   Fuente: data/costos-diarios.json (que a su vez documenta, por destino, de
   dónde sale el número, cuándo se verificó y cuánta confianza tiene). */
(function (root, tabla) {
  root.CS_DESTINATION_DAILY_COSTS = tabla;
  // La prueba de test.js lo requirea para compararlo con el modelo, asi que
  // tiene que servir tanto en el navegador como en node.
  if (typeof module !== 'undefined' && module.exports) module.exports = tabla;
})(typeof globalThis !== 'undefined' ? globalThis : this, {
  poa: { name: 'Porto Alegre', transport: { eco: 13, confort: 30 }, food: { casual: 27, moderado: 50, gourmet: 90 } },
  rio: { name: 'Río de Janeiro', transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 95 } },
  sao: { name: 'São Paulo', transport: { eco: 22, confort: 48 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  curitiba: { name: 'Curitiba', transport: { eco: 22, confort: 48 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  bue: { name: 'Buenos Aires', transport: { eco: 18, confort: 38 }, food: { casual: 30, moderado: 58, gourmet: 100 } },
  bho: { name: 'Belo Horizonte', transport: { eco: 14, confort: 28 }, food: { casual: 22, moderado: 42, gourmet: 75 } },
  ssa: { name: 'Salvador de Bahía', transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  for: { name: 'Fortaleza / Jericoacoara', transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  nat: { name: 'Natal', transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 48, gourmet: 80 } },
  mcz: { name: 'Maceió', transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  rec: { name: 'Recife', transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 82 } },
  joaopessoa: { name: 'João Pessoa', transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 82 } },
  porto: { name: 'Porto de Galinhas', transport: { eco: 15, confort: 32 }, food: { casual: 28, moderado: 52, gourmet: 85 } },
  maragogi: { name: 'Maragogi', transport: { eco: 13, confort: 28 }, food: { casual: 24, moderado: 45, gourmet: 75 } },
  jericoacoara: { name: 'Jericoacoara', transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  buz: { name: 'Búzios', transport: { eco: 18, confort: 38 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  arraial: { name: 'Arraial do Cabo', transport: { eco: 14, confort: 28 }, food: { casual: 25, moderado: 45, gourmet: 75 } },
  cabo: { name: 'Cabo Frio', transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  angra: { name: 'Angra dos Reis', transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 105 } },
  paraty: { name: 'Paraty', transport: { eco: 12, confort: 26 }, food: { casual: 24, moderado: 44, gourmet: 75 } },
  ilha: { name: 'Ilha Grande', transport: { eco: 10, confort: 30 }, food: { casual: 28, moderado: 52, gourmet: 90 } },
  ubatuba: { name: 'Ubatuba', transport: { eco: 15, confort: 32 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  ilhabela: { name: 'Ilhabela', transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 58, gourmet: 95 } },
  fln: { name: 'Florianópolis', transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  bcm: { name: 'Balneário Camboriú', transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  camboriu: { name: 'Camboriú', transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  bombinhas: { name: 'Bombinhas', transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  rosa: { name: 'Praia do Rosa', transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  itapema: { name: 'Itapema', transport: { eco: 15, confort: 32 }, food: { casual: 28, moderado: 54, gourmet: 92 } },
  garopaba: { name: 'Garopaba', transport: { eco: 15, confort: 33 }, food: { casual: 25, moderado: 50, gourmet: 86 } },
  ferrugem: { name: 'Ferrugem', transport: { eco: 16, confort: 35 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  picarras: { name: 'Piçarras', transport: { eco: 16, confort: 35 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  gram: { name: 'Gramado', transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } },
  canela: { name: 'Canela', transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } },
  torres: { name: 'Torres', transport: { eco: 15, confort: 33 }, food: { casual: 26, moderado: 50, gourmet: 88 } },
  canoa: { name: 'Capão da Canoa', transport: { eco: 14, confort: 31 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  igu: { name: 'Foz de Iguazú', transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  fernando: { name: 'Fernando de Noronha', transport: { eco: 30, confort: 75 }, food: { casual: 50, moderado: 95, gourmet: 160 } },
  pip: { name: 'Pipa', transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 55, gourmet: 90 } },
  trancoso: { name: 'Trancoso / Arraial d’Ajuda', transport: { eco: 20, confort: 45 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  morro: { name: 'Morro de São Paulo', transport: { eco: 20, confort: 45 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  portoseguro: { name: 'Porto Seguro', transport: { eco: 18, confort: 40 }, food: { casual: 33, moderado: 60, gourmet: 105 } },
  itacare: { name: 'Itacaré', transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 58, gourmet: 100 } },
  forte: { name: 'Praia do Forte', transport: { eco: 18, confort: 40 }, food: { casual: 34, moderado: 62, gourmet: 105 } },
});
