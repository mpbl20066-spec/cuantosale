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
    ]
  },
  imperdibles: [
    { name: 'Cristo Redentor', d: 'Uno de los grandes símbolos de Río y una visita clásica.', foto: foto('rio#Vuelo privado en helicóptero de 30 minutos al Cristo Redentor') },
    { name: 'Pan de Azúcar', d: 'Teleféricos y vistas panorámicas de la bahía y la ciudad.', foto: foto('rio#Río: medio día con el Cristo, la escalera Selarón y atardecer en el Pan de Azúcar') },
    { name: 'Escadaria Selarón', d: 'Postales de Lapa y Santa Teresa.', foto: foto('rio#Río: Cristo Redentor, Pan de Azúcar, Selarón y almuerzo con parrilla') },
    { name: 'Jardim Botânico', d: 'Naturaleza y tranquilidad.', foto: '' },
    { name: 'Parque Lage', d: 'Muy buena combinación con el entorno del Corcovado.', foto: '' },
    { name: 'Arpoador', d: 'Uno de los clásicos para el atardecer.', foto: fotoDeLaGuia('rio', 'Praia do Diabo') },
    { name: 'Maracaná', d: 'Una opción para quienes disfrutan del fútbol.', foto: foto('rio#Río: entrada a un partido de fútbol en el Maracanã con transporte privado') },
    { name: 'Santa Teresa', d: 'Arte, gastronomía, arquitectura y calles con mucha personalidad.', foto: '' },
    { name: 'Floresta da Tijuca', d: 'Uno de los bosques urbanos más grandes del mundo, con cascadas y miradores a 20 minutos de la playa.', foto: foto('rio#Cristo Redentor y Parque Nacional da Tijuca') },
    { name: 'Morro Dois Irmãos', d: 'El sendero que sale de Vidigal, con la vista de Ipanema y Leblon desde arriba.', foto: foto('rio#Caminata al amanecer al Morro Dois Irmãos con video con dron') }
  ],

  secciones: [
    { id: 'carnaval', icono: '🎭', titulo: 'Carnaval de Río',
      intro: 'El Carnaval 2027 va del sábado 6 al martes 9 de febrero. Tiene dos caras: los desfiles de las escuelas de samba en el Sambódromo, con entrada, y los blocos de rua, gratis, en la calle.',
      items: [
        { t: 'Sambódromo', d: 'Las escuelas del Grupo Especial desfilan de noche en la Marquês de Sapucaí, cada una con más de una hora de carros y miles de bailarines. Las entradas van de las tribunas populares a los camarotes, y conviene comprarlas con meses de anticipación en los canales oficiales. El sábado siguiente al Carnaval está el Desfile das Campeãs, con las mejores escuelas y entradas más fáciles de conseguir.' },
        { t: 'Blocos de rua', d: 'Cientos de fiestas callejeras gratis, con banda y disfraz, en Centro, Santa Teresa, Ipanema y otros barrios. Empiezan semanas antes del Carnaval y la prefeitura publica el horario y el recorrido de cada uno. Arrancan temprano, a veces a las 7 de la mañana.' },
        { t: 'Ensayos de las escuelas', d: 'En los meses antes del Carnaval las escuelas ensayan en sus quadras (Mangueira, Salgueiro, Portela y otras). Es la forma de vivir el samba fuera de las fechas de Carnaval.' }
      ],
      bullets: ['El alojamiento se reserva con meses: en Carnaval los precios se multiplican y muchas posadas piden un mínimo de noches.', 'En los blocos, salí con lo justo: el celular guardado, poco efectivo y nada de valor a la vista.', 'Fin de año también llena la ciudad: el Réveillon de Copacabana junta a millones de personas en la playa para los fuegos artificiales.'] },
    { id: 'favelas', icono: '🏘️', titulo: 'Vidigal y Rocinha',
      intro: 'Son dos de las comunidades más conocidas de Río, sobre los morros entre Leblon y São Conrado. Se visitan, pero no por cuenta propia: la situación cambia de una semana a otra.',
      items: [
        { t: 'Vidigal', d: 'Sobre Leblon, frente al mar. Desde arriba sale el sendero al Morro Dois Irmãos, de unos 40 minutos de subida, con una de las vistas más lindas de Ipanema, Leblon y la Lagoa. Se sube desde la Avenida Niemeyer en mototaxi o en van, y arriba hay bares con terraza para el atardecer.' },
        { t: 'Rocinha', d: 'Considerada la favela más grande de Brasil, con casas que suben por todo el morro. Se recorre con un tour guiado por gente de la comunidad, que conoce las calles y sabe por dónde se puede pasar ese día.' }
      ],
      cierre: { t: 'Antes de ir', d: 'Consultá con el guía o con tu alojamiento si ese día hay algún problema, no saques fotos de personas sin permiso y seguí las indicaciones del guía.' } },
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

const ITACARE = {
  antes: {
    "titulo": "Antes de viajar a Itacaré",
    "intro": "Itacaré es un pueblo chico en la desembocadura del Rio de Contas, en el sur de Bahía, rodeado de selva atlántica. Las playas más lindas están fuera del pueblo, a senderos o a minutos de auto, así que conviene organizar cómo te vas a mover.",
    "items": [
      {
        "t": "Documentación",
        "d": "Los uruguayos pueden ingresar a Brasil con pasaporte o cédula de identidad original, de acuerdo con la información del Consulado de Brasil en Montevideo."
      },
      {
        "t": "La puerta de entrada es Ilhéus",
        "d": "No hay aeropuerto en Itacaré: se vuela al aeropuerto Jorge Amado de Ilhéus (IOS), a unos 70 a 75 km, y se sigue por la ruta BA-001."
      },
      {
        "t": "¿Auto o no?",
        "d": "En el pueblo se camina a todos lados, pero Itacarezinho, Engenhoca, Jeribucaçu y las cascadas quedan sobre la ruta. Si querés recorrerlas por tu cuenta, alquilar auto ayuda; si no, se hacen con agencias o en taxi."
      }
    ]
  },
  imperdibles: [],
  secciones: [
    {
      "id": "llegar",
      "icono": "✈️",
      "titulo": "Cómo llegar a Itacaré desde Montevideo",
      "intro": "No hay vuelos directos de Montevideo a Ilhéus: se vuela con al menos una escala, en general en São Paulo, y desde Ilhéus se sigue por tierra.",
      "items": [
        {
          "t": "Vuelo a Ilhéus (IOS)",
          "d": "La conexión más habitual es por São Paulo: de Guarulhos a Ilhéus hay vuelos todos los días y el tramo dura unas 2 horas. Azul, GOL y LATAM combinan rutas por Guarulhos, Congonhas o Campinas; si mezclás aerolíneas, revisá que no tengas que cambiar de aeropuerto."
        },
        {
          "t": "De Ilhéus a Itacaré en auto",
          "d": "Son unos 70 a 75 km por la BA-001, asfaltada y sin peaje, con tramos de curvas entre la selva y los cacaotales: cerca de 1 h 30. Hay alquiladoras en el aeropuerto y agencias que hacen traslados."
        },
        {
          "t": "De Ilhéus a Itacaré en ómnibus",
          "d": "La empresa Rota hace el trayecto desde la terminal de Ilhéus, más o menos cada hora, en unas 2 horas. El aeropuerto queda lejos de la terminal, así que necesitás un taxi entre los dos."
        },
        {
          "t": "Por Salvador",
          "d": "Es la alternativa más larga: unos 250 a 270 km cruzando en ferry a la isla de Itaparica, o unos 390 km por la BR-101. En ómnibus, desde Bom Despacho (del otro lado del ferry), son unas 5 h 30."
        }
      ],
      "cierre": {
        "t": "En el camino",
        "d": "Si vas en auto desde Ilhéus, el Mirante de Serra Grande queda sobre la misma ruta: vale la parada."
      },
      "bullets": [
        "No te olvides de sumar: vuelo, equipaje, traslado aeropuerto → Itacaré y la vuelta.",
        "En feriados y temporada alta, comprá el ómnibus con anticipación."
      ]
    },
    {
      "id": "alojarse",
      "icono": "🏨",
      "titulo": "Dónde alojarse en Itacaré",
      "intro": "El pueblo es chico y casi todo está a distancia caminable. La diferencia está entre dormir cerca de los bares o cerca de una playa más tranquila.",
      "items": [
        {
          "t": "Centro y Rua Pituba",
          "d": "La Pituba (Rua Pedro Longo) es la calle principal, con posadas, bares y restaurantes. Es la opción si querés salir de noche y moverte sin auto, aunque queda más lejos de las playas más lindas."
        },
        {
          "t": "Praia da Concha",
          "d": "Concentra la mayoría de las posadas y restaurantes, en general más grandes, con pileta y jardín. Está cerca de la Pituba, así que se puede salir a pie de noche."
        },
        {
          "t": "Tiririca",
          "d": "Lo más tranquilo, con pocas posadas, aire de playa salvaje y las olas que buscan los surfistas."
        },
        {
          "t": "Sobre la ruta a Ilhéus",
          "d": "Entre Itacarezinho y Serra Grande hay resorts y posadas aisladas en la selva. Para dormir ahí necesitás auto."
        }
      ],
      "bullets": [
        "Si vas en auto, buscá alojamiento con estacionamiento propio: en temporada alta el lugar en la calle escasea y los estacionamientos privados cobran por día.",
        "Algunas calles de acceso a las playas son de tierra y se ponen difíciles después de la lluvia."
      ]
    },
    {
      "id": "moverse",
      "icono": "🛵",
      "titulo": "Cómo moverse por Itacaré",
      "intro": "El centro se recorre a pie y muchas playas solo se alcanzan por senderos. Para las que quedan sobre la BA-001 vas a necesitar algún transporte.",
      "items": [
        {
          "t": "A pie",
          "d": "Del centro a la Concha, la Coroa y el Resende se camina; el Resende está a unos 20 minutos de la Concha. Tiririca, Costa y Ribeira siguen por la misma orilla."
        },
        {
          "t": "Taxi y mototaxi",
          "d": "Los taxis trabajan con precio fijo por viaje y también hay mototaxis. Si vas a una playa lejana, acordá de antemano la hora y el lugar de la vuelta."
        },
        {
          "t": "Ómnibus de la ruta",
          "d": "El ómnibus Itacaré–Ilhéus para frente al acceso de playas como Itacarezinho; desde ahí queda una caminata hasta la arena."
        },
        {
          "t": "Auto",
          "d": "Es lo más práctico para Itacarezinho, Engenhoca, Jeribucaçu, el Tijuípe y Serra Grande, porque el transporte público no llega bien a todas."
        },
        {
          "t": "Senderos",
          "d": "Prainha (40 minutos desde la Ribeira), la Trilha das 4 Praias y Jeribucaçu (unos 30 minutos después de 4 km de camino de tierra) se hacen caminando. Con lluvia se ponen resbalosos."
        }
      ]
    },
    {
      "id": "noche",
      "icono": "🌙",
      "titulo": "Itacaré de noche",
      "intro": "La noche del pueblo se concentra en una sola calle.",
      "items": [
        {
          "t": "Rua Pituba",
          "d": "Tiendas, bares y restaurantes uno al lado del otro; en algunos tramos hay música fuerte y gente bailando en la calle, con shows y forró."
        },
        {
          "t": "El atardecer antes",
          "d": "El plan clásico es ver la puesta de sol desde la Ponta do Xaréu y después subir a la Pituba a cenar."
        }
      ],
      "cierre": {
        "t": "Consejo",
        "d": "Volvé por calles con movimiento y no te quedes en las playas ni en los senderos después de que oscurece."
      }
    },
    {
      "id": "seguridad",
      "icono": "🛡️",
      "titulo": "Seguridad en Itacaré",
      "intro": "Es un pueblo tranquilo, pero los senderos por la selva no tienen luz ni vigilancia, y en el pasado hubo robos, sobre todo en el de la Prainha.",
      "bullets": [
        "Hacé los senderos de día y volvé antes de que oscurezca.",
        "A las calas por la selva no lleves nada de valor; si no te sentís seguro, andá con guía o con una agencia.",
        "El sendero a la Prainha tiene muchos desvíos y poca señalización: es fácil perderse sin guía.",
        "Las calas de la selva no tienen guardavidas: si hay olas fuertes, no te metas.",
        "Con lluvia, los senderos y los caminos de tierra se ponen resbalosos.",
        "En el auto, no dejes nada a la vista en los estacionamientos de las playas."
      ]
    },
    {
      "id": "practico",
      "icono": "💱",
      "titulo": "Cosas prácticas que tenés que saber",
      "items": [
        {
          "t": "Moneda",
          "d": "Real brasileño (BRL / R$)."
        },
        {
          "t": "Cajeros",
          "d": "Hay banco y cajeros en el centro del pueblo, pero no en las playas de la ruta. Sacá antes de salir."
        },
        {
          "t": "Tarjetas",
          "d": "Conviene tener una alternativa a la tarjeta: para barracas de playa, estacionamientos, barqueros y entradas a cascadas, llevá efectivo."
        },
        {
          "t": "Internet",
          "d": "Roaming o eSIM / SIM local."
        },
        {
          "t": "Idioma",
          "d": "Portugués."
        }
      ]
    },
    {
      "id": "llevar",
      "icono": "🎒",
      "titulo": "Qué llevar",
      "intro": "Itacaré es playa, selva y río: armá la valija para caminar tanto como para tirarte en la arena.",
      "grupos": [
        {
          "titulo": "Para todos los viajes",
          "bullets": [
            "Protector solar",
            "Repelente (al atardecer hay mosquitos)",
            "Ropa liviana y de playa",
            "Algo de abrigo liviano y un piloto: llueve en todos los meses",
            "Ropa para salir de noche por la Pituba",
            "Mochila pequeña",
            "Cargador / power bank",
            "Efectivo y un medio de pago alternativo"
          ]
        },
        {
          "titulo": "Para senderos y cascadas",
          "bullets": [
            "Calzado con agarre o sandalias de trekking",
            "Agua",
            "Gorra",
            "Bolsa estanca para el celular",
            "Revisá la marea y el pronóstico antes de salir"
          ]
        }
      ]
    }
  ],
  faq: [],
  fuentes: 'Información práctica verificada en fuentes públicas (aeropuerto de Ilhéus, operadores de transporte y guías locales). Los precios y horarios cambian: confirmalos antes de viajar.'
};

/* "Info util" del resto de los destinos: data/guias-info.json, { clave: { antes, secciones } }. Rio e Itacare
   tienen ademas imperdibles y preguntas, escritos aca arriba. */
const EXTRA = (function () {
  try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'guias-info.json'), 'utf8')); } catch (e) { return {}; }
})();
const SALIDA = { rio: RIO, itacare: ITACARE, foto: foto };
Object.keys(EXTRA).forEach(function (k) {
  if (SALIDA[k]) return;
  const x = EXTRA[k] || {};
  if (!x.antes || !Array.isArray(x.secciones)) return;
  SALIDA[k] = { antes: x.antes, imperdibles: [], secciones: x.secciones, faq: [],
    fuentes: 'Información práctica verificada en fuentes públicas (aeropuertos, empresas de transporte, organismos de turismo). Los horarios y servicios cambian: confirmalos antes de viajar.' };
});

module.exports = SALIDA;
