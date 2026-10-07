'use strict';
/* Guia editorial completa de un destino, para la pagina publica
   /destino/<slug> (ver lib/destinos-web.js). Es contenido que va ADEMAS de lo
   que ya sale de lib/guias.js (playas, que ver, que hacer, comer, tips).

   Hoy solo Rio, tomado de "guia rio.pdf". Del PDF no se copiaron las notas
   internas de edicion ("los precios deben estar conectados con los datos de
   Cuanto Sale", "para cada playa incluir ubicacion...") ni ningun precio: los
   precios se calculan en la app, y la pagina manda ahi.

   Forma de una seccion:
     { id, icono, titulo, intro?, items?: [{ t, d }], bullets?: [texto],
       grupos?: [{ titulo, bullets }], cierre?: { t, d } }

   Las fotos de los imperdibles salen de data/tour-photos.json (las mismas
   fotos de Wikimedia con autor y licencia que usan los tours): se pide por la
   clave 'rio#<titulo del tour>'. Un imperdible sin foto se muestra sin imagen. */

const fotosTours = require('../data/tour-photos.json');
const guias = require('./guias');

function foto(clave) {
  const f = fotosTours[clave];
  return f && f.url ? String(f.url).split('?')[0] : '';
}

/* Foto de una playa de la guia de ciudad: el Arpoador no tiene foto propia y la
   de la Praia do Diabo es justo la del Arpoador. */
function fotoDeLaGuia(destino, playa) {
  const g = guias.guias[destino];
  const b = g && (g.beaches || []).find(function (x) { return x.name === playa; });
  return b && b.foto ? b.foto : '';
}

const RIO = {
  antes: {
    titulo: 'Antes de viajar a Río',
    intro: 'Río de Janeiro es mucho más que Copacabana y el Cristo Redentor. Esta guía reúne playas, cultura, naturaleza, gastronomía, transporte y presupuesto para ayudarte a organizar el viaje.',
    items: [
      { t: 'Documentación', d: 'Los uruguayos pueden ingresar a Brasil con pasaporte o cédula de identidad original, de acuerdo con la información del Consulado de Brasil en Montevideo.' },
      { t: '¿Cuántos días?', d: 'Para una primera visita, 5 días completos es un buen punto de partida. Con 3 días vas a tener que elegir; con 7 podés recorrer con más calma.' }
    ],
    bullets: ['Definí fechas.', 'Compará vuelos y equipaje.', 'Elegí la zona donde dormir.', 'Calculá transporte, comida y actividades.', 'Dejá margen para gastos variables.']
  },
  imperdibles: [
    { name: 'Cristo Redentor', d: 'Uno de los grandes símbolos de Río y una visita clásica.', foto: foto('rio#Vuelo privado en helicóptero de 30 minutos al Cristo Redentor') },
    { name: 'Pan de Azúcar', d: 'Teleféricos y vistas panorámicas de la bahía y la ciudad.', foto: foto('rio#Río: medio día con el Cristo, la escalera Selarón y atardecer en el Pan de Azúcar') },
    { name: 'Escadaria Selarón', d: 'Postales de Lapa y Santa Teresa.', foto: foto('rio#Río: Cristo Redentor, Pan de Azúcar, Selarón y almuerzo con parrilla') },
    { name: 'Jardim Botânico', d: 'Naturaleza y tranquilidad.', foto: '' },
    { name: 'Parque Lage', d: 'Muy buena combinación con el entorno del Corcovado.', foto: '' },
    { name: 'Arpoador', d: 'Uno de los clásicos para el atardecer.', foto: fotoDeLaGuia('rio', 'Praia do Diabo') },
    { name: 'Maracaná', d: 'Una opción para quienes disfrutan del fútbol.', foto: foto('rio#Río: entrada a un partido de fútbol en el Maracanã con transporte privado') },
    { name: 'Santa Teresa', d: 'Arte, gastronomía, arquitectura y calles con mucha personalidad.', foto: '' }
  ],
  secciones: [
    { id: 'cuando', icono: '📅', titulo: '¿Cuándo viajar a Río?',
      intro: 'Río se puede visitar durante todo el año. La mejor fecha depende de si priorizás playa, clima, eventos, menor demanda o presupuesto.',
      items: [
        { t: 'Verano', d: 'Calor, playa y mucha actividad.' },
        { t: 'Carnaval', d: 'Experiencia especial, pero requiere planificación.' },
        { t: 'Otoño y primavera', d: 'Buenas alternativas para combinar paseos y playa.' },
        { t: 'Invierno', d: 'Puede ser agradable para recorrer, aunque el clima es menos seguro para días de playa.' }
      ],
      cierre: { t: 'Clave para el presupuesto', d: 'Los precios de vuelos y alojamiento pueden cambiar mucho según las fechas. Para una estimación realista, calculá con las fechas exactas de tu viaje.' } },
    { id: 'llegar', icono: '✈️', titulo: 'Cómo llegar a Río desde Montevideo',
      intro: 'Para la mayoría de los viajeros, el avión es la alternativa más práctica.',
      items: [
        { t: 'RIOgaleão (GIG)', d: 'Principal aeropuerto internacional.' },
        { t: 'Santos Dumont (SDU)', d: 'Aeropuerto dentro de la ciudad, especialmente conveniente para algunos desplazamientos internos.' }
      ],
      cierre: { t: 'Desde el aeropuerto', d: 'Podés combinar aplicaciones de transporte, taxi y transporte público según tu destino final.' },
      bullets: ['No te olvides de sumar: vuelo, equipaje, traslado aeropuerto → alojamiento y traslado alojamiento → aeropuerto.'] },
    { id: 'alojarse', icono: '🏨', titulo: 'Dónde alojarse en Río',
      intro: 'La zona donde dormís cambia mucho la experiencia y también puede afectar tu gasto diario de transporte.',
      items: [
        { t: 'Copacabana', d: 'Buena opción para una primera visita: playa, restaurantes y transporte.' },
        { t: 'Ipanema', d: 'Playa, gastronomía, tiendas y excelente ubicación.' },
        { t: 'Leblon', d: 'Más tranquilo y de perfil más premium.' },
        { t: 'Botafogo', d: 'Buena conexión y mucha oferta gastronómica.' },
        { t: 'Lapa / Centro', d: 'Vida nocturna, cultura e historia.' }
      ] },
    { id: 'mapa', icono: '🗺️', titulo: 'Mapa: ¿dónde está todo?',
      intro: 'Organizá Río por zonas para evitar perder tiempo cruzando la ciudad constantemente.',
      items: [
        { t: 'Zona Sur', d: 'Copacabana, Ipanema, Leblon, Botafogo, Urca y Flamengo.' },
        { t: 'Centro', d: 'Centro Histórico, Lapa y Santa Teresa.' },
        { t: 'Zona Oeste', d: 'Barra, Recreio y Grumari.' }
      ],
      cierre: { t: 'Consejo', d: 'Al elegir alojamiento, mirá también la distancia a las actividades que querés hacer.' } },
    { id: 'naturaleza', icono: '🥾', titulo: 'Río para los que quieren naturaleza',
      intro: 'La ciudad también tiene senderos, miradores, bosques y paisajes para quienes quieren salir del circuito tradicional.',
      items: [
        { t: 'Parque Nacional da Tijuca', d: 'Senderos, miradores y cascadas.' },
        { t: 'Morro Dois Irmãos', d: 'Una de las vistas más reconocibles de la ciudad.' },
        { t: 'Pedra Bonita / Pedra da Gávea', d: 'Opciones para quienes buscan caminatas y vistas.' },
        { t: 'Vista Chinesa', d: 'Mirador rodeado de naturaleza.' },
        { t: 'Pista Cláudio Coutinho', d: 'Paseo junto al mar en Urca.' },
        { t: 'Mirante Dona Marta', d: 'Panorámica de la ciudad.' }
      ] },
    { id: 'barrios', icono: '🏛️', titulo: 'Río más allá de las playas',
      intro: 'Para conocer otra cara de Río, sumá barrios y zonas históricas a tu itinerario.',
      items: [
        { t: 'Lapa', d: 'Samba, bares y vida nocturna.' },
        { t: 'Santa Teresa', d: 'Arte, gastronomía y arquitectura.' },
        { t: 'Centro Histórico', d: 'Teatro Municipal, Catedral, Confeitaria Colombo, CCBB, Candelária y Praça Mauá.' },
        { t: 'Pequena África', d: 'Una zona fundamental para conocer parte de la historia y cultura de Río.' }
      ] },
    { id: 'comida', icono: '🍽️', titulo: 'Qué comer en Río',
      intro: 'No pienses solamente en restaurantes. La comida diaria puede representar una parte importante del presupuesto.',
      bullets: ['Qué probar: feijoada, picanha, moqueca, pastel, agua de coco, caipirinha, açaí y sándwiches.'],
      cierre: { t: 'Cómo calcularlo', d: 'Separá desayuno, almuerzo, cena, bebidas y snacks. Los precios cambian según zona, temporada y tipo de establecimiento.' } },
    { id: 'moverse', icono: '🚇', titulo: 'Cómo moverse por Río',
      intro: 'No necesitás usar siempre el mismo medio de transporte. Combiná según distancia, horario y cantidad de personas.',
      items: [
        { t: 'Metro', d: 'Una de las opciones más prácticas para conectar distintas zonas. La tarifa puede cambiar; verificá el valor vigente antes de viajar.' },
        { t: 'Uber', d: 'Práctico para traslados y especialmente útil cuando viajás en grupo.' },
        { t: 'Bus', d: 'Puede ser útil, aunque para visitantes puede resultar menos intuitivo.' },
        { t: 'A pie', d: 'Muchas zonas turísticas se pueden recorrer caminando.' }
      ] },
    { id: 'itinerarios', icono: '🧭', titulo: 'Itinerarios de 3, 5 y 7 días',
      intro: 'Usá estos itinerarios como punto de partida y adaptalos a tus intereses y ritmo.',
      items: [
        { t: '3 días', d: 'Día 1: Copacabana + Ipanema + Arpoador. Día 2: Cristo + Parque Lage. Día 3: Pan de Azúcar + Urca + Lapa.' },
        { t: '5 días', d: 'Sumá Centro + Lapa + Santa Teresa y dejá un día para playa o naturaleza.' },
        { t: '7 días', d: 'Agregá Tijuca, senderos o miradores y un día flexible para repetir tu lugar favorito.' }
      ] },
    { id: 'noche', icono: '🌙', titulo: 'Río de noche',
      intro: 'La ciudad ofrece opciones para distintos estilos de noche.',
      items: [
        { t: 'Botafogo', d: 'Bares y gastronomía.' },
        { t: 'Lapa', d: 'Samba y ambiente nocturno.' },
        { t: 'Ipanema', d: 'Restaurantes y bares.' },
        { t: 'Copacabana', d: 'Restaurantes y movimiento.' },
        { t: 'Santa Teresa', d: 'Ambiente más relajado y artístico.' }
      ],
      cierre: { t: 'Consejo', d: 'De noche, priorizá zonas concurridas y planificá cómo volver al alojamiento.' } },
    { id: 'seguridad', icono: '🛡️', titulo: 'Seguridad en Río',
      intro: 'Río es una ciudad enorme y, como en cualquier gran ciudad turística, conviene prestar atención a las pertenencias y planificar los desplazamientos.',
      bullets: ['No lleves grandes cantidades de efectivo.', 'Evitá exhibir objetos de valor innecesariamente.', 'Guardá el celular cuando no lo uses.', 'De noche, priorizá zonas concurridas.', 'Usá transporte confiable.', 'Revisá el recorrido antes de salir.', 'En playas y lugares concurridos, prestá atención a tus pertenencias.'] },
    { id: 'practico', icono: '💱', titulo: 'Cosas prácticas que tenés que saber',
      items: [
        { t: 'Moneda', d: 'Real brasileño (BRL / R$).' },
        { t: 'Electricidad', d: 'En Río es común encontrar 110 V, aunque algunos hoteles pueden ofrecer también 220 V. Verificá en tu alojamiento.' },
        { t: 'Internet', d: 'Roaming o eSIM / SIM local.' },
        { t: 'Tarjetas', d: 'Ampliamente aceptadas, pero conviene tener una alternativa.' },
        { t: 'Idioma', d: 'Portugués. Algunas zonas turísticas tienen atención en otros idiomas.' }
      ] },
    { id: 'llevar', icono: '🎒', titulo: 'Qué llevar',
      intro: 'Armá la valija según la época del año y las actividades que quieras hacer.',
      grupos: [
        { titulo: 'Para todos los viajes', bullets: ['Protector solar', 'Calzado cómodo', 'Ropa liviana', 'Algo para días frescos', 'Mochila pequeña', 'Cargador / power bank', 'Repelente', 'Ropa de playa', 'Medio de pago alternativo'] },
        { titulo: 'Si vas a hacer senderismo', bullets: ['Calzado adecuado', 'Agua', 'Gorra', 'Protector solar', 'Revisar dificultad y condiciones antes de salir'] }
      ] },
    { id: 'presupuesto', icono: '💰', titulo: '¿Cuánto cuesta viajar a Río?',
      intro: 'No existe un único precio para viajar a Río. El presupuesto cambia según fechas, cantidad de personas, alojamiento, vuelos, comida, transporte y actividades.',
      items: [
        { t: 'Económico', d: 'Vuelo + alojamiento + comida + transporte local + actividades básicas.' },
        { t: 'Medio', d: 'Más comodidad en alojamiento y mayor variedad de actividades y comidas.' },
        { t: 'Cómodo', d: 'Más flexibilidad, mejores ubicaciones y más actividades.' },
        { t: '1 persona', d: 'El alojamiento pesa más porque no se divide.' },
        { t: '2 personas', d: 'Algunos gastos se pueden compartir.' },
        { t: '4 personas', d: 'El alojamiento puede dividirse, pero aumentan comidas, actividades y transporte.' }
      ],
      cierre: { t: 'Río no es un precio. Es tu viaje.', d: 'Dos personas pueden viajar a Río durante las mismas fechas y gastar cantidades completamente diferentes. CuántoSale te ayuda a estimar tu presupuesto según cómo querés viajar.' } }
  ],
  faq: [
    { q: '¿Cuántos días necesito?', a: 'Para una primera visita, 5 días completos permiten combinar atractivos y tiempo de playa.' },
    { q: '¿Cuánto cuesta viajar desde Montevideo?', a: 'Depende de fechas, vuelos, alojamiento, cantidad de personas y estilo de viaje. Calculá tu presupuesto personalizado en CuántoSale.' },
    { q: '¿Cuál es la mejor zona para alojarse?', a: 'Copacabana e Ipanema son opciones populares para una primera visita; Botafogo también puede ser interesante por ubicación.' },
    { q: '¿Río es caro?', a: 'Hay opciones para distintos presupuestos. La clave es comparar el costo total del viaje.' },
    { q: '¿Qué hacer gratis?', a: 'Playas, Arpoador, algunos parques, miradores y recorridos por barrios y zonas históricas.' },
    { q: '¿Necesito pasaporte?', a: 'Los uruguayos pueden ingresar a Brasil con pasaporte o cédula de identidad original, según la información consular.' }
  ],
  fuentes: 'Información práctica tomada de fuentes oficiales: Consulado de Brasil en Montevideo, Riotur, MetrôRio, RIOgaleão y Visit Brasil. Los precios y condiciones pueden cambiar: verificá valores actualizados antes de reservar o viajar.'
};

module.exports = { rio: RIO, foto: foto };
