'use strict';
/* Servicios de bus Montevideo <-> Brasil, tal como los publican las empresas.
   Fuentes: EGA (pagina de Horarios y Tarifas, salidas de domingo) y TTL
   (cuadro de horarios "Actualizado: Hasta 1/3/26").

   Precios en pesos uruguayos ($U), SOLO IDA. TTL no publica tarifa en ese
   cuadro: queda en null y la app muestra "Consultar tarifa" en vez de inventar
   un numero. `vigencia` es hasta cuando la empresa dice que el horario vale. */
window.CS_BUS_SERVICES = [
  {
    empresa: 'EGA', fuente: 'Horarios y Tarifas de EGA (salidas de domingo)', vigencia: null,
    rutas: [
      { dest: 'poa', origen: 'Montevideo', destino: 'Porto Alegre', dias: 'Dom', salida: '14:30', llegada: '01:30', idaUyu: 4125, idaDiamanteUyu: 5530 },
      { dest: 'fln', origen: 'Montevideo', destino: 'Florianópolis', dias: 'Dom', salida: '14:30', llegada: '08:30', idaUyu: 5845, idaDiamanteUyu: 7195 }
    ]
  },
  {
    empresa: 'TTL', fuente: 'Cuadro de horarios de TTL', vigencia: '2026-03-01',
    rutas: [
      { dest: 'poa', origen: 'Montevideo', destino: 'Porto Alegre', dias: 'Todos los días', salida: '21:00', llegada: '09:30', idaUyu: null },
      { dest: 'poa', origen: 'Porto Alegre', destino: 'Montevideo', dias: 'Todos los días', salida: '20:00', llegada: '09:00', idaUyu: null },
      { dest: 'fln', origen: 'Montevideo', destino: 'Florianópolis', dias: 'Ma, Vi, Do', salida: '16:30', llegada: '13:00', idaUyu: null },
      { dest: 'fln', origen: 'Florianópolis', destino: 'Montevideo', dias: 'Lu, Ju, Sa', salida: '15:00', llegada: '10:00', idaUyu: null }
    ]
  }
];
