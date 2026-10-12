'use strict';
/* Guia Secreta: contenido por destino.

   ESTE ARCHIVO NO SE SIRVE AL NAVEGADOR. Vive en lib/, no en public/, a
   proposito. Cuando estaba en public/ era un .js estatico: cualquiera lo
   bajaba con curl y tenia la guia de los 88 destinos, sin cuenta y sin
   comprar nada. Un candado en el DOM no cambiaba eso —el texto ya estaba en
   la pagina— y ademas se leia con el verificador de elementos, con un lector
   de pantalla y con window.print().

   Ahora lo consume unicamente el server, que lo expone por /api/guia solo
   cuando el cliente prueba que eligio un hotel con precio real de Booking
   (ver guiaToken() en server.js). app.js ya no lo carga: pide la guia por
   fetch y, si el server dice que no, no se dibuja nada.

   ---------------------------------------------------------------------------
   COMO SE RESUELVE LA GUIA DE UN DESTINO
   ---------------------------------------------------------------------------
   Se busca en este orden y se corta en el primero que existe:

     1. GUIAS[destKey]        override de ciudad ("fln", "gram")
     2. REGIONES[dest.region] guia regional ("Santa Catarina")
     3. null                  sin guia. La vista lo dice, no inventa.

   El paso 3 es el que no existia antes. La versión previa hacia fallback a
   FOOD_TIPS.fln, así que Gramado, Canela, Torres, Capão da Canoa, Maragogi,
   Porto de Galinhas y Buenos Aires recibian "busca prato executivo en el
   centro de Florianópolis". Un destino sin guia escrita muestra un estado
   vacio honesto; uno mal escrito muestra un consejo que la hace cruzar el
   pais en auto.

   Para agregar un destino no hace falta tocar este archivo más alla de la
   entrada: `región` sale de DEST en lib/model.js y ya viaja al cliente
   (server.js:1017), así que una guia regional nueva tapa sola a todos los
   destinos de ese estado.

   ---------------------------------------------------------------------------
   SCHEMA
   ---------------------------------------------------------------------------
   Todos los campos son opcionales menos `resumen`. Se renderiza lo que haya.

     clave        en que guia regional se apoya, en slug (ver regionSlug
                  más abajo). Solo informativo: para el pie del PDF el
                  render usa meta.dest.region de lib/model.js, que ya viene
                  con el nombre acentuado y no hay que duplicar aca.
     resumen      una linea. Sale en la tarjeta y en la portada del PDF.
     temporada    { alta:[meses], baja:[meses], nota }  con numeros 1-12.
                  Si no está, la seccion no se imprime.
     beaches[]    { name, zona, vibe, cuando, foto }   "cuando" SIN tilde.
                  Con tilde la palabra pasa a ser interrogativa y la clave
                  deja de coincidir: el render lee b.cuando y recibe
                  undefined.
     atracciones[] { name, zona, dur, usd, nota }   cosas para VER
     comer[]      { name, tipo, zona, usd, momento, nota }
     hacer[]      { name, zona, dur, usd, nota }     cosas para HACER
     tips[]       { titulo, texto }

   ---------------------------------------------------------------------------
   REGLA HIPERLOCAL (guias de ciudad)
   ---------------------------------------------------------------------------
   La Guia Secreta es para alguien que ya esta en el destino y tiene medio dia
   libre, no para armar otro viaje. Por eso, en toda guia de GUIAS:

     - Cada playa queda a GUIA_MAX_KM (30 km) o menos del centro del destino.
       El centro es el de lib/playas.js, el mismo que usa la tarjeta del hotel,
       y la distancia es en linea recta, como en esa tarjeta. Una excursion de
       dos horas no es una playa de la ciudad: no va.
     - Primero lo que el turista no encuentra solo: calas, playas de barrio,
       las que usa la gente del lugar. La playa de postal que sale primera en
       cualquier buscador sobra; si se la deja afuera a proposito, se dice en
       un tip (ver la de Rio).
     - Cada playa lleva lat, lng y foto. La foto es de Wikimedia Commons, para
       que creditos-fotos.js pueda resolver autor y licencia: despues de
       agregar fotos, correr `node creditos-fotos.js`. Sin coordenadas la
       playa no sale en el mapa, y sin foto la tarjeta queda pelada al lado de
       las otras.
     - Si el destino no figura en lib/playas.js, primero se agrega ahi su
       centro: sin centro no hay contra que medir.

   test.js revisa las tres cosas en cada guia de ciudad y falla si una playa
   nueva se pasa de los 30 km o viene sin foto.

   TODOS los destinos de DEST tienen guia de ciudad, con el formato de la de
   Florianopolis: playas con foto y mapa (o, donde no hay playa --Sao Paulo,
   Gramado, Canela, Porto Alegre--, 'atracciones' con foto, numero y mapa). Las
   guias REGIONALES quedan solo como respaldo de un destino nuevo: son de
   estado entero y nombran pueblos a horas de distancia, asi que se reemplazan
   escribiendo la guia de ciudad, no estirando la regional.

   UNA GUIA DE CIUDAD DECLARA LAS CINCO SECCIONES, aunque sea con [].
   mezclarGuia() completa con la regional cada seccion que la ciudad no define:
   Capao da Canoa mostraba Torres y Tramandai por eso. Y despues de agregar
   fotos hay que correr 'node creditos-fotos.js'.

   ---------------------------------------------------------------------------
   POR QUE "atracciones" Y "hacer" SON DOS SECCIONES
   ---------------------------------------------------------------------------
   No es una division academica. "Mirante do Santana" y "Beco do Batman"
   están en atracciones: se mira una cosa y se termina. "Barco a la Costa da
   Lagoa" y "Santo Antônio de Lisboa" están en hacer: se hace una cosa y se
   termina tambien, pero ocupa un rato de la agenda. Mezclados, el lector no
   puede decidir "tengo dos horas libres, qué hago", que es la pregunta real.

   Cuando no hay una division limpia, el criterio es: si se puede empezar y
   terminar en una visita de menos de una hora, es atraccion; si hay que
    reservar tiempo o es una salida de medio día, es hacer.

   ---------------------------------------------------------------------------
   POR QUE NO HAY SECCION "tours"
   ---------------------------------------------------------------------------
   Porque los tours ya existen. En public/app.js hay LOCAL_TOURS (111
   entradas escritas a mano, con precio estimado) y la app los muestra en
   su propia sección.

   Escribirlos tambien acá los duplicaría, y duplicar 111 entradas que
   ya hay que mantener es la forma más corta de que se desincronicen.

   En vez de eso la guía pide los tours al render: el bloque "Tours
   recomendados" se arma desde los mismos datos que la sección de
   experiencias de la app. Si un destino no tiene ninguno, el bloque no se
   imprime.

   ---------------------------------------------------------------------------
   COMO SE USA foodPerDay
   ---------------------------------------------------------------------------
   app.js ya calcula el presupuesto diario de comida por pasajero
   (detailState.foodPerDay, app.js:3647). La guia no lo inventa: compara los
   precios de `comer` contra ese numero y arma el veredicto. Si la guia no
   tiene precios, no dice nada de presupuesto. Un numero que no se puede
   chequear contra la fuente es peor que no mostrarlo.

   ---------------------------------------------------------------------------
   REGLAS DE CONTENIDO
   ---------------------------------------------------------------------------
   - Sin HTML. Todo texto plano; el render arma las etiquetas. El codigo
     anterior interpolaba las puntas directo al markup, y por eso el <b> era
     la única forma de resaltar. Con datos en un archivo aparte, eso pasa a
     ser inyeccion en cuánto el contenido venga de afuera.
   - `usd` es un numero, no un string. Si el precio no se pudo verificar, el
     campo no va. Un placeholder es un dato falso con formato de dato.
   - Precios de comida, no de alojamiento: el alojamiento ya sale real de
     Booking con fechas y pasajeros, y una guia con precios de hotel compite
     con la fuente buena.
   - Una guia es un mapa, no un proyecto turístico. Si no le sirve a alguien
     que ya sabe a donde va, sobra.

   Cuando agregues una guia nueva, subi CACHE_VERSION en sw.js. El service
   worker sirve este archivo cache-first: sin cambiar el numero, quién ya
   visito la PWA se queda con la guia vieja para siempre. */
var CACHE_VERSION = 5;
// Ver "REGLA HIPERLOCAL": distancia maxima, en km en linea recta, entre el
// centro del destino (lib/playas.js) y cada playa de una guia de ciudad.
var GUIA_MAX_KM = 30;

/* ===========================================================================
   GUIAS DE CIUDAD
   =========================================================================== */
var GUIAS = {

  /* -----------------------------------------------------------------------
     FLORIANOPOLIS. La guia de referencia: es la que define sí el schema
     sirve. Si al leer esto pensas "esto es una guia de verdad", el schema
     está bien. Si pensas "faltan cosas", probablemente falten de verdad: hay
     que sumar secciones al schema, no al texto.
     ----------------------------------------------------------------------- */
  fln: {
    region: 'santa-catarina',
    resumen: 'Una isla con más de 40 playas, lagunas y pueblos de pescadores, unida al continente por puentes. Cada costa es un viaje distinto: el norte calmo y familiar, el este con olas, el sur más salvaje.',
    temporada: {
      alta: [12, 1, 2, 3],
      baja: [6, 7, 8, 9],
      nota: 'Enero y febrero son lo más caro y lo más lleno, con tráfico pesado en toda la isla. De junio a septiembre es invierno: precios bajos, pero frío para la playa. Para playa con menos gente, marzo o la primera mitad de diciembre.'
    },
    clima: {
      titulo: 'Clima en Florianópolis mes por mes',
      intro: 'Florianópolis tiene cuatro estaciones: verano caluroso y húmedo, e invierno fresco con el agua fría.',
      meses: [
        { m: 'Ene', max: 29, min: 22, lluvia: 241, mar: 26, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 22, lluvia: 198, mar: 26, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 21, lluvia: 180, mar: 25.5, demanda: 'media' },
        { m: 'Abr', max: 27, min: 19, lluvia: 116, mar: 24, demanda: 'media' },
        { m: 'May', max: 24, min: 16, lluvia: 126, mar: 22, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 14, lluvia: 86, mar: 19.5, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 13, lluvia: 101, mar: 18, demanda: 'baja' },
        { m: 'Ago', max: 22, min: 14, lluvia: 93, mar: 18, demanda: 'baja' },
        { m: 'Sep', max: 22, min: 15, lluvia: 147, mar: 19, demanda: 'baja' },
        { m: 'Oct', max: 24, min: 18, lluvia: 153, mar: 20.5, demanda: 'baja' },
        { m: 'Nov', max: 26, min: 19, lluvia: 147, mar: 22.5, demanda: 'baja' },
        { m: 'Dic', max: 28, min: 21, lluvia: 177, mar: 24, demanda: 'alta' }
      ],
      nota: 'Para playa con el agua tibia y menos gente: marzo, y si podés, la primera quincena de abril. Enero y febrero son lo más caluroso, pero también lo más lluvioso, con tormentas de tarde y la isla llena. De junio a septiembre el agua baja a 18 o 19 grados: sirve para recorrer los pueblos y comer ostras a precios bajos, no para bañarse.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 (estación Florianópolis, São José). Agua: promedios de seatemperature.info.'
    },
    beaches: [
      { name: 'Beira-Mar Norte', zona: 'Centro, sobre la bahía norte', lat: -27.5786, lng: -48.5241, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Beira_mar_norte_Florian%C3%B3polis_SC.jpg/1280px-Beira_mar_norte_Florian%C3%B3polis_SC.jpg', vibe: 'No es una playa: es la costanera del centro, con ciclovía, gente caminando y vista al puente Hercílio Luz. El agua de la bahía no es para bañarse.', cuando: 'Todo el año, a última hora de la tarde para caminar y ver el atardecer.' },
      { name: 'Barra da Lagoa (canal y molhe)', zona: 'Costa este, 20 km del centro', lat: -27.5748, lng: -48.4258, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Barra_da_Lagoa%2C_Florian%C3%B3polis%2C_SC.jpg/1280px-Barra_da_Lagoa%2C_Florian%C3%B3polis%2C_SC.jpg', vibe: 'Pueblo de pescadores donde la Lagoa da Conceição desemboca en el mar por un canal. Restaurantes de pescado sobre el agua, botes y un puente colgante a la Prainha da Barra.', cuando: 'Todo el año. A la hora del almuerzo se llenan los restaurantes del canal: llegá antes de las 13.' },
      { name: 'Praia Mole', zona: 'Costa este, 18 km del centro', lat: -27.6034, lng: -48.4370, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Praia_Mole%2C_Florian%C3%B3polis.jpg/1280px-Praia_Mole%2C_Florian%C3%B3polis.jpg', vibe: 'La playa joven de la isla: olas para surf, bares sobre la arena y gente hasta la tarde. Arena gruesa y morros a los costados.', cuando: 'Diciembre a marzo para el ambiente. El mar es abierto: con bandera roja no se entra.' },
      { name: 'Naufragados', zona: 'Punta sur de la isla', lat: -27.8335, lng: -48.5619, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Naufragados%2C_Florian%C3%B3polis.jpg/1280px-Naufragados%2C_Florian%C3%B3polis.jpg', vibe: 'La playa más aislada de la isla, sin calles: se llega por un sendero de unos 3 km por el bosque desde Caieira da Barra do Sul, o en barco. Tiene un faro y ruinas de un fuerte del siglo XVIII.', cuando: 'Día seco. Llevá agua y calzado para el sendero; servicios hay muy pocos.' },
      { name: 'Canasvieiras', zona: 'Norte, 30 km del centro', lat: -27.4296, lng: -48.4602, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/Playa_Canasvieiras_-_Floripa%2C_Brasil_%281%29.jpg/1280px-Playa_Canasvieiras_-_Floripa%2C_Brasil_%281%29.jpg', vibe: 'La playa de los uruguayos y argentinos: agua calma y poco profunda, mucha infraestructura y todo a pie (supermercados, restaurantes, sombrillas). La elegida para ir con chicos.', cuando: 'Todo el año, y en enero está llenísima. Es buena opción cuando el oleaje cierra las playas de la costa este.' },
      { name: 'Praia da Joaquina', zona: 'Costa este, 20 km del centro', lat: -27.6343, lng: -48.4544, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Praia_da_Joaquina%2C_Florian%C3%B3polis%2C_Santa_Catarina.JPG/1280px-Praia_da_Joaquina%2C_Florian%C3%B3polis%2C_Santa_Catarina.JPG', vibe: 'Olas grandes y las dunas al lado, donde se hace sandboard. Es una de las playas clásicas del surf en Brasil.', cuando: 'Todo el año. Mar abierto y con corrientes: para nadar, quedate cerca de la torre de guardavidas.' },
      { name: 'Praia do Campeche', zona: 'Sur de la isla, 20 km del centro', lat: -27.6859, lng: -48.4805, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Praia_do_Campeche.jpg/1280px-Praia_do_Campeche.jpg', vibe: 'Playa larga de mar abierto, con olas y surf. Enfrente está la Ilha do Campeche, de agua transparente, a la que se cruza en barco.', cuando: 'Diciembre a marzo para cruzar a la isla, que tiene cupo de visitantes por día. Con bandera roja no se entra.' },
      { name: 'Lagoa da Conceição', zona: 'Centro-este de la isla, 12 km del centro', lat: -27.6032, lng: -48.4654, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/Lagoa_da_Concei%C3%A7%C3%A3o_%283423230047%29.jpg/1280px-Lagoa_da_Concei%C3%A7%C3%A3o_%283423230047%29.jpg', vibe: 'No es mar: es una laguna salobre, conectada al océano por el canal de la Barra. Se hace kayak, paddle y kitesurf, y al lado están las dunas. El barrio de la Lagoa es el centro de la noche de la isla.', cuando: 'Todo el año. Sirve como plan cuando el mar está bravo, porque no depende del oleaje.' },
      { name: 'Praia Brava', zona: 'Norte de la isla, Cachoeira do Bom Jesus', lat: -27.3976, lng: -48.4158, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Floripa_12_2014_Brava_1079.JPG/1280px-Floripa_12_2014_Brava_1079.JPG', vibe: 'Playa de olas entre dos morros, con edificios detrás. Se alquilan sombrillas y sillas, y el ambiente es más tranquilo que el de Canasvieiras.', cuando: 'Mejor de mañana o con poco viento. Es mar abierto: mirá la bandera antes de entrar.' },
      { name: 'Lagoinha do Leste', zona: 'Sur de la isla, solo a pie', lat: -27.7735, lng: -48.487, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Praia_da_Lagoinha_do_Leste%2C_Florian%C3%B3polis.jpg/1280px-Praia_da_Lagoinha_do_Leste%2C_Florian%C3%B3polis.jpg', vibe: 'Una playa sin calles ni construcciones, entre dos morros y con una laguna detrás de la arena. Se llega caminando: una hora y media desde Pântano do Sul, o un poco más por la costa desde Matadeiro.', cuando: 'Día seco y con tiempo. Llevá agua y comida, porque allá no hay nada, y volvé antes de que oscurezca: el sendero no tiene luz.' },
      { name: 'Praia do Santinho', zona: 'Noreste, 23 km del centro', lat: -27.4584, lng: -48.375, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Ilha_Santa_Catarina_20_Praia_Santinho.JPG/1280px-Ilha_Santa_Catarina_20_Praia_Santinho.JPG', vibe: 'Playa de olas con dunas detrás y, en las piedras del extremo norte, grabados rupestres de los primeros habitantes de la isla. Tiene mucha menos gente que Ingleses, la vecina.', cuando: 'Todo el año. Es mar abierto: con bandera roja, caminá y no entres.' },
      { name: 'Jurerê Internacional', zona: 'Norte, 24 km del centro', lat: -27.4389, lng: -48.4992, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Praia_de_Jurer%C3%AA_Internacional.JPG/1280px-Praia_de_Jurer%C3%AA_Internacional.JPG', vibe: 'Playa de agua calma y arena clara en el norte de la isla, frente a un barrio de casas grandes y beach clubs con música. En la punta oeste está la Fortaleza de São José da Ponta Grossa.', cuando: 'Diciembre a marzo; los beach clubs se llenan de tarde. Para nadar tranquilo, de mañana.' },
      { name: 'Praia dos Ingleses', zona: 'Noreste, 31 km del centro', lat: -27.4367, lng: -48.3856, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Praia_dos_Ingleses_%285378358433%29.jpg/1280px-Praia_dos_Ingleses_%285378358433%29.jpg', vibe: 'Playa larga y urbana del norte de la isla, con muchos hoteles, restaurantes y movimiento. Olas moderadas y, enfrente, la Ilha Mata Fome.', cuando: 'Todo el año; en enero está llena. Es mar abierto: mirá la bandera.' },
      { name: 'Praia da Armação', zona: 'Sur de la isla, 21 km del centro', lat: -27.7444, lng: -48.5064, foto: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Praia_da_Arma%C3%A7%C3%A3o_-_Florian%C3%B3polis_-_Santa_Catarina_-_panoramio_%281%29.jpg', vibe: 'Pueblo de pescadores con la iglesia de Sant’Ana frente a la playa y barcos que cruzan a la Ilha do Campeche. Mar abierto, con olas.', cuando: 'Diciembre a marzo, si querés cruzar a la Ilha do Campeche.' },
      { name: 'Pântano do Sul', zona: 'Sur de la isla, 27 km del centro', lat: -27.7858, lng: -48.5188, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Praia_do_P%C3%A2ntano_do_Sul_%2824801356822%29.jpg/1280px-Praia_do_P%C3%A2ntano_do_Sul_%2824801356822%29.jpg', vibe: 'Pueblo de pescadores al final de la ruta del sur, con restaurantes de pescado sobre la arena y una bahía abierta entre morros. De acá sale el sendero a la Lagoinha do Leste.', cuando: 'Mediodía, para comer frente al mar.' }
    ],
    atracciones: [
      { name: 'Mercado Público', zona: 'Centro', lat: -27.5973, lng: -48.5531, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Mercado_P%C3%BAblico_de_Florian%C3%B3polis_%283886761127%29.jpg/1280px-Mercado_P%C3%BAblico_de_Florian%C3%B3polis_%283886761127%29.jpg', dur: '1 h', usd: 0, nota: 'Edificio de fines del siglo XIX con pescaderías, puestos de mariscos y bares en el patio central. La entrada es libre; se paga lo que se consume.' },
      { name: 'Praça XV de Novembro', zona: 'Centro', lat: -27.5976, lng: -48.5499, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Praca_XVdeNovembro_Florianopolis.jpg/1280px-Praca_XVdeNovembro_Florianopolis.jpg', dur: '30 min', usd: 0, nota: 'La plaza del centro histórico, con una higuera centenaria en el medio. Alrededor están la Catedral y el Palácio Cruz e Sousa, que hoy es el Museu Histórico de Santa Catarina.' },
      { name: 'Ponte Hercílio Luz', zona: 'Centro', lat: -27.5938, lng: -48.5654, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Ponte_Herc%C3%ADlio_Luz_FREITASFOTOS_002.jpg/1280px-Ponte_Herc%C3%ADlio_Luz_FREITASFOTOS_002.jpg', dur: '45 min', usd: 0, nota: 'El puente colgante de 1926 que une la isla con el continente, símbolo de la ciudad. Se puede cruzar a pie o en bici.' },
      { name: 'Catedral Metropolitana', zona: 'Centro', lat: -27.5964, lng: -48.5493, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Catedral_Metropolitana_de_Florian%C3%B3polis_-_Florian%C3%B3polis_-_20230325122402.jpg/1280px-Catedral_Metropolitana_de_Florian%C3%B3polis_-_Florian%C3%B3polis_-_20230325122402.jpg', dur: '30 min', usd: 0, nota: 'La catedral del centro histórico, sobre la Praça XV. Se entra gratis.' },
      { name: 'Fortaleza de São José da Ponta Grossa', zona: 'Norte, en la punta oeste de Jurerê', dur: '1 h 30', lat: -27.4317, lng: -48.5183, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Fortaleza_Sao_Jose-Florianopolis-Brasil.JPG/1280px-Fortaleza_Sao_Jose-Florianopolis-Brasil.JPG', nota: 'Fuerte portugués del siglo XVIII sobre el morro que cierra Jurerê, con vista a la bahía norte. Se llega en auto o bus hasta arriba del morro; la administra la UFSC y cobra entrada, salvo el último domingo de cada mes entre marzo y noviembre, que es gratis.' },
      { name: 'Fortaleza de Santa Cruz de Anhatomirim', zona: 'Isla de Anhatomirim, bahía norte', dur: 'Medio día con el barco', lat: -27.4272, lng: -48.5645, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Forte_cart%C3%A3o_postal.JPG/1280px-Forte_cart%C3%A3o_postal.JPG', nota: 'El fuerte más grande de la bahía, en una isla chica frente a Governador Celso Ramos. Solo se llega en barco: las escunas que salen de Canasvieiras paran ahí. La entrada se paga aparte del barco, y el último domingo de cada mes entre marzo y noviembre es gratis.' },
      { name: 'Museu Histórico de Santa Catarina (Palácio Cruz e Sousa)', zona: 'Centro, Praça XV', dur: '1 h', lat: -27.5967, lng: -48.55, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Museu_Hist%C3%B3rico_de_Santa_Catarina_-_Pal%C3%A1cio_Cruz_e_Sousa_-_Florian%C3%B3polis%2C_SC.jpg/1280px-Museu_Hist%C3%B3rico_de_Santa_Catarina_-_Pal%C3%A1cio_Cruz_e_Sousa_-_Florian%C3%B3polis%2C_SC.jpg', nota: 'El antiguo palacio de gobierno, rosado y lleno de estatuas, frente a la Praça XV. Adentro hay salones de época y la historia del estado. Cobra entrada; confirmá horario y precio antes de ir, porque cambian según la temporada.' },
      { name: 'Mirante da Lagoa', zona: 'Morro da Lagoa, camino del centro a la Lagoa', dur: '20 min', usd: 0, lat: -27.6009, lng: -48.4813, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Lagoa_da_Concei%C3%A7%C3%A3o_do_alto_do_Mirante_-_By_Mauro_Soares_-_panoramio.jpg/1280px-Lagoa_da_Concei%C3%A7%C3%A3o_do_alto_do_Mirante_-_By_Mauro_Soares_-_panoramio.jpg', nota: 'El mirador sobre la ruta que baja del centro a la Lagoa da Conceição: se ven la laguna, el barrio, las dunas de la Joaquina y el mar. Tiene estacionamiento al costado de la ruta y es gratis. Paralo a la ida o a la vuelta de la Lagoa.' }
    ],
    comer: [
      { name: 'Prato feito del centro', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía, 12 a 14 h', nota: 'Arroz, porotos, ensalada y una carne o pollo, a precio fijo. Es la comida con mejor relación precio-cantidad de la ciudad: buscá la pizarra del día, no un restaurante de carta.' },
      { name: 'Comida por quilo', tipo: 'Almuerzo', zona: 'Toda la ciudad', usd: 7, momento: 'Mediodía, de 11 a 14 h', nota: 'Buffet donde cada uno se sirve y paga por el peso del plato. Es la comida de todos los días en Brasil y sale menos que cualquier carta turística.' },
      { name: 'Ostras', tipo: 'Almuerzo o cena', zona: 'Santo Antônio de Lisboa y Ribeirão da Ilha', momento: 'Mediodía o atardecer', nota: 'Florianópolis es el mayor productor de ostras de Brasil, y los criaderos están frente a estos dos pueblos. Se comen frescas, gratinadas o al vapor, mirando la bahía.' },
      { name: 'Sequência de camarão', tipo: 'Almuerzo o cena', zona: 'Lagoa da Conceição y Barra da Lagoa', momento: 'Mediodía', nota: 'El plato típico de la isla: una serie de preparaciones de camarón (al ajo, empanado, en pirão, con arroz) que se pide para dos y alcanza para más.' },
      { name: 'Açaí', tipo: 'Merienda', zona: 'Centro y barrios', usd: 7, momento: 'Tarde', nota: 'Viene del Amazonas, pero en Brasil se toma en todas partes, en bowl con granola, banana o leche en polvo.' },
      { name: 'Coxinha y café de panadería', tipo: 'Merienda', zona: 'Calles del centro', usd: 3, momento: 'Toda la tarde', nota: 'Coxinha frita, rellena de pollo desmenuzado, y un café de la panadería. Es la merienda barata de todo Brasil.' },
      { name: 'Tainha de temporada', tipo: 'Almuerzo', zona: 'Restaurantes de pescado de Pântano do Sul, Armação y el norte de la isla', momento: 'Mayo a julio, al mediodía', nota: 'Entre mayo y julio es la zafra de la tainha (lisa), que los pescadores sacan con redes desde la playa. Es el pescado de la cocina tradicional de la isla y en esos meses aparece frita, asada o rellena en los restaurantes frente al mar.' }
    ],
    hacer: [
      { name: 'Barco a la Costa da Lagoa', zona: 'Lagoa da Conceição', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Barcos_na_beira_da_Costa_da_Lagoa.jpg/1280px-Barcos_na_beira_da_Costa_da_Lagoa.jpg', dur: 'Medio día', nota: 'Un pueblo a orillas de la laguna al que no llegan autos: se va en el barco de línea que sale de la Lagoa o por un sendero. Restaurantes de pescado sobre el agua y una cascada corta.' },
      { name: 'Santo Antônio de Lisboa', zona: 'Noroeste de la isla', dur: 'Medio día', nota: 'Pueblo de casas coloniales de los inmigrantes azorianos, con la iglesia frente al mar y restaurantes de ostras. Es de los mejores atardeceres de la isla, sobre la bahía.' },
      { name: 'Ribeirão da Ilha', zona: 'Sur de la isla, costa oeste', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Igreja_Nossa_Senhora_da_Lapa_em_2020.jpg/1280px-Igreja_Nossa_Senhora_da_Lapa_em_2020.jpg', dur: 'Medio día', nota: 'El otro pueblo azoriano, más lejos y más tranquilo, con la calle principal pegada a la bahía y los criaderos de ostras enfrente.' },
      { name: 'Sandboard en las dunas', zona: 'Joaquina / Lagoa', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Sandboard_nas_dunas_da_Lagoa.JPG/1280px-Sandboard_nas_dunas_da_Lagoa.JPG', dur: '2 h', nota: 'Las dunas entre la Joaquina y la Lagoa da Conceição. Se alquilan tablas al pie de las dunas.' },
      { name: 'Morro da Cruz', zona: 'Centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/Florian%C3%B3polis_SC_Brasil_-_Vista_do_Centro_Mirante_Morro_da_Cruz_-_panoramio.jpg/1280px-Florian%C3%B3polis_SC_Brasil_-_Vista_do_Centro_Mirante_Morro_da_Cruz_-_panoramio.jpg', dur: '1 h', usd: 0, nota: 'El mirador sobre la ciudad: se ven las dos bahías, el centro y los puentes. Se sube en auto o taxi; el mejor momento es el atardecer.' },
      { name: 'Escuna por la bahía norte', zona: 'Sale de Canasvieiras', dur: '5 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Escunas_em_Canasvieiras%2C_Florianopolis%2C_SC.jpg/1280px-Escunas_em_Canasvieiras%2C_Florianopolis%2C_SC.jpg', nota: 'Los barcos con forma de galeón salen del muelle de Canasvieiras, cruzan la bahía donde suelen verse delfines y paran en la isla de Anhatomirim y en Governador Celso Ramos para almorzar. El almuerzo y la entrada a la fortaleza no están incluidos. Hay varias empresas: confirmá días y horarios, que cambian según la temporada.' },
      { name: 'Cruce a la Ilha do Campeche', zona: 'Sale de Armação y Campeche', dur: 'Día entero', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Praia_da_Ilha_do_Campeche.jpg/1280px-Praia_da_Ilha_do_Campeche.jpg', nota: 'Una isla protegida, de agua clara y arena blanca, con grabados rupestres en las piedras. Tiene cupo de visitantes por día y, además del barco, se paga una tasa de visita que vende la Prefeitura. En enero el cupo se llena: andá temprano o reservá el barco el día anterior.' }
    ],
    tips: [
      { titulo: 'Toda la isla es un mismo lugar', texto: 'Florianópolis no es una ciudad con playas: es una isla de unos 54 km de largo llena de playas, y en temporada el tráfico es pesado. Planificá por zona y no por día: cada día una zona (norte, este y Lagoa, sur) y no cruzás la isla cuatro veces.' },
      { titulo: 'En la bahía no se nada', texto: 'El agua de las bahías alrededor del centro no es para bañarse. Las playas para nadar están en el norte, el este y el sur. Antes de ir, el IMA de Santa Catarina publica cada semana qué puntos están aptos para baño.' },
      { titulo: 'Auto o bus, según el plan', texto: 'Los buses urbanos salen de la terminal del centro (TICEN) y llegan a todas las playas, pero con trasbordos en las terminales de cada zona y lento. Con auto se ven varias playas en el mismo día; en enero el problema es el tráfico y el estacionamiento.' },
      { titulo: 'Horarios de fin de semana', texto: 'Muchos comercios del centro cierran el sábado después del mediodía y el domingo. Para el almuerzo del domingo confirmá antes de ir, o te vas a encontrar todo cerrado.' },
      { titulo: 'Dónde está el centro histórico', texto: 'El centro está en la costa oeste de la isla, frente al continente, entre la Praça XV, el Mercado Público y la cabecera del puente Hercílio Luz. Se recorre a pie en medio día.' },
      { titulo: 'Mirá la bandera y entrá cerca del guardavidas', texto: 'Las corrientes de retorno son la causa principal de ahogamientos en Santa Catarina, y en enero de 2026 Campeche fue la playa con más rescates del estado. Bandera roja es riesgo alto y doble roja, playa cerrada. Si te agarra la corriente, no nades contra ella: nadá paralelo a la costa y hacé señas.' },
      { titulo: 'En el bus, sin efectivo', texto: 'Desde enero de 2026 los buses urbanos dejaron de aceptar efectivo arriba del coche; en las terminales todavía se paga en ventanilla. También se paga con Pix por QR, pero así no tenés el trasbordo gratis: con la tarjeta de transporte, un pasaje te sirve para combinar en las terminales durante un rato.' }
    ]
  },

  sao: {
    region: 'sao-paulo',
    resumen: 'La ciudad más grande del país y una de las que mejor se come de América del Sur. No es un destino de playa: es un destino de ciudad.',
    temporada: { alta: [1, 7, 12], baja: [3, 4, 5, 6, 8, 9, 10], nota: 'São Paulo no tiene temporada de playa: tiene temporada de eventos. En verano llueve fuerte casi todas las tardes. De abril a septiembre llueve poco y hace fresco, el mejor momento para caminarla; fuera de las vacaciones de julio, también es la época más tranquila.' },
    clima: {
      titulo: 'Clima en São Paulo mes por mes',
      intro: 'Veranos calurosos con tormentas casi todas las tardes e inviernos secos y frescos.',
      meses: [
        { m: 'Ene', max: 29, min: 19, lluvia: 292, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 20, lluvia: 258, demanda: 'media' },
        { m: 'Mar', max: 28, min: 19, lluvia: 229, demanda: 'baja' },
        { m: 'Abr', max: 27, min: 18, lluvia: 87, demanda: 'baja' },
        { m: 'May', max: 23, min: 15, lluvia: 66, demanda: 'baja' },
        { m: 'Jun', max: 23, min: 14, lluvia: 60, demanda: 'baja' },
        { m: 'Jul', max: 23, min: 13, lluvia: 48, demanda: 'alta' },
        { m: 'Ago', max: 25, min: 13, lluvia: 32, demanda: 'baja' },
        { m: 'Sep', max: 25, min: 15, lluvia: 83, demanda: 'baja' },
        { m: 'Oct', max: 27, min: 17, lluvia: 127, demanda: 'baja' },
        { m: 'Nov', max: 27, min: 17, lluvia: 144, demanda: 'media' },
        { m: 'Dic', max: 28, min: 19, lluvia: 231, demanda: 'alta' }
      ],
      nota: 'Para caminar la ciudad, de abril a septiembre: llueve poco, los días son templados y las noches frescas. De diciembre a marzo hace calor y llueve fuerte casi todas las tardes. Julio y el verano son los meses más caros desde Uruguay por las vacaciones; noviembre se encarece por los eventos, como el Gran Premio de Fórmula 1.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 del INMET (estación Mirante de Santana).'
    },
    beaches: [],
    atracciones: [
      { name: 'Mercado Municipal', zona: 'Centro', lat: -23.5417, lng: -46.6295, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Conservas_en_un_puesto_japones_del_Mercado_Municipal_de_Sao_Paulo.jpg/1280px-Conservas_en_un_puesto_japones_del_Mercado_Municipal_de_Sao_Paulo.jpg', dur: '1 h', usd: 0, nota: 'El edificio de 1933 con vitrales, puestos de frutas, especias y fiambres. La entrada es gratis: lo que se gasta es en comer, y lo clásico es el sándwich de mortadela y el pastel de bacalao. Caro para lo que es, pero es la mejor introducción a la ciudad en una hora.' },
      { name: 'Beco do Batman', zona: 'Vila Madalena', lat: -23.5565, lng: -46.6867, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/ROGERIO_CASSIMIRO_Beco_do_Batman_SAO_PAULO_SP_%2839780582590%29.jpg/1280px-ROGERIO_CASSIMIRO_Beco_do_Batman_SAO_PAULO_SP_%2839780582590%29.jpg', dur: '1 h', usd: 0, nota: 'El callejón de grafitis más famoso de la ciudad: un pasillo con buenas pinturas que se recorre en un rato. Andá de día.' },
      { name: 'Catedral da Sé', zona: 'Centro', lat: -23.5513, lng: -46.6344, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/S%C3%A3o_Paulo-_Catedral_da_S%C3%A9_%2815981%29.jpg/1280px-S%C3%A3o_Paulo-_Catedral_da_S%C3%A9_%2815981%29.jpg', dur: '45 min', usd: 0, nota: 'La catedral neogótica sobre la Praça da Sé, el kilómetro cero de la ciudad. Entrar es gratis; abajo hay una cripta que se visita con guía.' },
      { name: 'Museu de Arte de São Paulo', zona: 'Avenida Paulista', lat: -23.5615, lng: -46.656, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/MASP_-_Museu_de_Arte_de_S%C3%A3o_Paulo_%283407312147%29.jpg/1280px-MASP_-_Museu_de_Arte_de_S%C3%A3o_Paulo_%283407312147%29.jpg', dur: '2 h', usd: 15, nota: 'La colección cuelga en los caballetes de vidrio que diseñó Lina Bo Bardi, en orden cronológico y sin paredes en el medio, que es raro y funciona. Se ve de punta a punta en dos horas, y los martes la entrada es gratis con reserva online.' },
      { name: 'Estação da Luz', zona: 'Centro', lat: -23.5351, lng: -46.6354, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Esta%C3%A7%C3%A3o_da_Luz%2C_S%C3%A3o_Paulo_%280001_50%29.jpg/1280px-Esta%C3%A7%C3%A3o_da_Luz%2C_S%C3%A3o_Paulo_%280001_50%29.jpg', dur: '1 h', usd: 0, nota: 'La estación de tren de 1901, de hierro y ladrillo, que sigue funcionando con trenes y metro. Mirarla es gratis; en el mismo edificio está el Museu da Língua Portuguesa, que se paga aparte.' },
      { name: 'Pinacoteca', zona: 'Centro', lat: -23.5343, lng: -46.6339, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Pinacoteca_do_Estado_de_S%C3%A3o_Paulo_%28Lado_oposto%29.jpg/1280px-Pinacoteca_do_Estado_de_S%C3%A3o_Paulo_%28Lado_oposto%29.jpg', dur: '1 h', usd: 5, nota: 'El museo de arte más antiguo de la ciudad, en un edificio neoclásico. Es la mejor colección de arte brasileño del país, y a diferencia del MASP tiene tiempo para mirar: no son 500 obras de golpe.' },
      { name: 'Memorial da América Latina', zona: 'Barra Funda', lat: -23.5275, lng: -46.6654, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Vista_lateral_3_da_escultura_%22Integra%C3%A7%C3%A3o%22_by_Bruno_Giorgi%2C_1989._Localizada_no_Memorial_da_Am%C3%A9rica_Latina%2C_S%C3%A3o_Paulo_-_SP.jpg/1280px-Vista_lateral_3_da_escultura_%22Integra%C3%A7%C3%A3o%22_by_Bruno_Giorgi%2C_1989._Localizada_no_Memorial_da_Am%C3%A9rica_Latina%2C_S%C3%A3o_Paulo_-_SP.jpg', dur: '2 h', usd: 0, nota: 'El conjunto que Oscar Niemeyer inauguró en 1989, con explanadas de cemento, la mano de concreto y unas 8 hectáreas. Es gratis y entre semana hay poca gente.' },
      { name: 'Edifício Copan', zona: 'Centro', lat: -23.5466, lng: -46.6445, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Edif%C3%ADcio_Copan._-_panoramio_%281%29.jpg/1280px-Edif%C3%ADcio_Copan._-_panoramio_%281%29.jpg', dur: '20 min', usd: 0, nota: 'El edificio ondulado de Oscar Niemeyer, con más de mil departamentos y una forma que se reconoce de lejos. Se mira desde la calle; la azotea se visita con reserva.' },
      { name: 'Theatro Municipal', zona: 'Centro', lat: -23.5453, lng: -46.6386, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Theatro_Municipal_de_S%C3%A3o_Paulo_%2816-06-2024%29.jpg/1280px-Theatro_Municipal_de_S%C3%A3o_Paulo_%2816-06-2024%29.jpg', dur: '45 min', usd: 0, nota: 'La ópera de 1911, con fachada de inspiración parisina y cúpula de vidrio. Se visita por dentro con guía y la plaza de enfrente es de paso obligado en el centro.' },
    ],
    comer: [
      { name: 'Prato feito y virado à paulista', tipo: 'Almuerzo', zona: 'Centro y barrios', momento: 'Mediodía hasta las 15 h', nota: 'El plato del día de los bares: arroz, feijão, carne y ensalada. Los lunes muchos sirven virado à paulista (porotos con harina de mandioca, chuleta, huevo frito y repollo). Es el almuerzo de oficina y de lo más barato para comer sentado.' },
      { name: 'Cafetería de barrio', tipo: 'Desayuno', zona: 'Vila Madalena y Pinheiros', usd: 5, momento: '7 a 11 h', nota: 'Café con leche y pan con queso. Sentarse en la vereda es parte de la comida. El brunch caro es para el domingo, no entre semana.' },
      { name: 'Feira livre', tipo: 'Compra', zona: 'Cambia por barrio', usd: 5, momento: 'Mañana, un día fijo por barrio', nota: 'Cada barrio tiene su feria en un día fijo. Averiguá cuál te queda cerca y andá a la mañana: fruta, pastel y caldo de cana.' },
      { name: 'Pastel de feira', tipo: 'Merienda', zona: 'Ferias libres', usd: 3, momento: 'Mañana', nota: 'Una masa fina frita, grande y crocante, rellena de carne, queso o palmito, que se vende por unidad en el puesto de la feria. Se come parado, con un caldo de cana.' },
      { name: 'Rodízio de pizza', tipo: 'Cena', zona: 'Perdizes y Mooca', usd: 12, momento: 'Noche', nota: 'Se paga un precio fijo y los mozos pasan porciones de pizza por la mesa hasta que digas basta. Es la cena que más rinde de la ciudad si llegaste con hambre.' }
    ],
    hacer: [
      { name: 'Parque Ibirapuera', zona: 'Ibirapuera / Vila Mariana', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Parque_Ibirapuera_e_Obelisco_2017.jpg/1280px-Parque_Ibirapuera_e_Obelisco_2017.jpg', dur: '2 h', usd: 0, nota: 'El parque más visitado de la ciudad, con edificios de Oscar Niemeyer y museos adentro, como el MAM y el Museu Afro Brasil. Es donde va la gente a correr y a andar en bici, sobre todo los fines de semana.' },
      { name: 'Chopp en el Bar Brahma', zona: 'Centro (Ipiranga y São João)', foto: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Bar_Brahma_1.JPG', dur: '2 h', nota: 'El bar clásico de la esquina de Ipiranga y São João, la que nombra la canción "Sampa" de Caetano Veloso. Chopp (cerveza tirada) y, algunas noches, música en vivo.' }
    ],
    tips: [
      { titulo: 'El metro es la mejor decisión que podés tomar', texto: 'La red no llega a todos lados, pero es rápida, cuesta menos que un taxi y une los lugares que más vas a visitar: el centro, la Luz, la Paulista, Pinheiros y Vila Madalena. El problema de São Paulo es el tráfico de superficie: usá el metro y dejá el auto para lo que queda lejos.' },
      { titulo: 'Se come bien en todos los precios', texto: 'Un prato feito, un pastel de feria o un sándwich de mortadela salen bastante menos que un restaurante con carta, y son parte de la ciudad tanto como los restaurantes famosos.' },
      { titulo: 'Avenida Paulista es para ver, no para comer', texto: 'Paulista es una avenida de oficinas, bancos y museos, y los domingos se cierra a los autos y se llena de gente. Las tiendas de lujo están en la Rua Oscar Freire, en Jardins. Para comer a precio de barrio, buscá Pinheiros, Vila Madalena o el centro.' },
      { titulo: 'La lluvia pasa', texto: 'El diluvio cae casi todos los días de diciembre a marzo, dura veinte minutos y la ciudad sigue. No es motivo para no hacer nada: llevá paraguas y seguí.' }
    ]
  },

  /* -----------------------------------------------------------------------
     RIO DE JANEIRO. La primera guia escrita con la regla hiperlocal (ver
     "REGLA HIPERLOCAL" arriba): todas las playas a 30 km o menos del Centro,
     cada una con foto y coordenadas. Antes Rio no tenia guia propia y heredaba
     la regional, que mandaba a Buzios, Paraty, Ilha Grande y Angra: dos a
     cuatro horas de ruta para alguien que se aloja en Copacabana.

     Prainha y Grumari quedan afuera a proposito (37 y 39 km). Son las que
     cualquier lista nombra primero, y por eso mismo no son secretas. Van en
     un tip, para que quien las escuche sepa por que no estan.
     ----------------------------------------------------------------------- */
  rio: {
    resumen: 'Las playas famosas de la Zona Sur y la Barra, y las calas chicas entre morros a las que va la gente de Río, la mayoría a menos de una hora del Centro.',
    temporada: { alta: [12, 1, 2, 7], baja: [3, 4, 5, 9, 10, 11], nota: 'De diciembre a febrero hace más de 30 grados, llueve fuerte pero corto a la tarde, y Carnaval y fin de año llevan los precios al doble. Julio se llena con las vacaciones de invierno. Marzo, abril, septiembre y octubre tienen buen clima, menos gente y mejores precios.' },
    /* Clima mes por mes. Temperaturas y lluvia: normales 1991-2020 de la estacion costera de Saude (Centro);
       el agua del mar es el promedio mensual de la costa. `demanda` es cuanto se llena y encarece Rio para quien
       viaja desde Uruguay: alta en las vacaciones de verano, Carnaval, fin de ano y vacaciones de julio. */
    clima: {
      titulo: 'Clima en Río mes por mes',
      intro: 'Río tiene calor todo el año. Lo que cambia es la lluvia, la temperatura del agua y cuánta gente hay.',
      meses: [
        { m: 'Ene', max: 31, min: 24, lluvia: 135, mar: 25.5, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 24, lluvia: 130, mar: 26, demanda: 'alta' },
        { m: 'Mar', max: 30, min: 24, lluvia: 135, mar: 26.5, demanda: 'baja' },
        { m: 'Abr', max: 29, min: 23, lluvia: 95, mar: 26, demanda: 'baja' },
        { m: 'May', max: 26, min: 21, lluvia: 70, mar: 24.5, demanda: 'baja' },
        { m: 'Jun', max: 26, min: 20, lluvia: 45, mar: 23, demanda: 'media' },
        { m: 'Jul', max: 25, min: 19, lluvia: 40, mar: 22.5, demanda: 'alta' },
        { m: 'Ago', max: 26, min: 19, lluvia: 45, mar: 22, demanda: 'media' },
        { m: 'Sep', max: 26, min: 20, lluvia: 55, mar: 22, demanda: 'baja' },
        { m: 'Oct', max: 27, min: 21, lluvia: 85, mar: 22.5, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 22, lluvia: 100, mar: 23.5, demanda: 'baja' },
        { m: 'Dic', max: 30, min: 23, lluvia: 135, mar: 25, demanda: 'alta' }
      ],
      nota: 'Para playa con agua tibia y menos gente: marzo y abril. Para caminar la ciudad con poca lluvia: de mayo a septiembre, aunque el agua está más fría. En verano llueve fuerte pero corto, casi siempre a la tarde.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 (estación Saúde, Río de Janeiro).'
    },
    beaches: [
      { name: 'Copacabana', zona: 'Zona Sur, 8 km del Centro', lat: -22.9757, lng: -43.1866, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Praia_de_Copacabana_-_Rio_de_Janeiro%2C_Brasil.jpg/960px-Praia_de_Copacabana_-_Rio_de_Janeiro%2C_Brasil.jpg', vibe: 'Cuatro kilómetros de arena frente al calçadão de mosaico blanco y negro, con vóley, fútbol en la arena y quioscos con agua de coco y cerveza desde temprano. Es la playa con más movimiento de Río y está abierta a toda hora.', cuando: 'Amanecer o atardecer; entre las 11 y las 15 hay más sol y más gente.' },
      { name: 'Ipanema', zona: 'Zona Sur, 9 km del Centro', lat: -22.9873, lng: -43.2021, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Praia_de_Ipanema_Rio_de_Janeiro.jpg/1280px-Praia_de_Ipanema_Rio_de_Janeiro.jpg', vibe: 'Desde la piedra del Arpoador hasta el Leblon, con el Dois Irmãos de fondo. Cada puesto de salvavidas tiene su público: el Arpoador, surfistas y aplausos al sol; el centro, gente joven; hacia el Leblon, familias.', cuando: 'Tarde, para ver el sol caer detrás del Dois Irmãos.' },
      { name: 'Leblon', zona: 'Zona Sur, 10 km del Centro', lat: -22.9879, lng: -43.2244, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Rio_de_Janeiro_Ipanema_%26_Leblon_173_Feb_2006.JPG/960px-Rio_de_Janeiro_Ipanema_%26_Leblon_173_Feb_2006.JPG', vibe: 'La continuación de Ipanema hacia el oeste, más residencial y más tranquila. Es la playa de los vecinos del barrio, con mucha familia y menos ruido que Copacabana.', cuando: 'Mañana, entre semana.' },
      { name: 'São Conrado', zona: 'Zona Sur, entre Leblon y Barra, 16 km del Centro', lat: -22.9995, lng: -43.2655, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Praia_de_S%C3%A3o_Conrado_-_Rio.jpg/1280px-Praia_de_S%C3%A3o_Conrado_-_Rio.jpg', vibe: 'Una playa abierta entre el Morro Dois Irmãos y la Pedra da Gávea, con la Rocinha en el morro de enfrente. En la punta oeste, la Praia do Pepino, aterrizan las alas delta que despegan de la Pedra Bonita: se pueden mirar desde la arena toda la tarde.', cuando: 'Días de sol y poco viento, cuando vuelan las alas delta. Es mar abierto con olas: con bandera roja no se entra, y después de lluvias fuertes revisá el boletín del INEA antes de bañarte.' },
      { name: 'Barra da Tijuca', zona: 'Zona Oeste, 19 km del Centro', lat: -23.0132, lng: -43.3197, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Praia_da_Barra_e_Montanhas_do_Parque_Nacional_da_Tijuca.jpg/1280px-Praia_da_Barra_e_Montanhas_do_Parque_Nacional_da_Tijuca.jpg', vibe: 'Una playa larga y ancha de mar abierto, con olas fuertes, quioscos numerados y ciclovía junto a la arena. Hay más espacio que en la Zona Sur y es la playa de los cariocas con auto.', cuando: 'Fin de semana temprano; con olas grandes el baño es riesgoso.' },
      { name: 'Praia Vermelha', zona: 'Urca, 5 km del Centro', lat: -22.9548, lng: -43.164, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Praia_Vermelha_01.jpg/1280px-Praia_Vermelha_01.jpg', vibe: 'Una cala encajada entre el Pan de Azúcar y el Morro da Babilônia. El agua es calma porque la boca es angosta, y la usan las familias de Urca: el turista pasa por al lado para hacer la fila del bondinho y no baja a la arena.', cuando: 'Todo el año. Temprano entre semana está casi vacía. Es también el punto de partida de la Pista Cláudio Coutinho (ver Qué hacer).' },
      { name: 'Praia do Diabo', zona: 'Entre Arpoador y Copacabana, 9 km del Centro', lat: -22.988, lng: -43.1925, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Arpoador_-_Praia_do_Diabo_RJ.jpg/1280px-Arpoador_-_Praia_do_Diabo_RJ.jpg', vibe: 'Una franja corta de arena entre la Pedra do Arpoador y el Forte de Copacabana. Miles de personas la miran desde la piedra al atardecer y casi nadie baja: es de los surfistas y bodyboarders del barrio.', cuando: 'Con mar calmo, a la mañana. Con olas grandes no es para nadar: la corriente tira hacia las piedras.' },
      { name: 'Praia da Joatinga', zona: 'Joá, entre São Conrado y Barra, 17 km del Centro', lat: -23.0143, lng: -43.2906, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Praia_da_Joatinga_%283539967037%29.jpg/1280px-Praia_da_Joatinga_%283539967037%29.jpg', vibe: 'Una caleta escondida al pie de los acantilados del Joá. Se entra caminando por el condominio y se baja por las piedras. Arena clara, agua verde y casi ningún turista, porque desde la ruta no se ve.', cuando: 'Solo con marea baja: con la alta el mar se come casi toda la arena. Mirá la tabla de mareas antes de ir y no te quedes hasta que oscurezca, porque la subida por las piedras sin luz es peligrosa.' },
      { name: 'Praia do Sossego', zona: 'Niterói, 14 km en línea recta del Centro', lat: -22.9707, lng: -43.0513, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Praia_do_Sossego_-_Niter%C3%B3i_-_RJ_%2815231628881%29.jpg/1280px-Praia_do_Sossego_-_Niter%C3%B3i_-_RJ_%2815231628881%29.jpg', vibe: 'Una cala entre Piratininga y Camboinhas a la que se llega por un sendero corto que baja desde la calle. Sin kioscos ni sillas de alquiler: el nombre ("tranquilidad") es la descripción.', cuando: 'Todo el año, con agua y comida desde el hotel porque no hay nada para comprar. Hay que cruzar el puente Río-Niterói: en auto o Uber es cerca de una hora, más en hora pico.' }
    ],
    atracciones: [
      { name: 'Cristo Redentor', zona: 'Corcovado, Cosme Velho', lat: -22.9519, lng: -43.2106, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Christ_the_Redeemer_-_Cristo_Redentor.jpg/1280px-Christ_the_Redeemer_-_Cristo_Redentor.jpg', dur: '3 h', nota: 'La estatua a 710 metros, con la ciudad entera abajo. Se sube en el Trem do Corcovado, que sale de Cosme Velho y tarda unos 20 minutos entre la selva, o en las vans oficiales que salen de Copacabana, Largo do Machado y Paineiras. Andá temprano o en la última hora: al mediodía se llena. Si el morro está tapado de nubes no se ve nada, así que mirá el cielo antes de ir.' },
      { name: 'Pan de Azúcar', zona: 'Urca, Praia Vermelha', lat: -22.9494, lng: -43.1567, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/P%C3%A3o_de_A%C3%A7ucar_-_Sugarloaf_Mountain_-_Zuckerhut_-_2022.jpg/1280px-P%C3%A3o_de_A%C3%A7ucar_-_Sugarloaf_Mountain_-_Zuckerhut_-_2022.jpg', dur: '2 a 3 h', nota: 'El teleférico (bondinho) sube en dos tramos: primero al Morro da Urca y después al Pan de Azúcar, con la bahía, Copacabana y el Cristo enfrente. El atardecer es lo más lindo y lo más lleno: llegá una hora antes. El primer tramo también se puede subir a pie por un sendero que sale de la Pista Cláudio Coutinho.' },
      { name: 'Maracanã', zona: 'Zona Norte', lat: -22.9122, lng: -43.2303, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Maracana_2022.jpg/1280px-Maracana_2022.jpg', dur: '1 h 30', nota: 'El estadio de las finales de 1950 y 2014. Se puede hacer la visita guiada por vestuarios, túnel y campo, o ir a un partido: Flamengo y Fluminense juegan de locales ahí, y un clásico es otra experiencia. Para el partido, mejor ir y volver en metro o con un tour, nunca a pie de noche.' },
      { name: 'Floresta da Tijuca', zona: 'Parque Nacional da Tijuca, Alto da Boa Vista', lat: -22.9594, lng: -43.2778, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Floresta_da_Tijuca_60.jpg/1280px-Floresta_da_Tijuca_60.jpg', dur: 'Medio día', usd: 0, nota: 'Uno de los bosques urbanos más grandes del mundo, replantado a mano en el siglo XIX. Adentro están la Cascatinha Taunay, la Capela Mayrink, el mirador de la Vista Chinesa y el Pico da Tijuca, de 1.022 metros. La entrada es gratis; conviene ir en auto o con un tour porque las distancias adentro son largas.' },
      { name: 'Mirante Dona Marta', zona: 'Botafogo', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Vista_do_Morro_Dona_Marta.jpg/1280px-Vista_do_Morro_Dona_Marta.jpg', dur: '45 min', usd: 0, nota: 'Desde acá el Cristo queda de frente y el Pan de Azúcar abajo, con toda la bahía de Botafogo en el medio. Es gratis y tiene mucha menos gente que el Corcovado. Se sube en taxi o Uber: el camino a pie no es recomendable.' },
      { name: 'Escadaria Selarón', zona: 'Lapa / Santa Teresa', lat: -22.9143, lng: -43.179, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Escadaria_Selar%C3%B3n_-_Rio_de_Janeiro_-_20240417062601.jpg/1280px-Escadaria_Selar%C3%B3n_-_Rio_de_Janeiro_-_20240417062601.jpg', dur: '30 min', usd: 0, nota: 'La escalera cubierta de azulejos de todo el mundo. Andá temprano: a media mañana se llena de grupos y la foto sale con cincuenta personas.' },
      { name: 'Arcos da Lapa', zona: 'Lapa', lat: -22.9126, lng: -43.1799, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/2018_Rio_de_Janeiro_-_Aqueduto_da_Carioca.jpg/1280px-2018_Rio_de_Janeiro_-_Aqueduto_da_Carioca.jpg', dur: '20 min', usd: 0, nota: 'El acueducto del siglo XVIII que hoy cruza el bondinho de Santa Teresa por arriba. De día es una foto; de noche, el centro de la movida de Lapa.' },
      { name: 'Jardim Botânico', zona: 'Jardim Botânico', lat: -22.9675, lng: -43.2239, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/Corcovado%2C_veduta_02_giardin_botanico.JPG/1280px-Corcovado%2C_veduta_02_giardin_botanico.JPG', dur: '2 h', nota: 'El jardín fundado en 1808, con la avenida de palmeras imperiales y el Corcovado de fondo. Tiene entrada paga y combina bien con el Parque Lage, que está a pocas cuadras.' },
      { name: 'Parque Lage', zona: 'Jardim Botânico', lat: -22.9606, lng: -43.212, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/Parque_Lage%2C_Rio_de_Janeiro_Project_2345_01.jpg/1280px-Parque_Lage%2C_Rio_de_Janeiro_Project_2345_01.jpg', dur: '1 h', usd: 0, nota: 'Una mansión con el patio interno y la pileta al pie del Corcovado, rodeada de selva. Se entra gratis y hay un café adentro. Desde acá sale el sendero que sube al Cristo, exigente y mejor con guía.' },
      { name: 'Museu do Amanhã y Praça Mauá', zona: 'Centro, zona portuaria', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Museu_do_Amanh%C3%A3_rio.jpg/1280px-Museu_do_Amanh%C3%A3_rio.jpg', dur: '2 h', nota: 'El museo de ciencia de Santiago Calatrava, sobre la bahía, en la zona del puerto renovada. Al lado están el Museu de Arte do Rio y el Boulevard Olímpico con los murales gigantes de Kobra.' },
      { name: 'Real Gabinete Português de Leitura', zona: 'Centro', lat: -22.9054, lng: -43.1822, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Real_Gabinete_Portugu%C3%AAs_de_Leitura_11-18.jpg/1280px-Real_Gabinete_Portugu%C3%AAs_de_Leitura_11-18.jpg', dur: '30 min', usd: 0, nota: 'Una biblioteca del siglo XIX con estanterías de madera tallada hasta el techo. Se entra gratis en horario de oficina y queda a pocas cuadras de cualquier recorrido por el Centro.' }
    ],
    comer: [
      { name: 'Mate de galão y Biscoito Globo', tipo: 'Merienda', zona: 'En la arena, cualquier playa', momento: 'Toda la tarde', nota: 'El mate frío con limón que venden los ambulantes con los tanques al hombro, y la rosquilla de polvilho que viene en bolsa. Es la merienda de playa de todo carioca y no se consigue en un bar.' },
      { name: 'Empada en la Mureta da Urca', tipo: 'Merienda', zona: 'Urca', momento: 'Atardecer', nota: 'Se compran la empada y la cerveza en el bar de la esquina y se comen sentado en el murito, con los pies colgando sobre la bahía. Es el plan de fin de tarde del barrio, a cinco minutos de la Praia Vermelha.' },
      { name: 'Prato feito del Centro', tipo: 'Almuerzo', zona: 'Centro', momento: 'Mediodía, de 11:30 a 14:30', nota: 'Arroz, feijão, farofa, ensalada y una carne por bastante menos que un plato en la Zona Sur. Es la comida de los oficinistas: buscá el cartel escrito a mano en la puerta, no una carta.' },
      { name: 'Pastel con caldo de cana en la feria', tipo: 'Desayuno', zona: 'Ferias de barrio', momento: 'Mañana, hasta las 13', nota: 'Cada barrio tiene su feria libre un día de la semana. El puesto de pastel con jugo de caña recién molido es el desayuno de feria de toda la ciudad.' }
    ],
    hacer: [
      { name: 'Sendero al Morro Dois Irmãos', zona: 'Vidigal, sobre Leblon', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Morro_Dois_Irm%C3%A3os%2C_Rio_de_Janeiro.JPG/1280px-Morro_Dois_Irm%C3%A3os%2C_Rio_de_Janeiro.JPG', dur: '2 h 30', usd: 0, nota: 'Se sube en mototaxi o van por Vidigal hasta el comienzo del sendero, y de ahí son unos 40 minutos de subida. Arriba se ven Ipanema, Leblon, la Lagoa y la Rocinha. Mejor ir con un guía de la comunidad y nunca de noche.' },
      { name: 'Tour por la Rocinha', zona: 'Entre Gávea y São Conrado', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Rocinha_rio_de_janeiro_panorama_2010.jpg/1280px-Rocinha_rio_de_janeiro_panorama_2010.jpg', dur: '3 h', nota: 'La favela más grande de Brasil, recorrida a pie con un guía que vive ahí. No se va por cuenta propia: el guía sabe por dónde se puede pasar ese día.' },
      { name: 'Vuelo en ala delta', zona: 'Pedra Bonita, São Conrado', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Hang_gliding_Brasil.jpg/1280px-Hang_gliding_Brasil.jpg', dur: '2 h', nota: 'Se despega en tándem con instructor desde la rampa de la Pedra Bonita y se aterriza en la playa de São Conrado. Depende del viento: se confirma el mismo día.' },
      { name: 'Samba en la Pedra do Sal', zona: 'Saúde, Pequena África', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/2018_Rio_de_Janeiro_-_Pedra_do_Sal.jpg/1280px-2018_Rio_de_Janeiro_-_Pedra_do_Sal.jpg', dur: 'Noche', usd: 0, nota: 'Una ronda de samba al aire libre, gratis, en las escaleras de piedra donde nació el samba carioca. Se hace algunas noches por semana: confirmá la agenda antes de ir.' },
      { name: 'Noche en Lapa', zona: 'Lapa', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Arcos_da_Lapa_a_noite_%285814912781%29.jpg/1280px-Arcos_da_Lapa_a_noite_%285814912781%29.jpg', dur: 'Noche', nota: 'Bares con samba en vivo, gente en la calle bajo los arcos y gafieiras para bailar. Los viernes y sábados es cuando más se mueve. Andá y volvé en Uber.' },
      { name: 'Pista Cláudio Coutinho', zona: 'Urca, sale de la Praia Vermelha', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Pista_Claudio_Coutinho_-_Urca.JPG/1280px-Pista_Claudio_Coutinho_-_Urca.JPG', dur: '1 h', usd: 0, nota: 'Un camino plano de poco más de un kilómetro al pie del Pan de Azúcar, entre el mar y la selva, con monos tití a la vista. Gratis y con movimiento desde temprano.' },
      { name: 'Caminho dos Pescadores', zona: 'Leme, punta de Copacabana', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Lascar_Morro_do_Leme%2C_Copacabana_%284551769010%29.jpg/1280px-Lascar_Morro_do_Leme%2C_Copacabana_%284551769010%29.jpg', dur: '40 min', usd: 0, nota: 'Una pasarela al costado de la Pedra do Leme, sobre el mar, donde pescan los vecinos. Desde la punta se ve Copacabana entera, y casi nadie que se aloja en la playa la conoce.' },
      { name: 'Atardecer en la Pedra do Arpoador', zona: 'Arpoador', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/P%C3%B4r-do-sol_na_Pedra_do_Arpoador_2014_11_17.jpg/1280px-P%C3%B4r-do-sol_na_Pedra_do_Arpoador_2014_11_17.jpg', dur: '1 h', usd: 0, nota: 'El sol se pone detrás del Morro Dois Irmãos y la gente aplaude. Llegá media hora antes para tener lugar en la piedra, y después mirá la Praia do Diabo desde arriba.' }
    ],
    tips: [
      { titulo: 'Prainha y Grumari no están en esta guía', texto: 'Son lindas, pero quedan a casi 40 km del Centro: con el tránsito es más de una hora de ida desde Copacabana. Para medio día de playa, Joatinga o la Praia Vermelha dan lo mismo sin perder la tarde en la ruta.' },
      { titulo: 'La bandera manda', texto: 'Las calas chicas no tienen guardavidas fijo. Bandera roja quiere decir corriente de retorno de verdad, no exageración. En Diabo, Joatinga y Sossego la corriente es el peligro principal.' },
      { titulo: 'No todas las playas están aptas todos los días', texto: 'El INEA publica qué playas están aptas para bañarse. Las de mar abierto casi siempre lo están; las de la bahía (Urca, Botafogo, Flamengo) cambian después de cada lluvia.' },
      { titulo: 'A la arena, liviano', texto: 'Celular en el bolsillo, nada de valor a la vista y un billete chico para el ambulante. En las calas chicas no hay dónde dejar las cosas, así que conviene ir liviano.' }
    ]
  },

  buz: {
    resumen: 'Una península con más de veinte playas a pocos minutos una de otra. Las mejores son las chicas y de agua quieta, no las del centro.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 9], nota: 'De diciembre a febrero y en Carnaval los precios se duplican y la Rua das Pedras se llena de noche. De abril a junio y en septiembre el agua sigue tibia, hay sol y se consigue lugar en cualquier playa sin madrugar.' },
    clima: {
      titulo: 'Clima en Búzios mes por mes',
      intro: 'Búzios llueve poco para estar en Brasil y tiene sol casi todo el año. Lo que cambia es la temperatura del agua y cuánta gente hay.',
      meses: [
        { m: 'Ene', max: 29, min: 22, lluvia: 75, mar: 24, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 23, lluvia: 37, mar: 24.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 23, lluvia: 58, mar: 25.5, demanda: 'media' },
        { m: 'Abr', max: 28, min: 22, lluvia: 79, mar: 25, demanda: 'baja' },
        { m: 'May', max: 26, min: 20, lluvia: 74, mar: 23.5, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 19, lluvia: 48, mar: 22.5, demanda: 'baja' },
        { m: 'Jul', max: 25, min: 19, lluvia: 47, mar: 22, demanda: 'media' },
        { m: 'Ago', max: 24, min: 19, lluvia: 38, mar: 21.5, demanda: 'media' },
        { m: 'Sep', max: 24, min: 19, lluvia: 58, mar: 21.5, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 20, lluvia: 91, mar: 22, demanda: 'media' },
        { m: 'Nov', max: 27, min: 21, lluvia: 93, mar: 22.5, demanda: 'media' },
        { m: 'Dic', max: 28, min: 22, lluvia: 88, mar: 24, demanda: 'alta' }
      ],
      nota: 'Para playa con agua tibia y menos gente: marzo después de Carnaval y abril. De mayo a septiembre casi no llueve, pero el agua baja a 21-22° y de noche refresca. De diciembre a febrero y en Carnaval los precios se duplican.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1961-1990 (estación Cabo Frio – Álcalis, en Arraial do Cabo). Temperatura del agua: promedio de los últimos 10 años según seatemperature.info. Es la estación oficial más cercana, a unos 25 km.'
    },
    beaches: [
      { name: 'Praia dos Ossos', zona: 'Centro', lat: -22.746, lng: -41.8814, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Praia_dos_Ossos%2C_246_-_Village_de_B%C3%BAzios%2C_B%C3%BAzios_-_RJ%2C_28950-000%2C_Brazil_-_panoramio.jpg/1280px-Praia_dos_Ossos%2C_246_-_Village_de_B%C3%BAzios%2C_B%C3%BAzios_-_RJ%2C_28950-000%2C_Brazil_-_panoramio.jpg', vibe: 'La playa del pueblo, al pie de la Igreja de Sant\'Ana, con los barcos de pesca fondeados. El agua es quieta y de acá salen los taxis-barco a las otras playas.', cuando: 'Temprano a la mañana, antes de que lleguen los barcos de paseo.' },
      { name: 'Azeda y Azedinha', zona: 'A pie desde Ossos', lat: -22.7422, lng: -41.8818, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Azeda.jpg/960px-Azeda.jpg', vibe: 'Dos calas de agua transparente a las que se baja por un sendero corto desde Ossos. Son chicas y se llenan rápido: el que llega a las 9 elige lugar.', cuando: 'Mañana. Después del mediodía no queda arena libre en temporada.' },
      { name: 'João Fernandes', zona: 'Norte de la península', lat: -22.7418, lng: -41.8745, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_Jo%C3%A3o_Fernandes_-_Arma%C3%A7%C3%A3o_de_B%C3%BAzios-RJ.jpg/1280px-Praia_Jo%C3%A3o_Fernandes_-_Arma%C3%A7%C3%A3o_de_B%C3%BAzios-RJ.jpg', vibe: 'La mejor para snorkel sin barco: agua verde, quieta y con peces a tres metros de la orilla. Tiene restaurantes sobre la arena, más caros que en el pueblo.', cuando: 'Todo el año. Llevá máscara propia: el alquiler sale casi lo mismo que comprarla.' },
      { name: 'Praia do Forno', zona: 'Detrás de la Praia Brava', lat: -22.7614, lng: -41.8749, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Ba%C3%ADa_da_Praia_do_Forno.JPG/1280px-Ba%C3%ADa_da_Praia_do_Forno.JPG', vibe: 'Arena rojiza y agua fría y clara, en una bahía cerrada a la que se llega por un sendero de diez minutos. No hay calle, así que no hay multitud.', cuando: 'Días sin viento sur. Llevá agua: arriba no venden nada.' },
      { name: 'Praia da Tartaruga', zona: 'Camino a Ferradura', lat: -22.7567, lng: -41.9066, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Praia_da_Tartaruga_-_B%C3%BAzios_-_RJ_Imagem_A%C3%A9rea.jpg/1280px-Praia_da_Tartaruga_-_B%C3%BAzios_-_RJ_Imagem_A%C3%A9rea.jpg', vibe: 'Agua muy calma y tortugas que comen pasto marino cerca de la orilla. Es la que eligen las familias del lugar.', cuando: 'Mañana, cuando el agua está más clara.' },
      { name: 'Geribá', zona: 'Sur de la península', lat: -22.7804, lng: -41.9136, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Praia_de_Gerib%C3%A1_deserta_durante_a_pandemia_de_COVID-19.jpg/1280px-Praia_de_Gerib%C3%A1_deserta_durante_a_pandemia_de_COVID-19.jpg', vibe: 'La playa larga de olas, con surf y la gente joven de Búzios. Es la opción cuando las calas del norte están llenas.', cuando: 'Tarde, para el surf.' },
      { name: 'Ferradura', zona: 'Sur, 3 km de la Orla Bardot', lat: -22.7716, lng: -41.889, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Parque_Estadual_da_Costa_do_Sol_-_Anna_Cl%C3%A1udia_Gouveia_Salomon_%2806%29.jpg/1280px-Parque_Estadual_da_Costa_do_Sol_-_Anna_Cl%C3%A1udia_Gouveia_Salomon_%2806%29.jpg', vibe: 'Una bahía cerrada con forma de herradura, de agua quieta y sin olas. Es la elegida para ir con chicos y para alquilar kayak o stand up paddle.', cuando: 'Todo el día; de mañana hay más lugar en la arena.' },
      { name: 'João Fernandinho', zona: 'Norte, al lado de João Fernandes, 2 km del centro', lat: -22.7393, lng: -41.874, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Buzios-JoaoFernandinho1.jpg/1280px-Buzios-JoaoFernandinho1.jpg', vibe: 'La cala chica que sigue a João Fernandes, separada por unas piedras, con agua verde y quieta. Tiene poca arena y es buena para snorkel desde la orilla.', cuando: 'Mañana, antes de que se llene; con mar calmo para el snorkel.' },
      { name: 'Praia Brava', zona: 'Este de la península, 3 km del centro', lat: -22.7548, lng: -41.8714, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Praia_Brava_-_B%C3%BAzios.jpg/1280px-Praia_Brava_-_B%C3%BAzios.jpg', vibe: 'Mar abierto con olas, del lado del océano: es la playa del surf en el este de Búzios. Tiene bares sobre la arena y corrientes en los días de mar grande.', cuando: 'Tarde, para el atardecer en los bares. Nadá cerca de la orilla y solo con bandera verde.' },
      { name: 'Olho de Boi', zona: 'Sendero desde la Praia Brava, 15 min', lat: -22.7552, lng: -41.8652, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Buzios_RJ_Brasil_-_Praia_de_nudismo%2C_Olho_de_Boi_-_panoramio.jpg/1280px-Buzios_RJ_Brasil_-_Praia_de_nudismo%2C_Olho_de_Boi_-_panoramio.jpg', vibe: 'Una cala chica entre piedras a la que solo se llega por un sendero desde Brava. Es la playa nudista de Búzios.', cuando: 'Días sin viento. Llevá agua: no hay servicios.' },
      { name: 'Praia da Foca', zona: 'Entre Forno y Ferradura, sendero corto, 3 km', lat: -22.7653, lng: -41.8788, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Praia_da_Foca_2010_BBKW.JPG/1280px-Praia_da_Foca_2010_BBKW.JPG', vibe: 'Una cala muy chica entre rocas, con agua clara y casi sin arena. Se llega por un sendero corto y hay más piedra que playa.', cuando: 'Mañana con mar calmo, para nadar con máscara.' },
      { name: 'Ferradurinha', zona: 'Sur, junto a Geribá, 5 km', lat: -22.7816, lng: -41.9001, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Praia_da_Ferradurinha_B%C3%BAzios.JPG/1280px-Praia_da_Ferradurinha_B%C3%BAzios.JPG', vibe: 'Una cala chica de agua quieta y transparente, con piedras planas que forman piletas en la orilla. Se llena rápido porque entra poca gente.', cuando: 'Temprano; con marea baja se forman las piletas entre las piedras.' },
      { name: 'Manguinhos', zona: 'Oeste, entrada de Búzios, 7 km por ruta', lat: -22.769, lng: -41.9113, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Praia_de_Manguinhos_-_Arma%C3%A7%C3%A3o_dos_B%C3%BAzios.jpg/1280px-Praia_de_Manguinhos_-_Arma%C3%A7%C3%A3o_dos_B%C3%BAzios.jpg', vibe: 'Una bahía larga de agua bajita y calma, con botes de pescadores fondeados. Por el viento de la tarde es la playa del kitesurf y el windsurf.', cuando: 'Mañana para nadar; de tarde, para mirar o practicar kite.' },
      { name: 'Praia Rasa', zona: 'Oeste, sobre la bahía, 10 km por ruta', lat: -22.7294, lng: -41.9721, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/13/Buzios-PraiaRasa1.jpg/1280px-Buzios-PraiaRasa1.jpg', vibe: 'Una playa larga de agua bajita y quieta, frente a islas, con posadas y poca gente de paso. Buena para ir con chicos y para kayak.', cuando: 'Todo el día; al atardecer el sol cae sobre la bahía.' },
      { name: 'Praia da Armação', zona: 'Centro, frente a la Orla Bardot', lat: -22.7493, lng: -41.8825, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Buzios-PraiaArma%C3%A7ao1.jpg/1280px-Buzios-PraiaArma%C3%A7ao1.jpg', vibe: 'La playa del centro, angosta y con barcos fondeados. Es más para mirar el pueblo y tomar algo en la orilla que para nadar.', cuando: 'Atardecer.' },
      { name: 'Praia do Canto', zona: 'Centro, al final de la Rua das Pedras', lat: -22.7541, lng: -41.891, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Buzios-Arma%C3%A7ao1.jpg/1280px-Buzios-Arma%C3%A7ao1.jpg', vibe: 'La playa urbana de la Rua das Pedras, con muelle, barcos de paseo y agua quieta. Hay restaurantes con mesas sobre la arena.', cuando: 'De día para el muelle; de noche, para cenar mirando el agua.' },
      { name: 'Praia das Caravelas', zona: 'Sur, 12 km por ruta, límite con Cabo Frio', lat: -22.8146, lng: -41.954, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Caravelas.JPG/1280px-Caravelas.JPG', vibe: 'Una playa de mar abierto rodeada de cerros con vegetación y piedras, con olas y poca gente. Tiene pocos servicios.', cuando: 'Días sin viento sur; nadá con cuidado por las olas.' }
    ],
    atracciones: [
      { name: 'Orla Bardot', zona: 'Centro', lat: -22.7531, lng: -41.8842, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Escultura_Bardot.JPG/1280px-Escultura_Bardot.JPG', dur: '45 min', usd: 0, nota: 'La rambla de piedra que une el centro con Ossos, con la estatua de Brigitte Bardot. Se recorre caminando al atardecer, cuando el sol baja sobre la bahía.' },
      { name: 'Mirante do Forno', zona: 'Praia Brava', dur: '30 min', usd: 0, nota: 'El mirador del sendero que baja a la Praia do Forno. Desde arriba se ven las dos bahías: la que sale en todas las fotos de Búzios.' },
      { name: 'Igreja de Sant\'Ana', zona: 'Ossos', lat: -22.7471, lng: -41.8819, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/Igreja_de_Sant%27Ana.jpg/1280px-Igreja_de_Sant%27Ana.jpg', dur: '20 min', usd: 0, nota: 'La capilla blanca sobre la piedra, del siglo XVIII. Arriba hay un banco con la mejor vista de la Praia dos Ossos.' },
      { name: 'Rua das Pedras', zona: 'Centro', dur: '1 h', usd: 0, lat: -22.7553, lng: -41.8873, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Buzios-RuaPedras1.jpg/1280px-Buzios-RuaPedras1.jpg', nota: 'La calle peatonal de piedra del centro, que sigue a la Orla Bardot, con tiendas, bares y restaurantes. De día se camina tranquila; de noche es el centro de la vida nocturna de Búzios. Se llega a pie desde cualquier punto del centro.' },
      { name: 'Ponta da Lagoinha', zona: 'Entre Praia da Foca y Ferradura', dur: '1 h', usd: 0, lat: -22.7686, lng: -41.8774, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/PontaDaLagoinhaBBKW01.JPG/1280px-PontaDaLagoinhaBBKW01.JPG', nota: 'Una punta de rocas planas talladas por las olas, con piletas naturales y vista a las islas, dentro del Parque Estadual da Costa do Sol. Se llega por un sendero corto, de unos 500 metros, con poca señalización. Un cartel en el lugar explica la geología de las rocas.' },
      { name: 'Porto da Barra', zona: 'Manguinhos, 5 km del centro', dur: '1 h 30', lat: -22.7695, lng: -41.9125, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/ThiagoFreitas_Porto_da_Barra_Armacao_dos_Buzios_RJ_%2826181559517%29.jpg/1280px-ThiagoFreitas_Porto_da_Barra_Armacao_dos_Buzios_RJ_%2826181559517%29.jpg', nota: 'Un conjunto de bares y restaurantes frente a la Praia de Manguinhos, con un muelle sobre la bahía. Es uno de los lugares de Búzios para ver la puesta de sol, y de noche se llena. Tiene estacionamiento y queda a menos de 10 minutos en auto del centro; en finde y feriados conviene reservar mesa.' },
      { name: 'Forte São Mateus', zona: 'Cabo Frio, Praia do Forte, 20 km', dur: '1 h', usd: 0, lat: -22.8853, lng: -42.0079, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Forte_de_S%C3%A3o_Mateus_do_Cabo_Frio_01.jpg/1280px-Forte_de_S%C3%A3o_Mateus_do_Cabo_Frio_01.jpg', nota: 'Un fuerte colonial blanco sobre las rocas del extremo de la Praia do Forte, en Cabo Frio, protegido como patrimonio histórico nacional. Se sube por un camino corto entre las piedras y desde arriba se ven la playa, el canal de Itajuru y la Ilha do Japonês. La entrada es gratis; combinalo con un día en Cabo Frio.' }
    ],
    comer: [
      { name: 'Prato feito del centro', tipo: 'Almuerzo', zona: 'Calles de atrás de la Rua das Pedras', usd: 10, momento: 'Mediodía', nota: 'Arroz, feijão, ensalada y pescado del día. A dos cuadras de la rambla cuesta la mitad que en la Rua das Pedras.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro y Manguinhos', usd: 9, momento: 'De 11 a 15 h', nota: 'Bufé que se paga por peso. Es lo que comen los que trabajan en Búzios, y se elige solo lo que se quiere.' },
      { name: 'Pastel y caldo de cana', tipo: 'Merienda', zona: 'Centro y Manguinhos', usd: 4, momento: 'Tarde', nota: 'Pastel frito recién hecho con jugo de caña, en los puestos y bares chicos del pueblo. La merienda barata de la península.' },
      { name: 'Pescado frito en la playa', tipo: 'Cena', zona: 'Ossos y Manguinhos', usd: 16, momento: 'Noche', nota: 'Porción de pescado frito o casquinha de siri para compartir. Pedí la porción para dos: alcanza para tres.' },
      { name: 'Crepes en la Rua das Pedras', tipo: 'Cena', zona: 'Rua das Pedras', momento: 'Noche', nota: 'El clásico es Chez Michou, una crepería que funciona en la Rua das Pedras hace más de 30 años, con crepes dulces y saladas con rellenos abundantes. Siempre hay fila, sobre todo de noche.' },
      { name: 'Mariscos con vista en el Porto da Barra', tipo: 'Cena', zona: 'Manguinhos', momento: 'Atardecer', nota: 'Los restaurantes del Porto da Barra tienen mesas casi sobre la arena y mucho pescado y mariscos en la carta. Llegá antes de la puesta de sol y reservá en finde y feriados.' }
    ],
    hacer: [
      { name: 'Taxi-barco por las calas', zona: 'Sale de Ossos', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Praia_dos_Ossos_13.jpg/1280px-Praia_dos_Ossos_13.jpg', dur: '3 h', usd: 20, nota: 'Te deja en João Fernandes, Azeda o Tartaruga y te busca a la hora que digas. Sale más barato que el paseo en escuna y no vas con cien personas.' },
      { name: 'Snorkel en João Fernandes', zona: 'Norte', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Praia_de_Jo%C3%A3o_Fernandes_01.jpg/1280px-Praia_de_Jo%C3%A3o_Fernandes_01.jpg', dur: '2 h', usd: 0, nota: 'Con máscara propia y desde la orilla. El lado derecho de la playa, junto a las piedras, es donde hay más peces.' },
      { name: 'Atardecer en la Orla Bardot', zona: 'Centro', dur: '1 h', usd: 0, nota: 'El sol se pone sobre el mar del lado del pueblo. Los bares de la rambla se llenan; en la piedra de la punta hay lugar.' },
      { name: 'Paseo en escuna por las playas', zona: 'Sale del muelle del centro, en la Orla Bardot', dur: '2 h 30', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Passeio_de_Escuna.JPG/1280px-Passeio_de_Escuna.JPG', nota: 'El barco grande que recorre la costa norte de la península, con paradas para nadar en lugares como la Ilha Feia, João Fernandinho o Azeda. Es el paseo clásico para ver muchas playas de una vez. Antes de comprar, preguntá cuántas paradas hace y desde qué muelle sale.' },
      { name: 'Bautismo de buceo', zona: 'João Fernandinho y alrededores', dur: '2 a 4 h', nota: 'Buceo con tanque para quien nunca lo hizo, con instructor y equipo incluidos; algunas salidas son desde la playa y otras en barco. Los que ya tienen certificación pueden ir a puntos como la Ilha da Âncora o la Ilha Feia. Reservá con una operadora habilitada y confirmá la edad mínima.' },
      { name: 'Clase de surf en Geribá', zona: 'Geribá', dur: '1 a 3 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Top_view_of_waves_on_a_beach_%28Unsplash%29.jpg/1280px-Top_view_of_waves_on_a_beach_%28Unsplash%29.jpg', nota: 'Geribá tiene unos dos kilómetros de olas sobre fondo de arena y sirve para todos los niveles. Las escuelas llevan la tabla y el traje, empiezan con teoría en la arena y siguen en el agua. Las mejores olas entran con mar del sudeste; el finde hay mucha gente en el agua.' },
      { name: 'Kitesurf y windsurf en Manguinhos', zona: 'Manguinhos y Praia Rasa', dur: '2 h', nota: 'Por el viento nordeste, Manguinhos y la Praia Rasa son las playas de la vela, del kite y del windsurf en Búzios. Hay clubes y escuelas con clases según el viento del día. Si no practicás, se mira desde la arena o desde el muelle del Porto da Barra.' }
    ],
    tips: [
      { titulo: 'Las calas se llenan a media mañana', texto: 'Azeda, Forno y João Fernandes son chicas. En temporada, a las 11 ya no hay arena libre. Ir temprano y volver a comer al pueblo es el plan que funciona.' },
      { titulo: 'La Rua das Pedras es para mirar', texto: 'De noche es la calle más linda de Búzios y la más cara. Para comer conviene ir dos cuadras hacia adentro y volver a caminar por la rambla.' },
      { titulo: 'El agua es fría', texto: 'Búzios recibe corrientes del sur y el agua está bastante más fría que en el Nordeste, incluso en verano. Las calas del norte son las más tibias.' },
      { titulo: 'Salí de Río temprano', texto: 'Desde Río son unos 170 km por el Puente Río-Niterói y la Via Lagos, con peaje. Un viernes o una víspera de feriado el viaje puede tardar el doble o más: salí de mañana temprano o en día de semana.' },
      { titulo: 'Acordá la vuelta del taxi-barco', texto: 'Los taxis-barco salen de Ossos y del Cais do Mangue, en la Praia da Armação, hacia Azeda, João Fernandes, Tartaruga y Manguinhos. Antes de bajarte, preguntá hasta qué hora hay barco de vuelta.' },
      { titulo: 'Las vans paran donde les hacés seña', texto: 'Las vans recorren la avenida José Bento Ribeiro Dantas de punta a punta y paran si las llamás con la mano. No entran hasta las playas: contá con unos minutos de caminata.' },
      { titulo: 'No tenés que pagarle al cuidacoches', texto: 'Los cuidacoches de la calle no están registrados y no estás obligado a pagarles. En muchas playas el estacionamiento privado es del quiosco y no te cobran si consumís ahí.' }
    ]
  },

  arraial: {
    resumen: 'El agua más transparente del estado de Río, en playas a las que se llega caminando desde el pueblo o en un barco de pescadores.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 9], nota: 'En enero y Carnaval el pueblo recibe más gente de la que entra y los barcos a la Praia do Farol se agotan. De abril a junio y en septiembre el agua sigue clara, hay menos gente y los paseos salen sin espera.' },
    clima: {
      titulo: 'Clima en Arraial do Cabo mes por mes',
      intro: 'Arraial es de los lugares más secos de la costa de Río. Lo que más cambia es el agua: con viento del noreste se enfría de golpe.',
      meses: [
        { m: 'Ene', max: 29, min: 22, lluvia: 75, mar: 24.5, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 23, lluvia: 37, mar: 24.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 23, lluvia: 58, mar: 25.5, demanda: 'media' },
        { m: 'Abr', max: 28, min: 22, lluvia: 79, mar: 25, demanda: 'baja' },
        { m: 'May', max: 26, min: 20, lluvia: 74, mar: 23.5, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 19, lluvia: 48, mar: 22.5, demanda: 'baja' },
        { m: 'Jul', max: 25, min: 19, lluvia: 47, mar: 22, demanda: 'media' },
        { m: 'Ago', max: 24, min: 19, lluvia: 38, mar: 21.5, demanda: 'media' },
        { m: 'Sep', max: 24, min: 19, lluvia: 58, mar: 21.5, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 20, lluvia: 91, mar: 22, demanda: 'media' },
        { m: 'Nov', max: 27, min: 21, lluvia: 93, mar: 22.5, demanda: 'media' },
        { m: 'Dic', max: 28, min: 22, lluvia: 88, mar: 24, demanda: 'alta' }
      ],
      nota: 'Los promedios del agua no muestran la surgencia: con viento del noreste, más frecuente de septiembre a marzo, sube agua del fondo y el mar puede bajar de 18° por varios días. Para agua clara, tibia y menos gente: abril y mayo. En enero y Carnaval los barcos al Farol se agotan y los precios suben.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1961-1990 (estación Cabo Frio – Álcalis, en Arraial do Cabo). Temperatura del agua: promedio de los últimos 10 años según seatemperature.info.'
    },
    beaches: [
      { name: 'Praia dos Anjos', zona: 'Puerto', lat: -22.973, lng: -42.0206, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Praia_dos_Anjos.JPG/1280px-Praia_dos_Anjos.JPG', vibe: 'El puerto de los pescadores, de agua quieta y verde. Desde acá salen todos los barcos a la isla del Farol y a las playas sin calle.', cuando: 'Temprano, para salir en el primer barco.' },
      { name: 'Praia do Forno', zona: 'A pie desde Anjos', lat: -22.9661, lng: -42.0154, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Praia_do_Forno_-_Arraial.jpg/1280px-Praia_do_Forno_-_Arraial.jpg', vibe: 'Una bahía de agua transparente a la que se llega por un sendero de quince minutos detrás del puerto, o en barco. Sin calle y sin autos.', cuando: 'Mañana, antes de que lleguen los barcos de paseo.' },
      { name: 'Prainhas do Pontal do Atalaia', zona: 'Pontal do Atalaia', lat: -22.9688, lng: -41.9994, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Arraial_pontal_atalaia_1.jpg/1280px-Arraial_pontal_atalaia_1.jpg', vibe: 'Dos playas chicas entre piedras, con una escalera de madera que baja desde el mirador. Es la postal de Arraial y el agua parece de piscina.', cuando: 'Antes de las 10: después se arma fila en la escalera.' },
      { name: 'Praia Grande', zona: 'Centro', lat: -22.9707, lng: -42.0333, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Praia_Grande_-_Arraial_do_Cabo_-_panoramio_%2820%29.jpg/1280px-Praia_Grande_-_Arraial_do_Cabo_-_panoramio_%2820%29.jpg', vibe: 'La playa larga de mar abierto, de agua fría y muy clara. Hay olas y lugar de sobra: es donde va la gente del pueblo.', cuando: 'Tarde, para el atardecer.' },
      { name: 'Praia do Farol', zona: 'Ilha do Cabo Frio, en barco', lat: -23.0015, lng: -42.0038, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/VistaPraiadoFarol-Arraial_do_Cabo-feb2016.jpg/1280px-VistaPraiadoFarol-Arraial_do_Cabo-feb2016.jpg', vibe: 'Arena blanca y agua turquesa en una isla protegida por la Marina. Solo se llega con los barcos autorizados del puerto y la estadía es corta.', cuando: 'Días de mar calmo: con viento el barco no para en la isla.' },
      { name: 'Prainha', zona: 'Norte del centro, 1 km', lat: -22.959, lng: -42.024, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Prainha_Arraial_do_Cabo.jpg/1280px-Prainha_Arraial_do_Cabo.jpg', vibe: 'Una bahía chica de agua calma y transparente, con quioscos y lugar para familias. Es la playa más resguardada cerca del centro.', cuando: 'Mañana; los fines de semana de verano se llena.' },
      { name: 'Praia Brava', zona: 'Pontal do Atalaia, sendero desde la ruta, 3 km', lat: -22.982, lng: -42.025, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Praia_Brava_-_panoramio_%281%29.jpg/1280px-Praia_Brava_-_panoramio_%281%29.jpg', vibe: 'Mar abierto con olas fuertes entre cerros, a la que se baja por un sendero. Es la playa de los surfistas y no tiene servicios.', cuando: 'Para mirar o surfear; con olas grandes no es para nadar.' },
      { name: 'Praia do Pontal', zona: 'Norte, al final de la Praia Grande, 4 km', lat: -22.9401, lng: -42.0345, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Praia_do_Pontal_%28Arraial_do_Cabo%29.JPG/1280px-Praia_do_Pontal_%28Arraial_do_Cabo%29.JPG', vibe: 'El extremo norte de la Praia Grande, al pie del morro, con arena blanca y mar abierto. Hay menos gente que cerca del centro.', cuando: 'Tarde, en días sin viento sur.' }
    ],
    atracciones: [
      { name: 'Mirante do Pontal do Atalaia', zona: 'Pontal do Atalaia', lat: -22.9815, lng: -42.0291, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Costa_do_Sol_Pontal.jpg/1280px-Costa_do_Sol_Pontal.jpg', dur: '40 min', usd: 0, nota: 'El mirador sobre las Prainhas, con las dos bahías a los costados. Se llega en taxi o en una caminata en subida desde el centro.' },
      { name: 'Gruta Azul', zona: 'Ilha do Cabo Frio', lat: -23, lng: -42.0101, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/GrutaAzulArraialdoCaboBrasil-feb2016.jpg/1280px-GrutaAzulArraialdoCaboBrasil-feb2016.jpg', dur: '20 min', usd: 0, nota: 'Una cueva en la roca donde el agua se pone azul eléctrico. Se ve desde el barco, en el paseo que sale de Praia dos Anjos.' },
      { name: 'Igreja de Nossa Senhora dos Remédios', zona: 'Praia dos Anjos', lat: -22.9693, lng: -42.0195, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Igreja_de_Nossa_Senhora_dos_Rem%C3%A9dios_em_Arraial_do_Cabo.jpg/1280px-Igreja_de_Nossa_Senhora_dos_Rem%C3%A9dios_em_Arraial_do_Cabo.jpg', dur: '20 min', usd: 0, nota: 'La iglesia de los pescadores, del siglo XVI, frente al puerto. Al lado está el mercado de pescado.' }
    ],
    comer: [
      { name: 'Pescado del día en el puerto', tipo: 'Almuerzo', zona: 'Praia dos Anjos', usd: 12, momento: 'Mediodía', nota: 'Los restaurantes frente al puerto sirven lo que entró esa mañana, frito o a la plancha, con arroz y pirão.' },
      { name: 'Prato feito', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'El plato del día de los bares del centro, lejos de la rambla. Es la comida barata del pueblo.' },
      { name: 'Açaí en la plaza', tipo: 'Merienda', zona: 'Centro', usd: 5, momento: 'Tarde', nota: 'Bowl de açaí con banana y granola. Después de un día de playa es lo que pide todo el mundo.' }
    ],
    hacer: [
      { name: 'Paseo en barco a la isla del Farol', zona: 'Sale de Praia dos Anjos', dur: '4 h', usd: 20, nota: 'Recorre Forno, Prainhas, Gruta Azul y para en la Praia do Farol. Elegí barco chico y preguntá cuánto tiempo paran en la isla.' },
      { name: 'Sendero a la Praia do Forno', zona: 'Praia dos Anjos', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Arraial_do_Cabo-RJ_Trilha_da_Praia_do_Forno.jpg/1280px-Arraial_do_Cabo-RJ_Trilha_da_Praia_do_Forno.jpg', dur: '1 h', usd: 0, nota: 'Sube por detrás del puerto y baja a la bahía. Corto, con piedra suelta: zapatillas, no ojotas.' },
      { name: 'Buceo bautismo', zona: 'Praia dos Anjos', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Diving_in_Arraial_do_Cabo_01.JPG/1280px-Diving_in_Arraial_do_Cabo_01.JPG', dur: '3 h', usd: 60, nota: 'Arraial es la capital del buceo del país por la claridad del agua. El bautismo con instructor no necesita curso previo.' }
    ],
    tips: [
      { titulo: 'El agua es fría, y por eso es clara', texto: 'Frente a Arraial sube agua fría del fondo del mar (la surgencia), y eso la deja transparente. Incluso en verano puede estar cerca de los 18 grados: es normal.' },
      { titulo: 'El barco, temprano', texto: 'Los paseos salen desde las 9 y en temporada se agotan. Reservalo el día anterior en el puerto y pagá en efectivo para conseguir mejor precio.' },
      { titulo: 'El viento decide el día', texto: 'Con viento del nordeste la Praia Grande queda calma y con el agua más fría. Con viento sur se agita, y conviene ir a las playas del lado del puerto. Mirá el viento antes de elegir playa.' }
    ]
  },

  cabo: {
    resumen: 'La ciudad más grande de la Región de los Lagos: playa larga de arena blanca, dunas y calas con agua clara a pocos minutos del centro.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 9], nota: 'En verano y fines de semana largos la ciudad se llena con gente de Río y la Praia do Forte no tiene lugar. De abril a junio y en septiembre hay sol, agua clara y precios de temporada baja.' },
    clima: {
      titulo: 'Clima en Cabo Frio mes por mes',
      intro: 'Cabo Frio tiene poca lluvia y viento casi constante. El agua es más fría que en Río y cambia con el viento.',
      meses: [
        { m: 'Ene', max: 29, min: 22, lluvia: 75, mar: 24.5, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 23, lluvia: 37, mar: 25, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 23, lluvia: 58, mar: 25.5, demanda: 'media' },
        { m: 'Abr', max: 28, min: 22, lluvia: 79, mar: 25, demanda: 'baja' },
        { m: 'May', max: 26, min: 20, lluvia: 74, mar: 23.5, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 19, lluvia: 48, mar: 22.5, demanda: 'baja' },
        { m: 'Jul', max: 25, min: 19, lluvia: 47, mar: 22, demanda: 'media' },
        { m: 'Ago', max: 24, min: 19, lluvia: 38, mar: 21.5, demanda: 'media' },
        { m: 'Sep', max: 24, min: 19, lluvia: 58, mar: 21.5, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 20, lluvia: 91, mar: 22, demanda: 'media' },
        { m: 'Nov', max: 27, min: 21, lluvia: 93, mar: 23, demanda: 'media' },
        { m: 'Dic', max: 28, min: 22, lluvia: 88, mar: 24, demanda: 'alta' }
      ],
      nota: 'Para playa con sol, agua más tibia y precios bajos: abril y mayo. De junio a septiembre casi no llueve, pero el agua baja a 21-22°. En verano y fines de semana largos llega mucha gente de Río y la Praia do Forte se llena; con viento del noreste el agua se enfría de golpe.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1961-1990 (estación Cabo Frio – Álcalis, en Arraial do Cabo). Temperatura del agua: promedio de los últimos 10 años según seatemperature.info.'
    },
    beaches: [
      { name: 'Praia do Forte', zona: 'Centro', lat: -22.8866, lng: -42.0182, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Praia_do_Forte_-_Cabo_Frio_-_RJ_-_panoramio.jpg/1280px-Praia_do_Forte_-_Cabo_Frio_-_RJ_-_panoramio.jpg', vibe: 'La playa principal, larga y de arena muy blanca, con el fuerte de São Mateus en la punta. Agua fría y clara, con olas suaves.', cuando: 'Mañana. En verano, de tarde no hay dónde poner la sombrilla.' },
      { name: 'Ilha do Japonês', zona: 'Canal de Itajuru', lat: -22.8814, lng: -42.0049, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Ilha_do_Japon%C3%AAs_em_Cabo_Frio%2C_Regi%C3%A3o_dos_lagos-RJ.JPG/960px-Ilha_do_Japon%C3%AAs_em_Cabo_Frio%2C_Regi%C3%A3o_dos_lagos-RJ.JPG', vibe: 'Una isla chica en el canal, con agua bajita y tibia. Se cruza en bote desde el Bairro da Passagem o caminando con marea baja.', cuando: 'Marea baja: el agua llega a la cintura.' },
      { name: 'Praia das Conchas', zona: 'Peró', lat: -22.8697, lng: -41.9831, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Mirante_da_Praia_das_Conchas_-_Cabo_Frio._%286894111536%29.jpg/960px-Mirante_da_Praia_das_Conchas_-_Cabo_Frio._%286894111536%29.jpg', vibe: 'Una cala con forma de herradura y agua muy calma, entre piedras. Ideal para nadar sin olas.', cuando: 'Todo el día; es más tranquila entre semana.' },
      { name: 'Praia do Peró', zona: 'Norte', lat: -22.845, lng: -41.9839, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Praia_do_Per%C3%B3%2C_no_Parque_Estadual_da_costa_do_Sol_em_Cabo_Frio-RJ.JPG/960px-Praia_do_Per%C3%B3%2C_no_Parque_Estadual_da_costa_do_Sol_em_Cabo_Frio-RJ.JPG', vibe: 'Una playa larga dentro del parque estatal, con dunas detrás y sin edificios. Hay lugar aunque la ciudad esté llena.', cuando: 'Tarde. El viento sube después del mediodía y llegan los kitesurfistas.' },
      { name: 'Praia das Dunas', zona: 'Sur del centro', lat: -22.8963, lng: -42.0273, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Praia_das_Dunas%2C_Cabo_Frio_em_2013.jpg/1280px-Praia_das_Dunas%2C_Cabo_Frio_em_2013.jpg', vibe: 'Dunas altas de arena blanca y mar abierto. Es la continuación de la Praia do Forte, sin la gente.', cuando: 'Mañana. Llevá agua: hay pocos servicios en la orilla.' },
      { name: 'Praia do Siqueira', zona: 'Lagoa de Araruama, 4 km', lat: -22.8765, lng: -42.0527, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Praia_do_Siqueira_-_Parque_Estadual_da_Costa_do_Sol_-_Cabo_Frio%2CRJ.JPG/1280px-Praia_do_Siqueira_-_Parque_Estadual_da_Costa_do_Sol_-_Cabo_Frio%2CRJ.JPG', vibe: 'Una playa de laguna, sobre la Lagoa de Araruama, con agua bajita y sin olas. No es la del mar transparente: es la del atardecer.', cuando: 'Atardecer: el sol se pone sobre la laguna.' }
    ],
    atracciones: [
      { name: 'Forte São Mateus', zona: 'Praia do Forte', lat: -22.8828, lng: -42.0136, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/CaboFrio_Forte_de_S%C3%A3o_Matheus.JPG/1280px-CaboFrio_Forte_de_S%C3%A3o_Matheus.JPG', dur: '30 min', usd: 0, nota: 'El fuerte del siglo XVII sobre las piedras de la punta. Desde arriba se ve toda la Praia do Forte.' },
      { name: 'Bairro da Passagem', zona: 'Centro', lat: -22.8755, lng: -42.0083, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/CaboFrio_Rua_Manoel_Ant%C3%B4nio_Ribeiro.JPG/1280px-CaboFrio_Rua_Manoel_Ant%C3%B4nio_Ribeiro.JPG', dur: '1 h', usd: 0, nota: 'El barrio colonial junto al canal, con casas bajas y la capilla de São Benedito. De la orilla salen los botes a la Ilha do Japonês.' },
      { name: 'Morro da Guia', zona: 'Centro', lat: -22.8789, lng: -42.0231, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Cabo_Frio_RJ_Brasil_-_Capela_N.S._da_Guia%2C_mirante_Morro_da_Guia_-_panoramio.jpg/1280px-Cabo_Frio_RJ_Brasil_-_Capela_N.S._da_Guia%2C_mirante_Morro_da_Guia_-_panoramio.jpg', dur: '45 min', usd: 0, nota: 'La capilla del siglo XVIII sobre un cerro, con vista al canal y a las salinas.' }
    ],
    comer: [
      { name: 'Comida por kilo del centro', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso a dos cuadras de la playa. Es el almuerzo de quien vive en la ciudad.' },
      { name: 'Pescado en el canal', tipo: 'Cena', zona: 'Rua dos Biquínis / Passagem', usd: 15, momento: 'Noche', nota: 'Porción de pescado o camarón para compartir en los bares sobre el canal de Itajuru.' },
      { name: 'Milho cozido y queijo coalho', tipo: 'Merienda', zona: 'En la arena', usd: 3, momento: 'Toda la tarde', nota: 'Choclo hervido y queso a la brasa que venden los ambulantes. La merienda de playa más barata.' }
    ],
    hacer: [
      { name: 'Paseo en barco por las islas', zona: 'Sale del canal', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Canal_de_Cabo_Frio_de_onde_sai_os_barcos_para_passeios_pela_regi%C3%A3o_-_Rj._%288700502486%29.jpg/1280px-Canal_de_Cabo_Frio_de_onde_sai_os_barcos_para_passeios_pela_regi%C3%A3o_-_Rj._%288700502486%29.jpg', dur: '2 h', usd: 15, nota: 'Recorre la Ilha do Japonês, la Praia do Forte y las calas de la costa. Elegí barco chico y preguntá si para a nadar.' },
      { name: 'Caminata por las dunas', zona: 'Praia das Dunas', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Dunas_de_Cabo_Frio.JPG/1280px-Dunas_de_Cabo_Frio.JPG', dur: '1 h 30', usd: 0, nota: 'Desde el final de la Praia do Forte hacia el sur, por arriba de las dunas. Mejor al atardecer.' },
      { name: 'Rua dos Biquínis', zona: 'Gamboa', dur: '1 h', usd: 0, nota: 'Una calle entera de fábricas de bikinis que venden directo. Los precios son de fábrica, no de shopping.' }
    ],
    tips: [
      { titulo: 'Cabo Frio sirve de base', texto: 'Arraial do Cabo está a 15 km y Búzios a 25 km. Si te alojás en Cabo Frio, se llega a las dos en ómnibus.' },
      { titulo: 'Fin de semana, otra ciudad', texto: 'Los sábados y domingos llega la gente de Río y el tránsito en la entrada es de horas. Las playas lejanas, como el Peró, se aprovechan mejor entre semana.' },
      { titulo: 'El agua es clara pero fría', texto: 'Igual que en Arraial, la corriente fría del fondo deja el agua transparente y a menos de 20 grados en algunos días de verano.' }
    ]
  },

  ilha: {
    resumen: 'Una isla sin autos, con selva hasta el agua. Todo se hace a pie o en barco desde la Vila do Abraão, y las mejores playas están a una caminata de distancia.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 8, 9], nota: 'De diciembre a febrero llueve casi todas las tardes y la Vila do Abraão se llena. De abril a junio y en septiembre los senderos están secos, el agua sigue tibia y los barcos salen sin espera.' },
    clima: {
      titulo: 'Clima en Ilha Grande mes por mes',
      intro: 'Ilha Grande tiene calor y agua tibia en verano, pero también mucha lluvia. Los senderos cambian mucho según la época.',
      meses: [
        { m: 'Ene', max: 30, min: 23, lluvia: 236, mar: 26.5, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 23, lluvia: 189, mar: 27, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 23, lluvia: 206, mar: 26.5, demanda: 'media' },
        { m: 'Abr', max: 28, min: 21, lluvia: 167, mar: 25.5, demanda: 'media' },
        { m: 'May', max: 26, min: 19, lluvia: 114, mar: 24, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 18, lluvia: 72, mar: 22.5, demanda: 'baja' },
        { m: 'Jul', max: 24, min: 17, lluvia: 90, mar: 22, demanda: 'media' },
        { m: 'Ago', max: 24, min: 17, lluvia: 54, mar: 21.5, demanda: 'baja' },
        { m: 'Sep', max: 25, min: 18, lluvia: 121, mar: 22, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 19, lluvia: 142, mar: 22.5, demanda: 'media' },
        { m: 'Nov', max: 27, min: 21, lluvia: 149, mar: 23.5, demanda: 'media' },
        { m: 'Dic', max: 28, min: 22, lluvia: 258, mar: 25, demanda: 'alta' }
      ],
      nota: 'De diciembre a marzo llueven más de 180 mm por mes, casi siempre en chaparrones de tarde, y los senderos se embarran. De mayo a septiembre llueve mucho menos y se camina mejor, aunque el agua baja a 22°. Abril y mayo juntan agua tibia, senderos más secos y precios bajos.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1981-2010 (estación Angra dos Reis). Temperatura del agua: promedio de los últimos 10 años según seatemperature.info. Es la estación oficial más cercana; la isla pertenece a Angra.'
    },
    beaches: [
      { name: 'Praia Preta', zona: 'A pie desde Abraão', lat: -23.1318, lng: -44.1699, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/PraiaPreta-IlhaGrande1.jpg/1280px-PraiaPreta-IlhaGrande1.jpg', vibe: 'Una playa de arena oscura a diez minutos del muelle, con las ruinas del antiguo lazareto al lado. Agua calma y sombra de árboles.', cuando: 'Cualquier momento; ideal el primer día, recién llegado.' },
      { name: 'Abraãozinho', zona: 'Sendero o taxi-barco', lat: -23.1349, lng: -44.1516, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Praia_do_Abra%C3%A3ozinho.jpg/1280px-Praia_do_Abra%C3%A3ozinho.jpg', vibe: 'Una cala chica de agua transparente, a media hora a pie por la costa. Hay un solo bar y casi siempre lugar.', cuando: 'Mañana; de tarde llegan los taxi-barcos.' },
      { name: 'Palmas', zona: 'Sendero T10', lat: -23.1458, lng: -44.139, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Praia_de_Palmas%2C_Ilha_Grande%2C_Angra_dos_Reis.jpg/1280px-Praia_de_Palmas%2C_Ilha_Grande%2C_Angra_dos_Reis.jpg', vibe: 'Playa tranquila con un pueblito de pescadores, de camino a Lopes Mendes. Buen lugar para almorzar pescado y seguir caminando.', cuando: 'Mediodía, como parada del sendero.' },
      { name: 'Lopes Mendes', zona: 'Costa sur, sendero o barco + sendero', lat: -23.172, lng: -44.138, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Ilha_Grande_-_Lopes_Mendes_-_panoramio_%2816%29.jpg/1280px-Ilha_Grande_-_Lopes_Mendes_-_panoramio_%2816%29.jpg', vibe: 'Tres kilómetros de arena blanca que cruje al pisar y mar abierto con olas. Es la playa más famosa de la isla y aun así nunca parece llena.', cuando: 'Día entero. Volvé con tiempo: el último taxi-barco de Pouso sale a media tarde.' },
      { name: 'Dois Rios', zona: 'Costa sur, 8 km por camino de tierra', lat: -23.1844, lng: -44.1895, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Dois_Rios_-_panoramio_%289%29.jpg/1280px-Dois_Rios_-_panoramio_%289%29.jpg', vibe: 'Una playa larga entre dos ríos, al lado de lo que fue el presidio de la isla. Casi sin gente y con agua dulce para sacarse la sal.', cuando: 'Día entero de caminata. Llevá comida y agua.' },
      { name: 'Lagoa Azul', zona: 'Norte de la isla, en barco', lat: -23.0831, lng: -44.2291, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Lagoa_Azul_%2831358908884%29.jpg/1280px-Lagoa_Azul_%2831358908884%29.jpg', vibe: 'No es una playa sino una bahía de agua quieta entre islotes, llena de peces. Se nada con máscara desde el barco.', cuando: 'Mañana, con mar calmo, en el paseo de barco.' },
      { name: 'Saco do Céu', zona: 'Norte de la isla, en barco o taxi-barco', lat: -23.105, lng: -44.205, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Saco_do_Ceu_Ilha_Grande_RJ_-_panoramio.jpg/960px-Saco_do_Ceu_Ilha_Grande_RJ_-_panoramio.jpg', vibe: 'Una ensenada cerrada de agua verde y tan quieta que de noche refleja las estrellas, de ahí el nombre. Casi no hay arena: se nada desde el barco o desde los muelles de los restaurantes de la orilla.', cuando: 'Mediodía, como parada del paseo a Lagoa Azul; o de noche, para ver el cielo reflejado.' },
      { name: 'Caxadaço', zona: 'Costa sur, sendero desde Dois Rios', lat: -23.1743, lng: -44.163, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Caxada%C3%A7o_-_Ilha_Grande_-_panoramio.jpg/1280px-Caxada%C3%A7o_-_Ilha_Grande_-_panoramio.jpg', vibe: 'Una cala chica cerrada por piedras, con agua transparente y quieta: de lo mejor de la isla para snorkel. Desde Dois Rios es alrededor de una hora de sendero.', cuando: 'Mañana, combinado con Dois Rios. Llevá máscara, comida y agua: no hay ningún servicio.' },
      { name: 'Parnaioca', zona: 'Costa sur, sendero desde Dois Rios o barco', lat: -23.1934, lng: -44.2507, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/Praia_do_Parnaioca%2C_Ilha_Grande_Gabrielle_Patitucci_%2801%29.jpg/1280px-Praia_do_Parnaioca%2C_Ilha_Grande_Gabrielle_Patitucci_%2801%29.jpg', vibe: 'Una playa larga y casi vacía donde un río de agua oscura se junta con el mar. Viven pocas familias y hay un par de campings. Se llega por el sendero desde Dois Rios, unas cuatro horas, o en las lanchas que dan la vuelta a la isla.', cuando: 'Día entero, o mejor quedándose a dormir en camping. Salí temprano: a la vuelta no hay cómo acortar camino.' },
      { name: 'Aventureiro', zona: 'Costa sur, en barco', lat: -23.1877, lng: -44.3185, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Praia_do_Aventureiro_em_Ilha_Grande.jpg/1280px-Praia_do_Aventureiro_em_Ilha_Grande.jpg', vibe: 'La playa del cocotero acostado sobre la arena, en una reserva donde vive una comunidad caiçara. Es el rincón más aislado de la isla: se llega en barco y la cantidad de visitantes por día está limitada.', cuando: 'Con mar calmo: con mar de fondo los barcos no entran. Para dormir hay que reservar el camping con anticipación.' },
      { name: 'Praia do Abraão', zona: 'Vila do Abraão, junto al muelle', lat: -23.1404, lng: -44.1672, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Praia_Abr%C3%A3o.JPG/1280px-Praia_Abr%C3%A3o.JPG', vibe: 'La playa del pueblo, frente a los barcos fondeados y con la iglesia de São Sebastião detrás. El agua es quieta, pero hay mucho movimiento de lanchas.', cuando: 'Atardecer, cuando vuelven los barcos.' },
      { name: 'Praia do Canto', zona: 'Vila do Abraão, 10 min a pie', lat: -23.1419, lng: -44.1636, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Praia_do_Canto.jpg/1280px-Praia_do_Canto.jpg', vibe: 'La punta este del pueblo, con posadas y bares sobre la arena y agua calma. Tiene menos lanchas que la playa del muelle.', cuando: 'Tarde.' },
      { name: 'Praia da Júlia', zona: 'A pie desde Abraão, 15 min por la costa', lat: -23.1411, lng: -44.1605, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Praia_da_J%C3%BAlia.jpg/1280px-Praia_da_J%C3%BAlia.jpg', vibe: 'Una cala chica de arena clara y agua quieta, sobre el camino de la costa hacia Abraãozinho.', cuando: 'Mañana, de camino a Abraãozinho.' },
      { name: 'Praia da Feiticeira', zona: 'Norte, sendero desde Abraão o taxi-barco', lat: -23.1211, lng: -44.1864, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Praia_da_Feiticeira%2C_Ilha_Grande.jpg/1280px-Praia_da_Feiticeira%2C_Ilha_Grande.jpg', vibe: 'Una playa tranquila de agua clara rodeada de selva, cerca del sendero a la Cachoeira da Feiticeira.', cuando: 'Mediodía, combinada con la cascada.' },
      { name: 'Pouso', zona: 'Sendero T10, antes de Lopes Mendes', lat: -23.1593, lng: -44.1384, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Praia_do_Pouso_-_Ilha_grande.jpg/1280px-Praia_do_Pouso_-_Ilha_grande.jpg', vibe: 'Una ensenada de agua calma con muelle, donde paran los taxi-barcos. Desde acá se camina unos 20 minutos hasta Lopes Mendes.', cuando: 'Mediodía, como parada camino a Lopes Mendes.' },
      { name: 'Japariz', zona: 'Norte de la isla, en barco o sendero', lat: -23.0919, lng: -44.2139, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Japariz_-_Ilha_Grande.JPG/1280px-Japariz_-_Ilha_Grande.JPG', vibe: 'Una ensenada de agua quieta con muelles y restaurantes. Es la parada de almuerzo de muchos paseos a Lagoa Azul.', cuando: 'Mediodía, en el paseo de barco.' },
      { name: 'Freguesia de Santana', zona: 'Norte de la isla, en barco', lat: -23.0888, lng: -44.2349, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/FreguesiaSantana6.jpg/1280px-FreguesiaSantana6.jpg', vibe: 'Una playa de agua calma con muelle y una iglesia colonial en la orilla. Es una de las paradas del paseo por la costa norte.', cuando: 'En el paseo de barco, con mar calmo.' },
      { name: 'Lagoa Verde', zona: 'Costa norte, en barco', lat: -23.1401, lng: -44.3239, foto: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Lagoa_Verde_em_Ilha_Grande-RJ-Brasil_%281376956558%29.jpg', vibe: 'No es una playa sino una pileta natural de agua verde entre la isla y un islote, con muchos peces. Se nada con máscara desde el barco.', cuando: 'Mañana, con mar calmo, en el paseo de barco.' },
      { name: 'Praia do Leste', zona: 'Costa sur, junto a la Praia do Sul, en barco o sendero', lat: -23.179, lng: -44.2774, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Praia_do_Leste_-_Ilha_Grande_-_Brasil_-_panoramio.jpg/1280px-Praia_do_Leste_-_Ilha_Grande_-_Brasil_-_panoramio.jpg', vibe: 'Una playa larga de arena blanca y mar abierto, dentro de la reserva biológica de la Praia do Sul. Casi sin gente y sin servicios.', cuando: 'Con mar calmo. Llevá agua y comida.' },
      { name: 'Provetá', zona: 'Costa sur, en barco', lat: -23.1817, lng: -44.343, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Provet%C3%A1_-_Ilha_Grande.JPG/1280px-Provet%C3%A1_-_Ilha_Grande.JPG', vibe: 'Una bahía en forma de herradura con un pueblo de pescadores, el más grande de la isla después de Abraão. El agua de la bahía es calma.', cuando: 'Día entero, con mar calmo para el barco.' }
    ],
    atracciones: [
      { name: 'Aqueduto y Cachoeira da Feiticeira', zona: 'A pie desde Abraão', lat: -23.1335, lng: -44.1731, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Aqueduto%2C_Ilha_Grande.jpg/1280px-Aqueduto%2C_Ilha_Grande.jpg', dur: '2 h', usd: 0, nota: 'El acueducto de piedra del siglo XIX en medio de la selva, y una cascada con pozo para bañarse un poco más arriba.' },
      { name: 'Ruínas do Lazareto', zona: 'Praia Preta', lat: -23.131, lng: -44.1707, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/20210116081318_ru%C3%ADnas_lazareto_ilha_grande.jpg/1280px-20210116081318_ru%C3%ADnas_lazareto_ilha_grande.jpg', dur: '30 min', usd: 0, nota: 'Lo que queda del antiguo hospital de cuarentena, entre la selva y el mar. De camino a la Praia Preta.' },
      { name: 'Igreja de São Sebastião', zona: 'Vila do Abraão', lat: -23.1404, lng: -44.1685, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/VilaAbraaoChurch3.jpg/1280px-VilaAbraaoChurch3.jpg', dur: '15 min', usd: 0, nota: 'La iglesia blanca frente al muelle, la foto de llegada de la isla.' }
    ],
    comer: [
      { name: 'Prato feito de la Vila', tipo: 'Almuerzo', zona: 'Calles de adentro de Abraão', usd: 10, momento: 'Mediodía', nota: 'Pescado, arroz, feijão y ensalada. Una cuadra hacia adentro desde la orilla cuesta bastante menos.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila do Abraão', usd: 9, momento: 'De 11 a 15 h', nota: 'Bufé por peso, lo más barato para comer bien antes de un sendero.' },
      { name: 'Pescado en Palmas', tipo: 'Almuerzo', zona: 'Praia de Palmas', usd: 14, momento: 'Mediodía', nota: 'Los bares de pescadores de Palmas sirven el pescado del día de camino a Lopes Mendes.' }
    ],
    hacer: [
      { name: 'Sendero a Lopes Mendes', zona: 'Abraão → Pouso → Lopes Mendes', foto: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Trilha_Lopes_Mendes_-_Palmas_-_panoramio.jpg', dur: '2 h 30', usd: 0, nota: 'El sendero T10 cruza la selva por Palmas y Pouso. Se puede ir caminando y volver en taxi-barco desde Pouso.' },
      { name: 'Paseo de barco a Lagoa Azul', zona: 'Sale del muelle', foto: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Lagoa_Azul_e_Barco.jpg', dur: '6 h', usd: 30, nota: 'Para en Lagoa Azul, Lagoa Verde y playas del norte. Se nada con máscara en aguas quietas.' },
      { name: 'Pico do Papagaio', zona: 'Centro de la isla', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Pico_do_Papagaio%2C_Ilha_Grande.jpg/1280px-Pico_do_Papagaio%2C_Ilha_Grande.jpg', dur: '6 h', usd: 0, nota: 'La caminata más dura de la isla: casi mil metros de subida. Solo con guía y saliendo de madrugada para ver el amanecer.' }
    ],
    tips: [
      { titulo: 'Algo de efectivo, por las dudas', texto: 'En Abraão la mayoría de los comercios aceptan tarjeta, pero hay pocos cajeros. Llevá algo de efectivo por las dudas, para barcos y puestos chicos.' },
      { titulo: 'El último barco manda', texto: 'Los taxi-barcos de vuelta desde Pouso y Lopes Mendes tienen último horario. Preguntalo al salir: perderlo es caminar dos horas de noche por la selva.' },
      { titulo: 'Lluvia de tarde en verano', texto: 'En verano llueve casi todas las tardes. Los senderos se hacen de mañana y la tarde se deja para la Vila.' }
    ]
  },

  paraty: {
    resumen: 'Un pueblo colonial de calles de piedra frente a una bahía con islas. Las playas del pueblo son tranquilas; las de agua clara están a un barco o a un ómnibus de distancia.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 8, 9], nota: 'De diciembre a marzo llueve fuerte casi todas las tardes y con marea alta el agua entra en las calles del centro. Entre mayo y septiembre hay menos lluvia y días claros; fuera de las vacaciones de julio, los precios son más bajos.' },
    clima: {
      titulo: 'Clima en Paraty mes por mes',
      intro: 'Paraty es caluroso y húmedo en verano y templado en invierno. La lluvia es lo que más cambia de un mes a otro.',
      meses: [
        { m: 'Ene', max: 30, min: 23, lluvia: 236, mar: 27, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 23, lluvia: 189, mar: 27.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 23, lluvia: 206, mar: 27, demanda: 'media' },
        { m: 'Abr', max: 28, min: 21, lluvia: 167, mar: 26, demanda: 'media' },
        { m: 'May', max: 26, min: 19, lluvia: 114, mar: 24, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 18, lluvia: 72, mar: 23, demanda: 'baja' },
        { m: 'Jul', max: 24, min: 17, lluvia: 90, mar: 22, demanda: 'media' },
        { m: 'Ago', max: 24, min: 17, lluvia: 54, mar: 22, demanda: 'baja' },
        { m: 'Sep', max: 25, min: 18, lluvia: 121, mar: 22.5, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 19, lluvia: 142, mar: 23, demanda: 'media' },
        { m: 'Nov', max: 27, min: 21, lluvia: 149, mar: 24, demanda: 'media' },
        { m: 'Dic', max: 28, min: 22, lluvia: 258, mar: 25.5, demanda: 'alta' }
      ],
      nota: 'De diciembre a marzo llueve fuerte casi todas las tardes y el agua está a 27°. Entre mayo y septiembre hay menos lluvia y días claros para recorrer el centro y las cascadas, con el agua a 22°. Fuera de las vacaciones de julio, mayo, junio, agosto y septiembre son los meses más baratos.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1981-2010 (estación Angra dos Reis). Temperatura del agua: promedio de los últimos 10 años según seatemperature.info. Es la estación oficial más cercana, a unos 45 km; en Paraty suele llover algo más.'
    },
    beaches: [
      { name: 'Praia do Pontal', zona: 'Cruzando el puente del centro', lat: -23.2151, lng: -44.7115, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Turistas_na_Praia_do_Pontal_-_Paraty%28RJ%29.jpg/1280px-Turistas_na_Praia_do_Pontal_-_Paraty%28RJ%29.jpg', vibe: 'La playa del pueblo, con bares sobre la arena y vista a la bahía. No es la del agua clara: es la de la cerveza al atardecer.', cuando: 'Atardecer.' },
      { name: 'Jabaquara', zona: 'Norte del centro', lat: -23.2131, lng: -44.7146, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Praia_do_Jabaquara_-_Paraty_%284157533641%29.jpg/1280px-Praia_do_Jabaquara_-_Paraty_%284157533641%29.jpg', vibe: 'Agua bajita y quieta, con barro de manglar en una punta que la gente usa como mascarilla. La playa de las familias.', cuando: 'Mañana, con marea alta para poder nadar.' },
      { name: 'Praia Vermelha', zona: 'En barco por la bahía', lat: -23.1959, lng: -44.6446, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Praia_Vermelha_-_Paraty.jpg/1280px-Praia_Vermelha_-_Paraty.jpg', vibe: 'Arena rojiza y agua verde y quieta, frente a una isla. Solo se llega en barco o por un sendero desde la ruta.', cuando: 'En el paseo de barco por la bahía.' },
      { name: 'Praia do Meio (Trindade)', zona: 'Trindade, 25 km por ruta', lat: -23.3536, lng: -44.7264, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Praia_do_Meio_Trindade_Paraty_BR.jpg/1280px-Praia_do_Meio_Trindade_Paraty_BR.jpg', vibe: 'Una cala entre piedras gigantes con agua quieta, en el pueblo hippie de Trindade. Al lado está la piscina natural del Cachadaço.', cuando: 'Mañana. En verano el estacionamiento se llena a las 10.' },
      { name: 'Cachadaço', zona: 'Trindade, 25 km por ruta', lat: -23.3568, lng: -44.7309, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Cachada%C3%A7o_Paraty.jpg/1280px-Cachada%C3%A7o_Paraty.jpg', vibe: 'Una playa salvaje con una piscina natural entre rocas a la que se llega por un sendero desde la Praia do Meio.', cuando: 'Marea baja: con marea alta la piscina se mezcla con el mar.' },
      { name: 'Praia do Sono', zona: 'Sendero desde Laranjeiras, 25 km por ruta', lat: -23.3342, lng: -44.6326, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Praia_Sono.jpg/960px-Praia_Sono.jpg', vibe: 'Una playa larga sin calle, con una comunidad de pescadores y camping. Se llega con una caminata de una hora por la selva.', cuando: 'Día entero. Volvé antes de que oscurezca.' },
      { name: 'Praia Brava (Trindade)', zona: 'Trindade, sendero desde la ruta, 25 km', lat: -23.3407, lng: -44.7024, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Paraty_RJ_Vila_de_Trindade_Brava_07.jpg/1280px-Paraty_RJ_Vila_de_Trindade_Brava_07.jpg', vibe: 'Mar abierto con olas y piedras, rodeado de selva, al que se baja por un sendero antes de llegar a Trindade. No tiene servicios.', cuando: 'Para mirar; nadá solo con mar calmo.' },
      { name: 'Praia do Cepilho', zona: 'Trindade, entrada del pueblo, 25 km', lat: -23.3445, lng: -44.7139, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Paraty_RJ_Vila_de_Trindade_Cepilho.jpg/1280px-Paraty_RJ_Vila_de_Trindade_Cepilho.jpg', vibe: 'La primera playa de Trindade, con olas y piedras grandes en las puntas. Es la de los surfistas del pueblo.', cuando: 'Mañana; con olas, mejor para surf que para nadar.' },
      { name: 'Praia dos Ranchos (Trindade)', zona: 'Trindade, frente al pueblo, 25 km', lat: -23.3506, lng: -44.7215, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Trindade_Praia_de_Fora_2.jpg/1280px-Trindade_Praia_de_Fora_2.jpg', vibe: 'La playa principal de Trindade, también llamada Praia de Fora, con bares sobre la arena y piedras gigantes en una punta.', cuando: 'Tarde, después de la Praia do Meio.' },
      { name: 'Ponta Negra', zona: 'Reserva de la Juatinga, en barco o sendero', lat: -23.3476, lng: -44.6072, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Praia_de_Ponta_Negra-_Paraty.jpg/1280px-Praia_de_Ponta_Negra-_Paraty.jpg', vibe: 'Una playa de comunidad caiçara entre piedras y selva, con un río que forma un pozo junto al mar. Se llega en barco o por un sendero de varias horas desde Laranjeiras.', cuando: 'Para quedarse a dormir; el barco solo entra con mar calmo.' },
      { name: 'Praia Grande da Cajaíba', zona: 'Península de la Juatinga, en barco', lat: -23.2674, lng: -44.5825, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Grande_da_Caja%C3%ADba.JPG/1280px-Grande_da_Caja%C3%ADba.JPG', vibe: 'Una playa larga de agua calma, con pocas casas de pescadores y camping. No hay calle: se llega en barco.', cuando: 'Con mar calmo, en barco desde Paraty o Paraty-Mirim.' },
      { name: 'Martim de Sá', zona: 'Punta de la Juatinga, sendero o barco', lat: -23.3038, lng: -44.5536, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Arco-%C3%ADris_na_praia_de_Martim_de_S%C3%A1.jpg/1280px-Arco-%C3%ADris_na_praia_de_Martim_de_S%C3%A1.jpg', vibe: 'Una playa aislada de mar abierto en la punta de la península, con un camping. Se llega por un sendero largo o en barco.', cuando: 'Para dormir en camping; consultá el mar antes de ir.' },
      { name: 'Saco do Mamanguá', zona: 'En barco desde Paraty-Mirim, 20 km por ruta', lat: -23.2595, lng: -44.6345, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Beach_-_Saco_do_Mamangu%C3%A1_-_panoramio_%281%29.jpg/1280px-Beach_-_Saco_do_Mamangu%C3%A1_-_panoramio_%281%29.jpg', vibe: 'Un brazo de mar angosto entre montañas, de agua quieta y con manglar al fondo, con playas chicas en las orillas.', cuando: 'Mañana, en kayak o en barco.' },
      { name: 'Praia da Lula', zona: 'En barco por la bahía', lat: -23.1968, lng: -44.6297, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Praia_da_Lula_%28140734402%29.jpg', vibe: 'Una playa chica de agua verde y quieta, con un restaurante en la orilla. Es parada habitual de los barcos de paseo.', cuando: 'En el paseo de barco por la bahía.' },
      { name: 'Tarituba', zona: 'Norte, junto a la BR-101, 30 km por ruta', lat: -23.0459, lng: -44.5951, foto: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Tarituba_praia.jpg', vibe: 'Un pueblito de pescadores con playa de agua calma y piedras en la orilla, frente a islas.', cuando: 'Mañana, de paso hacia Angra.' }
    ],
    atracciones: [
      { name: 'Centro Histórico', zona: 'Centro', lat: -23.2197, lng: -44.7125, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Centro_Hist%C3%B3rico_Paraty_7397.jpg/1280px-Centro_Hist%C3%B3rico_Paraty_7397.jpg', dur: '2 h', usd: 0, nota: 'Calles de piedra irregular y casas coloniales blancas. Sin autos. De noche, con los faroles, es otro pueblo.' },
      { name: 'Igreja de Santa Rita', zona: 'Centro Histórico', lat: -23.2208, lng: -44.7129, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Igreja_de_Santa_Rita_Paraty_RJ.jpg/1280px-Igreja_de_Santa_Rita_Paraty_RJ.jpg', dur: '20 min', usd: 1, nota: 'La iglesia blanca frente al agua, la postal de Paraty. Adentro hay un pequeño museo de arte sacro.' },
      { name: 'Forte Defensor Perpétuo', zona: 'Morro do Forte', lat: -23.2119, lng: -44.7114, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Forte_Defensor_Perp%C3%A9tuo%2C_Paraty%2C_RJ_-_IMG20231111183101.jpg/1280px-Forte_Defensor_Perp%C3%A9tuo%2C_Paraty%2C_RJ_-_IMG20231111183101.jpg', dur: '40 min', usd: 0, nota: 'Un fuerte del siglo XVIII sobre el cerro, a quince minutos a pie del centro, con vista a la bahía.' }
    ],
    comer: [
      { name: 'Prato feito fuera del centro', tipo: 'Almuerzo', zona: 'Del otro lado de la ruta', usd: 9, momento: 'Mediodía', nota: 'El centro histórico es caro. Del otro lado de la avenida principal el mismo plato cuesta la mitad.' },
      { name: 'Cachaça de alambique', tipo: 'Degustación', zona: 'Alambiques de la ruta', momento: 'Tarde', nota: 'Paraty tiene fama por la cachaça. Los alambiques de la ruta a Cunha dan degustación gratis.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Puestos del puerto', usd: 4, momento: 'Tarde', nota: 'Pastel frito relleno de camarón, en los puestos junto al muelle.' }
    ],
    hacer: [
      { name: 'Paseo en barco por la bahía', zona: 'Sale del muelle', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Passeio_de_Escuna_-_Paraty%2C_RJ_-_panoramio_%2814%29.jpg/1280px-Passeio_de_Escuna_-_Paraty%2C_RJ_-_panoramio_%2814%29.jpg', dur: '5 h', usd: 25, nota: 'Para en islas y playas como la Vermelha y la Lula. Hay escunas grandes y barcos chicos; el chico para más y en lugares más tranquilos.' },
      { name: 'Cascadas de la ruta a Cunha', zona: 'Penha, 10 km', dur: '3 h', usd: 0, nota: 'La Cachoeira do Tobogã es una piedra lisa por la que los locales se tiran al pozo. Al lado hay más cascadas chicas.' },
      { name: 'Trindade en ómnibus', zona: 'Sale de la terminal', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Trindade_%284181103751%29.jpg/1280px-Trindade_%284181103751%29.jpg', dur: 'Día entero', usd: 3, nota: 'El ómnibus urbano llega a Trindade en una hora. Es la forma más barata de ir a las playas de agua clara.' }
    ],
    tips: [
      { titulo: 'Las calles de piedra', texto: 'El empedrado es irregular a propósito, para dejar pasar el agua. Ojotas o sandalias planas: con taco no se camina.' },
      { titulo: 'La marea entra al centro', texto: 'Con luna llena y marea alta el agua sube por algunas calles. Es normal, dura una hora y es parte del pueblo.' },
      { titulo: 'Las playas de agua clara están lejos', texto: 'Las del centro son de bahía, de agua quieta y verdosa. Para agua transparente hay que ir a Trindade o salir en barco.' }
    ]
  },

  angra: {
    resumen: 'Una bahía con más de trescientas islas. La ciudad es de paso: lo que vale la pena está en el agua, a un barco de distancia.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 8, 9], nota: 'En verano llueve casi todas las tardes y los barcos van llenos. De abril a junio y en septiembre el mar está calmo, el agua sigue tibia y los paseos salen con lugar.' },
    clima: {
      titulo: 'Clima en Angra dos Reis mes por mes',
      intro: 'Angra tiene verano caluroso y lluvioso e invierno templado y más seco. El agua de la bahía está tibia casi todo el año.',
      meses: [
        { m: 'Ene', max: 30, min: 23, lluvia: 236, mar: 27, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 23, lluvia: 189, mar: 27.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 23, lluvia: 206, mar: 26.5, demanda: 'media' },
        { m: 'Abr', max: 28, min: 21, lluvia: 167, mar: 25.5, demanda: 'media' },
        { m: 'May', max: 26, min: 19, lluvia: 114, mar: 24, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 18, lluvia: 72, mar: 22.5, demanda: 'baja' },
        { m: 'Jul', max: 24, min: 17, lluvia: 90, mar: 22, demanda: 'media' },
        { m: 'Ago', max: 24, min: 17, lluvia: 54, mar: 22, demanda: 'baja' },
        { m: 'Sep', max: 25, min: 18, lluvia: 121, mar: 22, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 19, lluvia: 142, mar: 23, demanda: 'media' },
        { m: 'Nov', max: 27, min: 21, lluvia: 149, mar: 23.5, demanda: 'media' },
        { m: 'Dic', max: 28, min: 22, lluvia: 258, mar: 25, demanda: 'alta' }
      ],
      nota: 'De diciembre a marzo llueve más de 180 mm por mes, casi siempre a la tarde, y los barcos van llenos. De abril a junio y en septiembre el mar está más calmo, el agua sigue tibia y los paseos salen con lugar. En julio y agosto llueve poco pero el agua baja a 22°.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1981-2010 (estación Angra dos Reis). Temperatura del agua: promedio de los últimos 10 años según seatemperature.info.'
    },
    beaches: [
      { name: 'Praia do Bonfim', zona: '3 km del centro', lat: -23.0208, lng: -44.3327, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Ba%C3%ADa_de_angra_Igreja_do_bonfim.jpg/1280px-Ba%C3%ADa_de_angra_Igreja_do_bonfim.jpg', vibe: 'Una playa chica frente a islotes, con la capilla do Bonfim en un islote al que se cruza a pie con marea baja. La playa de la ciudad.', cuando: 'Tarde, después de los paseos de barco.' },
      { name: 'Ilha da Gipóia', zona: 'En barco, 20 min', lat: -23.0459, lng: -44.357, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Ilha_da_Gip%C3%B3ia%2C_Angra_dos_Reis_-_RJ%2C_Brazil_-_panoramio_%288%29.jpg/1280px-Ilha_da_Gip%C3%B3ia%2C_Angra_dos_Reis_-_RJ%2C_Brazil_-_panoramio_%288%29.jpg', vibe: 'La isla grande frente a la ciudad, con playas de agua verde como la Praia do Dentista y la Praia da Juliana. Barcos con bar fondean y la gente nada desde la cubierta.', cuando: 'Mañana, en el paseo de barco.' },
      { name: 'Lagoa Azul', zona: 'Ilha Grande, en barco', lat: -23.0831, lng: -44.2291, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Lagoa_Azul_%2831358908884%29.jpg/1280px-Lagoa_Azul_%2831358908884%29.jpg', vibe: 'Bahía de agua quieta y transparente entre islotes, con cardúmenes que se acercan al barco. La parada más famosa de los paseos.', cuando: 'Mañana, con mar calmo.' },
      { name: 'Ilhas Botinas', zona: 'En barco, 15 min, al lado de Gipóia', lat: -23.0534, lng: -44.3287, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Ilha_Botinas_%2832200318795%29.jpg/960px-Ilha_Botinas_%2832200318795%29.jpg', vibe: 'Dos islotes gemelos con un par de palmeras cada uno, rodeados de agua turquesa y bajita. No hay arena para quedarse: se nada y se hace snorkel desde el barco entre peces de colores.', cuando: 'Mañana, en el paseo de escuna, antes de que se llene de lanchas.' },,
      { name: 'Praia do Anil', zona: 'Centro', lat: -23.0058, lng: -44.3098, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Praia_do_Anil-1.JPG/1280px-Praia_do_Anil-1.JPG', vibe: 'La playa urbana del centro, frente a un islote y a la bahía, con agua bajita. Es más para caminar que para nadar.', cuando: 'Atardecer.' },
      { name: 'Praia do Laboratório', zona: 'Itaorna, junto a la usina nuclear, 20 km por ruta', lat: -23.0098, lng: -44.4449, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Praia_do_Laborat%C3%B3rio.jpg/1280px-Praia_do_Laborat%C3%B3rio.jpg', vibe: 'Una playa casi vacía de agua tibia, porque recibe el agua de refrigeración de la usina. Hay tortugas que nadan cerca de la orilla.', cuando: 'Mañana.' },
      { name: 'Ilha de Cataguases', zona: 'En barco, unos 40 min', lat: -23.0253, lng: -44.2846, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Um_dia_na_ilha_de_Catagu%C3%A1s.jpg/1280px-Um_dia_na_ilha_de_Catagu%C3%A1s.jpg', vibe: 'Una isla chica con playa de arena clara y agua transparente y bajita. Es parada de los paseos de escuna.', cuando: 'Mañana, antes de que lleguen los barcos grandes.' },
      { name: 'Praia da Vila Histórica de Mambucaba', zona: 'Mambucaba, 40 km por la BR-101', lat: -23.0264, lng: -44.5176, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Mambucaba_-_panoramio_%284%29.jpg/1280px-Mambucaba_-_panoramio_%284%29.jpg', vibe: 'La playa del pueblo colonial de Mambucaba, de mar abierto con olas suaves y vista a una isla.', cuando: 'Mañana, combinada con un paseo por las calles del pueblo.' }
    ],
    atracciones: [
      { name: 'Igreja e Convento do Carmo', zona: 'Centro', lat: -23.0069, lng: -44.3151, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Angra_dos_Reis_RJ_Brasil_-_Igreja_e_Convento_do_Carmo%2C_no_centro_da_cidade_-_panoramio.jpg/1280px-Angra_dos_Reis_RJ_Brasil_-_Igreja_e_Convento_do_Carmo%2C_no_centro_da_cidade_-_panoramio.jpg', dur: '30 min', usd: 0, nota: 'Iglesia colonial del siglo XVII en el centro de Angra. Lo poco del pueblo antiguo que queda en pie.' },
      { name: 'Capela do Bonfim', zona: 'Praia do Bonfim', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Capela_do_Senhor_do_Bonfim%2C_Angra_dos_Reis%2C_RJ.jpg/1280px-Capela_do_Senhor_do_Bonfim%2C_Angra_dos_Reis%2C_RJ.jpg', dur: '30 min', usd: 0, nota: 'Una capilla del siglo XVIII en un islote frente a la playa. No hay pasarela: se cruza a pie con marea baja. Por dentro abre pocas veces al año, pero la vista a las islas de la bahía está siempre.' },
      { name: 'Cais de Santa Luzia', zona: 'Centro', lat: -23.0077, lng: -44.3155, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Letreiro_%E2%80%9CEu_amo_Angra_dos_Reis%E2%80%9D%2C_cais_Santa_Luzia_02.jpg/1280px-Letreiro_%E2%80%9CEu_amo_Angra_dos_Reis%E2%80%9D%2C_cais_Santa_Luzia_02.jpg', dur: '20 min', usd: 0, nota: 'El muelle de donde salen los barcos a Ilha Grande y a las islas. Al atardecer vuelven las escunas.' }
    ],
    comer: [
      { name: 'Comida por kilo del centro', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato antes o después de un día en barco.' },
      { name: 'Pescado frito en Bonfim', tipo: 'Almuerzo', zona: 'Praia do Bonfim', usd: 14, momento: 'Mediodía', nota: 'Porciones de pescado o calamar para compartir frente a los islotes.' },
      { name: 'Almuerzo en el barco', tipo: 'Almuerzo', zona: 'Paseo de escuna', usd: 15, momento: 'Mediodía', nota: 'Muchos paseos incluyen almuerzo o lo venden a bordo. Preguntá antes: a veces sale más barato llevar el propio.' }
    ],
    hacer: [
      { name: 'Paseo de escuna por las islas', zona: 'Sale del Cais de Santa Luzia', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/ROGERIO_CASSIMIRO_passeio_de_escuna_ANGRA_DOS_REIS_RJ_%2839150557780%29.jpg/1280px-ROGERIO_CASSIMIRO_passeio_de_escuna_ANGRA_DOS_REIS_RJ_%2839150557780%29.jpg', dur: '6 h', usd: 30, nota: 'Recorre Gipóia, Lagoa Azul y playas de Ilha Grande con paradas para nadar. Elegí uno con barco chico.' },
      { name: 'Barco a Ilha Grande', zona: 'Cais de Santa Luzia', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Barcas_para_Ilha_Grande_-_panoramio.jpg/1280px-Barcas_para_Ilha_Grande_-_panoramio.jpg', dur: '1 h 30', usd: 8, nota: 'La barca pública a la Vila do Abraão es la forma más barata de cruzar. Las lanchas rápidas tardan la mitad y cuestan el triple.' },
      { name: 'Snorkel en Lagoa Azul', zona: 'Ilha Grande', foto: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Lagoa_Azul_e_Barco.jpg', dur: '1 h', usd: 0, nota: 'Llevá máscara propia: en la parada se ven cientos de peces sin bajar más de un metro.' }
    ],
    tips: [
      { titulo: 'La ciudad no es la playa', texto: 'Angra es una ciudad portuaria y comercial. Las playas lindas están en las islas, así que el día se planifica alrededor del barco.' },
      { titulo: 'Escuna chica, mejor paseo', texto: 'Las escunas grandes llevan a cien personas, con música alta y paradas cortas. Los barcos chicos cuestan un poco más y paran donde las grandes no entran.' },
      { titulo: 'Efectivo a mano', texto: 'Muchos barcos y vendedores de las islas no tienen posnet. Llevá reales en efectivo.' }
    ]
  },

  ilhabela: {
    resumen: 'Una isla de montaña con selva hasta el mar. Las playas del lado del continente son tranquilas; las del otro lado, salvajes y difíciles de llegar.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 8, 9, 10], nota: 'En verano la balsa desde São Sebastião tiene horas de espera y llueve de tarde. De abril a junio y en septiembre la isla está tranquila y el agua sigue templada.' },
    clima: {
      titulo: 'Clima en Ilhabela mes por mes',
      intro: 'Ilhabela es húmeda y verde todo el año. El verano trae calor y lluvia; el invierno, días secos y agua más fresca.',
      meses: [
        { m: 'Ene', max: 30, min: 21, lluvia: 281, mar: 27, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 20, lluvia: 197, mar: 27, demanda: 'alta' },
        { m: 'Mar', max: 30, min: 21, lluvia: 263, mar: 26.5, demanda: 'media' },
        { m: 'Abr', max: 29, min: 19, lluvia: 218, mar: 25.5, demanda: 'baja' },
        { m: 'May', max: 27, min: 16, lluvia: 174, mar: 24, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 15, lluvia: 164, mar: 22.5, demanda: 'baja' },
        { m: 'Jul', max: 24, min: 14, lluvia: 138, mar: 21.5, demanda: 'media' },
        { m: 'Ago', max: 25, min: 15, lluvia: 126, mar: 21.5, demanda: 'baja' },
        { m: 'Sep', max: 25, min: 17, lluvia: 130, mar: 21.5, demanda: 'baja' },
        { m: 'Oct', max: 27, min: 18, lluvia: 188, mar: 22.5, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 19, lluvia: 205, mar: 23.5, demanda: 'media' },
        { m: 'Dic', max: 30, min: 21, lluvia: 223, mar: 25, demanda: 'alta' }
      ],
      nota: 'Para playa con agua tibia y sin la cola de la balsa: marzo y abril. De mayo a septiembre llueve menos y es buena época para senderos y cascadas, aunque el agua baja a 21-22°. En verano llueve casi todas las tardes, hay borrachudos (mosquitos chicos) y los precios suben.',
      fuente: 'Temperaturas y lluvia: normales 2007-2019 de la estación de São Sebastião (CIIAGRO), frente a la isla. Agua: promedio de seatemperature.info para la zona.'
    },
    beaches: [
      { name: 'Praia do Curral', zona: 'Sur, por la ruta costera', lat: -23.8664, lng: -45.4318, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Praia_do_Curral%2C_Ilhabela_%282284333705%29.jpg/960px-Praia_do_Curral%2C_Ilhabela_%282284333705%29.jpg', vibe: 'La playa con más movimiento de la isla: bares sobre la arena, agua calma y un barco hundido cerca de la orilla para hacer snorkel.', cuando: 'Tarde, para quedarse al atardecer.' },
      { name: 'Praia da Feiticeira', zona: 'Sur', lat: -23.8454, lng: -45.4088, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Praia_da_Feiticeira_-_Ilhabela_-_panoramio.jpg/960px-Praia_da_Feiticeira_-_Ilhabela_-_panoramio.jpg', vibe: 'Una playa chica entre piedras, con una cascada cerca. Es la más linda del lado tranquilo y tiene menos gente que el Curral.', cuando: 'Mañana.' },
      { name: 'Praia do Julião', zona: 'Sur', lat: -23.8539, lng: -45.4141, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Praia_Juli%C3%A3o_-_Ilhabela-_S%C3%A3o_Paulo_-_Por_do_sol_3.JPG/1280px-Praia_Juli%C3%A3o_-_Ilhabela-_S%C3%A3o_Paulo_-_Por_do_sol_3.JPG', vibe: 'Una cala chica de agua verde, con sombra de árboles sobre la arena. Tranquila incluso en temporada.', cuando: 'Mediodía, para la sombra.' },
      { name: 'Castelhanos', zona: 'Lado del mar abierto, 22 km de camino de tierra', lat: -23.8557, lng: -45.2887, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Praia_de_Castelhanos_-_Ilhabela_-_SP.jpg/1280px-Praia_de_Castelhanos_-_Ilhabela_-_SP.jpg', vibe: 'La playa salvaje de la isla, en una bahía grande del otro lado de la montaña. Se llega en 4x4 por un camino de tierra o en barco.', cuando: 'Día entero, con seco: con lluvia el camino se corta.' },
      { name: 'Praia do Jabaquara', zona: 'Norte, al final del camino', lat: -23.7363, lng: -45.2929, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/MaristelaColucci_PraiadoJabaquara_Ilhabela_SP_%2827181353098%29.jpg/1280px-MaristelaColucci_PraiadoJabaquara_Ilhabela_SP_%2827181353098%29.jpg', vibe: 'La última playa del norte, donde un río de agua dulce desemboca sobre la arena. Agua transparente, sombra de árboles y mucha menos gente que en el sur.', cuando: 'Mañana. El último tramo es de tierra: con lluvia fuerte, mejor dejarlo para otro día.' },
      { name: 'Praia do Perequê', zona: 'Sur, 4 km', lat: -23.8097, lng: -45.3677, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Praia_do_Perequ%C3%AA_-_Ilhabela.jpg/1280px-Praia_do_Perequ%C3%AA_-_Ilhabela.jpg', vibe: 'La playa más urbana de la isla, con bares, kioscos y alquiler de kayak y stand up. El agua es calma y poco profunda, buena para chicos.', cuando: 'Todo el día; al atardecer el sol cae detrás de la sierra de São Sebastião.' },
      { name: 'Praia do Saco da Capela', zona: 'Sur, 1 km', lat: -23.7843, lng: -45.3606, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Ilhabela_SP_Brasil_-_Praia_Saco_da_Capela_-_panoramio.jpg/1280px-Ilhabela_SP_Brasil_-_Praia_Saco_da_Capela_-_panoramio.jpg', vibe: 'Una caleta chica pegada a la Vila, con barcos de pesca anclados y piedras en los extremos. Agua calma del canal, más para mirar el atardecer que para pasar el día.', cuando: 'Atardecer.' },
      { name: 'Praia do Sino', zona: 'Norte, 4 km', lat: -23.748, lng: -45.3479, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Praia_do_Sino_em_Ilhabela.jpg/1280px-Praia_do_Sino_em_Ilhabela.jpg', vibe: 'Una playa de piedras redondas en el norte del canal: algunas suenan como campana si se golpean, de ahí el nombre. Agua calma y transparente, buena para snorkel.', cuando: 'Mañana, con el agua más quieta.' },
      { name: 'Praia Grande', zona: 'Sur, 11 km', lat: -23.8577, lng: -45.4168, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Praia_Grande_%28Ilhabela%29.jpg/1280px-Praia_Grande_%28Ilhabela%29.jpg', vibe: 'Una de las playas más largas del lado del canal, con restaurantes y kioscos sobre la arena. Agua calma y una capilla chica en el canto.', cuando: 'Fines de semana se llena; entre semana, todo el día.' },
      { name: 'Praia da Fome', zona: 'Norte, en barco o por sendero desde el Jabaquara', lat: -23.7433, lng: -45.2669, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Praia_da_Fome_-_Ilhabela.jpg/1280px-Praia_da_Fome_-_Ilhabela.jpg', vibe: 'Una caleta del norte rodeada de selva, con pocas casas de caiçaras y agua verde y transparente. No hay ruta: se llega en barco o caminando.', cuando: 'Días de mar calmo, de mañana.' },
      { name: 'Praia Vermelha', zona: 'Bahía de Castelhanos, 4x4 + sendero', lat: -23.8725, lng: -45.29, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Ilha_Bela_-_Praia_Vermelha.jpg/1280px-Ilha_Bela_-_Praia_Vermelha.jpg', vibe: 'Una playa chica junto a la Praia Mansa, en el extremo sur de la bahía de Castelhanos. Arena rojiza y agua calma, casi sin gente.', cuando: 'Días secos, cuando el camino a Castelhanos está abierto.' },
      { name: 'Praia de Indaiaúba', zona: 'Costa este, solo en barco', lat: -23.9089, lng: -45.303, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Indaiauba.jpg/1280px-Indaiauba.jpg', vibe: 'Una caleta aislada del lado del océano, con selva hasta la arena y una comunidad caiçara. Sin ruta ni comercios: se llega en los paseos de barco.', cuando: 'Días de mar calmo, en los paseos de barco.' },
      { name: 'Praia do Bonete', zona: 'Sur, sendero de 12 km o barco', lat: -23.9177, lng: -45.345, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Praia_do_Bonete%2C_Ilhabela%2C_2021.jpg/1280px-Praia_do_Bonete%2C_Ilhabela%2C_2021.jpg', vibe: 'Una vila caiçara en el extremo sur, con olas para surf y un río que desemboca en la playa. Se llega por un sendero de unas 4 horas o en barco.', cuando: 'Para dormir una noche; el sendero, siempre con días secos.' },
      { name: 'Praia das Pedras Miúdas (Ilha das Cabras)', zona: 'Sur, 7 km', lat: -23.8303, lng: -45.3903, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_Ilha_das_Cabras_Ilhabela.jpg/1280px-Praia_Ilha_das_Cabras_Ilhabela.jpg', vibe: 'La playa frente a la Ilha das Cabras, con agua muy calma y transparente. Es la base del snorkel y el buceo del santuario marino: las escuelas de buceo están frente a la arena.', cuando: 'Mañana, con el canal quieto. Con viento sur el mar se pica.' },
      { name: 'Praia da Siriúba', zona: 'Norte, 3 km', lat: -23.7543, lng: -45.3496, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Parque_Estadual_de_Ilhabela_Jo%C3%A3o_Paulo_Marques_DAndretta_%284%29.jpg/1280px-Parque_Estadual_de_Ilhabela_Jo%C3%A3o_Paulo_Marques_DAndretta_%284%29.jpg', vibe: 'Una de las playas chicas del norte, sobre la ruta pasando la Vila. Mar calmo, barcos fondeados y kioscos con reposeras y sombrillas.', cuando: 'Todo el día; buena para ir con chicos.' },
      { name: 'Praia da Armação', zona: 'Norte, 5 km', lat: -23.7385, lng: -45.3455, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Parque_Estadual_de_Ilhabela_-_Jo%C3%A3o_Paulo_Marques_DAndretta_%2813%29.jpg/1280px-Parque_Estadual_de_Ilhabela_-_Jo%C3%A3o_Paulo_Marques_DAndretta_%2813%29.jpg', vibe: 'Una playa de arena ancha y plana cerca de la Ponta das Canas, con restaurantes, alquiler de equipos y una capilla chica junto a la arena. El viento la hizo el lugar del windsurf y el kitesurf de la isla.', cuando: 'Tarde, cuando entra el viento si vas a navegar; de mañana para bañarte con el agua más quieta.' },
      { name: 'Praia do Pacuíba', zona: 'Norte, camino de tierra hacia el Jabaquara', lat: -23.7264, lng: -45.3172, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Parque_Estadual_de_Ilhabela_Jo%C3%A3o_Paulo_Marques_DAndretta_%282%29.jpg/1280px-Parque_Estadual_de_Ilhabela_Jo%C3%A3o_Paulo_Marques_DAndretta_%282%29.jpg', vibe: 'Una playa escondida sobre el camino de tierra que sigue después de la Armação, unos 4 km antes del Jabaquara. Agua clara, pasto y mucha sombra; se entra por un sendero corto que es fácil pasarse.', cuando: 'Mañana, de paso al Jabaquara. Con lluvia fuerte el camino de tierra se complica.' },
      { name: 'Praia das Enchovas', zona: 'Costa sur, junto al Bonete', lat: -23.9123, lng: -45.3245, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Ilhabela_-_SP_-_panoramio_%285%29.jpg/1280px-Ilhabela_-_SP_-_panoramio_%285%29.jpg', vibe: 'Una caleta de arena y lajas de piedra al este del Bonete, con pocas casas de pescadores. Sin ruta: se llega en barco o por un sendero de unos 50 minutos desde el Bonete.', cuando: 'Si dormís en el Bonete, como paseo de medio día con mar calmo.' }
    ],
    atracciones: [
      { name: 'Vila (centro histórico)', zona: 'Vila', lat: -23.7791, lng: -45.3574, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Cadeia_e_Igreja_Matriz_de_Nossa_Senhora_da_Ajuda.jpg/1280px-Cadeia_e_Igreja_Matriz_de_Nossa_Senhora_da_Ajuda.jpg', dur: '1 h', usd: 0, nota: 'Calles con casas coloniales, la iglesia matriz y restaurantes. De noche es donde está todo.' },
      { name: 'Cachoeira dos Três Tombos', zona: 'Sur', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Cachoeira_dos_Tr%C3%AAs_Tombos.jpg/1280px-Cachoeira_dos_Tr%C3%AAs_Tombos.jpg', dur: '1 h', usd: 0, nota: 'Una cascada de tres caídas con pozo, a un sendero corto de la ruta.' },
      { name: 'Mirante do Pico do Baepi', zona: 'Centro de la isla', lat: -23.79, lng: -45.3339, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Vista_do_cume_do_Pico_do_Baepi_02.jpg/1280px-Vista_do_cume_do_Pico_do_Baepi_02.jpg', dur: '5 h', usd: 0, nota: 'Caminata dura de subida, con la vista de todo el canal desde arriba. Solo con guía.' },
      { name: 'Cachoeira da Toca', zona: 'Comienzo de la ruta a Castelhanos', dur: '2 a 3 h', lat: -23.8269, lng: -45.3405, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/CachoeiraIlhaBelaSP.jpg/1280px-CachoeiraIlhaBelaSP.jpg', nota: 'Está dentro de la Fazenda da Toca, una propiedad privada al comienzo de la ruta a Castelhanos, abierta a visitas desde 1967. Tiene una caída de unos 3 metros, un tobogán natural de piedra y pozos, con estacionamiento y baños. Se cobra entrada: consultá el valor y el horario con la fazenda antes de ir.' },
      { name: 'Cachoeira da Água Branca', zona: 'Parque da Usina, sur', dur: '1 a 3 h', lat: -23.8334, lng: -45.36, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Cachoeira_em_Ilhabela_-_S%C3%A3o_Paulo.JPG/1280px-Cachoeira_em_Ilhabela_-_S%C3%A3o_Paulo.JPG', nota: 'Una cascada ancha que baja por una laja de piedra, atrás del Museu Náutico en el Parque da Usina. Muy cerca, junto a la portería del Parque Estadual al comienzo de la ruta a Castelhanos, sale la Trilha da Água Branca: unos 4 km ida y vuelta, fácil, con varios pozos para bañarse como el Poço da Ducha y el Poço da Escada. En época seca cae mucha menos agua.' },
      { name: 'Cachoeira da Laje', zona: 'Sendero del Bonete, extremo sur', dur: '3 h', lat: -23.9326, lng: -45.409, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Cachoeira_da_trilha_para_praia_do_bonete.jpg/1280px-Cachoeira_da_trilha_para_praia_do_bonete.jpg', nota: 'La primera cascada del sendero al Bonete: una serie de toboganes y piscinas naturales en el río, con un puente colgante encima. Desde la Ponta da Sepituba, al final de la ruta del sur, son unos 40 minutos de caminata de dificultad baja a media. Andá con zapatillas y llevá agua y algo para comer.' },
      { name: 'Cachoeira do Saquinho', zona: 'Sendero del Bonete', dur: 'Día entero', lat: -23.9184, lng: -45.3549, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Parque_Estadual_de_Ilhabela_-_Arthur_Grangeiro_de_Souza_%28274%29.jpg/1280px-Parque_Estadual_de_Ilhabela_-_Arthur_Grangeiro_de_Souza_%28274%29.jpg', nota: 'La última de las tres cascadas del sendero al Bonete, después de la Laje y del río del Areado, con un puente de madera encima. Queda cerca del final del camino, así que conviene verla en el día que vas al Bonete o desde la vila si dormís ahí.' },
      { name: 'Cachoeira do Gato', zona: 'Bahía de Castelhanos', dur: '1 h 30', lat: -23.8374, lng: -45.2877, nota: 'La cascada más alta del parque, en el norte de la bahía de Castelhanos. El sendero sale de la Ponta do Gato, en la Praia de Castelhanos: son unos 4 km ida y vuelta, de dificultad media, y cruza el Ribeirão do Gato por un puente colgante. Se recomienda ir con guía, y solo los días que la ruta a Castelhanos está abierta.' },
      { name: 'Cachoeira da Friagem', zona: 'Norte, sobre la Siriúba', dur: '2 h', lat: -23.7587, lng: -45.3298, nota: 'Una caída de unos 25 metros en el morro sobre las playas del norte, con vista al canal de São Sebastião. El sendero sale de un condominio en la Praia da Siriúba y tiene unos 2,4 km ida y vuelta, de dificultad media. Mejor con guía.' },
      { name: 'Cachoeira do Veloso', zona: 'Sur, Praia do Veloso', dur: '1 h 30', lat: -23.884, lng: -45.4319, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Cachoeira_do_Veloso%2C_em_Ilhabela.jpg/960px-Cachoeira_do_Veloso%2C_em_Ilhabela.jpg', nota: 'La cascada más alta del lado del canal, con más de 30 metros de caída. El sendero sale de la Praia do Veloso, pasando el Curral, cruza una propiedad privada y son unos 2,2 km ida y vuelta, de dificultad media. Tiene poca gente aun en temporada alta.' },
      { name: 'Mirante dos Castelhanos', zona: 'Ruta a Castelhanos, en la sierra', dur: '20 min', lat: -23.8495, lng: -45.323, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Praia_de_Castelhanos_Ilhabela.jpg/1280px-Praia_de_Castelhanos_Ilhabela.jpg', nota: 'El mirador del camino de tierra que cruza la isla, con la costa del océano y las islas abajo. Queda sobre el camino, así que se para en la ida a Castelhanos. Con niebla, algo común en la sierra, no se ve nada.' },
      { name: 'Mirante do Piúva', zona: 'Sur, sobre la ruta', dur: '20 min', usd: 0, lat: -23.8258, lng: -45.384, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Mirante_pi%C3%BAva_em_Ilhabela.jpg/1280px-Mirante_pi%C3%BAva_em_Ilhabela.jpg', nota: 'Un deck de madera sobre el canal, al costado de la ruta del sur, con las letras de Ilhabela. Queda al lado de la Praia das Pedras Miúdas y la Ilha das Cabras, así que se combina con el snorkel. Lindo al atardecer, con el sol cayendo sobre la sierra del continente.' },
      { name: 'Fazenda Engenho d\'Água', zona: 'Engenho d\'Água, entre el Perequê y la Vila', dur: '1 h', lat: -23.7923, lng: -45.364, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Fazenda_Engenho_D%E2%80%99%C3%A1gua%2C_patrim%C3%B4nio_hist%C3%B3rico_de_Ilhabela%21.jpg/1280px-Fazenda_Engenho_D%E2%80%99%C3%A1gua%2C_patrim%C3%B4nio_hist%C3%B3rico_de_Ilhabela%21.jpg', nota: 'Una casona colonial de un antiguo ingenio de caña de azúcar del siglo XVIII, protegida como patrimonio, rodeada de un parque con palmeras. Hoy es parque municipal: se recorren los jardines, el acueducto y la rueda de agua, pero la casa no se visita por dentro. Los días y horarios cambiaron en los últimos años; consultá en la Prefeitura antes de ir.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Perequê y Vila', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en Perequê, donde vive la gente de la isla. La Vila es más cara.' },
      { name: 'Pescado frito en el Curral', tipo: 'Cena', zona: 'Praia do Curral', usd: 16, momento: 'Atardecer', nota: 'Porción de pescado para compartir en los bares de la arena, mirando el atardecer.' },
      { name: 'Açaí', tipo: 'Merienda', zona: 'Perequê', usd: 5, momento: 'Tarde', nota: 'Bowl de açaí con fruta, la merienda después de la playa.' },
      { name: 'Azul-marinho (pescado con banana verde)', tipo: 'Almuerzo', zona: 'Restaurantes de comida caiçara de la Vila y del sur', momento: 'Mediodía', nota: 'El plato de los pescadores caiçaras: pescado cocido con bananas verdes, que tiñen el caldo de un azul oscuro, y un pirão hecho con la banana pisada y harina de mandioca. Buscalo como azul-marinho o peixe com banana verde en los restaurantes de comida caiçara.' },
      { name: 'Almuerzo en los kioscos de Castelhanos', tipo: 'Almuerzo', zona: 'Praia de Castelhanos', momento: 'Mediodía, el día del 4x4', nota: 'Del otro lado de la isla no hay más que unos pocos kioscos y campings sobre la arena, que sirven pescado fresco y porciones. Llevá efectivo y no cuentes con señal de celular para pagar con el teléfono.' }
    ],
    hacer: [
      { name: 'Snorkel en el Curral', zona: 'Praia do Curral', dur: '1 h', usd: 0, nota: 'El casco hundido del Aymoré está a pocos metros de la orilla. Con máscara se ve desde la superficie.' },
      { name: 'Excursión a Castelhanos en 4x4', zona: 'Sale de la Vila', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Vis%C3%A3o_da_Praia_de_Castelhanos_a_partir_do_ponto_mais_alto.jpg/1280px-Vis%C3%A3o_da_Praia_de_Castelhanos_a_partir_do_ponto_mais_alto.jpg', dur: 'Día entero', usd: 35, nota: 'Cruza la montaña por un camino de tierra hasta la playa salvaje. Solo con días secos.' },
      { name: 'Cascadas del sur', zona: 'Sur', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Cachoeira_da_Laje_-_Ilhabela-SP_Brasil_-_panoramio.jpg/1280px-Cachoeira_da_Laje_-_Ilhabela-SP_Brasil_-_panoramio.jpg', dur: '2 h', usd: 0, nota: 'Feiticeira, Três Tombos y Laje: cascadas con pozo a pocos minutos de la ruta.' },
      { name: 'Sendero al Bonete', zona: 'Sale de la Ponta da Sepituba, extremo sur', dur: 'Día entero', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Parque_Estadual_de_Ilhabela_-_Arthur_Grangeiro_de_Souza_%2821%29.jpg/1280px-Parque_Estadual_de_Ilhabela_-_Arthur_Grangeiro_de_Souza_%2821%29.jpg', nota: 'Unos 12 km por la selva hasta la vila caiçara del Bonete, en 3 a 6 horas según el ritmo y las paradas. En el camino pasás por las cascadas da Laje, del Areado y del Saquinho, y al final por un mirador sobre la playa. Se puede estacionar en la Sepituba o en Borrifos, y volver en barco desde el Bonete (unos 40 minutos). Salí temprano y nunca con lluvia fuerte.' },
      { name: 'Snorkel y buceo en la Ilha das Cabras', zona: 'Praia das Pedras Miúdas, sur', dur: '2 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Ilha_das_Cabras.jpg/1280px-Ilha_das_Cabras.jpg', nota: 'Alrededor de la isla hay un santuario ecológico marino, protegido desde 1992, con peces de colores y tortugas. Hay una estatua de Neptuno a unos 7 metros de profundidad, para hacer buceo. Las escuelas de buceo están frente a la playa; para snorkel alcanza con máscara en los días de mar calmo.' },
      { name: 'Windsurf y kitesurf en la Armação', zona: 'Praia da Armação, norte', dur: 'Medio día', nota: 'La Armação y la Ponta das Canas son el lugar de los deportes de viento de la isla: ahí tiene su sede la asociación de windsurf y hay alquiler de equipos. El mejor viento es el del nordeste, más frecuente de julio a diciembre. No hay estacionamiento en la playa, así que llegá temprano.' }
    ],
    tips: [
      { titulo: 'El borrachudo existe', texto: 'Un mosquito chico que pica de día y deja ronchas por una semana. Repelente con icaridina desde que bajás de la balsa.' },
      { titulo: 'La balsa, con reserva', texto: 'En temporada la fila para cruzar en auto es de horas. Reservá el horario online o cruzá a pie: la balsa peatonal no tiene espera.' },
      { titulo: 'El lado salvaje no es para medio día', texto: 'Castelhanos y Bonete son hermosas pero llegar lleva horas. Si tenés poco tiempo, quedate en las playas del lado del canal.' },
      { titulo: 'La balsa no acepta tarjeta', texto: 'El auto paga en efectivo o con tag de peaje (Sem Parar, ConectCar y otros), y solo a la ida desde São Sebastião: la vuelta ya está incluida. Los ciclistas no pagan.' },
      { titulo: 'Del lado del océano no hay señal', texto: 'En Castelhanos, el Bonete y la costa este casi no hay señal de celular. Bajá el mapa offline y acordá de antemano la hora de la vuelta con el barco o el 4x4.' },
      { titulo: 'En julio, la Semana de Vela', texto: 'La Semana Internacional de Vela se hace en julio y llena los alojamientos de la isla. Si viajás esos días, reservá con meses de anticipación; si no te interesa, elegí otra semana.' }
    ]
  },

  ubatuba: {
    resumen: 'Más de cien playas a lo largo de la ruta, entre la sierra y el mar. Las mejores son calas chicas al norte, donde la selva llega a la arena.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 8, 9, 10], nota: 'Le dicen Ubachuva: llueve mucho, sobre todo en verano. De abril a junio y en septiembre llueve menos, el agua sigue templada y las calas están vacías entre semana.' },
    clima: {
      titulo: 'Clima en Ubatuba mes por mes',
      intro: 'Ubatuba es de las ciudades más lluviosas del litoral paulista. El calor y la lluvia van juntos de diciembre a marzo.',
      meses: [
        { m: 'Ene', max: 30, min: 22, lluvia: 313, mar: 27, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 22, lluvia: 291, mar: 27, demanda: 'alta' },
        { m: 'Mar', max: 30, min: 21, lluvia: 311, mar: 26.5, demanda: 'media' },
        { m: 'Abr', max: 28, min: 19, lluvia: 233, mar: 25.5, demanda: 'baja' },
        { m: 'May', max: 26, min: 16, lluvia: 123, mar: 24, demanda: 'baja' },
        { m: 'Jun', max: 25, min: 15, lluvia: 94, mar: 22.5, demanda: 'baja' },
        { m: 'Jul', max: 24, min: 14, lluvia: 93, mar: 21.5, demanda: 'media' },
        { m: 'Ago', max: 25, min: 14, lluvia: 74, mar: 21.5, demanda: 'baja' },
        { m: 'Sep', max: 25, min: 16, lluvia: 197, mar: 21.5, demanda: 'baja' },
        { m: 'Oct', max: 26, min: 18, lluvia: 246, mar: 22.5, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 19, lluvia: 264, mar: 23.5, demanda: 'media' },
        { m: 'Dic', max: 29, min: 20, lluvia: 280, mar: 25, demanda: 'alta' }
      ],
      nota: 'Para playa con agua tibia y menos lluvia: abril y mayo. De junio a agosto llueve poco pero el agua ronda los 21-22° y las noches son frescas. De diciembre a marzo llueve más de 290 mm por mes, casi siempre en chaparrones de tarde, y es cuando todo está más caro.',
      fuente: 'Temperaturas y lluvia: normales 1981-2010 del INMET (estación Ubatuba). Agua: promedio de seatemperature.info.'
    },
    beaches: [
      { name: 'Praia do Félix', zona: 'Norte, 15 km', lat: -23.3893, lng: -44.9716, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Praia_do_F%C3%A9lix_%28Praia_do_L%C3%BAcio%29%2C_Ubatuba_-_SP%2C_Brazil_-_panoramio_%284%29.jpg/960px-Praia_do_F%C3%A9lix_%28Praia_do_L%C3%BAcio%29%2C_Ubatuba_-_SP%2C_Brazil_-_panoramio_%284%29.jpg', vibe: 'Una playa en forma de media luna, con selva detrás y agua verde. Una punta es calma para nadar y la otra tiene olas.', cuando: 'Mañana, antes del viento.' },
      { name: 'Vermelha do Norte', zona: 'Norte, 5 km', lat: -23.4177, lng: -45.0372, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/Praia-vermelha-do-norte-ubatuba-170114-189.jpg/960px-Praia-vermelha-do-norte-ubatuba-170114-189.jpg', vibe: 'Playa de surf con arena rojiza, rodeada de morros verdes. Hay escuelas de surf y bares sencillos.', cuando: 'Tarde, cuando entra la ola.' },
      { name: 'Itamambuca', zona: 'Norte, 12 km', lat: -23.4011, lng: -45.0013, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Praia_de_Itamambuca.jpg/1280px-Praia_de_Itamambuca.jpg', vibe: 'La playa de surf más conocida, con un río que desemboca en una punta: un lado de olas y otro de agua dulce y quieta.', cuando: 'Mañana para el río; tarde para el surf.' },
      { name: 'Domingas Dias', zona: 'Sur, 14 km por ruta', lat: -23.4979, lng: -45.1445, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Praia_Domingas_Dias_-_Ubatuba_%2826528569621%29.jpg/1280px-Praia_Domingas_Dias_-_Ubatuba_%2826528569621%29.jpg', vibe: 'Una cala chica de agua transparente y calma, entre condominios y selva. Ideal para nadar y hacer snorkel.', cuando: 'Mañana; entre semana casi vacía.' },
      { name: 'Praia do Lázaro', zona: 'Sur, 14 km por ruta', lat: -23.4998, lng: -45.1345, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/Praia_do_L%C3%A1zaro_-_Ubatuba_%2825981770484%29.jpg/1280px-Praia_do_L%C3%A1zaro_-_Ubatuba_%2825981770484%29.jpg', vibe: 'Agua quieta y bares sobre la arena. Desde acá sale el sendero a Domingas Dias y los barcos a la Ilha Anchieta.', cuando: 'Todo el día.' },
      { name: 'Praia Grande', zona: 'Centro sur, 3 km', lat: -23.4697, lng: -45.0672, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Praia_Grande_Ubatuba_04.jpg/960px-Praia_Grande_Ubatuba_04.jpg', vibe: 'La playa urbana de Ubatuba, larga y con olas, con quioscos y movimiento. Para quien no tiene auto.', cuando: 'Tarde.' },
      { name: 'Prumirim', zona: 'Norte, 14 km', lat: -23.3789, lng: -44.956, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/M._H._Mathias_Praia_Prumirim_-_Ubatuba%2C_SP%2C_Brasil_%2836505158115%29.jpg/1280px-M._H._Mathias_Praia_Prumirim_-_Ubatuba%2C_SP%2C_Brasil_%2836505158115%29.jpg', vibe: 'Playa de selva al lado de la ruta, con la Ilha do Prumirim enfrente, a la que se cruza en bote, y una cascada con pozo del otro lado de la ruta.', cuando: 'Mañana en la playa y la cascada a la vuelta, para sacarse la sal.' },
      { name: 'Praia de Iperoig', zona: 'Centro, 2 km', lat: -23.4398, lng: -45.0682, foto: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Praia-do-cruzeiro-iperoig-ubatuba-161020-004.jpg', vibe: 'La playa del centro, frente a la costanera con kioscos y la feria de artesanía. El agua es calma pero recibe los ríos de la ciudad: es más para caminar que para bañarse.', cuando: 'Atardecer, para caminar por la costanera.' },
      { name: 'Praia do Itaguá', zona: 'Centro sur, 4 km', lat: -23.4517, lng: -45.0634, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/Praia_Do_Itagu%C3%A1_-_Ubatuba..JPG/1280px-Praia_Do_Itagu%C3%A1_-_Ubatuba..JPG', vibe: 'Una bahía calma con barcos de pesca anclados, frente a la avenida de bares y restaurantes. Ahí está el Projeto Tamar.', cuando: 'Atardecer, con los barcos a contraluz.' },
      { name: 'Praia Vermelha do Centro', zona: 'Centro sur, 6 km', lat: -23.4635, lng: -45.0491, foto: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Praia-vermelha-do-centro-ubatuba-170115-047.jpg', vibe: 'Una playa de arena rojiza con olas fuertes, buscada por surfistas y bodyboarders. Se baja por una escalera desde la calle.', cuando: 'Mañana; con mar grande, solo para mirar.' },
      { name: 'Praia das Toninhas', zona: 'Sur, 8 km', lat: -23.4873, lng: -45.0732, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Praia_das_Toninhas%2C_Ubatuba_1.jpg/1280px-Praia_das_Toninhas%2C_Ubatuba_1.jpg', vibe: 'Una bahía larga de agua calma y arena firme, con kioscos y pousadas detrás. Buena para ir con chicos.', cuando: 'Todo el día.' },
      { name: 'Praia da Enseada', zona: 'Sur, 9 km', lat: -23.4938, lng: -45.0912, foto: 'https://upload.wikimedia.org/wikipedia/commons/4/40/Praia-da-enseada-ubatuba-180522-001.jpg', vibe: 'Una ensenada protegida de agua quieta y poco profunda, con muchas pousadas y casas de veraneo. De las más familiares del sur de Ubatuba.', cuando: 'Todo el día; en enero se llena.' },
      { name: 'Praia da Sununga', zona: 'Sur, 13 km', lat: -23.5094, lng: -45.1326, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Praia_da_Sununga_-_Ubatuba_%2826032340673%29.jpg/1280px-Praia_da_Sununga_-_Ubatuba_%2826032340673%29.jpg', vibe: 'Playa de olas fuertes, conocida por la Gruta que Chora en el canto: una cueva donde el agua gotea del techo. Más para mirar que para bañarse.', cuando: 'Tarde, combinada con el Lázaro.' },
      { name: 'Praia da Almada', zona: 'Norte, 20 km', lat: -23.3716, lng: -44.9502, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Praia_da_Almada%2C_Ubatuba%2C_Brasil_%2814830220754%29.jpg/1280px-Praia_da_Almada%2C_Ubatuba%2C_Brasil_%2814830220754%29.jpg', vibe: 'Una vila de pescadores con agua calma y kioscos de pescado frito. Tranquila incluso en temporada.', cuando: 'Todo el día.' },
      { name: 'Praia de Picinguaba', zona: 'Norte, 33 km', lat: -23.3771, lng: -44.8386, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Praia_da_picinguaba_ubatuba-sp_-_panoramio.jpg/1280px-Praia_da_picinguaba_ubatuba-sp_-_panoramio.jpg', vibe: 'Una vila de pescadores dentro del parque, con casas junto al agua y barcos anclados. Agua calma y restaurantes de pescado.', cuando: 'Mañana; de acá salen barcos a playas sin ruta.' }
    ],
    atracciones: [
      { name: 'Projeto Tamar', zona: 'Centro', lat: -23.452, lng: -45.0703, foto: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Ubatuba_projeto_Tamar_%283336199981%29.jpg', dur: '1 h', usd: 6, nota: 'Centro de conservación de tortugas marinas, con tanques y tortugas en recuperación. Bueno para un día de lluvia.' },
      { name: 'Centro histórico', zona: 'Centro', lat: -23.4325, lng: -45.07, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Sobrad%C3%A3o_do_Porto.jpg/1280px-Sobrad%C3%A3o_do_Porto.jpg', dur: '45 min', usd: 0, nota: 'El Sobradão do Porto, una casona de 1846 frente a la bahía donde funciona la Casa da Cultura. Poco, pero es lo que queda del pueblo antiguo.' },
      { name: 'Mirante do Félix', zona: 'Ruta Rio-Santos, norte', dur: '20 min', usd: 0, nota: 'El mirador de la ruta sobre la Praia do Félix. Parada obligada camino al norte.' }
    ],
    comer: [
      { name: 'Prato feito caiçara', tipo: 'Almuerzo', zona: 'Centro y playas del norte', usd: 10, momento: 'Mediodía', nota: 'Pescado frito con arroz, feijão y ensalada en los bares de las playas.' },
      { name: 'Azul marinho', tipo: 'Almuerzo', zona: 'Restaurantes caiçaras', usd: 15, momento: 'Mediodía', nota: 'El plato típico: pescado cocido con banana verde, que deja el caldo azulado.' },
      { name: 'Pastel en la feria', tipo: 'Merienda', zona: 'Centro', usd: 3, momento: 'Mañana', nota: 'Pastel frito con jugo de caña en la feria del centro.' }
    ],
    hacer: [
      { name: 'Barco a la Ilha Anchieta', zona: 'Sale de Praia do Lázaro / Saco da Ribeira', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Ilha_Anchieta_-_Praia_do_Sul_1.jpg/1280px-Ilha_Anchieta_-_Praia_do_Sul_1.jpg', dur: '4 h', usd: 20, nota: 'Una isla parque estatal, con playas de agua clara y las ruinas de un antiguo presidio.' },
      { name: 'Sendero de Domingas Dias', zona: 'Praia do Lázaro', dur: '30 min', usd: 0, nota: 'Camino corto por la costa desde el Lázaro hasta la cala.' },
      { name: 'Clase de surf', zona: 'Itamambuca o Vermelha do Norte', foto: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Surf_na_praia_vermelha_-_Ubatuba_SP_%281366413191%29.jpg', dur: '2 h', usd: 30, nota: 'Las escuelas dan tabla, traje y clase en la playa. Ubatuba es la capital del surf del litoral paulista.' }
    ],
    tips: [
      { titulo: 'Sin auto, difícil', texto: 'Las playas lindas están a lo largo de 80 km de ruta. Hay ómnibus urbano, pero pasa poco. Con auto se ven tres playas en un día.' },
      { titulo: 'Mirá el pronóstico', texto: 'Ubatuba es una de las ciudades más lluviosas del país. Planeá las calas lejanas para los días de sol y dejá los museos para la lluvia.' },
      { titulo: 'Borrachudos en las playas de río', texto: 'En las playas con río, como Itamambuca, hay mosquito borrachudo. Repelente desde que llegás.' }
    ]
  },

  porto: {
    resumen: 'Un pueblo de pescadores convertido en balneario, con piscinas naturales en el arrecife frente a la arena. El secreto es la marea, no la playa.',
    temporada: { alta: [1, 2, 7, 12], baja: [4, 5, 6, 8], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días y el agua pierde transparencia. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros.' },
    clima: {
      titulo: 'Clima en Porto de Galinhas mes por mes',
      intro: 'En Porto de Galinhas hace calor todo el año y el agua nunca baja de 26°. Lo que cambia es la lluvia.',
      meses: [
        { m: 'Ene', max: 31, min: 23, lluvia: 107, mar: 28, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 23, lluvia: 127, mar: 28.5, demanda: 'alta' },
        { m: 'Mar', max: 31, min: 23, lluvia: 197, mar: 29, demanda: 'media' },
        { m: 'Abr', max: 30, min: 23, lluvia: 269, mar: 29, demanda: 'baja' },
        { m: 'May', max: 30, min: 22, lluvia: 317, mar: 28.5, demanda: 'baja' },
        { m: 'Jun', max: 29, min: 22, lluvia: 391, mar: 27.5, demanda: 'baja' },
        { m: 'Jul', max: 28, min: 21, lluvia: 315, mar: 26.5, demanda: 'alta' },
        { m: 'Ago', max: 28, min: 21, lluvia: 187, mar: 26.5, demanda: 'baja' },
        { m: 'Sep', max: 29, min: 22, lluvia: 93, mar: 26.5, demanda: 'media' },
        { m: 'Oct', max: 30, min: 22, lluvia: 53, mar: 27, demanda: 'media' },
        { m: 'Nov', max: 30, min: 23, lluvia: 39, mar: 27.5, demanda: 'media' },
        { m: 'Dic', max: 31, min: 23, lluvia: 62, mar: 27.5, demanda: 'alta' }
      ],
      nota: 'Para piscinas naturales con sol y agua clara: de septiembre a febrero; octubre y noviembre son los meses más secos y todavía no tienen precios de verano. De abril a julio llueve fuerte casi todos los días y el agua pierde transparencia. Diciembre, enero y julio son los meses más caros.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 del INMET (estación Recife-Curado, a unos 50 km). Agua: promedio de seatemperature.info para Recife.'
    },
    beaches: [
      { name: 'Praia de Porto de Galinhas', zona: 'Centro de la vila', lat: -8.5008, lng: -35.003, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Porto_de_Galinhas_-_Pernambuco_-_Brasil%282%29.jpg/1280px-Porto_de_Galinhas_-_Pernambuco_-_Brasil%282%29.jpg', vibe: 'La playa del pueblo, con el arrecife a doscientos metros. Con marea baja se forman las piscinas naturales y se llega en jangada.', cuando: 'Marea baja de 0.5 o menos. Mirá la tabla de mareas: sin marea baja no hay piscinas.' },
      { name: 'Maracaípe', zona: 'Sur', lat: -8.5258, lng: -35.0071, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Maraca%C3%ADpe-PE.jpg/1280px-Maraca%C3%ADpe-PE.jpg', vibe: 'La playa de surf, con olas fuertes y mucho menos gente que la vila. Se llega en bicicleta o buggy.', cuando: 'Tarde, para ver el surf.' },
      { name: 'Pontal de Maracaípe', zona: 'Desembocadura del río', lat: -8.54, lng: -35.0085, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/BRUNO_LIMA_PONTAL_DE_MARACAIPE_IPOJUCA_PE_%2826036000327%29.jpg/1280px-BRUNO_LIMA_PONTAL_DE_MARACAIPE_IPOJUCA_PE_%2826036000327%29.jpg', vibe: 'Donde el río se encuentra con el mar, con manglar y caballitos de mar que los jangadeiros muestran sin sacarlos del agua.', cuando: 'Atardecer: el sol se pone sobre el río.' },
      { name: 'Cupe', zona: 'Norte', lat: -8.4741, lng: -34.9949, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Praia_do_Cupe-PE.jpg/1280px-Praia_do_Cupe-PE.jpg', vibe: 'Playa larga y tranquila con piscinas en el arrecife, frente a los resorts. Casi sin vendedores.', cuando: 'Marea baja, de mañana.' },
      { name: 'Muro Alto', zona: 'Norte, 10 km', lat: -8.4198, lng: -34.9738, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/BRUNO_LIMA_PRAIA_DE_MURO_ALTO_IPOJUCA_PE_%289%29_%2839776720770%29.jpg/1280px-BRUNO_LIMA_PRAIA_DE_MURO_ALTO_IPOJUCA_PE_%289%29_%2839776720770%29.jpg', vibe: 'Un arrecife largo forma una piscina natural de dos kilómetros: agua calma y tibia todo el día, sin depender de la marea.', cuando: 'Todo el día, ideal con chicos.' },
      { name: 'Serrambi', zona: 'Sur, 12 km', lat: -8.562, lng: -35.017, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Vista_da_praia_de_Serrambi%2C_Ipojuca-PE.jpg/1280px-Vista_da_praia_de_Serrambi%2C_Ipojuca-PE.jpg', vibe: 'Playa de arrecifes y piscinas, con muchos menos turistas que Porto. Agua muy clara con marea baja.', cuando: 'Marea baja.' },
      { name: 'Praia dos Carneiros', zona: 'Tamandaré, unos 50 km al sur (1 h)', lat: -8.6967, lng: -35.0887, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Capela_de_S%C3%A3o_Benedito%2C_na_Praia_dos_Carneiros%2C_Tamandar%C3%A9%2C_Brasil.jpg/1280px-Capela_de_S%C3%A3o_Benedito%2C_na_Praia_dos_Carneiros%2C_Tamandar%C3%A9%2C_Brasil.jpg', vibe: 'Cocoteros hasta el agua, piscinas naturales con marea baja y la capillita de São Benedito sobre la arena. El mar es tan calmo que parece una laguna.', cuando: 'Marea baja y, si se puede, entre semana. Casi toda la arena es de clubes de playa que cobran entrada o consumo mínimo.' },
      { name: 'Praia de Guadalupe', zona: 'Sirinhaém, unos 30 km al sur', lat: -8.6855, lng: -35.0856, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Fal%C3%A9sia_na_Praia_de_Guadalupe_-_Barra_do_Sirinha%C3%A9m%2C_Sirinha%C3%A9m_-_PE.jpg/1280px-Fal%C3%A9sia_na_Praia_de_Guadalupe_-_Barra_do_Sirinha%C3%A9m%2C_Sirinha%C3%A9m_-_PE.jpg', vibe: 'Una playa larga y tranquila con barrancas, cocoteros y arrecifes cerca de la orilla, dentro de un área de protección ambiental. Tiene pocos comercios y casi nada de gente.', cuando: 'Marea baja, de mañana; combinala con Carneiros.' },
      { name: 'Praia de Suape', zona: 'Cabo de Santo Agostinho, unos 30 km al norte', lat: -8.3551, lng: -34.9555, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Praia_de_Suape_-_Pernambuco.jpg/1280px-Praia_de_Suape_-_Pernambuco.jpg', vibe: 'Una bahía protegida por el arrecife, de agua calma y poco profunda, junto a la vila de Suape. Hay restaurantes de pescado y salen barcos por el río Massangana.', cuando: 'Marea baja.' },
      { name: 'Enseada dos Corais', zona: 'Cabo de Santo Agostinho, unos 35 km al norte', lat: -8.3309, lng: -34.9508, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Enseada_dos_Corais.JPG/1280px-Enseada_dos_Corais.JPG', vibe: 'Una ensenada con arrecifes que forman piscinas naturales con marea baja. Es una playa de casas de veraneo, más tranquila que Porto.', cuando: 'Marea baja.' },
      { name: 'Praia de Calhetas', zona: 'Cabo de Santo Agostinho, unos 35 km al norte', lat: -8.345, lng: -34.9444, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Praia_de_Calhetas_%28Cabo_de_Santo_Agostinho%29_Pernambuco%2C_Brasil.jpg/1280px-Praia_de_Calhetas_%28Cabo_de_Santo_Agostinho%29_Pernambuco%2C_Brasil.jpg', vibe: 'Una cala chica entre piedras y selva, de agua transparente, buena para snorkel. Se baja por una escalera y tiene una tirolesa que cruza sobre el mar.', cuando: 'Mañana; los fines de semana se llena.' },
      { name: 'Praia de Gaibu', zona: 'Cabo de Santo Agostinho, unos 35 km al norte', lat: -8.3239, lng: -34.9469, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Praia_de_Gaibu%2C_Cabo%2C_PE.jpg/1280px-Praia_de_Gaibu%2C_Cabo%2C_PE.jpg', vibe: 'Una playa larga con olas, surf y muchos bares sobre la arena. Es la más concurrida del Cabo de Santo Agostinho.', cuando: 'Tarde.' },
      { name: 'Praia de Itapuama', zona: 'Cabo de Santo Agostinho, unos 40 km al norte', lat: -8.2972, lng: -34.9528, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Itapuama-Cabo_de_Santo_Agostinho_1.JPG/1280px-Itapuama-Cabo_de_Santo_Agostinho_1.JPG', vibe: 'Una playa abierta con olas, frecuentada por surfistas, al pie de la Pedra do Xaréu. Tiene pocos comercios.', cuando: 'Mañana, antes del viento.' }
    ],
    atracciones: [
      { name: 'Piscinas naturais', zona: 'Frente a la vila', lat: -8.5045, lng: -34.9985, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Piscinas_Naturais_de_Porto_de_Galinhas_-_Pernambuco.jpg/1280px-Piscinas_Naturais_de_Porto_de_Galinhas_-_Pernambuco.jpg', dur: '1 h', usd: 5, nota: 'Las piscinas del arrecife, con peces de colores. Se llega en jangada con marea baja; el precio es por persona y es fijo.' },
      { name: 'Vila de Porto de Galinhas', zona: 'Centro', lat: -8.5055, lng: -35.002, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Esculturas_de_galinhas_na_Vila_de_Porto_de_Galinhas_-_Praia_de_Porto_de_Galinhas_-_Pernambuco_-_Brasil.jpg/1280px-Esculturas_de_galinhas_na_Vila_de_Porto_de_Galinhas_-_Praia_de_Porto_de_Galinhas_-_Pernambuco_-_Brasil.jpg', dur: '1 h', usd: 0, nota: 'Calles peatonales con esculturas de gallinas, artesanía y bares. De noche se llena.' },
      { name: 'Pontal de Maracaípe al atardecer', zona: 'Maracaípe', lat: -8.54, lng: -35.0085, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Pontal_de_Maraca%C3%ADpe.jpg/1280px-Pontal_de_Maraca%C3%ADpe.jpg', dur: '1 h', usd: 0, nota: 'El mejor atardecer de la zona, sobre el río y el manglar.' },
      { name: 'Forte Castelo do Mar y Vila de Nazaré', zona: 'Cabo de Santo Agostinho, unos 18 km al norte', dur: '2 h', lat: -8.3586, lng: -34.945, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Forte_Castelo_do_Mar.JPG/1280px-Forte_Castelo_do_Mar.JPG', nota: 'Las ruinas del fuerte de 1630, sobre las piedras del cabo, junto a la Igreja de Nossa Senhora de Nazaré y las ruinas del convento carmelita. Se combina en el mismo día con Calhetas y la playa de Suape. El camino de tierra al fuerte se pone feo después de la lluvia: llevá calzado firme.' },
      { name: 'Convento de Santo Antônio de Ipojuca', zona: 'Ciudad de Ipojuca, unos 15 km tierra adentro', dur: '1 h', lat: -8.398, lng: -35.061, nota: 'Uno de los conventos franciscanos más antiguos de Brasil, fundado en 1606 y protegido como patrimonio nacional desde 1937. Al lado está la capilla del Senhor Santo Cristo, con un Cristo crucificado de brazos en alto que atrae romerías, sobre todo el 1 de enero. No encontramos horarios publicados: andá de mañana y preguntá en el lugar.' }
    ],
    comer: [
      { name: 'Tapioca en la vila', tipo: 'Desayuno', zona: 'Centro', usd: 3, momento: 'Mañana', nota: 'Tapioca de queijo coalho y coco, en los puestos de la plaza.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la playa. Más barato que cualquier restaurante de la orilla.' },
      { name: 'Agua de coco', tipo: 'Merienda', zona: 'En la arena', usd: 2, momento: 'Toda la tarde', nota: 'Coco verde frío, abierto en el momento.' },
      { name: 'Peixe na telha', tipo: 'Cena', zona: 'Vila', usd: 20, momento: 'Noche', nota: 'Pescado cocinado en teja de barro, para compartir entre dos.' },
      { name: 'Caldinho', tipo: 'Merienda', zona: 'Barracas de playa y bares de la vila', momento: 'Tarde', nota: 'Caldo espeso de porotos, pescado o camarón, servido en vasito. Es el acompañamiento clásico de la cerveza en Pernambuco.' },
      { name: 'Carne de sol com macaxeira', tipo: 'Almuerzo', zona: 'Restaurantes de comida regional', momento: 'Mediodía', nota: 'Carne salada y oreada, a la plancha, con mandioca frita o hervida, manteca de garrafa y queijo coalho. Un plato del nordeste que se come en toda la región.' },
      { name: 'Cartola', tipo: 'Merienda', zona: 'Restaurantes y cafés de la vila', momento: 'Postre', nota: 'El postre típico de Pernambuco: banana frita con queijo coalho derretido arriba, azúcar y canela.' }
    ],
    hacer: [
      { name: 'Jangada a las piscinas', zona: 'Frente a la vila', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Jangadas_em_Porto_de_Galinhas_-_Brasil_%287489903588%29.jpg/1280px-Jangadas_em_Porto_de_Galinhas_-_Brasil_%287489903588%29.jpg', dur: '1 h', usd: 5, nota: 'Las balsas de vela salen con marea baja. Llevá máscara: el agua llega a la cintura.' },
      { name: 'Buggy por las playas', zona: 'Sale de la vila', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Buggies_na_Praia_de_Porto_de_Galinhas_-_Ipojuca%2C_Pernambuco%2C_Brasil.jpg/1280px-Buggies_na_Praia_de_Porto_de_Galinhas_-_Ipojuca%2C_Pernambuco%2C_Brasil.jpg', dur: '4 h', usd: 25, nota: 'Recorre Muro Alto, Cupe, Maracaípe y el Pontal. Se comparte entre cuatro.' },
      { name: 'Paseo de caballitos de mar', zona: 'Pontal de Maracaípe', dur: '1 h', usd: 6, nota: 'Jangada por el río para ver caballitos de mar en el manglar.' },
      { name: 'Trilha dos Escravos e Igreja do Outeiro', zona: 'Sale del río Maracaípe', dur: '4 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Igreja_do_Oiteiro_em_Porto_de_Galinhas.jpg/1280px-Igreja_do_Oiteiro_em_Porto_de_Galinhas.jpg', nota: 'Una caminata guiada de unos 6,5 km: se cruza el manglar con agua por la rodilla o la cintura, según la marea, y se sube por la restinga hasta la Igreja do Outeiro, en el punto más alto de Maracaípe, con vista al estuario. Termina en una casa de farinha donde se prueba tapioca hecha a leña. Va con guía local y reserva previa; llevá ropa y calzado que se puedan mojar.' },
      { name: 'Paseo a la Ilha de Santo Aleixo', zona: 'Sirinhaém, unos 12 km al sur', dur: 'Día entero', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Ilha_de_Santo_Aleixo%2C_Sirinha%C3%A9m.jpg/960px-Ilha_de_Santo_Aleixo%2C_Sirinha%C3%A9m.jpg', nota: 'Una isla privada con piscinas naturales y agua calma. Se va en van hasta la Barra de Sirinhaém y de ahí son unos 15 minutos en lancha. Las agencias de la vila lo venden con el traslado y el day use de un club de playa; preguntá bien qué incluye antes de pagar.' },
      { name: 'Buceo con tanque', zona: 'Frente a la vila y mar afuera', dur: 'Medio día', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Mergulho_na_Praia_de_Porto_de_Galinhas_-_Ipojuca%2C_Pernambuco%2C_Brasil.jpg/1280px-Mergulho_na_Praia_de_Porto_de_Galinhas_-_Ipojuca%2C_Pernambuco%2C_Brasil.jpg', nota: 'Hay bautismos de buceo en los corales, para quien nunca buceó, y salidas a naufragios a más de 30 metros, solo para buzos con certificado. Contratalo con una operadora habilitada y en días de mar calmo.' },
      { name: 'Tirolesa en Calhetas', zona: 'Cabo de Santo Agostinho, unos 19 km al norte', dur: 'Medio día', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Praia_de_Calhetas_-_Cabo_de_Santo_Agostinho_-_Pernambuco_%281%29.jpg/1280px-Praia_de_Calhetas_-_Cabo_de_Santo_Agostinho_-_Pernambuco_%281%29.jpg', nota: 'Un cable cruza la cala por arriba del mar y te deja en la otra punta de la playa. Se suma al paseo del Cabo de Santo Agostinho que venden las agencias de la vila, junto con los miradores y la Vila de Nazaré.' }
    ],
    tips: [
      { titulo: 'La tabla de mareas manda', texto: 'Las piscinas solo existen con marea baja, y cambia de horario todos los días. Planeá el día al revés: primero la marea, después todo lo demás.' },
      { titulo: 'No pises el coral', texto: 'El arrecife está vivo y es área protegida. Hay multas por pisarlo o dar de comer a los peces.' },
      { titulo: 'Recife queda a una hora', texto: 'El aeropuerto está en Recife, a 60 km. El ómnibus sale más barato que el transfer, pero tarda el doble.' },
      { titulo: 'Luna llena y luna nueva', texto: 'Las mareas más bajas del mes caen en las semanas de luna llena y luna nueva: ahí las piscinas tienen el agua más baja y más clara. Si podés elegir fechas, apuntá a esos días.' },
      { titulo: 'La jangada se compra en la playa', texto: 'El precio es fijo, lo pone la asociación de jangadeiros, y el ticket se compra en sus casillas frente a la playa, sin reserva. Las salidas empiezan más o menos una hora antes del horario de la marea mínima.' },
      { titulo: 'Cupe tiene corriente', texto: 'En la playa del Cupe, frente a muchos hoteles, el mar tiene corriente fuerte. Para nadar tranquilo, Muro Alto y el Pontal do Cupe son más calmos.' }
    ]
  },

  mcz: {
    resumen: 'Una capital con playa urbana de agua verde y piscinas naturales frente a la rambla. Lo mejor es la costa al norte y al sur, a menos de media hora.',
    temporada: { alta: [1, 2, 7, 12], baja: [4, 5, 6, 8], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días y el agua pierde transparencia. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros.' },
    clima: {
      titulo: 'Clima en Maceió mes por mes',
      intro: 'Maceió tiene sol y calor casi todo el año. La lluvia se concentra de abril a agosto.',
      meses: [
        { m: 'Ene', max: 31, min: 21, lluvia: 91, mar: 27.5, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 22, lluvia: 80, mar: 28, demanda: 'alta' },
        { m: 'Mar', max: 32, min: 22, lluvia: 101, mar: 28.5, demanda: 'media' },
        { m: 'Abr', max: 31, min: 22, lluvia: 194, mar: 29, demanda: 'baja' },
        { m: 'May', max: 30, min: 21, lluvia: 295, mar: 28.5, demanda: 'baja' },
        { m: 'Jun', max: 28, min: 20, lluvia: 323, mar: 27.5, demanda: 'baja' },
        { m: 'Jul', max: 28, min: 20, lluvia: 271, mar: 26.5, demanda: 'alta' },
        { m: 'Ago', max: 28, min: 20, lluvia: 192, mar: 26, demanda: 'baja' },
        { m: 'Sep', max: 28, min: 20, lluvia: 109, mar: 26.5, demanda: 'media' },
        { m: 'Oct', max: 30, min: 20, lluvia: 70, mar: 26.5, demanda: 'media' },
        { m: 'Nov', max: 31, min: 22, lluvia: 45, mar: 27, demanda: 'media' },
        { m: 'Dic', max: 31, min: 21, lluvia: 37, mar: 27, demanda: 'alta' }
      ],
      nota: 'Para playa y piscinas de Pajuçara con agua clara: de septiembre a marzo, con noviembre y diciembre como los meses más secos. De abril a agosto llueve fuerte un rato casi todos los días y el mar se pone turbio. Diciembre, enero y julio son los meses más caros.',
      fuente: 'Temperaturas y lluvia: normales climatológicas del INMET (estación Maceió). Agua: promedio de seatemperature.info.'
    },
    beaches: [
      { name: 'Pajuçara', zona: 'Rambla, 2 km', lat: -9.6694, lng: -35.7136, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Praia_de_Paju%C3%A7ara%2C_Macei%C3%B3%2C_Alagoas_%2851381092942%29.jpg/1280px-Praia_de_Paju%C3%A7ara%2C_Macei%C3%B3%2C_Alagoas_%2851381092942%29.jpg', vibe: 'La playa de las piscinas naturales: con marea baja salen las jangadas hasta el arrecife, a dos kilómetros de la orilla.', cuando: 'Marea baja de mañana.' },
      { name: 'Ponta Verde', zona: 'Rambla, 4 km', lat: -9.6603, lng: -35.6971, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Ponta_Verde_Beach%2C_Macei%C3%B3%2C_Brazil.jpg/1280px-Ponta_Verde_Beach%2C_Macei%C3%B3%2C_Brazil.jpg', vibe: 'Agua verde y quieta protegida por el arrecife, con la rambla, los quioscos y el farol de la punta, al que se llega caminando con marea baja.', cuando: 'Mañana.' },
      { name: 'Jatiúca', zona: 'Rambla, 6 km', lat: -9.646, lng: -35.702, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Praia_da_Jati%C3%BAca%2C_Macei%C3%B3.jpg/1280px-Praia_da_Jati%C3%BAca%2C_Macei%C3%B3.jpg', vibe: 'La continuación de Ponta Verde, con más ola y menos piscinas. Es la playa de los hoteles grandes.', cuando: 'Tarde.' },
      { name: 'Cruz das Almas', zona: 'Norte, 8 km', lat: -9.6289, lng: -35.695, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Praia_de_Cruz_das_Almas%2C_Macei%C3%B3_%2851386956519%29.jpg/1280px-Praia_de_Cruz_das_Almas%2C_Macei%C3%B3_%2851386956519%29.jpg', vibe: 'Playa con olas, buena para surf y para caminar. Menos gente que la rambla.', cuando: 'Tarde.' },
      { name: 'Ipioca', zona: 'Litoral norte, 25 km', lat: -9.5317, lng: -35.6054, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Praia_de_Ipioca_-_Macei%C3%B3_-_Alagoas_%2811394587604%29.jpg/1280px-Praia_de_Ipioca_-_Macei%C3%B3_-_Alagoas_%2811394587604%29.jpg', vibe: 'Playa larga de cocoteros, con piscinas en el arrecife y clubes de playa. La primera de la costa norte que parece fuera de la ciudad.', cuando: 'Día entero.' },
      { name: 'Praia do Francês', zona: 'Marechal Deodoro, 22 km al sur', lat: -9.77, lng: -35.838, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Praia_do_Franc%C3%AAs.jpg/1280px-Praia_do_Franc%C3%AAs.jpg', vibe: 'Un lado protegido por arrecife, con agua quieta, y otro con olas para surf. Bares sobre la arena.', cuando: 'Todo el día; se llena el fin de semana.' },
      { name: 'Praia da Sereia', zona: 'Litoral norte, 18 km', lat: -9.5634, lng: -35.6444, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Praia_da_Sereia_-_Macei%C3%B3_-_Alagoas_-_Brasil._%2811410484595%29.jpg/1280px-Praia_da_Sereia_-_Macei%C3%B3_-_Alagoas_-_Brasil._%2811410484595%29.jpg', vibe: 'Una playa con piscinas naturales en el arrecife y la escultura de una sirena sobre una piedra en el agua. Tiene restaurantes de pescado y agua calma con marea baja.', cuando: 'Marea baja, de mañana.' },
      { name: 'Praia da Barra de São Miguel', zona: 'Barra de São Miguel, 32 km al sur', lat: -9.8349, lng: -35.8856, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Barra_de_S%C3%A3o_Miguel_-_Alagoas_%287522728350%29.jpg/1280px-Barra_de_S%C3%A3o_Miguel_-_Alagoas_%287522728350%29.jpg', vibe: 'Una playa de agua quieta, protegida por un arrecife largo frente a la costa. De la vila salen las lanchas al Gunga.', cuando: 'Marea baja.' },
      { name: 'Praia do Gunga', zona: 'Roteiro, 35 km al sur', lat: -9.8609, lng: -35.9047, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Praia-do-gunga-2012-09-22.JPG/1280px-Praia-do-gunga-2012-09-22.JPG', vibe: 'Una punta de arena entre el mar y la laguna del Roteiro, con cocoteros y barrancas de colores. Agua calma, kioscos y paseos en buggy a las barrancas.', cuando: 'Marea baja; se llena los fines de semana.' }
    ],
    atracciones: [
      { name: 'Feirinha de artesanato da Pajuçara', zona: 'Pajuçara', lat: -9.6645, lng: -35.7085, foto: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Feirinha_de_Artesanato_da_Paju%C3%A7ara.jpg', dur: '1 h', usd: 0, nota: 'Puestos de artesanía y bordado filé, típico de Alagoas. Se negocia el precio.' },
      { name: 'Mirante de São Gonçalo', zona: 'Centro', lat: -9.6633, lng: -35.7328, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Mirante_S%C3%A3o_Gon%C3%A7alo_-_panoramio.jpg/1280px-Mirante_S%C3%A3o_Gon%C3%A7alo_-_panoramio.jpg', dur: '30 min', usd: 0, nota: 'Mirador sobre la ciudad y el mar, en el barrio de Farol.' },
      { name: 'Catedral Metropolitana', zona: 'Centro', lat: -9.6653, lng: -35.7353, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Catedral_Metropolitana_de_Macei%C3%B3_1.jpg/1280px-Catedral_Metropolitana_de_Macei%C3%B3_1.jpg', dur: '20 min', usd: 0, nota: 'La catedral de Nossa Senhora dos Prazeres, del siglo XIX, en la Praça Dom Pedro II del centro histórico.' },
      { name: 'Marco dos Corais', zona: 'Ponta Verde, Praça Gogó da Ema', dur: '30 min', usd: 0, lat: -9.6655, lng: -35.6962, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Marco_dos_Corais%2C_Macei%C3%B3_%2852143550962%29.jpg/1280px-Marco_dos_Corais%2C_Macei%C3%B3_%2852143550962%29.jpg', nota: 'Un muelle sobre el mar en la punta de Ponta Verde, armado en 2022 sobre el viejo muelle del Alagoas Iate Clube, con un caballito de mar de mosaico adentro del agua. Al atardecer se llena: desde ahí se ve el sol bajar detrás del puerto. Es gratis y queda sobre la rambla, a pie desde Pajuçara.' },
      { name: 'Museu Palácio Floriano Peixoto', zona: 'Centro, Praça dos Martírios', dur: '1 h', usd: 0, lat: -9.66, lng: -35.7406, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Museu_Pal%C3%A1cio_Floriano_Peixoto_01.jpg/960px-Museu_Pal%C3%A1cio_Floriano_Peixoto_01.jpg', nota: 'El antiguo palacio de gobierno de Alagoas, blanco y del siglo XIX, hoy es museo, con salones de época y exposiciones temporarias. La entrada es gratis y abre en días hábiles; confirmá el horario con la Secretaría de Cultura de Alagoas antes de ir. Combinalo con la Catedral, a pocas cuadras.' },
      { name: 'Convento de Santa Maria Madalena y Museu de Arte Sacra', zona: 'Marechal Deodoro, centro histórico', dur: '1 h 30', lat: -9.7151, lng: -35.8934, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Igrejas_e_convento_franciscanos_-_Museu_de_Arte_Sacra_de_Alagoas_02.jpg/1280px-Igrejas_e_convento_franciscanos_-_Museu_de_Arte_Sacra_de_Alagoas_02.jpg', nota: 'Iglesia y convento franciscano levantados entre 1684 y 1793 en Marechal Deodoro, la primera capital de Alagoas, a unos 30 km por ruta desde la rambla. Adentro está el museo de arte sacro, con imágenes en madera, oro y plata de los siglos XVII y XVIII. Cobra entrada y no abre lunes ni martes: confirmá el horario. Queda de camino a la Praia do Francês.' },
      { name: 'Igreja do Senhor do Bonfim', zona: 'Marechal Deodoro, salida de la ciudad', dur: '20 min', lat: -9.7332, lng: -35.8913, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Igreja_do_Bonfim_-_Mal._Deodoro.jpg/1280px-Igreja_do_Bonfim_-_Mal._Deodoro.jpg', nota: 'La iglesia más antigua de Marechal Deodoro, sencilla, blanca y amarilla, restaurada y reabierta en 2022. Está a unos 2 km del centro histórico: conviene parar con el auto o el taxi al salir de la ciudad.' }
    ],
    comer: [
      { name: 'Tapioca de la rambla', tipo: 'Desayuno', zona: 'Pajuçara', usd: 3, momento: 'Mañana', nota: 'Las tapioqueiras de la rambla, con coco y queijo coalho.' },
      { name: 'Sururu', tipo: 'Almuerzo', zona: 'Restaurantes regionales', usd: 10, momento: 'Mediodía', nota: 'Un molusco de la laguna Mundaú, en caldo o en arroz. El plato de Maceió.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Ponta Verde', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la rambla.' },
      { name: 'Camarón en los quioscos', tipo: 'Cena', zona: 'Rambla', usd: 15, momento: 'Noche', nota: 'Porción de camarón frito para compartir mirando el mar.' },
      { name: 'Almuerzo en Massagueira', tipo: 'Almuerzo', zona: 'Massagueira, Marechal Deodoro, frente a la Lagoa Manguaba', momento: 'Mediodía, a la vuelta de la playa', nota: 'Un pueblo de restaurantes de comida regional a la orilla de la laguna, en el camino entre Maceió y la Praia do Francês. Se come pescado de laguna y de mar, camarón, sururu y la agulhinha frita, un pescadito crocante. El Bar do Pato es el clásico.' },
      { name: 'Bolo de goma', tipo: 'Merienda', zona: 'Entrada de Massagueira', momento: 'Tarde', nota: 'Las rosquitas de polvilho que venden en los puestos a la entrada de Massagueira, junto con otros dulces regionales. Para comprar al pasar, a la vuelta del litoral sur.' },
      { name: 'Chiclete de camarão', tipo: 'Cena', zona: 'Restaurantes de camarón de la rambla', momento: 'Noche', nota: 'Camarón en una salsa de varios quesos que se estira como chicle. El Imperador dos Camarões, sobre la rambla, es el restaurante que lo hizo conocido; hay porción chica para entrada.' }
    ],
    hacer: [
      { name: 'Jangada a las piscinas de Pajuçara', zona: 'Pajuçara', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Jangadas_na_Praia_de_Paju%C3%A7ara.jpg/1280px-Jangadas_na_Praia_de_Paju%C3%A7ara.jpg', dur: '1 h 30', usd: 8, nota: 'Salen con marea baja desde la arena. Precio fijo por persona, tabla en el puesto.' },
      { name: 'Bicicleta por la rambla', zona: 'Pajuçara a Cruz das Almas', dur: '1 h', usd: 0, nota: 'Ciclovía plana de 7 u 8 km frente al mar.' },
      { name: 'Barco por la Lagoa Mundaú', zona: 'Pontal da Barra', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/Ilha_na_Lagoa_Munda%C3%BA%2C_AL.jpg/1280px-Ilha_na_Lagoa_Munda%C3%BA%2C_AL.jpg', dur: '3 h', usd: 15, nota: 'Recorre las islas de la laguna. Sale del Pontal, el barrio de las bordadoras de filé.' },
      { name: 'Piscinas naturales de Ipioca', zona: 'Ipioca, litoral norte', dur: 'Medio día', nota: 'Ipioca tiene dos piscinas en el arrecife: a la del Tatu se va en jangada, desde el acceso público a la playa, y a la del Português en lancha o catamarán, que se contratan en los clubes de playa. Solo valen con marea baja de 0,5 o menos y día de sol. Queda mucho más cerca que Maragogi.' },
      { name: 'Piscinas naturales de Paripueira', zona: 'Paripueira, litoral norte', dur: 'Día entero', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Vista_a%C3%A9rea-Paripueira.jpg/1280px-Vista_a%C3%A9rea-Paripueira.jpg', nota: 'Las piscinas están a unos 2 km de la costa y se va en catamarán desde un club de playa de Costa Brava, en Paripueira: son 12 minutos de navegación y el paseo dura unas 2 horas. Además del barco se paga el day-use del club. El agua de la playa suele estar turbia, pero la de las piscinas es clara con marea baja.' },
      { name: 'Filé alagoano en el Pontal da Barra', zona: 'Pontal da Barra, a orillas de la Lagoa Mundaú', dur: '1 h 30', usd: 0, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Pontal_da_Barra_-_Porto_das_Canoas_-_Pra%C3%A7a_Am%C3%A9rico_Cust%C3%B3dio.jpg/1280px-Pontal_da_Barra_-_Porto_das_Canoas_-_Pra%C3%A7a_Am%C3%A9rico_Cust%C3%B3dio.jpg', nota: 'El barrio de las bordadoras de filé, el bordado sobre red de pesca que es patrimonio de Alagoas. Las callecitas están llenas de tiendas y a veces ves a alguien bordando. Andá temprano: después de las 16, cuando se van los ómnibus de turistas, empiezan a cerrar.' },
      { name: 'Noche en Jaraguá', zona: 'Jaraguá, barrio del puerto', dur: 'Una noche', nota: 'El barrio portuario, de casonas viejas, tiene la noche más alternativa: bares con música en vivo, un bar de jazz y el pasaje peatonal Rocha Cavalcante. Se mueve de jueves a sábado; los otros días está vacío. De día podés pasar por el Mercado das Artes 31, con artesanía de autor. Andá y volvé en Uber o taxi.' }
    ],
    tips: [
      { titulo: 'La marea, de nuevo', texto: 'Las piscinas de Pajuçara solo aparecen con marea baja. Los jangadeiros te dicen el horario del día.' },
      { titulo: 'El Gunga, mejor con excursión', texto: 'La Praia do Gunga, la de los acantilados, queda a más de 30 km. Se puede ir en ómnibus hasta la Barra de São Miguel y cruzar en lancha, pero la excursión es más simple.' },
      { titulo: 'Pajuçara para comer, Ponta Verde para dormir', texto: 'Las dos playas están pegadas. Los restaurantes baratos y la feria están en Pajuçara; los hoteles con vista, en Ponta Verde.' },
      { titulo: 'Mirá la tabla de mareas, no solo el horario', texto: 'Para las piscinas naturales importa el nivel: con marea de 0,5 o menos valen la pena; de 0,6 para arriba, no. Las mareas más bajas son con luna llena y luna nueva, y a la mañana. Llegá a las piscinas antes del mínimo y no vayas con día nublado.' },
      { titulo: 'Antes de bañarte en la ciudad, mirá el informe del IMA', texto: 'El Instituto do Meio Ambiente de Alagoas publica cada semana qué tramos de playa están aptos para el baño. Varios tramos de Pajuçara, Ponta Verde, Jatiúca y Cruz das Almas suelen salir no aptos; en el litoral norte y sur hay más tramos aptos.' },
      { titulo: 'Maragogi y Milagres no son para ir y volver en el día', texto: 'Los tours salen muy temprano y son más de 2 horas de ruta por tramo, más el tiempo de buscar pasajeros por los hoteles. Si te interesan, dormí allá una o dos noches; para piscinas en el día, Ipioca o Paripueira quedan mucho más cerca.' },
      { titulo: 'Si manejás, no tomes en la playa', texto: 'En Alagoas hay controles de alcohol (lei seca) a la vuelta de las playas. Con el GPS, preferí las avenidas principales: el Waze a veces manda por atajos de barrios poco recomendables.' }
    ]
  },

  maragogi: {
    resumen: 'Le dicen el Caribe brasileño por los galés: piscinas en un arrecife a seis kilómetros mar adentro. En tierra, playas de cocoteros casi vacías.',
    temporada: { alta: [1, 2, 7, 12], baja: [4, 5, 6, 8], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días y el agua pierde transparencia. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros. Los galés dependen de la marea baja y de la luna: en cuarto creciente o menguante las mareas son flojas.' },
    clima: {
      titulo: 'Clima en Maragogi mes por mes',
      intro: 'Maragogi tiene calor y agua tibia todo el año. Para los galés importan la lluvia y la marea más que la temperatura.',
      meses: [
        { m: 'Ene', max: 33, min: 21, lluvia: 70, mar: 27.5, demanda: 'alta' },
        { m: 'Feb', max: 32, min: 21, lluvia: 103, mar: 28, demanda: 'alta' },
        { m: 'Mar', max: 32, min: 22, lluvia: 146, mar: 28.5, demanda: 'media' },
        { m: 'Abr', max: 32, min: 21, lluvia: 193, mar: 29, demanda: 'baja' },
        { m: 'May', max: 30, min: 21, lluvia: 192, mar: 28.5, demanda: 'baja' },
        { m: 'Jun', max: 29, min: 20, lluvia: 187, mar: 27.5, demanda: 'baja' },
        { m: 'Jul', max: 28, min: 19, lluvia: 210, mar: 26.5, demanda: 'alta' },
        { m: 'Ago', max: 28, min: 19, lluvia: 104, mar: 26, demanda: 'baja' },
        { m: 'Sep', max: 29, min: 19, lluvia: 62, mar: 26.5, demanda: 'media' },
        { m: 'Oct', max: 31, min: 20, lluvia: 43, mar: 26.5, demanda: 'media' },
        { m: 'Nov', max: 32, min: 21, lluvia: 41, mar: 27, demanda: 'media' },
        { m: 'Dic', max: 33, min: 21, lluvia: 44, mar: 27, demanda: 'alta' }
      ],
      nota: 'Para ver los galés con agua cristalina: de septiembre a febrero, y de octubre a diciembre es cuando menos llueve. De abril a julio llueve casi todos los días y el agua se enturbia. Diciembre, enero y julio son los meses más caros; mirá la tabla de mareas antes de reservar el catamarán.',
      fuente: 'Temperaturas y lluvia: tabla climatológica de Maragogi del Departamento de Ciências Atmosféricas de la UFCG. Agua: promedio de seatemperature.info para Maceió.'
    },
    beaches: [
      { name: 'São Bento', zona: 'Sur, 4 km', lat: -9.0495, lng: -35.2392, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Praia_de_S%C3%A3o_Bento_%2851724223470%29.jpg/1280px-Praia_de_S%C3%A3o_Bento_%2851724223470%29.jpg', vibe: 'Una vila de pescadores con capilla frente al mar y piscinas naturales en la orilla con marea baja.', cuando: 'Marea baja.' },
      { name: 'Antunes', zona: 'Norte, 7 km', lat: -8.9746, lng: -35.18, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Praia_de_Antunes-3_%2851723356401%29.jpg/1280px-Praia_de_Antunes-3_%2851723356401%29.jpg', vibe: 'Cocoteros hasta la arena, agua quieta y piscinas naturales con marea baja. Para muchos, la más linda de Maragogi.', cuando: 'Mañana.' },
      { name: 'Barra Grande', zona: 'Norte, 3 km', lat: -8.989, lng: -35.195, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/Praia_de_Barra_Grande_-_Maragogi-7_%2851711885497%29.jpg/1280px-Praia_de_Barra_Grande_-_Maragogi-7_%2851711885497%29.jpg', vibe: 'Playa larga donde, con marea baja, se forma el Caminho de Moisés: una lengua de arena que entra en el mar.', cuando: 'Marea baja.' },
      { name: 'Japaratinga', zona: 'Sur, 15 km', lat: -9.088, lng: -35.258, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/Praia_de_Japaratinga_-_Alagoas._%2813125129473%29.jpg/1280px-Praia_de_Japaratinga_-_Alagoas._%2813125129473%29.jpg', vibe: 'Un pueblo vecino con playa de agua muy quieta y cocoteros. Tranquilo incluso en enero.', cuando: 'Todo el día.' },
      { name: 'Patacho', zona: 'Porto de Pedras, 30 km por la AL-101', lat: -9.16, lng: -35.296, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Vista_da_Praia_do_Patacho.jpg/1280px-Vista_da_Praia_do_Patacho.jpg', vibe: 'Arena blanca, cocoteros y piscinas naturales, en la Ruta Ecológica. Una de las playas más lindas de Alagoas.', cuando: 'Marea baja, de mañana.' },
      { name: 'Praia do Camacho', zona: 'Centro', lat: -9.0179, lng: -35.2209, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Praia_do_Camacho_%2851724228245%29.jpg/1280px-Praia_do_Camacho_%2851724228245%29.jpg', vibe: 'La playa del centro, frente a la costanera, con bares, pousadas y las agencias de los catamaranes a los galés. Agua calma protegida por el arrecife.', cuando: 'Marea baja; al atardecer, para caminar la costanera.' },
      { name: 'Ponta de Mangue', zona: 'Norte, 9 km', lat: -8.9572, lng: -35.1729, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Praia_de_Ponta_de_Mangue.jpg/1280px-Praia_de_Ponta_de_Mangue.jpg', vibe: 'Una playa de cocoteros y agua calma al norte de Antunes, con resorts y pocas construcciones sobre la arena. Con marea baja se forman piscinas en el arrecife.', cuando: 'Marea baja, de mañana.' },
      { name: 'São José da Coroa Grande', zona: 'Pernambuco, 18 km al norte', lat: -8.9062, lng: -35.1485, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/S%C3%A3o_Jos%C3%A9_da_Coroa_Grande_-_Pernambuco_-_Brasil.jpg/1280px-S%C3%A3o_Jos%C3%A9_da_Coroa_Grande_-_Pernambuco_-_Brasil.jpg', vibe: 'El primer pueblo de Pernambuco, con una playa larga de agua quieta y arrecifes que forman piscinas con marea baja. Tranquilo y con pocos turistas.', cuando: 'Marea baja.' },
      { name: 'Praia de Bitingui', zona: 'Japaratinga, 17 km al sur', lat: -9.1199, lng: -35.2715, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Praia_de_Bitingui_%2851709285719%29.jpg/1280px-Praia_de_Bitingui_%2851709285719%29.jpg', vibe: 'Una playa de cocoteros y arena blanca, de agua calma y casi sin construcciones. Con marea baja se camina lejos mar adentro.', cuando: 'Marea baja, de mañana.' },
      { name: 'Barreiras do Boqueirão', zona: 'Japaratinga, 18 km al sur', lat: -9.1252, lng: -35.2792, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Praia_Barreiras_do_Boqueir%C3%A3o_%2851724968887%29.jpg/1280px-Praia_Barreiras_do_Boqueir%C3%A3o_%2851724968887%29.jpg', vibe: 'Una playa con barrancas rojizas detrás de la arena y agua calma y clara. Hay pocos kioscos y mucho espacio.', cuando: 'Marea baja.' },
      { name: 'Praia de Tatuamunha', zona: 'Porto de Pedras, 32 km al sur', lat: -9.2266, lng: -35.3349, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Praia_de_Tatuamunha_-_Porto_de_Pedras_%2851726802328%29.jpg/1280px-Praia_de_Tatuamunha_-_Porto_de_Pedras_%2851726802328%29.jpg', vibe: 'Una playa de cocoteros en la Rota Ecológica, junto a la desembocadura del río Tatuamunha, donde está el santuario del peixe-boi (manatí). Agua calma y pocas pousadas.', cuando: 'Marea baja; el paseo del manatí sale según la marea.' },
      { name: 'Porto da Rua', zona: 'São Miguel dos Milagres, 35 km al sur', lat: -9.2406, lng: -35.3442, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Praia_de_Porto_da_Rua%2C_S%C3%A3o_Miguel_dos_Milagres%2C_Alagoas.jpg/1280px-Praia_de_Porto_da_Rua%2C_S%C3%A3o_Miguel_dos_Milagres%2C_Alagoas.jpg', vibe: 'Una playa de pescadores en la Rota Ecológica, con piscinas naturales en el arrecife y jangadas que llevan hasta ellas. Pousadas chicas y nada de edificios.', cuando: 'Marea baja.' }
    ],
    atracciones: [
      { name: 'Galés de Maragogi', zona: '6 km mar adentro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Peixe_papagaio_-_Piscinas_naturais_de_maragogi_-_Alagoas.jpg/1280px-Peixe_papagaio_-_Piscinas_naturais_de_maragogi_-_Alagoas.jpg', dur: '3 h', usd: 30, nota: 'Las piscinas naturales en el arrecife, con agua cristalina y peces. Solo se llega en catamarán y con marea baja; hay cupo diario.' },
      { name: 'Capela de São Bento', zona: 'São Bento', lat: -9.0508, lng: -35.2409, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Capela_de_S%C3%A3o_Bento_-_Praia_de_S%C3%A3o_Bento_%2851723593548%29.jpg/1280px-Capela_de_S%C3%A3o_Bento_-_Praia_de_S%C3%A3o_Bento_%2851723593548%29.jpg', dur: '20 min', usd: 0, nota: 'Capilla blanca frente al mar en la vila de pescadores.' },
      { name: 'Rota Ecológica dos Milagres', zona: 'Sur, desde Japaratinga', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/S%C3%A3o_Miguel_dos_Milagres_%2851728888428%29.jpg/1280px-S%C3%A3o_Miguel_dos_Milagres_%2851728888428%29.jpg', dur: 'Medio día', usd: 0, nota: 'La ruta costera hacia São Miguel dos Milagres, con playas desiertas y pueblos chicos.' },
      { name: 'Ruínas do Mosteiro de São Bento', zona: 'São Bento, 4 km al sur', dur: '30 min', lat: -9.0481, lng: -35.2436, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Mosteiro_de_Sao_Bento_de_Maragogi-2_%2851709385262%29.jpg/1280px-Mosteiro_de_Sao_Bento_de_Maragogi-2_%2851709385262%29.jpg', nota: 'Las paredes de un monasterio del siglo XVII, en un alto sobre la vila de São Bento, con vista a la playa y a los cocoteros. Es parada de los paseos en buggy por el litoral sur; si vas por tu cuenta, combinalo con la playa y la capilla de São Bento.' },
      { name: 'Mirante do Monte Tabor', zona: 'Japaratinga, 9 km al sur', dur: '1 h', lat: -9.0821, lng: -35.2547, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Mirante_do_Monte_Tabor-4_%2851707350912%29.jpg/1280px-Mirante_do_Monte_Tabor-4_%2851707350912%29.jpg', nota: 'Un mirador en lo alto de la Pousada Paraíso dos Coqueirais, sobre la AL-101, con vista al mar turquesa, el arrecife y el palmar. Se paga una entrada para subir. Andá al atardecer: los sábados hay música en vivo a la hora de la puesta de sol.' },
      { name: 'Farol de Porto de Pedras', zona: 'Porto de Pedras, 18 km al sur', dur: '30 min', lat: -9.1568, lng: -35.298, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/Farol_de_Porto_de_Pedras%2C_AL_%2852114915164%29.jpg/1280px-Farol_de_Porto_de_Pedras%2C_AL_%2852114915164%29.jpg', nota: 'El faro blanco y negro de 1933, en el morro de Nossa Senhora da Piedade, sobre el pueblo y la desembocadura del río Manguaba. Se ve desde la balsa que cruza de Japaratinga a Porto de Pedras, camino a Patacho y al peixe-boi. Lo administra la Marinha: no está confirmado que se pueda subir.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso en el centro, lejos de los resorts.' },
      { name: 'Pescado en São Bento', tipo: 'Almuerzo', zona: 'São Bento', usd: 13, momento: 'Mediodía', nota: 'Los bares de los pescadores sirven el pescado del día frente a las piscinas.' },
      { name: 'Agua de coco', tipo: 'Merienda', zona: 'Cualquier playa', usd: 2, momento: 'Tarde', nota: 'Coco verde de los cocoteros de la misma playa.' },
      { name: 'Langosta en São Bento', tipo: 'Cena', zona: 'São Bento', momento: 'Noche', nota: 'La langosta es el plato fuerte de la vila: a la manteca con hierbas y macaxeira frita, o gratinada. De noviembre a abril es la veda y, de febrero a abril, solo se puede servir la congelada declarada; si no hay, piden camarón, pulpo o pescado.' },
      { name: 'Bolinhos de goma', tipo: 'Merienda', zona: 'São Bento', momento: 'Tarde', nota: 'Las galletitas de almidón de mandioca en forma de concha que hacen en las casas de São Bento. Se compran en los puestos a la entrada de la vila.' },
      { name: 'Carne de sol con macaxeira', tipo: 'Almuerzo', zona: 'Centro y Japaratinga', momento: 'Mediodía', nota: 'Carne salada y secada, a la plancha, con mandioca frita, arroz, porotos y farofa. Está en casi todos los restaurantes de la zona, junto con el camarón empanado y los bolinhos de charque.' }
    ],
    hacer: [
      { name: 'Catamarán a los galés', zona: 'Sale de la Praia de Maragogi', dur: '3 h', usd: 30, nota: 'Salen con marea baja; reservá con un día de anticipación. Los días de marea floja el paseo no sale.' },
      { name: 'Buggy por la costa', zona: 'Centro', dur: '4 h', usd: 25, nota: 'Recorre Antunes, Barra Grande y São Bento. Se comparte entre cuatro.' },
      { name: 'Caminho de Moisés', zona: 'Barra Grande', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Caminho_de_Moises_-_Maragogi_%2851712943398%29.jpg/1280px-Caminho_de_Moises_-_Maragogi_%2851712943398%29.jpg', dur: '1 h', usd: 0, nota: 'Con marea muy baja se camina mar adentro por una lengua de arena. Mirá la tabla de mareas antes de ir.' },
      { name: 'Paseo del peixe-boi en el río Tatuamunha', zona: 'Porto de Pedras, 26 km al sur', dur: '1 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Rio_Tatuamunha_%2851726559941%29.jpg/1280px-Rio_Tatuamunha_%2851726559941%29.jpg', nota: 'En jangadas sin motor, río arriba hasta el recinto donde el ICMBio cuida y reintroduce manatíes. Sale de la sede de la Associação Peixe-Boi, en Tatuamunha; hay pocos cupos por día, así que reservá antes. Desde Maragogi es cerca de una hora en auto, cruzando la balsa de Porto de Pedras.' },
      { name: 'Trilha do Visgueiro', zona: 'Assentamento Água Fria, zona rural', dur: '4 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Marco_Ankosqui_Trilha_do_Visgueiro_Maragogi-AL_%2825978643197%29.jpg/1280px-Marco_Ankosqui_Trilha_do_Visgueiro_Maragogi-AL_%2825978643197%29.jpg', nota: 'Un sendero fácil, casi plano, con guía de la comunidad, que pasa por arroyos de selva atlántica hasta un visgueiro de unos 500 años y más de 20 metros. En el camino trabajan las artesanas de la Associação Mulheres de Fibra, que tejen con fibra de banano. Se reserva con anticipación.' },
      { name: 'Buceo con tanque en los galés', zona: 'Galés, 6 km mar adentro', dur: '3 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Sargentinho_-_Piscinas_naturais_de_Maragogi_-_Alagoas.jpg/1280px-Sargentinho_-_Piscinas_naturais_de_Maragogi_-_Alagoas.jpg', nota: 'Además del snorkel, en los galés se hace bautismo de buceo con tanque, sin experiencia previa, con instructores de operadoras habilitadas por el ICMBio. Sale con marea baja, junto con los paseos a las piscinas. No toques los corales ni des de comer a los peces.' }
    ],
    tips: [
      { titulo: 'Los galés tienen cupo', texto: 'La cantidad de visitantes por día es limitada. En temporada se agotan: reservá apenas llegues.' },
      { titulo: 'Sin marea baja no hay galés', texto: 'Si la marea no baja lo suficiente, las piscinas no se forman. Pedí que te lo confirmen antes de pagar.' },
      { titulo: 'Las mejores playas no están en el centro', texto: 'El centro es de paso. Antunes, Patacho y Japaratinga valen el viaje en buggy o en auto.' },
      { titulo: 'Al sur se cruza en balsa', texto: 'Para ir a Porto de Pedras, Patacho, el peixe-boi o São Miguel dos Milagres por la costa hay que cruzar el río Manguaba en balsa. El cruce dura menos de 10 minutos, pero entran pocos autos por viaje: en temporada, salí temprano.' },
      { titulo: 'Langosta solo fuera de la veda', texto: 'De noviembre a abril la pesca de langosta está vedada en Brasil. Si querés comerla fresca, el viaje tiene que ser de mayo a octubre.' },
      { titulo: 'El estacionamiento en la playa se paga', texto: 'En las playas con más movimiento hay pocos lugares en la calle y los estacionamientos cobran por día. Si vas a alquilar auto, buscá alojamiento con estacionamiento propio y llevá efectivo.' }
    ]
  },

  nat: {
    resumen: 'La capital de las dunas: playas urbanas con el Morro do Careca de fondo y, a media hora, dunas móviles que se recorren en buggy.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6], nota: 'Natal tiene sol casi todo el año. Llueve más entre abril y julio, pero en ráfagas cortas. Diciembre, enero y julio son los meses caros.' },
    clima: {
      titulo: 'Clima en Natal mes por mes',
      intro: 'Natal tiene calor y sol casi todo el año. Lo que cambia es la lluvia y cuánta gente hay.',
      meses: [
        { m: 'Ene', max: 30, min: 24, lluvia: 81, mar: 29, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 25, lluvia: 100, mar: 29.5, demanda: 'alta' },
        { m: 'Mar', max: 31, min: 24, lluvia: 201, mar: 29.5, demanda: 'baja' },
        { m: 'Abr', max: 30, min: 24, lluvia: 241, mar: 29.5, demanda: 'baja' },
        { m: 'May', max: 30, min: 23, lluvia: 222, mar: 29, demanda: 'baja' },
        { m: 'Jun', max: 29, min: 22, lluvia: 349, mar: 28, demanda: 'baja' },
        { m: 'Jul', max: 28, min: 21, lluvia: 254, mar: 27, demanda: 'alta' },
        { m: 'Ago', max: 29, min: 21, lluvia: 119, mar: 27, demanda: 'media' },
        { m: 'Sep', max: 29, min: 22, lluvia: 54, mar: 27, demanda: 'media' },
        { m: 'Oct', max: 30, min: 24, lluvia: 21, mar: 27.5, demanda: 'media' },
        { m: 'Nov', max: 30, min: 24, lluvia: 23, mar: 28, demanda: 'media' },
        { m: 'Dic', max: 30, min: 25, lluvia: 29, mar: 28.5, demanda: 'alta' }
      ],
      nota: 'Para playa con sol y poca lluvia: de septiembre a diciembre, cuando casi no llueve y todavía no es temporada alta. De marzo a julio llueve más, sobre todo en junio, aunque en general son chaparrones cortos. Enero y julio son los meses más caros y con más gente.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 (estación Natal). Temperatura del mar: promedio mensual 2022-2025 del modelo marino de Open-Meteo frente a la costa de Natal.'
    },
    beaches: [
      { name: 'Ponta Negra', zona: 'Zona sur, 13 km', lat: -5.8736, lng: -35.1766, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Foto_da_manh%C3%A3_na_Praia_de_Ponta_Negra.jpg/1280px-Foto_da_manh%C3%A3_na_Praia_de_Ponta_Negra.jpg', vibe: 'La playa de los hoteles, con el Morro do Careca en la punta. Agua tibia, olas suaves y una rambla con bares.', cuando: 'Mañana temprano o última hora de la tarde.' },
      { name: 'Praia do Forte', zona: 'Zona este, 4 km', lat: -5.7632, lng: -35.1962, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Praia_do_Forte%2C_Natal_%28RN%29.jpg/1280px-Praia_do_Forte%2C_Natal_%28RN%29.jpg', vibe: 'La playa del Forte dos Reis Magos, con piscinas naturales en el arrecife cuando baja la marea.', cuando: 'Marea baja.' },
      { name: 'Areia Preta', zona: 'Zona este, 2 km', lat: -5.786, lng: -35.189, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Areia-Preta-Natal.jpg/1280px-Areia-Preta-Natal.jpg', vibe: 'Una playa urbana con arrecife y la avenida costera. Cerca del centro y casi sin turistas.', cuando: 'Mañana.' },
      { name: 'Genipabu', zona: 'Norte, cruzando el puente, 15 km', lat: -5.696, lng: -35.208, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Genipabu%2C_Natal%2C_RN%2C_Brazil.jpg/1280px-Genipabu%2C_Natal%2C_RN%2C_Brazil.jpg', vibe: 'Dunas gigantes que caen sobre una laguna y el mar. Es el paseo en buggy más famoso de Natal.', cuando: 'Mañana, antes del calor fuerte sobre la arena.' },
      { name: 'Cotovelo', zona: 'Parnamirim, 19 km', lat: -5.96, lng: -35.148, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Praia_de_Cotovelo_-_Parnamirim_-_Rio_Grande_do_Norte.jpg/1280px-Praia_de_Cotovelo_-_Parnamirim_-_Rio_Grande_do_Norte.jpg', vibe: 'Playa tranquila de acantilados bajos y agua calma, donde veranea la gente de Natal.', cuando: 'Tarde.' },
      { name: 'Pirangi do Norte', zona: 'Parnamirim, 25 km', lat: -5.985, lng: -35.118, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_de_Pirangi_do_norte_-_panoramio.jpg/1280px-Praia_de_Pirangi_do_norte_-_panoramio.jpg', vibe: 'Agua quieta y piscinas naturales. Al lado está el cajueiro más grande del mundo.', cuando: 'Marea baja, de mañana.' },
      { name: 'Praia dos Artistas', zona: 'Zona este, 3 km', lat: -5.78, lng: -35.1932, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Praia_dos_Artistas%2C_Natal_%28RN%29.jpg/1280px-Praia_dos_Artistas%2C_Natal_%28RN%29.jpg', vibe: 'Playa urbana frente a la avenida costera, con edificios altos y piedras sobre la arena. Tiene quioscos y, cuando entra ola, surfistas.', cuando: 'Mañana.' },
      { name: 'Praia do Meio', zona: 'Zona este, 3 km', lat: -5.7734, lng: -35.1944, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Apr2024._Praia_do_Meio%2C_Natal%2C_Brazil_08.jpg/1280px-Apr2024._Praia_do_Meio%2C_Natal%2C_Brazil_08.jpg', vibe: 'Una franja de arena entre el arrecife y la avenida, cerca del Centro de Turismo y del Forte. El arrecife deja el agua calma cerca de la orilla con marea baja.', cuando: 'Marea baja, de mañana.' },
      { name: 'Redinha', zona: 'Zona norte, cruzando el puente, 8 km', lat: -5.745, lng: -35.2033, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Praia_da_Redinha%2C_Natal_%28RN%29.jpg/1280px-Praia_da_Redinha%2C_Natal_%28RN%29.jpg', vibe: 'El barrio de pescadores del otro lado del río Potengi, con la iglesia de los Navegantes frente al mar y el muelle. En el mercado se come ginga com tapioca, pescadito frito con tapioca.', cuando: 'Mediodía, para comer ginga com tapioca.' },
      { name: 'Búzios', zona: 'Nísia Floresta, 35 km', lat: -6.0313, lng: -35.1106, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Praia_de_Buzios.jpg/1280px-Praia_de_Buzios.jpg', vibe: 'Una bahía con arrecifes que forman piscinas naturales con marea baja, buenas para snorkel. Hay barracas y casas de veraneo.', cuando: 'Marea baja.' }
    ],
    atracciones: [
      { name: 'Forte dos Reis Magos', zona: 'Praia do Forte', lat: -5.7564, lng: -35.1949, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Forte-reis-magos.jpg/1280px-Forte-reis-magos.jpg', dur: '1 h', usd: 2, nota: 'Fuerte con forma de estrella del siglo XVI, sobre el arrecife. Con marea alta parece flotar. Cierra los lunes.' },
      { name: 'Cajueiro de Pirangi', zona: 'Pirangi do Norte', lat: -5.9786, lng: -35.1234, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Maior_cajueiro_do_mundo_3.jpg/1280px-Maior_cajueiro_do_mundo_3.jpg', dur: '45 min', usd: 2, nota: 'Un solo árbol de cajú que ocupa una manzana entera. Hay mirador arriba.' },
      { name: 'Centro de Turismo', zona: 'Petrópolis', lat: -5.7793, lng: -35.197, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Centro_de_Turismo%2C_Natal_%28RN%29.jpg/1280px-Centro_de_Turismo%2C_Natal_%28RN%29.jpg', dur: '1 h', nota: 'Una antigua cárcel convertida en mercado de artesanía y recuerdos, abierto todos los días.' }
    ],
    comer: [
      { name: 'Ginga com tapioca', tipo: 'Merienda', zona: 'Redinha', usd: 4, momento: 'Tarde', nota: 'Pescaditos fritos en tapioca. Típico del mercado de la Redinha.' },
      { name: 'Carne de sol con macaxeira', tipo: 'Almuerzo', zona: 'Restaurantes regionales', usd: 12, momento: 'Mediodía', nota: 'Carne salada y secada al sol, con mandioca frita y manteca de garrafa.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Ponta Negra', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la rambla.' },
      { name: 'Camarón al coco', tipo: 'Cena', zona: 'Ponta Negra', usd: 18, momento: 'Noche', nota: 'Camarón en salsa de coco. Rio Grande do Norte es el mayor productor de camarón de Brasil.' }
    ],
    hacer: [
      { name: 'Buggy por Genipabu', zona: 'Norte', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Passeio_de_Buggy_nas_dunas_de_Genipabu_01.jpg/1280px-Passeio_de_Buggy_nas_dunas_de_Genipabu_01.jpg', dur: '4 h', usd: 30, nota: 'Con o sin emoción: el bugueiro te pregunta. Pasa por la laguna; la tirolesa sobre el agua se paga aparte.' },
      { name: 'Dromedarios en Genipabu', zona: 'Genipabu', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Passeio_de_Dromed%C3%A1rios_em_Genipabu.jpg/1280px-Passeio_de_Dromed%C3%A1rios_em_Genipabu.jpg', dur: '30 min', usd: 15, nota: 'Paseo corto en dromedario por las dunas, la foto de Natal.' },
      { name: 'Piscinas de Maracajaú', zona: 'Norte, en excursión', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Parracho.jpg/1280px-Parracho.jpg', dur: 'Día entero', usd: 40, nota: 'Arrecifes a 7 km de la costa, con agua clara. Está a más de 50 km: solo en excursión.' }
    ],
    tips: [
      { titulo: 'No subas al Morro do Careca', texto: 'Está prohibido para proteger la duna y hay multa. Se mira desde la playa.' },
      { titulo: 'Bugueiro credenciado', texto: 'Contratá el buggy con un bugueiro credenciado (tiene la credencial a la vista). Los no credenciados no pueden entrar a las dunas de Genipabu.' },
      { titulo: 'Ponta Negra de noche', texto: 'La parte alta de Ponta Negra concentra la vida nocturna. Usá auto o Uber de noche para volver.' }
    ]
  },

  pip: {
    resumen: 'Una vila sobre acantilados rojos, con delfines que entran a la bahía y tortugas que desovan en la arena. Todo se hace a pie, y con marea baja se va de playa en playa por la arena.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6], nota: 'De abril a julio llueve más. De septiembre a marzo, sol todos los días. Las caminatas por la orilla dependen de la marea baja: con marea alta el mar llega a los acantilados.' },
    clima: {
      titulo: 'Clima en Pipa mes por mes',
      intro: 'En Pipa hace calor todo el año y el agua está siempre tibia. Lo que cambia es la lluvia y cuánta gente hay.',
      meses: [
        { m: 'Ene', max: 28, min: 25, lluvia: 72, mar: 29.5, demanda: 'alta' },
        { m: 'Feb', max: 28, min: 25, lluvia: 92, mar: 29.5, demanda: 'alta' },
        { m: 'Mar', max: 28, min: 25, lluvia: 129, mar: 29.5, demanda: 'baja' },
        { m: 'Abr', max: 28, min: 25, lluvia: 179, mar: 30, demanda: 'baja' },
        { m: 'May', max: 28, min: 25, lluvia: 163, mar: 29, demanda: 'baja' },
        { m: 'Jun', max: 27, min: 24, lluvia: 184, mar: 28, demanda: 'baja' },
        { m: 'Jul', max: 26, min: 23, lluvia: 167, mar: 27, demanda: 'alta' },
        { m: 'Ago', max: 26, min: 23, lluvia: 82, mar: 27, demanda: 'media' },
        { m: 'Sep', max: 27, min: 24, lluvia: 49, mar: 27, demanda: 'media' },
        { m: 'Oct', max: 27, min: 24, lluvia: 33, mar: 27.5, demanda: 'media' },
        { m: 'Nov', max: 28, min: 25, lluvia: 29, mar: 28, demanda: 'media' },
        { m: 'Dic', max: 28, min: 25, lluvia: 44, mar: 28.5, demanda: 'alta' }
      ],
      nota: 'Para playa y caminatas por la orilla: de septiembre a diciembre, con sol casi todos los días y poca lluvia. De abril a julio llueve más y el mar trae más algas. Enero, Carnaval y julio son los meses más caros; con marea alta varias playas quedan sin arena, así que mirá la tabla de mareas.',
      fuente: 'Temperaturas y lluvia: climatología de 30 años de Climatempo para Tibau do Sul (Pipa no tiene estación del INMET). Temperatura del mar: promedio mensual 2022-2025 del modelo marino de Open-Meteo frente a Pipa.'
    },
    beaches: [
      { name: 'Praia do Centro', zona: 'Vila de Pipa', lat: -6.225, lng: -35.064, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/PipaBeachView.JPG/1280px-PipaBeachView.JPG', vibe: 'La playa del pueblo, con barcos de pescadores y piscinas naturales en el arrecife con marea baja.', cuando: 'Mañana.' },
      { name: 'Praia do Amor', zona: 'Sur de la vila, 1 km', lat: -6.2318, lng: -35.0418, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Humberto_Sales_Praia_do_Amor_Tibau_do_Sul_RN_%2840015141315%29.jpg/1280px-Humberto_Sales_Praia_do_Amor_Tibau_do_Sul_RN_%2840015141315%29.jpg', vibe: 'La del acantilado con forma de corazón, vista desde el mirador. Abajo, olas para surf.', cuando: 'Tarde, para el surf y el atardecer en el Chapadão.' },
      { name: 'Chapadão', zona: 'Entre la Praia do Amor y la Praia das Minas, 2 km', lat: -6.2392, lng: -35.0376, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Humberto_Sales_Chapad%C3%A3o_Tibau_do_Sul_RN_%2840866701872%29.jpg/1280px-Humberto_Sales_Chapad%C3%A3o_Tibau_do_Sul_RN_%2840866701872%29.jpg', vibe: 'No es playa sino el mirador sobre los acantilados, con la vista de la Praia do Amor. Es el atardecer de Pipa.', cuando: 'Atardecer.' },
      { name: 'Baía dos Golfinhos', zona: 'Norte de la vila, a pie con marea baja', lat: -6.2246, lng: -35.0612, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Baia_dos_Golfinhos_-_Pipa_-_Rio_Grande_do_Norte_%2816363411160%29.jpg/1280px-Baia_dos_Golfinhos_-_Pipa_-_Rio_Grande_do_Norte_%2816363411160%29.jpg', vibe: 'Una bahía chica al pie del acantilado, donde los delfines entran a nadar cerca de la gente. Se llega caminando por la arena con marea baja.', cuando: 'Marea baja de mañana: con marea alta no se puede volver caminando.' },
      { name: 'Madeiro', zona: 'Norte, 3 km', lat: -6.2174, lng: -35.0752, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Praia_do_Madeiro_%285302194070%29.jpg/1280px-Praia_do_Madeiro_%285302194070%29.jpg', vibe: 'Una bahía bajo acantilados con selva, de olas suaves y largas, ideales para aprender surf. A veces se ven tortugas cerca de la orilla.', cuando: 'Todo el día; bajada por escalera.' },
      { name: 'Cacimbinhas', zona: 'Norte, 6 km', lat: -6.1995, lng: -35.0817, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Humberto_Sales_Cacimbinha_Tibau_do_Sul_RN_%2840666093475%29.jpg/1280px-Humberto_Sales_Cacimbinha_Tibau_do_Sul_RN_%2840666093475%29.jpg', vibe: 'Acantilados rojizos y una playa ancha casi sin construcciones, entre Madeiro y Tibau do Sul. Tiene olas para surf y a veces se ven delfines frente a la costa.', cuando: 'Marea baja, caminando por la arena desde Madeiro.' },
      { name: 'Praia do Giz', zona: 'Tibau do Sul, 9 km', lat: -6.186, lng: -35.0867, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_do_Giz%2C_Tibau_do_Sul.jpg/1280px-Praia_do_Giz%2C_Tibau_do_Sul.jpg', vibe: 'La playa de Tibau do Sul, al pie de un acantilado claro y junto a la boca de la Lagoa de Guaraíras. Es tranquila y queda cerca de los bares del atardecer en la laguna.', cuando: 'Tarde, y después el atardecer en la laguna.' },
      { name: 'Barra do Cunhaú', zona: 'Canguaretama, 25 km', lat: -6.3114, lng: -35.0359, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Barra_do_Cunhau_-_RN_18-06-2016.jpg/1280px-Barra_do_Cunhau_-_RN_18-06-2016.jpg', vibe: 'Donde el río Curimataú llega al mar, con la imagen de Nossa Senhora sobre el muelle y agua calma en la barra. Hay viento para kitesurf y paseos en barco por el manglar.', cuando: 'Tarde, para el atardecer sobre el río.' },
      { name: 'Baía Formosa', zona: 'Baía Formosa, 50 km', lat: -6.3419, lng: -35.0297, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Praia_em_Baia_Formosa_RN.JPG/1280px-Praia_em_Baia_Formosa_RN.JPG', vibe: 'Una bahía curva con pueblo de pescadores, barcos fondeados y agua calma cerca del muelle. En la punta rompe una ola buscada por surfistas.', cuando: 'Mañana.' },
      { name: 'Sagi', zona: 'Baía Formosa, límite con Paraíba, 60 km', lat: -6.4743, lng: -34.9701, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Praia_do_Sagi.jpg/1280px-Praia_do_Sagi.jpg', vibe: 'La última playa de Rio Grande do Norte, junto a la boca del río Guaju, con mar abierto y casi sin construcciones. Es más para ir de excursión en buggy que para quedarse.', cuando: 'Día entero, en excursión.' },
      { name: 'Pirangi do Sul', zona: 'Nísia Floresta, 50 km', lat: -5.9845, lng: -35.1194, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Pirang%C3%AD_do_Sul_-_Natal._%285578288916%29.jpg/1280px-Pirang%C3%AD_do_Sul_-_Natal._%285578288916%29.jpg', vibe: 'Agua calma en la boca del río Pirangi, frente a Pirangi do Norte, de donde salen los barcos a los parrachos. Hay barracas y casas de veraneo.', cuando: 'Marea baja, para el paseo a los parrachos.' },
      { name: 'Camurupim', zona: 'Nísia Floresta, 35 km', lat: -6.0872, lng: -35.0994, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Praia_de_Camurupim_RN_%289019158459%29.jpg/1280px-Praia_de_Camurupim_RN_%289019158459%29.jpg', vibe: 'Arrecifes que forman piscinas naturales de agua tibia frente a la playa, con barracas sobre la arena. Al sur sigue la Barreta, más tranquila.', cuando: 'Marea baja.' },
      { name: 'Tabatinga', zona: 'Nísia Floresta, 40 km', lat: -6.0616, lng: -35.097, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Praia_de_Tabatinga_%287900982204%29.jpg/1280px-Praia_de_Tabatinga_%287900982204%29.jpg', vibe: 'Acantilados altos sobre el mar, con el Mirante dos Golfinhos arriba, desde donde muchas veces se ven delfines. Abajo la playa tiene olas y se usa para surf.', cuando: 'Mañana, para los delfines desde el mirador.' }
    ],
    atracciones: [
      { name: 'Mirante do Chapadão', zona: 'Vila', lat: -6.2362, lng: -35.0364, foto: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Chapad%C3%A3o_Pipa_RN.jpg', dur: '1 h', usd: 0, nota: 'El atardecer sobre la Praia do Amor desde lo alto del acantilado.' },
      { name: 'Santuário Ecológico de Pipa', zona: 'Norte', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/Santu%C3%A1rio_Ecol%C3%B3gico_de_Pipa.jpg/1280px-Santu%C3%A1rio_Ecol%C3%B3gico_de_Pipa.jpg', dur: '1 h 30', usd: 6, nota: 'Senderos de mata atlántica con miradores sobre la Baía dos Golfinhos.' },
      { name: 'Lagoa de Guaraíras', zona: 'Tibau do Sul, 10 km', lat: -6.1873, lng: -35.111, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Lagoa_de_Guara%C3%ADras.jpg/1280px-Lagoa_de_Guara%C3%ADras.jpg', dur: '1 h', usd: 0, nota: 'La laguna donde el atardecer se mira desde los bares de Tibau. Hay paseos en barco.' }
    ],
    comer: [
      { name: 'Tapioca en la vila', tipo: 'Desayuno', zona: 'Avenida principal', usd: 3, momento: 'Mañana', nota: 'Tapioca de coco y queso en los puestos de la calle principal.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato de un pueblo caro.' },
      { name: 'Crepe de la calle', tipo: 'Cena', zona: 'Avenida principal', usd: 6, momento: 'Noche', nota: 'Los puestos de crepe y pastel de la avenida son la cena barata de Pipa.' }
    ],
    hacer: [
      { name: 'Caminata a la Baía dos Golfinhos', zona: 'Desde el centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Baia_dos_Golfinhos_-_Pipa.jpg/1280px-Baia_dos_Golfinhos_-_Pipa.jpg', dur: '2 h', usd: 0, nota: 'Por la arena con marea baja, al pie del acantilado. Calculá la vuelta: la marea sube rápido.' },
      { name: 'Clase de surf en Madeiro', zona: 'Madeiro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Surf_%C3%A9_religi%C3%A3o_na_Pipa.jpg/1280px-Surf_%C3%A9_religi%C3%A3o_na_Pipa.jpg', dur: '2 h', usd: 30, nota: 'Ola suave y larga, ideal para aprender.' },
      { name: 'Paseo de barco con delfines', zona: 'Sale del centro', foto: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Golfinho_Pipa.jpg', dur: '1 h 30', usd: 15, nota: 'El barco recorre la costa y los delfines suelen acompañarlo.' }
    ],
    tips: [
      { titulo: 'La marea decide el camino', texto: 'Las playas se unen caminando solo con marea baja. Con marea alta el mar llega al acantilado: mirá la tabla antes de salir.' },
      { titulo: 'No toques a los delfines', texto: 'Entran a la bahía porque están tranquilos. Tocarlos o perseguirlos está prohibido y los aleja.' },
      { titulo: 'Pipa es cara para lo que es', texto: 'Los precios son de balneario de moda. Comer en la calle y en los kilos baja mucho el gasto.' }
    ]
  },

  trancoso: {
    resumen: 'Un pueblo de casitas de colores alrededor de una plaza de pasto, el Quadrado, sobre un acantilado. Las playas están abajo, a una bajada de cinco minutos.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6, 8, 9, 10, 11], nota: 'En Año Nuevo y Carnaval los precios se multiplican. De marzo a junio llueve más, pero el pueblo está tranquilo y los precios bajan bastante.' },
    clima: {
      titulo: 'Clima en Trancoso mes por mes',
      intro: 'Trancoso tiene calor todo el año. Las lluvias fuertes llegan en abril y de noviembre a diciembre.',
      meses: [
        { m: 'Ene', max: 29, min: 24, lluvia: 91, mar: 26.5, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 24, lluvia: 81, mar: 27, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 24, lluvia: 89, mar: 27, demanda: 'baja' },
        { m: 'Abr', max: 28, min: 23, lluvia: 158, mar: 27, demanda: 'baja' },
        { m: 'May', max: 27, min: 22, lluvia: 123, mar: 26.5, demanda: 'baja' },
        { m: 'Jun', max: 26, min: 21, lluvia: 104, mar: 25.5, demanda: 'baja' },
        { m: 'Jul', max: 25, min: 20, lluvia: 81, mar: 25, demanda: 'alta' },
        { m: 'Ago', max: 25, min: 20, lluvia: 86, mar: 25, demanda: 'baja' },
        { m: 'Sep', max: 27, min: 21, lluvia: 66, mar: 25, demanda: 'baja' },
        { m: 'Oct', max: 28, min: 23, lluvia: 88, mar: 25.5, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 23, lluvia: 206, mar: 25.5, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 23, lluvia: 171, mar: 26, demanda: 'alta' }
      ],
      nota: 'Para playa, de enero a marzo hay más sol y el agua más tibia; Año Nuevo y Carnaval son lo más caro del año. Septiembre es el mes más seco y con precios bajos. En invierno el agua baja a 25° y las noches son frescas, pero se puede ir a la playa.',
      fuente: 'Temperaturas y lluvia: promedio 2015-2024 del reanálisis ERA5 (Open-Meteo) para el punto del destino; no hay normal INMET 1991-2020 publicada para esta localidad. Temperatura del agua: Weatherspark.'
    },
    beaches: [
      { name: 'Nativos', zona: 'Abajo del Quadrado', lat: -16.5893, lng: -39.0903, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Praia_dos_Nativos%2C_APA_Cara%C3%ADva_Trancoso.JPG/1280px-Praia_dos_Nativos%2C_APA_Cara%C3%ADva_Trancoso.JPG', vibe: 'La playa a la que se baja desde el pueblo, con el río Trancoso que desemboca y bares de playa.', cuando: 'Mañana; de tarde se llena.' },
      { name: 'Coqueiros', zona: 'Sur, 1 km', lat: -16.5971, lng: -39.09, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Vista_da_Praia_dos_Coqueiros_em_Trancoso%2C_Porto_Seguro_BA.JPG/1280px-Vista_da_Praia_dos_Coqueiros_em_Trancoso%2C_Porto_Seguro_BA.JPG', vibe: 'Agua calma con piscinas en el arrecife y cocoteros. La playa de los locales.', cuando: 'Marea baja.' },
      { name: 'Taípe', zona: 'Norte, 10 km', lat: -16.5534, lng: -39.0863, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg/1280px-Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg', vibe: 'Una playa larga entre Trancoso y Arraial d’Ajuda, con acantilados de colores y casi nadie. Se llega por la playa con marea baja o en auto por camino de tierra.', cuando: 'Mañana, cuando el sol pega en el acantilado.' },
      { name: 'Praia do Espelho', zona: 'Sur, 28 km por camino de tierra', lat: -16.7258, lng: -39.1225, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Coqueiros_Praia_do_Espelho.jpg/1280px-Coqueiros_Praia_do_Espelho.jpg', vibe: 'Agua quieta como un espejo con marea baja, acantilados de colores y piscinas naturales. Una de las playas más lindas de Brasil.', cuando: 'Marea baja; día entero.' },
      { name: 'Itapororoca', zona: 'Sur, 6 km', lat: -16.642, lng: -39.0944, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/MARCIO_FILHO_PRAIA_ITAPOROROCA_TRANCOSO_BAHIA_%2839168709600%29.jpg/1280px-MARCIO_FILHO_PRAIA_ITAPOROROCA_TRANCOSO_BAHIA_%2839168709600%29.jpg', vibe: 'Una playa larga y tranquila al sur de Trancoso, con agua verde y arrecifes cerca de la orilla. Hay pocas barracas y mucho espacio.', cuando: 'Marea baja; desde Coqueiros se llega caminando por la arena.' },
      { name: 'Praia do Satu', zona: 'Sur, 32 km por camino de tierra', lat: -16.771, lng: -39.1409, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Praia_do_Satu.jpg/1280px-Praia_do_Satu.jpg', vibe: 'Una playa casi desierta entre Espelho y Caraíva, con arrecife y agua calma cuando baja la marea. Casi no tiene servicios.', cuando: 'Marea baja, combinada con el día en la Praia do Espelho.' },
      { name: 'Caraíva', zona: 'Sur, unos 45 km por camino de tierra, y canoa', lat: -16.8102, lng: -39.1454, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Cara%C3%ADva%2C_Bahia%2C_Brasil.jpg/1280px-Cara%C3%ADva%2C_Bahia%2C_Brasil.jpg', vibe: 'Una vila sin autos del otro lado del río Caraíva, que se cruza en canoa. Playa larga con el río que desemboca al lado, donde se baja flotando con la corriente.', cuando: 'Día entero; al atardecer, sobre el río.' },
      { name: 'Coroa Vermelha', zona: 'Santa Cruz Cabrália, cruzando en balsa, 44 km', lat: -16.3532, lng: -39.0143, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG/1280px-Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG', vibe: 'Donde se dio la primera misa del Brasil, con una cruz frente al mar y piscinas en el arrecife.', cuando: 'Marea baja.' }
    ],
    atracciones: [
      { name: 'Quadrado', zona: 'Centro', lat: -16.5891, lng: -39.0949, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Quadrado_-_Trancoso_-_Porto_Seguro-BA_-_panoramio_%287%29.jpg/1280px-Quadrado_-_Trancoso_-_Porto_Seguro-BA_-_panoramio_%287%29.jpg', dur: '1 h', usd: 0, nota: 'La plaza de pasto con la Igreja de São João Batista en la punta y casas de colores alrededor. De noche se iluminan con faroles.' },
      { name: 'Igreja de São João Batista', zona: 'Quadrado', lat: -16.5894, lng: -39.0926, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Trancoso-Igreja_do_Quadrado.jpg/1280px-Trancoso-Igreja_do_Quadrado.jpg', dur: '15 min', usd: 0, nota: 'La iglesia blanca de los jesuitas sobre el acantilado, con vista al mar.' },
      { name: 'Mirante del Quadrado', zona: 'Detrás de la iglesia', lat: -16.5893, lng: -39.092, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Mirante_do_Quadrado.jpg/1280px-Mirante_do_Quadrado.jpg', dur: '20 min', usd: 0, nota: 'La vista del río, la playa y el mar desde lo alto.' }
    ],
    comer: [
      { name: 'Prato feito fuera del Quadrado', tipo: 'Almuerzo', zona: 'Calles de atrás', usd: 10, momento: 'Mediodía', nota: 'El Quadrado es carísimo. A dos cuadras, en los barrios, el plato cuesta un tercio.' },
      { name: 'Moqueca baiana', tipo: 'Cena', zona: 'Quadrado', usd: 25, momento: 'Noche', nota: 'Pescado con leche de coco y dendê, en cazuela de barro. Para dos.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Puestos de la entrada', usd: 4, momento: 'Tarde', nota: 'Bollo de feijão frito en dendê con camarón y vatapá.' }
    ],
    hacer: [
      { name: 'Excursión a la Praia do Espelho', zona: 'Sale del pueblo', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Praia_do_Espelho%2C_Trancoso%2C_Bahia.jpg/1280px-Praia_do_Espelho%2C_Trancoso%2C_Bahia.jpg', dur: 'Día entero', usd: 20, nota: 'Por camino de tierra. Calculá la marea baja para llegar en el mejor momento.' },
      { name: 'Caminata por la costa al sur', zona: 'Nativos → Rio Verde', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/MARCIO_FILHO_PRAIA_DOS_COQUEIROS_TRANCOSO_BAHIA_%2840268094364%29.jpg/1280px-MARCIO_FILHO_PRAIA_DOS_COQUEIROS_TRANCOSO_BAHIA_%2840268094364%29.jpg', dur: '2 h', usd: 0, nota: 'Por la arena con marea baja, pasando Coqueiros y Rio Verde.' },
      { name: 'Atardecer en el Quadrado', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Cuando el sol baja, todo el pueblo sube a la plaza.' }
    ],
    tips: [
      { titulo: 'Efectivo y paciencia', texto: 'Hay pocos cajeros y los caminos a las playas del sur son de tierra. Llevá efectivo y no planees horarios ajustados.' },
      { titulo: 'Arraial d’Ajuda está cerca', texto: 'A 25 km por ruta, con precios más bajos. Puede ser base para visitar Trancoso de día.' },
      { titulo: 'El Espelho es por la marea', texto: 'Con marea alta el Espelho es una playa linda más. Con marea baja es la que sale en las fotos.' }
    ]
  },

  ssa: {
    resumen: 'La ciudad más africana de Brasil, con playas urbanas de agua calma en la Barra y playas de cocoteros y arrecife al norte, a media hora del Pelourinho.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 8], nota: 'De abril a junio llueve casi todos los días. De septiembre a marzo hay sol y calor; Carnaval y Año Nuevo son los momentos más caros y más llenos del año.' },
    clima: {
      titulo: 'Clima en Salvador mes por mes',
      intro: 'Salvador tiene calor todo el año. Lo que cambia es la lluvia, que se concentra entre abril y julio, y cuánta gente hay.',
      meses: [
        { m: 'Ene', max: 31, min: 24, lluvia: 77, mar: 27.5, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 24, lluvia: 99, mar: 28.5, demanda: 'alta' },
        { m: 'Mar', max: 31, min: 24, lluvia: 147, mar: 29, demanda: 'media' },
        { m: 'Abr', max: 30, min: 24, lluvia: 285, mar: 29, demanda: 'baja' },
        { m: 'May', max: 28, min: 23, lluvia: 302, mar: 28, demanda: 'baja' },
        { m: 'Jun', max: 27, min: 22, lluvia: 238, mar: 26.5, demanda: 'baja' },
        { m: 'Jul', max: 27, min: 21, lluvia: 194, mar: 26, demanda: 'media' },
        { m: 'Ago', max: 27, min: 21, lluvia: 130, mar: 26, demanda: 'baja' },
        { m: 'Sep', max: 28, min: 22, lluvia: 99, mar: 26, demanda: 'media' },
        { m: 'Oct', max: 29, min: 23, lluvia: 91, mar: 26.5, demanda: 'media' },
        { m: 'Nov', max: 30, min: 23, lluvia: 108, mar: 26.5, demanda: 'media' },
        { m: 'Dic', max: 31, min: 24, lluvia: 63, mar: 26.5, demanda: 'alta' }
      ],
      nota: 'Para playa con sol: de septiembre a marzo, con enero y febrero como los meses más secos y calurosos. De abril a julio llueve casi todos los días, con mayo como el mes más lluvioso, aunque es buena época para recorrer el Pelourinho con precios más bajos. Año Nuevo y Carnaval son los momentos más caros y llenos del año.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 (estación Salvador-Ondina). Temperatura del mar: promedio mensual 2022-2025 del modelo marino de Open-Meteo frente a la Barra.'
    },
    beaches: [
      { name: 'Porto da Barra', zona: 'Barra, 4 km', lat: -13.0043, lng: -38.5328, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_do_Porto_da_Barra--Forte_de_Santa_Maria_Salvador_Bahia_2021-7598.jpg/1280px-Praia_do_Porto_da_Barra--Forte_de_Santa_Maria_Salvador_Bahia_2021-7598.jpg', vibe: 'Una bahía de agua quieta entre dos fuertes, donde el sol se pone sobre el mar. Es la playa de los soteropolitanos y la más animada de la ciudad.', cuando: 'Atardecer: la gente aplaude cuando se pone el sol.' },
      { name: 'Buracão', zona: 'Rio Vermelho, 6 km', lat: -13.015, lng: -38.4833, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Praia_do_Burac%C3%A3o%2C_Salvador.jpg/1280px-Praia_do_Burac%C3%A3o%2C_Salvador.jpg', vibe: 'Una cala escondida entre edificios, a la que se baja por una escalera. Olas y gente del barrio.', cuando: 'Mañana; de tarde da sombra.' },
      { name: 'Ribeira', zona: 'Península de Itapagipe, 13 km', lat: -12.911, lng: -38.4975, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Praia_da_Ribeira%2C_Salvador_-_4.jpg/1280px-Praia_da_Ribeira%2C_Salvador_-_4.jpg', vibe: 'Del lado de la bahía, con las heladerías más famosas de Salvador. Es más para pasear y tomar helado: el agua muchas veces no es apta para bañarse. El plan de domingo de las familias.', cuando: 'Domingo a la tarde.' },
      { name: 'Itapuã', zona: 'Norte, 20 km', lat: -12.9535, lng: -38.3612, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Itapua_Beach_Bahia_04.jpg/1280px-Itapua_Beach_Bahia_04.jpg', vibe: 'La playa de la canción, con el faro, cocoteros y piscinas en el arrecife. Barrio de pescadores y bares de playa.', cuando: 'Marea baja.' },
      { name: 'Flamengo', zona: 'Norte, 27 km', lat: -12.9288, lng: -38.318, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/MARCIO_FILHO_PRAIA_DO_FLAMENGO_SALVADOR_BAHIA_%2841078840821%29.jpg/1280px-MARCIO_FILHO_PRAIA_DO_FLAMENGO_SALVADOR_BAHIA_%2841078840821%29.jpg', vibe: 'Playa larga y limpia, de las mejores de la ciudad, con quioscos y olas para surf.', cuando: 'Día entero.' },
      { name: 'Farol da Barra', zona: 'Barra, 5 km', lat: -13.0094, lng: -38.532, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Praia_do_Farol_da_Barra%2C_Salvador_BA_-_Brasil_%284269533192%29.jpg/1280px-Praia_do_Farol_da_Barra%2C_Salvador_BA_-_Brasil_%284269533192%29.jpg', vibe: 'La playa al pie del faro y del Forte de Santo Antônio, con mar abierto y arrecifes que forman piscinas con marea baja. Tiene barracas y la rambla de la Barra detrás.', cuando: 'Marea baja de mañana; atardecer desde el fuerte.' },
      { name: 'Ondina', zona: 'Ondina, 7 km', lat: -13.0116, lng: -38.5054, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Praia_de_Ondina_em_Salvador.jpg/1280px-Praia_de_Ondina_em_Salvador.jpg', vibe: 'Playa urbana frente a los hoteles de la avenida costera, entre arrecifes. Con marea baja se forman piscinas; con marea alta el mar llega fuerte.', cuando: 'Marea baja.' },
      { name: 'Amaralina', zona: 'Amaralina, 9 km', lat: -13.0144, lng: -38.4745, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Praia_da_Amaralina_-_2025-07-18.jpg/1280px-Praia_da_Amaralina_-_2025-07-18.jpg', vibe: 'Mar abierto con olas, más para surf y para caminar la rambla que para nadar. Hay puestos de acarajé y quioscos.', cuando: 'Mañana para surf; tarde para caminar.' },
      { name: 'Jaguaribe', zona: 'Piatã, 18 km', lat: -12.9576, lng: -38.3898, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Praia_de_Jaguaribe_-_Salvador_1.jpg/1280px-Praia_de_Jaguaribe_-_Salvador_1.jpg', vibe: 'Playa larga junto a la boca del río Jaguaribe, con olas y barracas. Se juntan surfistas y grupos de vóley.', cuando: 'Mañana.' },
      { name: 'Stella Maris', zona: 'Norte, 25 km', lat: -12.9403, lng: -38.3306, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Stella_Maris_-_The_Beach.jpg/1280px-Stella_Maris_-_The_Beach.jpg', vibe: 'Playa amplia con arrecifes, barracas grandes y casas de veraneo, cerca del aeropuerto. Hay olas para surf y piscinas con marea baja.', cuando: 'Marea baja.' }
    ],
    atracciones: [
      { name: 'Pelourinho', zona: 'Centro Histórico', lat: -12.9715, lng: -38.5084, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Largo_do_Pelourinho%2C_Salvador_20150719-DSC05452.JPG/1280px-Largo_do_Pelourinho%2C_Salvador_20150719-DSC05452.JPG', dur: '3 h', usd: 0, nota: 'Calles de piedra con casas coloniales de colores, iglesias barrocas y música en la calle. Olodum ensaya en el Pelourinho; confirmá el día.' },
      { name: 'Elevador Lacerda', zona: 'Centro', lat: -12.9741, lng: -38.5134, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Elevador_Lacerda_-_Salvador.jpg/1280px-Elevador_Lacerda_-_Salvador.jpg', dur: '20 min', usd: 0.1, nota: 'El ascensor que une la Cidade Alta con la Baixa. Cuesta centavos y tiene la mejor vista de la bahía.' },
      { name: 'Igreja de São Francisco', zona: 'Pelourinho', lat: -12.9747, lng: -38.5089, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Igreja_de_S%C3%A3o_Francisco_Salvador_2019-6875.jpg/1280px-Igreja_de_S%C3%A3o_Francisco_Salvador_2019-6875.jpg', dur: '40 min', usd: 3, nota: 'Iglesia barroca con el interior cubierto de oro. Una de las más ricas de Brasil.' },
      { name: 'Forte de Santo Antônio da Barra', zona: 'Barra', lat: -13.0103, lng: -38.5329, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Forte_de_Santo_Ant%C3%B4nio_da_Barra_-_Salvador_-_20220730120630.jpg/1280px-Forte_de_Santo_Ant%C3%B4nio_da_Barra_-_Salvador_-_20220730120630.jpg', dur: '1 h', usd: 3, nota: 'El faro de la Barra, con el museo náutico adentro. El atardecer desde las murallas.' },
      { name: 'Igreja do Bonfim', zona: 'Colina do Bonfim, Cidade Baixa', dur: '1 h', lat: -12.9238, lng: -38.5081, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Igreja_de_Nosso_Senhor_do_Bonfim_Salvador_2021-7341.jpg/1280px-Igreja_de_Nosso_Senhor_do_Bonfim_Salvador_2021-7341.jpg', nota: 'La iglesia de las cintas de colores, en lo alto de la península de Itapagipe. Adentro está la sala de los exvotos, con fotos y figuras que dejan los fieles. Conviene combinarla con la Ribeira, que queda cerca, y volver en Uber o taxi.' },
      { name: 'Orixás del Dique do Tororó', zona: 'Tororó, cerca de la Fonte Nova', dur: '45 min', usd: 0, lat: -12.9853, lng: -38.5071, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Orix%C3%A1s_do_Dique_do_Toror%C3%B3.jpg/1280px-Orix%C3%A1s_do_Dique_do_Toror%C3%B3.jpg', nota: 'Una laguna con esculturas gigantes de orixás de Tatti Moreno, ocho flotando en el agua y otras en la orilla. Se camina alrededor por la vereda y es gratis. Mejor de día.' },
      { name: 'Solar do Unhão y MAM', zona: 'Avenida Contorno, entre el Comércio y la Barra', dur: '1 h 30', lat: -12.9826, lng: -38.5203, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Solar_do_Unh%C3%A3o_-_ft.Lazaro_Menezes_%28cropped1%29.jpg/1280px-Solar_do_Unh%C3%A3o_-_ft.Lazaro_Menezes_%28cropped1%29.jpg', nota: 'Un caserón colonial sobre la bahía donde funciona el Museu de Arte Moderna da Bahia, con un parque de esculturas al borde del agua. Es un buen lugar para ver el atardecer. Andá en Uber o taxi: la Avenida Contorno no es para caminar.' },
      { name: 'Catedral Basílica', zona: 'Terreiro de Jesus, Pelourinho', dur: '40 min', lat: -12.9729, lng: -38.5103, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Catedral_Bas%C3%ADlica_de_Salvador_Facade_2019-9898.jpg/1280px-Catedral_Bas%C3%ADlica_de_Salvador_Facade_2019-9898.jpg', nota: 'La antigua iglesia de los jesuitas, frente a la plaza del Terreiro de Jesus, con altares dorados y la lápida de Mem de Sá. Abre de día con pausa al mediodía; los horarios cambian, así que confirmalos antes.' }
    ],
    comer: [
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Puestos de las baianas', usd: 4, momento: 'Tarde', nota: 'Bollo de feijão frito en dendê, con camarón, vatapá y pimienta. Pedilo "frio" si no querés picante.' },
      { name: 'Moqueca baiana', tipo: 'Almuerzo', zona: 'Rio Vermelho y Pelourinho', usd: 20, momento: 'Mediodía', nota: 'Pescado en leche de coco y dendê, con arroz y pirão. Para dos.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Barra y Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso, con platos baianos en la mesa.' },
      { name: 'Sorvete da Ribeira', tipo: 'Postre', zona: 'Ribeira', usd: 3, momento: 'Tarde', nota: 'Helados de frutas regionales, en la heladería tradicional frente a la bahía.' },
      { name: 'Abará', tipo: 'Merienda', zona: 'Puestos de las baianas', momento: 'Tarde', nota: 'El primo del acarajé: la misma masa de feijão fradinho, pero envuelta en hoja de banano y cocida al vapor. Se sirve abierto con vatapá, caruru y camarón. Donde hay acarajé, casi siempre hay abará.' },
      { name: 'Bobó de camarão', tipo: 'Almuerzo', zona: 'Restaurantes de comida baiana, Rio Vermelho y Pelourinho', momento: 'Mediodía', nota: 'Crema espesa de mandioca con leche de coco, dendê y camarones. Se come con arroz y suele venir para compartir.' }
    ],
    hacer: [
      { name: 'Atardecer en el Porto da Barra', zona: 'Barra', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/P%C3%B4r_do_Sol_na_Praia_do_Porto_da_Barra%C2%B7_16_01_2023_%C2%B7_Salvador_%28BA%29_%2852635776518%29.jpg/1280px-P%C3%B4r_do_Sol_na_Praia_do_Porto_da_Barra%C2%B7_16_01_2023_%C2%B7_Salvador_%28BA%29_%2852635776518%29.jpg', dur: '1 h', usd: 0, nota: 'Llevá una lata, sentate en la arena o en el muro del fuerte y mirá cómo el sol cae sobre la bahía.' },
      { name: 'Mercado Modelo', zona: 'Cidade Baixa', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Mercado_Modelo_Salvador_Bahia_2021-6320.jpg/1280px-Mercado_Modelo_Salvador_Bahia_2021-6320.jpg', dur: '1 h', usd: 0, nota: 'El mercado de artesanía al pie del Elevador Lacerda. Hay capoeira en la puerta.' },
      { name: 'Barco a la Ilha dos Frades', zona: 'Sale del Terminal Náutico', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Escunas_rumo_a_Ilha_dos_Frades.jpg/1280px-Escunas_rumo_a_Ilha_dos_Frades.jpg', dur: 'Día entero', usd: 25, nota: 'Islas de la bahía con playas de agua quieta. El paseo para en Frades e Itaparica.' },
      { name: 'Lagoa do Abaeté', zona: 'Itapuã, 18 km', dur: '2 h', usd: 0, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Lagoa_do_Abaet%C3%A9._Foto_Tatiana_Azeviche_Setur_%2815483283200%29.jpg/1280px-Lagoa_do_Abaet%C3%A9._Foto_Tatiana_Azeviche_Setur_%2815483283200%29.jpg', nota: 'Una laguna de agua oscura rodeada de dunas blancas, dentro del parque del Abaeté. Hay senderos alrededor de la laguna y por las dunas. Combinala con la playa de Itapuã y llevá agua: en la arena hace mucho calor.' },
      { name: 'Balé Folclórico da Bahia', zona: 'Teatro Miguel Santana, Pelourinho', dur: '1 h 30', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Bal%C3%A9_Folcl%C3%B3rico_da_Bahia-1487.jpg/1280px-Bal%C3%A9_Folcl%C3%B3rico_da_Bahia-1487.jpg', nota: 'La compañía de danza afrobrasileña hace funciones en su teatro del Pelourinho, con capoeira, samba de roda y danzas de los orixás. Las entradas se venden por Sympla y en boletería; revisá qué días hay función, porque la compañía también sale de gira.' },
      { name: 'Feira de São Joaquim', zona: 'Água de Meninos, Cidade Baixa', dur: '1 h', usd: 0, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Dry_shrimps_at_Feira_de_S%C3%A3o_Joaquim%2C_Salvador%2C_BA%2C_14-02-2023_%281%29.jpg/1280px-Dry_shrimps_at_Feira_de_S%C3%A3o_Joaquim%2C_Salvador%2C_BA%2C_14-02-2023_%281%29.jpg', nota: 'El mercado popular donde se compran el camarón seco, el dendê y la masa de acarajé, además de frutas, cerámica y artículos de candomblé. Andá de mañana, con poco encima, y combinalo con el Bonfim.' }
    ],
    tips: [
      { titulo: 'El Pelourinho, de día', texto: 'De día está lleno de policía y gente. De noche, quedate en las calles principales y volvé en taxi o Uber.' },
      { titulo: 'Las cintas de Bonfim no se regalan', texto: 'Te atan una cinta en la muñeca y después piden plata. Si no la querés, decí que no antes de que te la pongan.' },
      { titulo: 'La Barra es la base', texto: 'Alojarse en la Barra deja playa, atardecer y comida a pie, y el Pelourinho a 15 minutos.' },
      { titulo: 'Lavagem do Bonfim, en enero', texto: 'El segundo jueves después del Día de Reyes, las baianas caminan unos 8 km desde la iglesia de la Conceição da Praia hasta el Bonfim y lavan las escaleras. Va muchísima gente: andá temprano y a pie.' },
      { titulo: '2 de febrero, fiesta de Iemanjá', texto: 'En el Rio Vermelho la gente lleva flores y regalos al mar para Iemanjá. Ese día el barrio se llena: si querés ir, salí temprano y olvidate del auto.' },
      { titulo: 'En Carnaval, reservá con meses de anticipación', texto: 'Los circuitos principales son el Dodô (Barra-Ondina, por la costa) y el Osmar (Campo Grande). Alojarse cerca de la Barra es lo más práctico y lo más caro; hoteles, vuelos y abadás se agotan con meses de anticipación.' },
      { titulo: 'El ferry a Itaparica tiene filas', texto: 'El ferry a la Ilha de Itaparica sale del terminal de São Joaquim y las lanchas a Mar Grande, del Terminal Náutico. En feriados y fines de semana largos hay esperas de horas; si podés, cruzá en días de semana.' }
    ]
  },

  for: {
    resumen: 'La capital del sol del Nordeste, con playas urbanas para comer y bailar forró. Las playas de agua para nadar están en las afueras, a menos de una hora.',
    temporada: { alta: [1, 7, 12], baja: [3, 4, 5], nota: 'De febrero a mayo es la época de lluvias. De julio a diciembre no llueve y sopla viento fuerte, ideal para kitesurf. Hace calor todo el año.' },
    clima: {
      titulo: 'Clima en Fortaleza mes por mes',
      intro: 'Fortaleza tiene calor todo el año. Lo que cambia es la lluvia, concentrada de febrero a mayo, y el viento.',
      meses: [
        { m: 'Ene', max: 31, min: 25, lluvia: 156, mar: 29.5, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 24, lluvia: 187, mar: 29.5, demanda: 'media' },
        { m: 'Mar', max: 31, min: 24, lluvia: 337, mar: 30, demanda: 'baja' },
        { m: 'Abr', max: 31, min: 24, lluvia: 385, mar: 30, demanda: 'baja' },
        { m: 'May', max: 31, min: 24, lluvia: 229, mar: 29.5, demanda: 'baja' },
        { m: 'Jun', max: 31, min: 23, lluvia: 130, mar: 28.5, demanda: 'media' },
        { m: 'Jul', max: 31, min: 23, lluvia: 70, mar: 27.5, demanda: 'alta' },
        { m: 'Ago', max: 31, min: 23, lluvia: 20, mar: 27.5, demanda: 'media' },
        { m: 'Sep', max: 31, min: 24, lluvia: 14, mar: 27.5, demanda: 'media' },
        { m: 'Oct', max: 32, min: 24, lluvia: 10, mar: 28, demanda: 'media' },
        { m: 'Nov', max: 32, min: 25, lluvia: 10, mar: 28.5, demanda: 'media' },
        { m: 'Dic', max: 32, min: 25, lluvia: 37, mar: 28.5, demanda: 'alta' }
      ],
      nota: 'Para playa y paseos a las dunas: de julio a diciembre, cuando casi no llueve y sopla viento fuerte, ideal para kitesurf. De febrero a mayo es la época de lluvias, con marzo y abril como los meses más mojados. Diciembre, enero y julio son los más caros.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 (estación Fortaleza). Temperatura del mar: promedio mensual 2022-2025 del modelo marino de Open-Meteo frente a la costa de Fortaleza.'
    },
    beaches: [
      { name: 'Praia de Iracema', zona: 'Centro, 2 km', lat: -3.7206, lng: -38.5085, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Pier_da_praia_de_Iracema_%28Fortaleza%29_01.jpg/1280px-Pier_da_praia_de_Iracema_%28Fortaleza%29_01.jpg', vibe: 'La playa del muelle de los ingleses, con atardecer sobre el mar y bares alrededor. No es para nadar: es para caminar y salir.', cuando: 'Atardecer, en el Ponte dos Ingleses.' },
      { name: 'Meireles', zona: '3 km', lat: -3.7235, lng: -38.5018, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Praia_do_Meireles%2C_Fortaleza%2C_Cear%C3%A1.jpg/1280px-Praia_do_Meireles%2C_Fortaleza%2C_Cear%C3%A1.jpg', vibe: 'La rambla de los hoteles, con feria de artesanía de noche y quioscos. Agua con algo de olas.', cuando: 'Noche, para la feria.' },
      { name: 'Mucuripe', zona: '4 km', lat: -3.7242, lng: -38.4903, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Mucuripe_Beach%2C_Fortaleza%2C_Brazil_1.jpg/1280px-Mucuripe_Beach%2C_Fortaleza%2C_Brazil_1.jpg', vibe: 'Las jangadas de los pescadores, que vuelven al atardecer con el pescado que se vende en el mercado de al lado.', cuando: 'Tarde, cuando vuelven las jangadas.' },
      { name: 'Praia do Futuro', zona: '8 km', lat: -3.7312, lng: -38.4564, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Fortaleza_do_Futuro.jpg/1280px-Fortaleza_do_Futuro.jpg', vibe: 'La playa para bañarse de la ciudad: larga, con olas y barracas enormes que tienen piscina, show y caranguejo los jueves.', cuando: 'Jueves a la noche, por el caranguejo.' },
      { name: 'Cumbuco', zona: 'Caucaia, 35 km', lat: -3.627, lng: -38.731, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Cumbuco_Beach%2C_Fortaleza%2C_Cear%C3%A1%2C_Brasil_-_panoramio.jpg/1280px-Cumbuco_Beach%2C_Fortaleza%2C_Cear%C3%A1%2C_Brasil_-_panoramio.jpg', vibe: 'Dunas, lagunas y viento constante: la capital del kitesurf. Se llega en ómnibus o en auto, y las dunas se recorren en buggy.', cuando: 'De julio a diciembre, con viento.' },
      { name: 'Porto das Dunas', zona: 'Aquiraz, 25 km', lat: -3.838, lng: -38.395, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Praia_de_Porto_das_Dunas_11.jpg/1280px-Praia_de_Porto_das_Dunas_11.jpg', vibe: 'Playa de dunas y mar abierto, con algo de olas, donde está el parque acuático Beach Park.', cuando: 'Día entero.' },
      { name: 'Sabiaguaba', zona: 'Sudeste, 20 km', lat: -3.7835, lng: -38.4304, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Praia_de_Sabiaguaba.jpg/1280px-Praia_de_Sabiaguaba.jpg', vibe: 'Dunas, manglar y la boca del río Cocó dentro de un parque protegido, al final de la Praia do Futuro. Mar abierto y pocas barracas.', cuando: 'Tarde, para el atardecer en las dunas.' },
      { name: 'Prainha', zona: 'Aquiraz, 30 km', lat: -3.9023, lng: -38.3462, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Prainha_%28Aquiraz%29_02.jpg/1280px-Prainha_%28Aquiraz%29_02.jpg', vibe: 'Playa de pescadores con jangadas y un centro de rendeiras que tejen encaje de bilro. Mar abierto con algo de olas y viento.', cuando: 'Mañana.' }
    ],
    atracciones: [
      { name: 'Ponte dos Ingleses', zona: 'Praia de Iracema', lat: -3.7181, lng: -38.5168, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Ponte_dos_Ingleses%2C_tamb%C3%A9m_conhecida_como_Ponte_Met%C3%A1lica.jpg/1280px-Ponte_dos_Ingleses%2C_tamb%C3%A9m_conhecida_como_Ponte_Met%C3%A1lica.jpg', dur: '40 min', usd: 0, nota: 'El muelle sobre el mar, con delfines algunos días y el mejor atardecer de la ciudad.' },
      { name: 'Centro Dragão do Mar', zona: 'Praia de Iracema', lat: -3.7217, lng: -38.5202, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Centro_Drag%C3%A3o_do_Mar_de_Arte_e_Cultura_%284%29.jpg/1280px-Centro_Drag%C3%A3o_do_Mar_de_Arte_e_Cultura_%284%29.jpg', dur: '1 h', usd: 0, nota: 'Centro cultural con museos, planetario y bares alrededor. De noche hay música.' },
      { name: 'Mercado Central', zona: 'Centro', lat: -3.7234, lng: -38.5239, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Mar2024._Mercado_Central_de_Fortaleza%2C_Cear%C3%A1%2C_Brazil_02.jpg/1280px-Mar2024._Mercado_Central_de_Fortaleza%2C_Cear%C3%A1%2C_Brazil_02.jpg', dur: '1 h', usd: 0, nota: 'Cuatro pisos de artesanía, castañas de cajú y hamacas. Se negocia.' }
    ],
    comer: [
      { name: 'Caranguejo en la Praia do Futuro', tipo: 'Cena', zona: 'Praia do Futuro', usd: 15, momento: 'Jueves a la noche', nota: 'Los jueves todas las barracas sirven cangrejo con martillito. Es una tradición de la ciudad.' },
      { name: 'Baião de dois', tipo: 'Almuerzo', zona: 'Restaurantes regionales', usd: 10, momento: 'Mediodía', nota: 'Arroz con feijão verde y queso coalho. El plato de Ceará.' },
      { name: 'Tapioca de Messejana', tipo: 'Merienda', zona: 'Centro das Tapioqueiras', usd: 3, momento: 'Tarde', nota: 'Un centro entero de puestos de tapioca, camino al sur.' },
      { name: 'Pescado en el Mucuripe', tipo: 'Almuerzo', zona: 'Mercado de pescado', usd: 12, momento: 'Mediodía', nota: 'Comprás el pescado o el camarón y te lo cocinan en los puestos de al lado.' }
    ],
    hacer: [
      { name: 'Forró en la Praia de Iracema', zona: 'Iracema', dur: '3 h', usd: 6, nota: 'Casas de forró con banda en vivo varias noches por semana. Nadie se queda sentado.' },
      { name: 'Buggy en Cumbuco', zona: 'Cumbuco', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Esquibunda%2C_Fortaleza%2C_CE.jpg/1280px-Esquibunda%2C_Fortaleza%2C_CE.jpg', dur: '3 h', usd: 25, nota: 'Dunas, lagunas y el "esquibunda": bajar las dunas en tabla y caer al agua.' },
      { name: 'Feria de Meireles', zona: 'Meireles', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Feirinha_da_Beira_Mar_01.jpg/1280px-Feirinha_da_Beira_Mar_01.jpg', dur: '1 h', usd: 0, nota: 'Feria de artesanía todas las noches en la rambla.' }
    ],
    tips: [
      { titulo: 'No te bañes frente al centro', texto: 'Las playas entre Iracema y Mucuripe no suelen estar aptas para el baño. Para nadar, Praia do Futuro o las de afuera.' },
      { titulo: 'El viento es el clima', texto: 'De julio a diciembre sopla fuerte todo el día. Es bueno para el kite y alivia el calor, pero en la playa vuela la arena.' },
      { titulo: 'Jeri queda lejos', texto: 'Jericoacoara está a 300 km. No es una salida de día: son 5 horas por trayecto.' }
    ]
  },

  jericoacoara: {
    resumen: 'Una vila de calles de arena dentro de un parque nacional, entre dunas y lagunas de agua dulce. Todo se hace a pie, en buggy o en 4x4.',
    temporada: { alta: [1, 7, 8, 9, 10, 12], baja: [3, 4, 5], nota: 'De marzo a mayo llueve y las lagunas se llenan. De julio a diciembre no llueve, sopla viento fuerte y es temporada de kitesurf; las lagunas bajan hacia el final del año.' },
    clima: {
      titulo: 'Clima en Jericoacoara mes por mes',
      intro: 'En Jeri hace calor todo el año. Lo que cambia es la lluvia, el viento y el agua de las lagunas.',
      meses: [
        { m: 'Ene', max: 28, min: 26, lluvia: 120, mar: 29, demanda: 'alta' },
        { m: 'Feb', max: 28, min: 25, lluvia: 184, mar: 29, demanda: 'media' },
        { m: 'Mar', max: 28, min: 25, lluvia: 298, mar: 29, demanda: 'baja' },
        { m: 'Abr', max: 28, min: 25, lluvia: 292, mar: 29.5, demanda: 'baja' },
        { m: 'May', max: 29, min: 26, lluvia: 159, mar: 29.5, demanda: 'baja' },
        { m: 'Jun', max: 29, min: 25, lluvia: 51, mar: 29, demanda: 'media' },
        { m: 'Jul', max: 29, min: 25, lluvia: 28, mar: 28, demanda: 'alta' },
        { m: 'Ago', max: 29, min: 25, lluvia: 7, mar: 27.5, demanda: 'alta' },
        { m: 'Sep', max: 29, min: 25, lluvia: 4, mar: 27.5, demanda: 'alta' },
        { m: 'Oct', max: 29, min: 26, lluvia: 7, mar: 27.5, demanda: 'alta' },
        { m: 'Nov', max: 29, min: 26, lluvia: 8, mar: 28, demanda: 'media' },
        { m: 'Dic', max: 29, min: 26, lluvia: 31, mar: 28.5, demanda: 'alta' }
      ],
      nota: 'Para kitesurf y sol seguro: de julio a diciembre, cuando prácticamente no llueve y el viento sopla fuerte todos los días. Para ver las lagunas llenas: de mayo a julio, al final de las lluvias. De marzo a mayo llueve mucho y los precios bajan; diciembre, enero y julio son los meses más caros.',
      fuente: 'Temperaturas y lluvia: climatología de 30 años de Climatempo para Jericoacoara (la vila no tiene estación del INMET). Temperatura del mar: promedio mensual 2022-2025 del modelo marino de Open-Meteo frente a Jericoacoara.'
    },
    beaches: [
      { name: 'Praia da Vila', zona: 'Frente a la vila', lat: -2.7965, lng: -40.5187, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Jijoca_de_Jericoacoara.jpg/1280px-Jijoca_de_Jericoacoara.jpg', vibe: 'La playa de la vila, de agua tibia y calma, con la duna del atardecer en una punta. Barcos y caipirinhas en carritos.', cuando: 'Mañana para nadar; atardecer en la duna.' },
      { name: 'Duna do Pôr do Sol', zona: 'Oeste de la vila', lat: -2.8036, lng: -40.5188, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Imensid%C3%A3o_do_mar_vista_da_Duna_do_P%C3%B4r_do_Sol_-_Praia_de_Jericoacoara.jpg/1280px-Imensid%C3%A3o_do_mar_vista_da_Duna_do_P%C3%B4r_do_Sol_-_Praia_de_Jericoacoara.jpg', vibe: 'La duna grande donde todo el pueblo sube a ver el sol caer en el mar. Después hay capoeira en la playa.', cuando: 'Media hora antes del atardecer.' },
      { name: 'Malhada', zona: 'Este de la vila, a pie', lat: -2.7916, lng: -40.5183, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Pedras_na_praia_da_Malhada.jpg/1280px-Pedras_na_praia_da_Malhada.jpg', vibe: 'Playa de piedras y arena camino a la Pedra Furada, con olas buenas para surf.', cuando: 'Marea baja, de camino a la Pedra Furada.' },
      { name: 'Pedra Furada', zona: 'Este, 3 km a pie', lat: -2.7885, lng: -40.4917, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/02_-_Pedra-Furada-Jericoacoara-Ce_Helio_Bastos_salmon140722.jpg/960px-02_-_Pedra-Furada-Jericoacoara-Ce_Helio_Bastos_salmon140722.jpg', vibe: 'El arco de piedra sobre el mar, símbolo de Jeri. Se llega caminando por la playa con marea baja.', cuando: 'Marea baja. En julio el sol se pone justo en el agujero.' },
      { name: 'Lagoa do Paraíso', zona: 'Jijoca, 15 km', lat: -2.9091, lng: -40.4311, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Lagoa_do_Para%C3%ADso_Jijoca_de_Jericoacoara.jpg/1280px-Lagoa_do_Para%C3%ADso_Jijoca_de_Jericoacoara.jpg', vibe: 'Una laguna de agua dulce, azul y tibia, con hamacas dentro del agua. La postal de Jeri.', cuando: 'Mediodía, cuando el agua está más azul.' },
      { name: 'Lagoa Azul', zona: 'Jijoca, 12 km', lat: -2.895, lng: -40.47, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/20--LagoaAzul-Jericoacoara%2CCe_Helio-Bastos-Salmon-110722.jpg/960px-20--LagoaAzul-Jericoacoara%2CCe_Helio-Bastos-Salmon-110722.jpg', vibe: 'La laguna vecina a la del Paraíso, más chica y con menos gente.', cuando: 'Después de la Lagoa do Paraíso.' },
      { name: 'Preá', zona: 'Este, 15 km', lat: -2.8133, lng: -40.3789, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Praia_do_Pre%C3%A1-13_%2853270615813%29.jpg/1280px-Praia_do_Pre%C3%A1-13_%2853270615813%29.jpg', vibe: 'Playa larga y plana con viento constante, donde están la mayoría de las escuelas de kitesurf. Se llega en buggy por la playa.', cuando: 'De julio a diciembre, a la tarde, cuando el viento es más fuerte.' },
      { name: 'Mangue Seco', zona: 'Oeste, 8 km', lat: -2.849, lng: -40.5619, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Mangue_Seco_-_Jijoca_de_Jericoacoara.jpg/1280px-Mangue_Seco_-_Jijoca_de_Jericoacoara.jpg', vibe: 'El manglar llega hasta la arena y el agua queda verde y calma. Es parada del paseo del oeste, antes de cruzar el río hacia Guriú.', cuando: 'Marea baja, en el paseo de buggy del oeste.' },
      { name: 'Guriú', zona: 'Oeste, 12 km', lat: -2.8494, lng: -40.5881, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Guri%C3%BA_%2853265768481%29.jpg/1280px-Guri%C3%BA_%2853265768481%29.jpg', vibe: 'Del otro lado del río, que se cruza en balsa, con dunas, manglar y un pueblo de pescadores. En el manglar hay paseos con guías locales para ver caballitos de mar.', cuando: 'Marea baja, en el paseo del oeste.' },
      { name: 'Tatajuba', zona: 'Camocim, 25 km', lat: -2.8591, lng: -40.6949, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Praia_de_Tatajuba_-_Jericoacoara_-_Cear%C3%A1_-_Brasil.JPG/1280px-Praia_de_Tatajuba_-_Jericoacoara_-_Cear%C3%A1_-_Brasil.JPG', vibe: 'Un pueblo rehecho después de que las dunas taparon el viejo, con la boca del río, dunas y lagunas alrededor. Se llega en buggy cruzando ríos en balsa.', cuando: 'Día entero, en el paseo del oeste.' }
    ],
    atracciones: [
      { name: 'Árvore da Preguiça', zona: 'Este, 5 km', lat: -2.8019, lng: -40.4623, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/%C3%81rvore_da_Pregui%C3%A7a.jpg/1280px-%C3%81rvore_da_Pregui%C3%A7a.jpg', dur: '20 min', usd: 0, nota: 'Un árbol torcido por el viento hasta quedar acostado. Parada del paseo del este.' },
      { name: 'Serrote', zona: 'Detrás de la vila', lat: -2.7881, lng: -40.4992, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Morro_do_Serrote_-_Jericoacoara.jpg/1280px-Morro_do_Serrote_-_Jericoacoara.jpg', dur: '1 h', usd: 0, nota: 'El cerro con el faro, a una caminata desde la vila, con vista de las dunas y el mar.' },
      { name: 'Rua Principal de noche', zona: 'Vila', dur: '2 h', usd: 0, nota: 'Calles de arena con bares, música en vivo y forró. La vida nocturna de Jeri.' }
    ],
    comer: [
      { name: 'Tapioca en la Rua Principal', tipo: 'Desayuno', zona: 'Vila', usd: 3, momento: 'Mañana', nota: 'Tapioca rellena en los puestos de la calle principal.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato de un pueblo caro.' },
      { name: 'Caipirinha en carrito', tipo: 'Atardecer', zona: 'Playa', usd: 4, momento: 'Atardecer', nota: 'Carritos de caipirinha y frutas en la arena, frente a la duna.' },
      { name: 'Peixe na brasa', tipo: 'Cena', zona: 'Vila', usd: 18, momento: 'Noche', nota: 'Pescado a la parrilla en los restaurantes de la calle de la playa.' }
    ],
    hacer: [
      { name: 'Buggy del este', zona: 'Sale de la vila', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Jericoacoara_08_2007_46.jpg/1280px-Jericoacoara_08_2007_46.jpg', dur: '5 h', usd: 35, nota: 'Pedra Furada, Árvore da Preguiça, Lagoa do Paraíso y Lagoa Azul. Se comparte entre cuatro.' },
      { name: 'Kitesurf en el Preá', zona: 'Preá, 10 km', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/Praia_do_prea_-_cruz_-_ceara.jpg/1280px-Praia_do_prea_-_cruz_-_ceara.jpg', dur: '3 h', nota: 'El viento más constante de Brasil. Hay escuelas con clases para empezar.' },
      { name: 'Caminata a la Pedra Furada', zona: 'Desde la vila', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Pedra_Furada_de_Jericoacoara_-_Cear%C3%A1.jpg/1280px-Pedra_Furada_de_Jericoacoara_-_Cear%C3%A1.jpg', dur: '2 h', usd: 0, nota: 'Por la playa con marea baja o por el cerro con marea alta.' }
    ],
    tips: [
      { titulo: 'Hay que pagar la tasa', texto: 'Jeri cobra una tasa de turismo sustentable (TUS) de pago único que vale por diez días; si te quedás más, se paga por día extra. Se paga online antes de llegar.' },
      { titulo: 'Sin auto común', texto: 'Desde Jijoca solo se entra en 4x4 o buggy: las calles son de arena. El transfer desde Fortaleza ya hace el cambio de vehículo.' },
      { titulo: 'Efectivo y cajeros', texto: 'Hay pocos cajeros y a veces sin plata. Llevá efectivo desde Fortaleza o Jijoca.' }
    ]
  },

  morro: {
    resumen: 'Una isla sin autos, donde las playas se llaman por número: Primeira, Segunda, Terceira y Quarta. Se llega en barco desde Salvador y todo se recorre a pie.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6, 8, 9, 10, 11], nota: 'De abril a junio llueve más y el mar se pone movido. De septiembre a marzo hay sol; en Año Nuevo y Carnaval la isla está llena y los precios suben mucho.' },
    clima: {
      titulo: 'Clima en Morro de São Paulo mes por mes',
      intro: 'Morro tiene calor todo el año. Lo que cambia es la lluvia, que se concentra de abril a julio.',
      meses: [
        { m: 'Ene', max: 29, min: 24, lluvia: 98, mar: 27, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 24, lluvia: 88, mar: 28, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 24, lluvia: 130, mar: 28.5, demanda: 'baja' },
        { m: 'Abr', max: 28, min: 23, lluvia: 192, mar: 28.5, demanda: 'baja' },
        { m: 'May', max: 27, min: 22, lluvia: 173, mar: 27, demanda: 'baja' },
        { m: 'Jun', max: 26, min: 21, lluvia: 153, mar: 26.5, demanda: 'baja' },
        { m: 'Jul', max: 26, min: 21, lluvia: 146, mar: 25.5, demanda: 'alta' },
        { m: 'Ago', max: 26, min: 21, lluvia: 132, mar: 25.5, demanda: 'baja' },
        { m: 'Sep', max: 27, min: 21, lluvia: 92, mar: 25.5, demanda: 'baja' },
        { m: 'Oct', max: 28, min: 23, lluvia: 82, mar: 26, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 23, lluvia: 148, mar: 26.5, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 24, lluvia: 101, mar: 26.5, demanda: 'alta' }
      ],
      nota: 'Para playa con sol y mar calmo, de septiembre a marzo; octubre y marzo tienen buen tiempo y menos gente. De abril a julio llueve casi un día de cada tres y el mar se pone movido. En Año Nuevo, Carnaval y julio la isla se llena y los precios suben.',
      fuente: 'Temperaturas y lluvia: promedio 2015-2024 del reanálisis ERA5 (Open-Meteo) para el punto del destino; no hay normal INMET 1991-2020 publicada para esta localidad. Temperatura del agua: Weatherspark.'
    },
    beaches: [
      { name: 'Primeira Praia', zona: 'Al lado de la vila', lat: -13.3779, lng: -38.9141, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/MARCIO_FILHO_PRIMEIRA_PRAIA_MORRO_DE_S%C3%83O_PAULO_BAHIA_%2826104106967%29.jpg/1280px-MARCIO_FILHO_PRIMEIRA_PRAIA_MORRO_DE_S%C3%83O_PAULO_BAHIA_%2826104106967%29.jpg', vibe: 'Una playa chica de olas, debajo del cerro del faro.', cuando: 'Mañana.' },
      { name: 'Segunda Praia', zona: '5 min a pie', lat: -13.3797, lng: -38.912, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Segunda_praia_-_panoramio.jpg/1280px-Segunda_praia_-_panoramio.jpg', vibe: 'La playa de la fiesta: bares, música y gente hasta la madrugada. De día, agua calma y piscinas con marea baja.', cuando: 'Tarde y noche.' },
      { name: 'Terceira Praia', zona: '10 min a pie', lat: -13.3833, lng: -38.9088, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Segunda_e_terceira_praia_-_panoramio.jpg/1280px-Segunda_e_terceira_praia_-_panoramio.jpg', vibe: 'Agua muy quieta protegida por el arrecife, con la isla de Caitá enfrente. La más tranquila para nadar.', cuando: 'Marea baja de mañana.' },
      { name: 'Quarta Praia', zona: '25 min a pie', lat: -13.3946, lng: -38.9072, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Mar%C3%A9_Baixa_-_Quarta_Praia.jpg/1280px-Mar%C3%A9_Baixa_-_Quarta_Praia.jpg', vibe: 'Una playa larga de cocoteros con piscinas naturales enormes con marea baja. Cuanto más lejos, menos gente.', cuando: 'Marea baja; día entero.' },
      { name: 'Garapuá', zona: 'Sur, 10 km', lat: -13.4756, lng: -38.9216, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Garapu%C3%A1_Foto_Tatiana_Azeviche_%2845236378984%29.jpg/1280px-Garapu%C3%A1_Foto_Tatiana_Azeviche_%2845236378984%29.jpg', vibe: 'Una vila de pescadores con arrecife y agua transparente, a la que se llega en barco o en tractor por la playa.', cuando: 'Día entero, en el paseo de la isla.' },
      { name: 'Praia da Gamboa', zona: 'Vila de Gamboa, 3 km', lat: -13.3933, lng: -38.9367, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Praia_da_Gamboa_%28Ilha_de_Tinhar%C3%A9%29.jpg/1280px-Praia_da_Gamboa_%28Ilha_de_Tinhar%C3%A9%29.jpg', vibe: 'Playa del lado del canal, frente a la vila de Gamboa: agua calma y poco profunda, barcos de pescadores y restaurantes simples.', cuando: 'Marea baja, para ir caminando desde Morro por la orilla; si no, en barco.' },
      { name: 'Praia da Argila', zona: 'Camino a Gamboa, 1,5 km', lat: -13.3867, lng: -38.9284, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Praia_da_Argila.jpg/1280px-Praia_da_Argila.jpg', vibe: 'Un barranco de arcilla junto al mar, donde la gente se embarra la piel y se enjuaga en el agua calma del canal.', cuando: 'Marea baja: el camino por la arena desde Morro solo se hace así.' },
      { name: 'Quinta Praia (Praia do Encanto)', zona: 'Sur, 5 km a pie por la arena', lat: -13.4238, lng: -38.9059, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Praia_do_Encanto.jpg/1280px-Praia_do_Encanto.jpg', vibe: 'La continuación de la Quarta Praia, mucho más vacía, con arrecife y piscinas naturales cuando baja la marea. Hay pocas posadas y casi ninguna barraca.', cuando: 'Marea baja; llevá agua.' },
      { name: 'Boca da Barra (Boipeba)', zona: 'Isla de Boipeba, 22 km en lancha', lat: -13.5794, lng: -38.9233, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Boipeba_-_Boca_da_Barra_-_praia.JPG/1280px-Boipeba_-_Boca_da_Barra_-_praia.JPG', vibe: 'La playa de la vila de Boipeba, donde el río del Inferno se junta con el mar: agua calma de río de un lado y mar del otro, con barracas y posadas.', cuando: 'Atardecer, mirando el río.' },
      { name: 'Tassimirim (Boipeba)', zona: 'Isla de Boipeba, 20 min a pie desde la vila', lat: -13.5828, lng: -38.9142, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Praia_de_Tassimirim_%2851029027607%29.jpg/1280px-Praia_de_Tassimirim_%2851029027607%29.jpg', vibe: 'Una playa larga de cocoteros con arrecife que forma piscinas con marea baja. Casi sin construcciones.', cuando: 'Marea baja.' },
      { name: 'Cueira (Boipeba)', zona: 'Isla de Boipeba, 40 min a pie desde la vila', lat: -13.5923, lng: -38.9111, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Praia_da_Cueira%2C_Ilha_Boipeba.jpg/1280px-Praia_da_Cueira%2C_Ilha_Boipeba.jpg', vibe: 'Arena ancha, cocoteros y agua calma protegida por el arrecife, con un par de restaurantes de mariscos donde se come langosta.', cuando: 'Mediodía, para almorzar en la playa.' },
      { name: 'Moreré (Boipeba)', zona: 'Isla de Boipeba, 25 km en lancha', lat: -13.6028, lng: -38.9033, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Morer%C3%A9_-_Boipeba.JPG/1280px-Morer%C3%A9_-_Boipeba.JPG', vibe: 'Una vila de pescadores con piscinas naturales en el arrecife, donde se nada entre peces. Es parada de la vuelta a la isla.', cuando: 'Marea baja, sin ella no hay piscinas.' },
      { name: 'Bainema (Boipeba)', zona: 'Isla de Boipeba, al sur de Moreré', lat: -13.6266, lng: -38.9015, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Praia_de_Bainema_%2851019666621%29.jpg/1280px-Praia_de_Bainema_%2851019666621%29.jpg', vibe: 'Una playa larga y vacía llena de cocoteros, entre Moreré y Castelhanos. No hay barracas.', cuando: 'Marea baja; llevá agua y algo para comer.' }
    ],
    atracciones: [
      { name: 'Farol do Morro', zona: 'Cerro de la vila', lat: -13.3759, lng: -38.9153, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Farol_do_Morro_de_S%C3%A3o_Paulo_-_BA_%2852113641437%29.jpg/1280px-Farol_do_Morro_de_S%C3%A3o_Paulo_-_BA_%2852113641437%29.jpg', dur: '40 min', usd: 0, nota: 'El faro sobre el cerro, con vista a todas las playas. De ahí sale la tirolesa a la Primeira Praia.' },
      { name: 'Fortaleza de Tapirandu', zona: 'Vila', lat: -13.3742, lng: -38.9159, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Fortaleza_de_Morro_deS%C3%A3o_Paulo.JPG/1280px-Fortaleza_de_Morro_deS%C3%A3o_Paulo.JPG', dur: '30 min', usd: 0, nota: 'Ruinas del fuerte del siglo XVII junto al muelle. El atardecer se mira desde sus murallas.' },
      { name: 'Portaló', zona: 'Entrada de la vila', lat: -13.3775, lng: -38.9177, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Portal_do_Morro_de_S%C3%A3o_Paulo_-_panoramio.jpg/1280px-Portal_do_Morro_de_S%C3%A3o_Paulo_-_panoramio.jpg', dur: '15 min', usd: 0, nota: 'El portal de piedra por donde se entra al pueblo desde el muelle.' }
    ],
    comer: [
      { name: 'Prato feito de la vila', tipo: 'Almuerzo', zona: 'Calles de la vila', usd: 10, momento: 'Mediodía', nota: 'Pescado, arroz, feijão y ensalada. Más barato en la vila que en las playas.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Plaza de la vila', usd: 4, momento: 'Tarde', nota: 'Las baianas de la plaza, al atardecer.' },
      { name: 'Moqueca', tipo: 'Cena', zona: 'Segunda Praia', usd: 22, momento: 'Noche', nota: 'Moqueca baiana para dos, en los restaurantes de la playa.' }
    ],
    hacer: [
      { name: 'Volta à ilha', zona: 'Sale de la Segunda Praia', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Piscinas_Naturais_de_Morer%C3%A9.jpg/1280px-Piscinas_Naturais_de_Morer%C3%A9.jpg', dur: 'Día entero', usd: 30, nota: 'Barco que da la vuelta a Tinharé con paradas en Garapuá, piscinas de Moreré y Boipeba.' },
      { name: 'Tirolesa del faro', zona: 'Primeira Praia', dur: '20 min', usd: 15, nota: 'Del cerro del faro hasta el mar de la Primeira Praia.' },
      { name: 'Atardecer en el fuerte', zona: 'Vila', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Sunset_II_-_Morro_de_S%C3%A3o_Paulo.JPG/1280px-Sunset_II_-_Morro_de_S%C3%A3o_Paulo.JPG', dur: '1 h', usd: 0, nota: 'Desde las ruinas de la fortaleza, mirando hacia el continente.' }
    ],
    tips: [
      { titulo: 'Tasa de entrada', texto: 'Se paga una tasa al llegar al muelle. Guardá el comprobante.' },
      { titulo: 'El barco desde Salvador marea', texto: 'El catamarán tarda dos horas y el mar suele estar movido. Si te mareás, la ruta por Valença es más larga pero con menos mar abierto.' },
      { titulo: 'Las valijas, en carretilla', texto: 'No hay autos: los carretilleros llevan las valijas del muelle a la posada. Acordá el precio antes.' }
    ]
  },

  itacare: {
    resumen: 'Un pueblo de surf donde la selva atlántica llega al mar. Las mejores playas son calas a las que se llega por senderos cortos desde la ruta.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6, 8, 9, 10, 11], nota: 'Llueve repartido todo el año, con más lluvia de abril a julio. De septiembre a marzo hay más sol. Las olas son mejores en invierno.' },
    clima: {
      titulo: 'Clima en Itacaré mes por mes',
      intro: 'Itacaré tiene calor y agua tibia todo el año. Llueve en todos los meses, más de abril a julio.',
      meses: [
        { m: 'Ene', max: 28, min: 24, lluvia: 103, mar: 27, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 24, lluvia: 94, mar: 27.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 24, lluvia: 128, mar: 28, demanda: 'baja' },
        { m: 'Abr', max: 28, min: 24, lluvia: 203, mar: 28, demanda: 'baja' },
        { m: 'May', max: 27, min: 23, lluvia: 158, mar: 27, demanda: 'baja' },
        { m: 'Jun', max: 26, min: 22, lluvia: 136, mar: 26, demanda: 'baja' },
        { m: 'Jul', max: 25, min: 21, lluvia: 131, mar: 25.5, demanda: 'alta' },
        { m: 'Ago', max: 25, min: 21, lluvia: 115, mar: 25.5, demanda: 'baja' },
        { m: 'Sep', max: 26, min: 22, lluvia: 88, mar: 25.5, demanda: 'baja' },
        { m: 'Oct', max: 27, min: 23, lluvia: 96, mar: 26, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 24, lluvia: 164, mar: 26, demanda: 'baja' },
        { m: 'Dic', max: 28, min: 24, lluvia: 113, mar: 26.5, demanda: 'alta' }
      ],
      nota: 'Para playa con más sol, de septiembre a marzo; septiembre y octubre son los meses más secos y tranquilos. De abril a julio llueve más, aunque casi siempre en chaparrones, y en invierno entran las mejores olas para surf. Diciembre, enero, febrero y julio son los meses caros.',
      fuente: 'Temperaturas y lluvia: promedio 2015-2024 del reanálisis ERA5 (Open-Meteo) para el punto del destino; no hay normal INMET 1991-2020 publicada para esta localidad. Temperatura del agua: Weatherspark.'
    },
    beaches: [
      { name: 'Praia da Concha', zona: 'Pueblo, 1 km', lat: -14.2752, lng: -38.9905, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/MARCIO_FILHO_PRAIA_DA_CONCHA_ITACARE_BAHIA_%283%29_%2841572951511%29.jpg/1280px-MARCIO_FILHO_PRAIA_DA_CONCHA_ITACARE_BAHIA_%283%29_%2841572951511%29.jpg', vibe: 'La playa del pueblo, de agua calma junto a la desembocadura del río, con el faro en la punta.', cuando: 'Atardecer, desde el faro.' },
      { name: 'Tiririca', zona: '1.5 km', lat: -14.2861, lng: -38.9854, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/MARCIO_FILHO_PRAIA_DA_TIRIRICA_ITACARE_BAHIA_%2840974478571%29.jpg/1280px-MARCIO_FILHO_PRAIA_DA_TIRIRICA_ITACARE_BAHIA_%2840974478571%29.jpg', vibe: 'La playa de los surfistas, con las mejores olas del pueblo y bares sencillos.', cuando: 'Tarde, para ver el surf.' },
      { name: 'Ribeira', zona: '2 km', lat: -14.29, lng: -38.988, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/PRAIA-DA-RIBEIRA.JPG/960px-PRAIA-DA-RIBEIRA.JPG', vibe: 'Agua calma en una punta y un río con cascada chica en la otra, donde la gente se tira desde una cuerda.', cuando: 'Mediodía.' },
      { name: 'Prainha', zona: 'Sendero desde la Ribeira, 3 km', lat: -14.308, lng: -38.9891, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/MARCIO_FILHO_PRAINHA_ITACARE_BAHIA_%2840974466101%29.jpg/1280px-MARCIO_FILHO_PRAINHA_ITACARE_BAHIA_%2840974466101%29.jpg', vibe: 'Una cala de cocoteros a la que se llega por un sendero de media hora por la selva. Para muchos, la más linda de Itacaré.', cuando: 'Mañana; volvé antes de las 16.' },
      { name: 'Itacarezinho', zona: 'Ruta a Ilhéus, 12 km', lat: -14.3816, lng: -39.0101, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Praia_de_Itacar%C3%A9zinho_-_Itacar%C3%A9_-_Bahia_-_Brasil_%288552602430%29.jpg/1280px-Praia_de_Itacar%C3%A9zinho_-_Itacar%C3%A9_-_Bahia_-_Brasil_%288552602430%29.jpg', vibe: 'Una playa larga y casi vacía, con cascada sobre la arena en un extremo.', cuando: 'Día entero.' },
      { name: 'Engenhoca', zona: 'Ruta a Ilhéus, 9 km', lat: -14.3529, lng: -39.0022, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Praia_de_Engenhoca_-_Itacar%C3%A9_-_Bahia_-_Brasil_%288552582542%29.jpg/1280px-Praia_de_Engenhoca_-_Itacar%C3%A9_-_Bahia_-_Brasil_%288552582542%29.jpg', vibe: 'Playa de surf escondida en la selva, a un sendero corto desde la ruta. Arena dorada, olas constantes y nada construido.', cuando: 'Mañana. Volvé antes de que oscurezca: el sendero no tiene luz.' },
      { name: 'Praia da Coroinha', zona: 'Centro, a orillas del río', lat: -14.2766, lng: -38.9959, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Praia_da_Coroinha_1.jpg/1280px-Praia_da_Coroinha_1.jpg', vibe: 'La playa de río del pueblo, con los barcos de pescadores varados cuando baja la marea. No es para nadar en el mar, sino para caminar y ver el atardecer.', cuando: 'Atardecer.' },
      { name: 'Praia do Resende', zona: '1,5 km del centro', lat: -14.2839, lng: -38.9851, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Praia_do_Resende_em_Itacar%C3%A9%2C_Bahia.jpg/1280px-Praia_do_Resende_em_Itacar%C3%A9%2C_Bahia.jpg', vibe: 'Una playa chica entre rocas y selva, a pocos minutos caminando del centro, con olas para surf y algunas barracas.', cuando: 'Mañana.' },
      { name: 'Praia de São José', zona: 'Sur, 4 km', lat: -14.3145, lng: -38.992, foto: 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Praiadesaojos%C3%A9.jpg', vibe: 'Una playa chica y aislada, rodeada de selva, de arena dorada y olas medianas. Casi nunca hay gente.', cuando: 'Mañana, con marea baja.' },
      { name: 'Havaizinho', zona: 'Ruta a Ilhéus, 9 km', lat: -14.3603, lng: -39.0045, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/PRAIA_DO_HAVAIZINHO.JPG/1280px-PRAIA_DO_HAVAIZINHO.JPG', vibe: 'Una playa de olas fuertes entre rocas y selva, una de las paradas de la Trilha das 4 Praias.', cuando: 'Mañana; el mar es bravo, nadá con cuidado.' },
      { name: 'Camboinha', zona: 'Ruta a Ilhéus, 10 km', lat: -14.3643, lng: -39.0053, foto: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/CAMBOINHA.JPG', vibe: 'Playa chica y salvaje entre Havaizinho e Itacarezinho, sin barracas, a la que se llega por el sendero.', cuando: 'Mañana, en la Trilha das 4 Praias.' },
      { name: 'Praia do Sargi', zona: 'Serra Grande, 30 km por la ruta a Ilhéus', lat: -14.5007, lng: -39.0348, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Praia_do_Sargi.jpg/1280px-Praia_do_Sargi.jpg', vibe: 'Una playa recta de varios kilómetros con cocoteros y casi nadie, que se ve entera desde el mirador de la ruta.', cuando: 'Día entero; pará en el mirador de la BA-001.' },
      { name: 'Pé de Serra (Serra Grande)', zona: 'Serra Grande, 28 km por la ruta a Ilhéus', lat: -14.4816, lng: -39.0321, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Praia_Serra_Grande.jpg/1280px-Praia_Serra_Grande.jpg', vibe: 'La playa de la vila de Serra Grande: arena ancha, cocoteros y pocas construcciones. Más tranquila que las de Itacaré.', cuando: 'Mañana.' }
    ],
    atracciones: [
      { name: 'Farol de Itacaré', zona: 'Praia da Concha', lat: -14.2726, lng: -38.9868, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Farol_da_Praia_da_Concha_-_Itacar%C3%A9_BA_%2826156106675%29.jpg/1280px-Farol_da_Praia_da_Concha_-_Itacar%C3%A9_BA_%2826156106675%29.jpg', dur: '30 min', usd: 0, nota: 'El faro en la punta de la Concha, con el atardecer sobre el río.' },
      { name: 'Rua Pituba', zona: 'Centro', dur: '1 h', usd: 0, nota: 'La calle peatonal del pueblo, con bares, crepes y música. Es la noche de Itacaré.' },
      { name: 'Igreja de São Miguel', zona: 'Centro', lat: -14.2776, lng: -38.9958, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Itacare_Church_%283001649299%29.jpg/1280px-Itacare_Church_%283001649299%29.jpg', dur: '15 min', usd: 0, nota: 'Iglesia colonial frente al río, de las más antiguas del sur de Bahía.' },
      { name: 'Mirante da Ponta do Xaréu', zona: 'Punta de la Praia da Concha', dur: '1 h', usd: 0, lat: -14.2749, lng: -38.9911, foto: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Ponta_do_Xar%C3%A9u.jpg', nota: 'Unas piedras con pasto, árboles y un banco de madera en la punta de la Concha, justo donde el Rio de Contas se encuentra con el mar. Es el lugar del pueblo para ver el atardecer, con el sol cayendo detrás de la Praia do Pontal. Se llega caminando desde la Praia da Coroa; llevá una toalla para sentarte en el pasto.' },
      { name: 'Cachoeira do Tijuípe', zona: 'BA-001, entre Itacaré y Serra Grande, 22 km', dur: '2 a 3 h', lat: -14.4078, lng: -39.0538, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Cachoeira_do_Tiju%C3%ADpe.jpg/1280px-Cachoeira_do_Tiju%C3%ADpe.jpg', nota: 'Una cascada ancha y baja, de unos 4 metros de alto y 15 de ancho, con un pozo grande para bañarse en medio de la selva. Es la cascada más fácil de la zona: la entrada está sobre la ruta y de ahí son unos 10 minutos a pie, con restaurante en el lugar. Se paga entrada porque es un predio privado; muchas excursiones la combinan con la Trilha das 4 Praias.' },
      { name: 'Mirante de Serra Grande', zona: 'BA-001, Serra Grande (Uruçuca), 32 km por la ruta', dur: '30 min', usd: 0, lat: -14.4769, lng: -39.0316, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Mirante_da_Serra_Grande_%285600684977%29.jpg/1280px-Mirante_da_Serra_Grande_%285600684977%29.jpg', nota: 'Un balcón a unos 80 metros sobre el mar, al costado de la ruta entre Ilhéus e Itacaré, con la Praia do Pé de Serra y los cocoteros abajo. En realidad son dos miradores pegados, los dos con lugar para estacionar y señalizados en la ruta. Parálo a la ida o a la vuelta del aeropuerto de Ilhéus: queda de paso.' }
    ],
    comer: [
      { name: 'Prato feito', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'El plato del día de los bares del centro, lejos de la Pituba.' },
      { name: 'Moqueca de banana-da-terra', tipo: 'Cena', zona: 'Pituba', usd: 15, momento: 'Noche', nota: 'La versión vegetariana de la moqueca, con banana de cocinar.' },
      { name: 'Chocolate de cacao local', tipo: 'Merienda', zona: 'Centro', usd: 4, momento: 'Tarde', nota: 'El sur de Bahía es tierra de cacao: hay chocolaterías con barras de fazendas de la zona.' }
    ],
    hacer: [
      { name: 'Trilha das 4 Praias', zona: 'Sale de la ruta a Ilhéus', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/Praia_da_Engenhoca%2C_Itacar%C3%A9-BA.jpg/1280px-Praia_da_Engenhoca%2C_Itacar%C3%A9-BA.jpg', dur: 'Medio día', nota: 'Une Engenhoca, Havaizinho, Camboinha e Itacarezinho por la selva: una hora y veinte de caminata, más las paradas para bañarse. Se hace con guía.' },
      { name: 'Clase de surf', zona: 'Tiririca', dur: '2 h', usd: 30, nota: 'Itacaré es uno de los mejores lugares de Brasil para aprender.' },
      { name: 'Rafting en el Rio de Contas', zona: 'Taboquinhas', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Rafting_no_Rio_de_Contas.jpg/1280px-Rafting_no_Rio_de_Contas.jpg', dur: 'Medio día', usd: 40, nota: 'Rápidos en el río que desemboca en el pueblo, en excursión.' },
      { name: 'Paseo en barco por el Rio de Contas y la Cachoeira do Cleandro', zona: 'Sale de la orilla del río, en el pueblo', dur: '4 h', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Rio_das_Contas_em_Itacare.jpg/1280px-Rio_das_Contas_em_Itacare.jpg', nota: 'Se remonta el río entre manglares, con cangrejos y aves, en lancha o canoa según quién lo haga, hasta la Cachoeira do Cleandro (también llamada do Engenho), de tres saltos y con pozo para bañarse. Está en un predio privado y se paga una entrada aparte. Lo venden las agencias del pueblo, pero también podés arreglar directo con los barqueros en la orilla del río, por la Rua Massaranduba; algunas salidas terminan al atardecer en la Praia do Pontal.' },
      { name: 'Trilha da Prainha y Praia de São José', zona: 'Sale de la Praia da Ribeira', dur: 'Medio día', foto: 'https://upload.wikimedia.org/wikipedia/commons/8/80/TRILHA-PRAINHA.JPG', nota: 'Unos 40 minutos de sendero por la selva desde la Ribeira hasta la Prainha, y de ahí se sigue a la Praia de São José. El camino tiene muchos desvíos y poca señalización, y en el pasado hubo robos: andá con guía o con una agencia y sin nada de valor. La otra forma de llegar es pagar el day use de un restaurante dentro del condominio Villa de São José, con reserva previa, que tiene un sendero de 10 minutos a la Prainha.' },
      { name: 'Islas de la Baía de Camamu y Taipu de Fora', zona: 'Sale de Camamu, a 60 km', dur: 'Día entero', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Piscinas_Naturais_de_Taipu_de_Fora-4_%2851039757791%29.jpg/1280px-Piscinas_Naturais_de_Taipu_de_Fora-4_%2851039757791%29.jpg', nota: 'Se va en auto hasta Camamu y de ahí en barco por la bahía, con paradas en islas como la Pedra Furada, hasta la Península de Maraú: Barra Grande y las piscinas naturales de Taipu de Fora. Es un día largo y cansador. Las piscinas se forman con la marea baja, así que conviene ir en luna nueva o llena.' }
    ],
    tips: [
      { titulo: 'Senderos, de día', texto: 'Las calas de la selva no tienen luz ni guardavidas. Volvé antes de que oscurezca y no lleves nada de valor.' },
      { titulo: 'La ruta es de Ilhéus', texto: 'El aeropuerto más cercano es Ilhéus, a 70 km por una ruta linda entre cacaotales.' },
      { titulo: 'Mosquitos de tarde', texto: 'Por la selva y los ríos, al atardecer hay mosquitos. Repelente antes de que baje el sol.' }
    ]
  },

  forte: {
    resumen: 'Una vila peatonal de pescadores con piscinas naturales frente a la playa y el centro de tortugas del Projeto Tamar. Al norte y al sur, playas de cocoteros casi vacías.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6, 8, 9, 10, 11], nota: 'De abril a junio llueve más. De septiembre a marzo hay sol, y de septiembre a marzo las tortugas desovan en la playa. Julio y verano son los meses caros.' },
    clima: {
      titulo: 'Clima en Praia do Forte mes por mes',
      intro: 'Praia do Forte tiene calor y agua tibia todo el año. La lluvia se concentra de abril a junio.',
      meses: [
        { m: 'Ene', max: 29, min: 25, lluvia: 82, mar: 27, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 25, lluvia: 65, mar: 28, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 25, lluvia: 132, mar: 28.5, demanda: 'baja' },
        { m: 'Abr', max: 29, min: 24, lluvia: 168, mar: 28.5, demanda: 'baja' },
        { m: 'May', max: 28, min: 24, lluvia: 211, mar: 27, demanda: 'baja' },
        { m: 'Jun', max: 27, min: 23, lluvia: 165, mar: 26.5, demanda: 'baja' },
        { m: 'Jul', max: 26, min: 22, lluvia: 114, mar: 25.5, demanda: 'alta' },
        { m: 'Ago', max: 26, min: 22, lluvia: 91, mar: 25.5, demanda: 'baja' },
        { m: 'Sep', max: 27, min: 23, lluvia: 70, mar: 25.5, demanda: 'baja' },
        { m: 'Oct', max: 28, min: 24, lluvia: 79, mar: 26, demanda: 'baja' },
        { m: 'Nov', max: 29, min: 24, lluvia: 102, mar: 26.5, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 25, lluvia: 75, mar: 26.5, demanda: 'alta' }
      ],
      nota: 'Para playa y piscinas naturales, de septiembre a marzo: poca lluvia y el agua más tibia. De abril a junio es la época de lluvias. Septiembre y octubre son de los meses más secos, con precios bajos y tortugas desovando en la playa.',
      fuente: 'Temperaturas y lluvia: promedio 2015-2024 del reanálisis ERA5 (Open-Meteo) para el punto del destino; no hay normal INMET 1991-2020 publicada para esta localidad. Temperatura del agua: Weatherspark.'
    },
    beaches: [
      { name: 'Praia do Forte', zona: 'Frente a la vila', lat: -12.5775, lng: -38.0064, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Barcos-PraiaDoForte.jpg/1280px-Barcos-PraiaDoForte.jpg', vibe: 'La playa del pueblo, con piscinas naturales en el arrecife cuando baja la marea y la capilla de São Francisco en la punta.', cuando: 'Marea baja, de mañana.' },
      { name: 'Itacimirim', zona: 'Sur, 6 km', lat: -12.62, lng: -38.045, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Praia_de_Itacimirim%2C_Cama%C3%A7ari%2C_Bahia_-_20250729_104908.jpg/1280px-Praia_de_Itacimirim%2C_Cama%C3%A7ari%2C_Bahia_-_20250729_104908.jpg', vibe: 'Agua quieta y piscinas grandes en el arrecife, con casas de veraneo y poca gente entre semana.', cuando: 'Marea baja.' },
      { name: 'Guarajuba', zona: 'Sur, 15 km', lat: -12.648, lng: -38.064, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Pescadores_Guarajuba_%282671595439%29.jpg/1280px-Pescadores_Guarajuba_%282671595439%29.jpg', vibe: 'Una playa de arrecifes con agua verde y calma, de las más limpias del litoral norte de Bahía.', cuando: 'Mañana.' },
      { name: 'Imbassaí', zona: 'Norte, 11 km', lat: -12.489, lng: -37.962, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Imbassa%C3%AD%2C_Mata_de_S%C3%A3o_Jo%C3%A3o%2C_Bahia_-_20250729_152829.jpg/1280px-Imbassa%C3%AD%2C_Mata_de_S%C3%A3o_Jo%C3%A3o%2C_Bahia_-_20250729_152829.jpg', vibe: 'Un río de agua oscura que corre paralelo al mar, separado por una franja de arena: se nada en agua dulce y en agua salada a veinte metros.', cuando: 'Día entero.' },
      { name: 'Barra do Jacuípe', zona: 'Sur, 22 km', lat: -12.7068, lng: -38.1247, foto: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Vista_da_Praia_de_Barra_do_Jacu%C3%ADpe.jpg', vibe: 'Donde el río Jacuípe se junta con el mar: de un lado agua dulce y calma, del otro playa abierta con olas.', cuando: 'Mañana, del lado del río.' },
      { name: 'Arembepe', zona: 'Sur, 30 km', lat: -12.7719, lng: -38.1764, foto: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Praia_de_Arembepe.jpg', vibe: 'Una vila de pescadores con piscinas en el arrecife y la Aldeia Hippie de los años 70 sobre las dunas, junto al río Capivara.', cuando: 'Marea baja.' },
      { name: 'Santo Antônio', zona: 'Norte, 18 km (camino de tierra desde la Linha Verde)', lat: -12.4598, lng: -37.9325, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Gleidson_Santos_-_Praia_de_Santo_Antonio_-_Mata_de_Sao_Joao_-_BA_%285%29_%2841578177691%29.jpg/1280px-Gleidson_Santos_-_Praia_de_Santo_Antonio_-_Mata_de_Sao_Joao_-_BA_%285%29_%2841578177691%29.jpg', vibe: 'Una playa larga y casi vacía frente a una vila chica, con un río que forma lagunas cerca del mar. Al lado está la de Diogo, igual de tranquila.', cuando: 'Mañana.' },
      { name: 'Costa do Sauípe', zona: 'Norte, 22 km', lat: -12.4391, lng: -37.9233, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Playa_en_Costa_do_Sau%C3%ADpe.jpg/1280px-Playa_en_Costa_do_Sau%C3%ADpe.jpg', vibe: 'La playa de los resorts de Sauípe: larga, de arena clara y mar abierto con olas. Se puede caminar kilómetros por la orilla.', cuando: 'Mañana; de tarde suele haber viento.' },
      { name: 'Porto de Sauípe', zona: 'Norte, 30 km', lat: -12.3806, lng: -37.882, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Gleidson_Santos_-_Praia_do_Porto_de_Sauipe_Sauipe_Mata_de_Sao_Joao_BA_%2825989071707%29.jpg/1280px-Gleidson_Santos_-_Praia_do_Porto_de_Sauipe_Sauipe_Mata_de_Sao_Joao_BA_%2825989071707%29.jpg', vibe: 'Una vila de pescadores en la desembocadura del río Sauípe, con agua de río oscura que se mezcla con el mar y una playa larga sin edificios.', cuando: 'Día entero.' }
    ],
    atracciones: [
      { name: 'Projeto Tamar', zona: 'Vila', lat: -12.5775, lng: -38.0019, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Projeto_Tamar_-_Praia_do_Forte%2C_Bahia_%287291159864%29.jpg/1280px-Projeto_Tamar_-_Praia_do_Forte%2C_Bahia_%287291159864%29.jpg', dur: '1 h 30', usd: 10, nota: 'La base principal de conservación de tortugas marinas de Brasil, con tanques, tortugas y tiburones de arrecife.' },
      { name: 'Castelo Garcia d\'Ávila', zona: '3 km de la vila', lat: -12.5796, lng: -38.0322, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Casa_da_Torre_de_Garcia_d%27%C3%81vila_e_Capela_de_Nossa_Senhora_da_Concei%C3%A7%C3%A3o.jpg/1280px-Casa_da_Torre_de_Garcia_d%27%C3%81vila_e_Capela_de_Nossa_Senhora_da_Concei%C3%A7%C3%A3o.jpg', dur: '1 h', usd: 5, nota: 'Ruinas de un castillo del siglo XVI, una de las primeras grandes construcciones portuguesas de Brasil.' },
      { name: 'Capela de São Francisco', zona: 'Punta de la playa', lat: -12.5778, lng: -38.0057, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Praia_do_Forte%2C_Bahia_%287291017092%29.jpg/1280px-Praia_do_Forte%2C_Bahia_%287291017092%29.jpg', dur: '15 min', usd: 0, nota: 'La capilla blanca en una plaza frente a la playa, al final de la calle principal.' }
    ],
    comer: [
      { name: 'Acarajé de la vila', tipo: 'Merienda', zona: 'Alameda do Sol', usd: 4, momento: 'Tarde', nota: 'Las baianas de la calle principal, al atardecer.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en las calles de atrás de la principal.' },
      { name: 'Moqueca', tipo: 'Cena', zona: 'Vila', usd: 22, momento: 'Noche', nota: 'Moqueca baiana para dos en los restaurantes de la alameda.' }
    ],
    hacer: [
      { name: 'Snorkel en las piscinas', zona: 'Frente a la vila', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Gleidson_Santos_Praia_do_Forte_Mata_de_Sao_Joao_BA_%2839051335340%29.jpg/1280px-Gleidson_Santos_Praia_do_Forte_Mata_de_Sao_Joao_BA_%2839051335340%29.jpg', dur: '1 h', usd: 0, nota: 'Con marea baja se nada desde la arena hasta las piscinas. Llevá máscara propia.' },
      { name: 'Reserva de Sapiranga', zona: '5 km', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Mata_Atl%C3%A2ntica_reserva_Sapiranga.jpg/1280px-Mata_Atl%C3%A2ntica_reserva_Sapiranga.jpg', dur: '3 h', usd: 15, nota: 'Selva atlántica con senderos, río y tirolesa.' },
      { name: 'Liberación de tortuguitas', zona: 'Playa', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Filhote_de_tartaruga_marinha.jpg/1280px-Filhote_de_tartaruga_marinha.jpg', dur: '1 h', usd: 0, nota: 'De septiembre a marzo, con suerte, el Tamar libera tortuguitas al atardecer.' }
    ],
    tips: [
      { titulo: 'La vila es peatonal', texto: 'Los autos se dejan en el estacionamiento de la entrada. Todo lo demás es a pie.' },
      { titulo: 'Salvador queda cerca', texto: 'El aeropuerto de Salvador está a 55 km por la Estrada do Coco. Se llega en ómnibus o transfer en una hora.' },
      { titulo: 'Las tortugas no se tocan', texto: 'Si ves una tortuga en la playa, no la toques ni la alumbres. Avisá al Tamar.' }
    ]
  },

  ajuda: {
    resumen: 'Un pueblo sobre un acantilado frente a Porto Seguro, con calles de bares y una escalera que baja a playas de arrecife y cocoteros.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6, 8, 9, 10, 11], nota: 'De abril a junio llueve más. En Año Nuevo y Carnaval el pueblo está lleno y caro. Septiembre, octubre y noviembre tienen sol y precios bajos.' },
    clima: {
      titulo: 'Clima en Arraial d’Ajuda mes por mes',
      intro: 'Arraial tiene calor todo el año. Las noches de invierno son frescas y en noviembre y diciembre llueve más.',
      meses: [
        { m: 'Ene', max: 30, min: 23, lluvia: 96, mar: 26.5, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 23, lluvia: 87, mar: 27, demanda: 'alta' },
        { m: 'Mar', max: 30, min: 23, lluvia: 89, mar: 27, demanda: 'baja' },
        { m: 'Abr', max: 29, min: 22, lluvia: 137, mar: 27, demanda: 'baja' },
        { m: 'May', max: 27, min: 21, lluvia: 99, mar: 26.5, demanda: 'baja' },
        { m: 'Jun', max: 26, min: 20, lluvia: 86, mar: 25.5, demanda: 'baja' },
        { m: 'Jul', max: 25, min: 19, lluvia: 69, mar: 25, demanda: 'alta' },
        { m: 'Ago', max: 26, min: 19, lluvia: 71, mar: 25, demanda: 'baja' },
        { m: 'Sep', max: 27, min: 20, lluvia: 60, mar: 25, demanda: 'baja' },
        { m: 'Oct', max: 28, min: 21, lluvia: 92, mar: 25.5, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 22, lluvia: 202, mar: 25.5, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 22, lluvia: 180, mar: 26, demanda: 'alta' }
      ],
      nota: 'Para playa, de enero a marzo hay más sol y el agua más tibia, pero enero y Carnaval son caros. Septiembre y octubre llueven poco, tienen precios bajos y el pueblo tranquilo. Noviembre y diciembre son los meses más lluviosos, con chaparrones fuertes.',
      fuente: 'Temperaturas y lluvia: promedio 2015-2024 del reanálisis ERA5 (Open-Meteo) para el punto del destino; no hay normal INMET 1991-2020 publicada para esta localidad. Temperatura del agua: Weatherspark.'
    },
    beaches: [
      { name: 'Mucugê', zona: 'Abajo del pueblo', lat: -16.4948, lng: -39.0687, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG/1280px-Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG', vibe: 'La playa a la que se baja por la calle del Mucugê, con barracas, agua calma y piscinas en el arrecife.', cuando: 'Marea baja, de mañana.' },
      { name: 'Pitinga', zona: 'Sur, 3 km', lat: -16.5125, lng: -39.0739, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg/1280px-Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg', vibe: 'Acantilados rojos, arena dorada y piscinas naturales. La más linda de Arraial y menos llena que Mucugê.', cuando: 'Marea baja.' },
      { name: 'Taípe', zona: 'Sur, 11 km', lat: -16.5534, lng: -39.0863, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg/1280px-Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg', vibe: 'Acantilados altos de colores sobre una playa casi vacía, camino a Trancoso.', cuando: 'Tarde, cuando el sol pega en el acantilado.' },
      { name: 'Araçaípe', zona: 'Norte, 2 km de Mucugê', lat: -16.4741, lng: -39.0624, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Praia_Ara%C3%A7a%C3%ADpe_-_Araial_D%27ajuda_-_Porto_Seguro-BA_-_panoramio.jpg/1280px-Praia_Ara%C3%A7a%C3%ADpe_-_Araial_D%27ajuda_-_Porto_Seguro-BA_-_panoramio.jpg', vibe: 'Una playa larga y tranquila, con cocoteros, arrecifes cerca de la orilla y pocas barracas. Es a donde se va cuando Mucugê está lleno.', cuando: 'Marea baja, cuando se forman piscinas en el arrecife. Desde Mucugê se llega caminando por la arena.' },
      { name: 'Apaga-Fogo', zona: 'Norte, junto a la balsa, 4 km', lat: -16.4623, lng: -39.0609, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/MARCIO_FILHO_PRAIA_DO_APAGA_FOGO_ARRAIAL_D_AJUDA_BAHIA_%2826106409837%29.jpg/1280px-MARCIO_FILHO_PRAIA_DO_APAGA_FOGO_ARRAIAL_D_AJUDA_BAHIA_%2826106409837%29.jpg', vibe: 'La primera playa de Arraial al bajar de la balsa, frente a la desembocadura del río Buranhém. Agua calma, algunas barracas y vista a Porto Seguro.', cuando: 'Mañana, con marea baja.' },
      { name: 'Parracho', zona: 'Sur, 1 km de Mucugê', lat: -16.5033, lng: -39.0716, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/MARCIO_FILHO_UIKI_PARRACHO_ARRAIAL_D_AJUDA_BAHIA_%2827106744128%29.jpg/1280px-MARCIO_FILHO_UIKI_PARRACHO_ARRAIAL_D_AJUDA_BAHIA_%2827106744128%29.jpg', vibe: 'Entre Mucugê y Pitinga, con piscinas naturales en el arrecife y barracas grandes con música. Tiene más movimiento que Pitinga.', cuando: 'Marea baja.' },
      { name: 'Coroa Vermelha', zona: 'Santa Cruz Cabrália, cruzando en balsa, 20 km', lat: -16.3532, lng: -39.0143, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG/1280px-Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG', vibe: 'Donde se dio la primera misa del Brasil, con una cruz frente al mar y piscinas en el arrecife.', cuando: 'Marea baja.' },
      { name: 'Santo André', zona: 'Santa Cruz Cabrália, 35 km por ruta y balsa', lat: -16.2494, lng: -39.0111, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Praia_de_Santo_Andr%C3%A9_by_Diego_Baravelli.jpg/1280px-Praia_de_Santo_Andr%C3%A9_by_Diego_Baravelli.jpg', vibe: 'Una vila tranquila del otro lado del río João de Tiba, que se cruza en balsa desde Santa Cruz Cabrália. Playa larga de agua calma, con arrecifes y pocas posadas.', cuando: 'Mañana, con marea baja.' }
    ],
    atracciones: [
      { name: 'Rua do Mucugê', zona: 'Centro', lat: -16.4919, lng: -39.0724, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/MUCUGE.JPG/1280px-MUCUGE.JPG', dur: '1 h', usd: 0, nota: 'La calle de bares, tiendas y restaurantes que baja a la playa. De noche se ilumina con faroles.' },
      { name: 'Igreja Matriz de Nossa Senhora d\'Ajuda', zona: 'Plaza', lat: -16.4894, lng: -39.0727, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Igreja_d%27Ajuda_-_Porto_Seguro_-_20220107165411.JPG/1280px-Igreja_d%27Ajuda_-_Porto_Seguro_-_20220107165411.JPG', dur: '20 min', usd: 0, nota: 'Iglesia del siglo XVI sobre el acantilado, con un mirador al mar.' },
      { name: 'Mirante de la plaza', zona: 'Plaza', lat: -16.4893, lng: -39.0727, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Mirante_das_Fitinhas_Arraial_d%27Ajuda_5.jpg/1280px-Mirante_das_Fitinhas_Arraial_d%27Ajuda_5.jpg', dur: '20 min', usd: 0, nota: 'Detrás de la iglesia, la vista de la costa hasta Porto Seguro.' }
    ],
    comer: [
      { name: 'Prato feito', tipo: 'Almuerzo', zona: 'Calles de atrás', usd: 9, momento: 'Mediodía', nota: 'El plato del día fuera de la Rua do Mucugê.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Plaza', usd: 4, momento: 'Tarde', nota: 'Las baianas de la plaza de la iglesia.' },
      { name: 'Pescado en la barraca', tipo: 'Almuerzo', zona: 'Mucugê y Pitinga', usd: 15, momento: 'Mediodía', nota: 'Porción de pescado para compartir en las barracas de playa.' }
    ],
    hacer: [
      { name: 'Caminata por la playa a Pitinga', zona: 'Desde Mucugê', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/Praia_da_Pitinga_Bahia.jpg/1280px-Praia_da_Pitinga_Bahia.jpg', dur: '1 h', usd: 0, nota: 'Por la arena con marea baja, pasando por piscinas naturales.' },
      { name: 'Balsa a Porto Seguro', zona: 'Ponta do Apaga-Fogo, 5 km', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Travessia_de_balsa_do_Rio_Buranh%C3%A9m_entre_Porto_Seguro_e_Arraial_d%27Ajuda_-_Bahia%2C_Brasil.jpg/1280px-Travessia_de_balsa_do_Rio_Buranh%C3%A9m_entre_Porto_Seguro_e_Arraial_d%27Ajuda_-_Bahia%2C_Brasil.jpg', dur: '15 min', usd: 1, nota: 'La balsa cruza el río a Porto Seguro: la ciudad histórica queda del otro lado.' },
      { name: 'Excursión a Trancoso', zona: 'Sale del pueblo', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Quadrado_-_Trancoso_-_Porto_Seguro-BA_-_panoramio_%2813%29.jpg/1280px-Quadrado_-_Trancoso_-_Porto_Seguro-BA_-_panoramio_%2813%29.jpg', dur: 'Medio día', usd: 10, nota: 'El Quadrado de Trancoso está a 25 km. Se va en ómnibus o en buggy por la playa.' }
    ],
    tips: [
      { titulo: 'Bajada empinada', texto: 'Del pueblo a la playa es una bajada fuerte de diez minutos. La vuelta, al sol, se siente.' },
      { titulo: 'Base barata para Trancoso', texto: 'Arraial cuesta bastante menos que Trancoso y está a unos cuarenta minutos.' },
      { titulo: 'Las barracas cobran consumo', texto: 'Algunas barracas de playa cobran consumo mínimo por las reposeras. Preguntá antes de sentarte.' }
    ]
  },

  fernando: {
    resumen: 'Un archipiélago parque nacional con el agua más transparente de Brasil, delfines, tortugas y tiburones de arrecife. Hay cupo de visitantes y cada playa tiene sus reglas.',
    temporada: { alta: [1, 9, 10, 11, 12], baja: [4, 5, 6], nota: 'De agosto a noviembre el mar está más calmo y el agua más clara. De diciembre a marzo entran las olas del norte en el mar de adentro. De marzo a julio llueve más. La TPA cuesta lo mismo todo el año, pero las posadas y los vuelos suben en temporada alta.' },
    clima: {
      titulo: 'Clima en Fernando de Noronha mes por mes',
      intro: 'En Noronha la temperatura casi no cambia en el año. Lo que cambia es la lluvia, el mar y la visibilidad bajo el agua.',
      meses: [
        { m: 'Ene', max: 30, min: 25, lluvia: 67, mar: 27.5, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 25, lluvia: 77, mar: 28, demanda: 'media' },
        { m: 'Mar', max: 31, min: 25, lluvia: 166, mar: 28.5, demanda: 'media' },
        { m: 'Abr', max: 30, min: 25, lluvia: 243, mar: 29, demanda: 'baja' },
        { m: 'May', max: 30, min: 25, lluvia: 206, mar: 28.5, demanda: 'baja' },
        { m: 'Jun', max: 30, min: 25, lluvia: 206, mar: 28, demanda: 'baja' },
        { m: 'Jul', max: 29, min: 24, lluvia: 179, mar: 27.5, demanda: 'media' },
        { m: 'Ago', max: 29, min: 24, lluvia: 61, mar: 27, demanda: 'media' },
        { m: 'Sep', max: 29, min: 25, lluvia: 26, mar: 26.5, demanda: 'alta' },
        { m: 'Oct', max: 30, min: 25, lluvia: 10, mar: 27, demanda: 'alta' },
        { m: 'Nov', max: 30, min: 25, lluvia: 9, mar: 27, demanda: 'alta' },
        { m: 'Dic', max: 31, min: 26, lluvia: 10, mar: 27.5, demanda: 'alta' }
      ],
      nota: 'Para buceo con el agua más clara y el mar de adentro calmo: de agosto a noviembre, los meses más secos. De diciembre a marzo entran las olas del norte y es temporada de surf en el mar de adentro. De marzo a julio llueve más. Los precios suben de septiembre a enero.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 del INMET (estación Fernando de Noronha), según el Atlas Climatológico de Pernambuco. Agua: promedio de seatemperature.info.'
    },
    beaches: [
      { name: 'Baía do Sancho', zona: 'Mar de adentro', lat: -3.8545, lng: -32.443, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Fernando_de_Noronha_-_PE_-_Baia_do_Sancho.jpg/1280px-Fernando_de_Noronha_-_PE_-_Baia_do_Sancho.jpg', vibe: 'Elegida varias veces la mejor playa del mundo. Se baja por una escalera dentro de una grieta del acantilado y abajo hay tortugas y peces a la orilla.', cuando: 'Mañana, antes de los barcos.' },
      { name: 'Baía dos Porcos', zona: 'Mar de adentro', lat: -3.8505, lng: -32.44, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Ba%C3%ADa_dos_Porcos%2C_Fernando_de_Noronha.jpg/960px-Ba%C3%ADa_dos_Porcos%2C_Fernando_de_Noronha.jpg', vibe: 'Una cala chica con piscinas naturales y la vista de los Dois Irmãos. Se llega por las piedras desde la Cacimba do Padre.', cuando: 'Marea baja.' },
      { name: 'Conceição', zona: 'Vila, al pie del Morro do Pico', lat: -3.8409, lng: -32.4163, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Morro_do_Pico_and_Concei%C3%A7%C3%A3o_Beach_in_Fernando_de_Noronha.jpg/960px-Morro_do_Pico_and_Concei%C3%A7%C3%A3o_Beach_in_Fernando_de_Noronha.jpg', vibe: 'Una playa larga de arena dorada, con bar y el atardecer frente al Morro do Pico.', cuando: 'Atardecer.' },
      { name: 'Cachorro', zona: 'Vila dos Remédios', lat: -3.839, lng: -32.4109, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Praia_do_Cachorro%2C_Fernando_de_Noronha_01.jpg/1280px-Praia_do_Cachorro%2C_Fernando_de_Noronha_01.jpg', vibe: 'La playa del pueblo, con piscina natural y bares. Es donde va la gente de la isla.', cuando: 'Tarde.' },
      { name: 'Sueste', zona: 'Mar de afuera', lat: -3.8662, lng: -32.4256, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/111_Ba%C3%ADa_do_Sueste_01.jpg/1280px-111_Ba%C3%ADa_do_Sueste_01.jpg', vibe: 'Una bahía de agua calma donde se nada con tortugas y tiburones limón en el fondo. Snorkel con guía.', cuando: 'Mañana, con marea alta.' },
      { name: 'Leão', zona: 'Mar de afuera', lat: -3.87, lng: -32.4373, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/PE_-_Parque_Nacional_Marinho_Fernando_de_Noronha_-_Praia_do_Le%C3%A3o.jpg/1280px-PE_-_Parque_Nacional_Marinho_Fernando_de_Noronha_-_Praia_do_Le%C3%A3o.jpg', vibe: 'Playa salvaje donde desovan las tortugas. Se puede nadar, con cuidado por las corrientes; de noche está cerrada por el desove.', cuando: 'De día: cierra antes de que oscurezca.' },
      { name: 'Atalaia', zona: 'Mar de afuera', lat: -3.878, lng: -32.43, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Praia_da_Atalaia_-_panoramio_%281%29.jpg/1280px-Praia_da_Atalaia_-_panoramio_%281%29.jpg', vibe: 'Una piscina natural con cupo diario y reglas estrictas: sin protector solar, tiempo limitado. Agua como un acuario.', cuando: 'Marea baja; se reserva en el ICMBio.' },
      { name: 'Cacimba do Padre', zona: 'Mar de adentro', lat: -3.8498, lng: -32.439, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Praia_da_Cacimba_do_Padre_-_Morro_Dois_Irm%C3%A3os.jpg/1280px-Praia_da_Cacimba_do_Padre_-_Morro_Dois_Irm%C3%A3os.jpg', vibe: 'La playa larga frente al Morro Dois Irmãos, la postal de la isla. De diciembre a marzo entran olas grandes y es la playa del surf; el resto del año el mar está manso.', cuando: 'Atardecer. Con marea baja se sigue por las piedras hasta la Baía dos Porcos.' },
      { name: 'Boldró', zona: 'Mar de adentro', lat: -3.8451, lng: -32.4288, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Praia_do_Boldr%C3%B3.jpg/1280px-Praia_do_Boldr%C3%B3.jpg', vibe: 'Una playa de arena dorada debajo del mirador, con los Dois Irmãos al fondo. Con mar calmo se nada bien; en verano entran olas buenas para surf.', cuando: 'Atardecer, mirándolo desde el Mirante do Boldró.' },
      { name: 'Praia do Bode', zona: 'Mar de adentro', lat: -3.8481, lng: -32.4347, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Praia_do_Bode_e_Morro_dois_Irm%C3%A3os.jpg/1280px-Praia_do_Bode_e_Morro_dois_Irm%C3%A3os.jpg', vibe: 'Una playa chica entre el Americano y la Quixabinha, frente al Morro Dois Irmãos. Poca gente y piscinas entre las piedras con marea baja.', cuando: 'Marea baja.' },
      { name: 'Praia do Meio', zona: 'Mar de adentro, junto a la Vila', lat: -3.8399, lng: -32.4134, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/Praia_do_Meio%2C_em_Fernando_de_Noronha.jpg/1280px-Praia_do_Meio%2C_em_Fernando_de_Noronha.jpg', vibe: 'Una playa entre la Conceição y el Cachorro, con piscinas naturales en las piedras cuando baja la marea. Se llega caminando desde la Vila dos Remédios.', cuando: 'Marea baja, de mañana.' },
      { name: 'Praia do Porto', zona: 'Porto de Santo Antônio', lat: -3.8348, lng: -32.4012, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/P%C3%B4r_do_sol_na_Praia_do_Porto.jpg/1280px-P%C3%B4r_do_sol_na_Praia_do_Porto.jpg', vibe: 'La playa junto al muelle, de agua calma y clara, con tortugas y peces cerca de la orilla. Hay restos de un barco hundido a poca profundidad, bueno para snorkel.', cuando: 'Mañana, antes de que salgan los barcos; al atardecer, para ver el sol desde el muelle.' }
    ],
    atracciones: [
      { name: 'Mirante dos Golfinhos', zona: 'Baía dos Golfinhos', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Mirante_dos_Golfinhos_5.jpg/1280px-Mirante_dos_Golfinhos_5.jpg', dur: '1 h', usd: 0, nota: 'Desde el acantilado se ven cientos de delfines rotadores que entran a descansar a la bahía. Temprano a la mañana.' },
      { name: 'Forte dos Remédios', zona: 'Vila dos Remédios', lat: -3.8378, lng: -32.4101, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Forte_de_Nossa_Senhora_dos_Rem%C3%A9dios_-_2011.jpg/1280px-Forte_de_Nossa_Senhora_dos_Rem%C3%A9dios_-_2011.jpg', dur: '40 min', usd: 0, nota: 'Fuerte del siglo XVIII sobre el pueblo, con vista al Morro do Pico y a las playas del norte.' },
      { name: 'Mirante do Boldró', zona: 'Boldró', lat: -3.846, lng: -32.4291, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Vista_do_Mirante_do_Boldr%C3%B3.jpg/1280px-Vista_do_Mirante_do_Boldr%C3%B3.jpg', dur: '1 h', usd: 0, nota: 'El atardecer de la isla, con los Dois Irmãos de frente.' }
    ],
    comer: [
      { name: 'Prato feito de la vila', tipo: 'Almuerzo', zona: 'Vila dos Remédios', usd: 15, momento: 'Mediodía', nota: 'En la isla todo llega en barco o avión: el plato del día es lo más barato que hay.' },
      { name: 'Tapioca de la plaza', tipo: 'Merienda', zona: 'Vila dos Remédios', usd: 5, momento: 'Tarde', nota: 'Puestos de tapioca en la plaza del pueblo.' },
      { name: 'Festival gastronômico del Zé Maria', tipo: 'Cena', zona: 'Pousada Zé Maria', momento: 'Noche', nota: 'Bufé de pescados y platos de la casa con música en vivo, dos noches por semana. Caro, pero es el plan de la isla: hay que reservar.' }
    ],
    hacer: [
      { name: 'Paseo de barco', zona: 'Porto de Santo Antônio', dur: '3 h', usd: 50, nota: 'Recorre el mar de adentro hasta la Ponta da Sapata, con delfines casi seguros.' },
      { name: 'Ilha tour', zona: 'Toda la isla', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Buggy_Fernando_De_Noronha.jpg/1280px-Buggy_Fernando_De_Noronha.jpg', dur: 'Día entero', usd: 45, nota: 'Recorrido en buggy o camioneta por las playas y miradores con guía local. Bueno para el primer día.' },
      { name: 'Planasub', zona: 'Porto', dur: '1 h 30', usd: 60, nota: 'Te remolca una lancha sobre una tabla bajo el agua. Se ve el fondo como volando.' }
    ],
    tips: [
      { titulo: 'Dos tasas obligatorias', texto: 'La TPA, por día de estadía, y el ingreso al Parque Nacional, que vale por diez días. Las dos se pagan online antes de viajar.' },
      { titulo: 'Agendá la Atalaia el primer día', texto: 'La Atalaia y las trilhas largas tienen cupo diario y se agendan con el ingreso del parque en el sistema del ICMBio, en el centro de visitantes del Boldró. Hacelo el primer día. El Sancho no se agenda.' },
      { titulo: 'Todo es caro', texto: 'Comida, agua y transporte cuestan bastante más que en el continente. Llevá snacks y protector solar desde casa.' }
    ]
  },

  bombinhas: {
    resumen: 'Una península chica con más de treinta playas y el agua más transparente del sur de Brasil. Las mejores son calas entre morros, a minutos una de otra.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 7, 8, 9, 10, 11], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y la primera quincena de diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. Del 15 de noviembre al 15 de abril se cobra una tasa ambiental para entrar con auto.' },
    clima: {
      titulo: 'Clima en Bombinhas mes por mes',
      intro: 'Bombinhas tiene verano caluroso con agua tibia y clara, e invierno fresco con el mar frío.',
      meses: [
        { m: 'Ene', max: 29, min: 21, lluvia: 184, mar: 26, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 21, lluvia: 207, mar: 26.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 20, lluvia: 191, mar: 25.5, demanda: 'media' },
        { m: 'Abr', max: 27, min: 18, lluvia: 116, mar: 24, demanda: 'media' },
        { m: 'May', max: 24, min: 15, lluvia: 126, mar: 22, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 13, lluvia: 86, mar: 19.5, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 12, lluvia: 109, mar: 18, demanda: 'baja' },
        { m: 'Ago', max: 22, min: 13, lluvia: 100, mar: 18, demanda: 'baja' },
        { m: 'Sep', max: 23, min: 14, lluvia: 131, mar: 19, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 17, lluvia: 144, mar: 21, demanda: 'baja' },
        { m: 'Nov', max: 27, min: 18, lluvia: 149, mar: 22.5, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 20, lluvia: 140, mar: 24.5, demanda: 'alta' }
      ],
      nota: 'Para playa y buceo con el agua tibia y menos gente: marzo y la primera mitad de abril, cuando el mar sigue en 24 grados o más. Enero y febrero tienen el mejor calor, pero también las lluvias de tarde, los precios más altos y la tasa ambiental para entrar con auto. De junio a septiembre el agua está entre 18 y 19 grados: para caminar los senderos, no para bañarse.',
      fuente: 'Temperaturas y lluvia: normales 1976-2005 de la estación de Itajaí (Embrapa/INMET), la más cercana con serie larga. Agua: promedios de seatemperature.info para Bombinhas.'
    },
    beaches: [
      { name: 'Bombinhas', zona: 'Centro', lat: -27.1471, lng: -48.4936, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Renato_Soares_Praia_de_Bombinhas_Bombinhas_SC_%2839151782420%29.jpg/1280px-Renato_Soares_Praia_de_Bombinhas_Bombinhas_SC_%2839151782420%29.jpg', vibe: 'La playa del centro, de agua verde y quieta, con restaurantes y la mayor parte de los hoteles.', cuando: 'Mañana; de tarde se llena.' },
      { name: 'Sepultura', zona: 'Centro, a pie', lat: -27.1414, lng: -48.4778, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Praia_da_Sepultura_-_Bombinhas%2C_Santa_Catarina%2C_Brasil.jpg/960px-Praia_da_Sepultura_-_Bombinhas%2C_Santa_Catarina%2C_Brasil.jpg', vibe: 'Una cala chica entre piedras con el agua más clara de la península. La mejor para snorkel desde la orilla.', cuando: 'Temprano: entra poca gente y a las 10 ya no hay lugar.' },
      { name: 'Quatro Ilhas', zona: 'Este, 1.5 km', lat: -27.1569, lng: -48.4849, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Quatroilhas4.jpg/1280px-Quatroilhas4.jpg', vibe: 'Playa larga de arena blanca frente a cuatro islotes. Hay olas y lugar de sobra.', cuando: 'Tarde.' },
      { name: 'Mariscal', zona: 'Sur, 4 km', lat: -27.1774, lng: -48.4998, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Renato_Soares_Praia_do_Mariscal_Bombinhas_SC_%2839151781020%29.jpg/1280px-Renato_Soares_Praia_do_Mariscal_Bombinhas_SC_%2839151781020%29.jpg', vibe: 'Una playa abierta y larga, de mar más bravo, con dunas y restinga detrás. La de los surfistas.', cuando: 'Tarde, con olas.' },
      { name: 'Bombas', zona: 'Oeste, 3 km', lat: -27.1391, lng: -48.509, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/Renato_Soares_Praia_de_Bombas_Bombinhas_SC_%2840252057674%29.jpg/1280px-Renato_Soares_Praia_de_Bombas_Bombinhas_SC_%2840252057674%29.jpg', vibe: 'La playa familiar, larga y de agua calma, con quioscos y buena infraestructura.', cuando: 'Todo el día.' },
      { name: 'Retiro dos Padres', zona: 'Centro, a pie', lat: -27.1448, lng: -48.4761, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Renato_Soares_Praia_Retiro_dos_Padres_Bombinhas_SC_%2827090294528%29.jpg/1280px-Renato_Soares_Praia_Retiro_dos_Padres_Bombinhas_SC_%2827090294528%29.jpg', vibe: 'Una cala chica entre piedras, al lado de la Sepultura, de agua clara y quieta. Casi no tiene servicios.', cuando: 'Mañana, con el mar calmo; buena para snorkel.' },
      { name: 'Lagoinha', zona: 'Centro, a pie', lat: -27.146, lng: -48.4808, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Final_de_tarde_na_lagoinha_-_panoramio.jpg/1280px-Final_de_tarde_na_lagoinha_-_panoramio.jpg', vibe: 'Una prainha chica y protegida en la punta del centro, de agua calma y transparente, pegada a las piedras.', cuando: 'Mañana, cuando el agua está más quieta.' },
      { name: 'Ribeiro', zona: 'entre Bombas y Bombinhas, 3 km por ruta', lat: -27.1462, lng: -48.4982, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Renato_Soares_Praia_do_Ribeiro_Bombinhas_SC_%2826712656377%29.jpg/1280px-Renato_Soares_Praia_do_Ribeiro_Bombinhas_SC_%2826712656377%29.jpg', vibe: 'Una prainha chica entre Bombas y Bombinhas, de agua calma, con pocas casas alrededor.', cuando: 'Mañana.' },
      { name: 'Caixa d\'Aço', zona: 'Porto Belo, 10 km por ruta', lat: -27.1285, lng: -48.5253, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Mirante_da_Enseada_do_Caixa_d%27A%C3%A7o_%2821058399866%29.jpg/1280px-Mirante_da_Enseada_do_Caixa_d%27A%C3%A7o_%2821058399866%29.jpg', vibe: 'Una ensenada cerrada entre morros, de agua quieta y transparente, donde paran los barcos de paseo. Buena para snorkel.', cuando: 'Mañana, antes de que lleguen los barcos de paseo.' },
      { name: 'Araçá', zona: 'Porto Belo, 9 km por ruta', lat: -27.135, lng: -48.5306, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Ara%C3%A7a_%2820897752079%29.jpg/1280px-Ara%C3%A7a_%2820897752079%29.jpg', vibe: 'Una bahía chica de pescadores, de agua quieta y verde, con barcos y restaurantes simples cerca de la arena.', cuando: 'Mediodía, para comer pescado frente al agua.' },
      { name: 'Canto Grande (Mar de Fora)', zona: 'Canto Grande, 7 km por ruta', lat: -27.194, lng: -48.4961, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Renato_Soares_Morro_do_Macaco_com_Canto_Grande_mar_de_Fora_Bombinhas_SC_%2840252069964%29.jpg/1280px-Renato_Soares_Morro_do_Macaco_com_Canto_Grande_mar_de_Fora_Bombinhas_SC_%2840252069964%29.jpg', vibe: 'El lado de mar abierto de Canto Grande, con olas, arena larga y el Morro do Macaco al fondo. Tiene menos gente que Mariscal.', cuando: 'Tarde, con olas; con bandera roja no se entra.' },
      { name: 'Canto Grande (Mar de Dentro)', zona: 'Canto Grande, 7 km por ruta', lat: -27.1932, lng: -48.5055, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Renato_Soares_Canto_Grande_mar_de_Dentro_Bombinhas_SC_%2840252071654%29.jpg/1280px-Renato_Soares_Canto_Grande_mar_de_Dentro_Bombinhas_SC_%2840252071654%29.jpg', vibe: 'El lado de la bahía de Canto Grande: agua quieta y bajita, barcos de pescadores y casas de veraneo. Buena para ir con chicos y para kayak.', cuando: 'Todo el día.' },
      { name: 'Praia do Araújo', zona: 'Porto Belo, 8 km por ruta', lat: -27.1428, lng: -48.5371, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Praia_do_Araujo_%2821105910432%29.jpg/1280px-Praia_do_Araujo_%2821105910432%29.jpg', vibe: 'Una cala chica en la punta del Araçá, de agua calma y con pocas casas.', cuando: 'Mañana.' },
      { name: 'Zimbros', zona: 'Zimbros, 9 km por ruta', lat: -27.1814, lng: -48.5319, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Zimbros%2C_Bombinhas_-_SC%2C_Brazil_-_panoramio.jpg/1280px-Zimbros%2C_Bombinhas_-_SC%2C_Brazil_-_panoramio.jpg', vibe: 'Pueblo de pescadores sobre la bahía, con agua calma, barcos fondeados y restaurantes de mariscos.', cuando: 'Mañana para nadar; atardecer sobre la bahía.' },
      { name: 'Porto Belo (Centro)', zona: 'Porto Belo, 9 km por ruta', lat: -27.1547, lng: -48.5483, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Muelle_Porto_Belo_%2838587560%29.jpeg/1280px-Muelle_Porto_Belo_%2838587560%29.jpeg', vibe: 'La playa del pueblo, de agua calma frente a la Ilha de Porto Belo, con muelle, barcos y restaurantes.', cuando: 'Mañana; del muelle salen los barcos a la isla.' },
      { name: 'Tainha', zona: 'Canto Grande, 12 km por ruta', lat: -27.2161, lng: -48.5095, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Renato_Soares_Praia_da_Tainha_Bombinhas_SC_%2840919247342%29.jpg/1280px-Renato_Soares_Praia_da_Tainha_Bombinhas_SC_%2840919247342%29.jpg', vibe: 'Una cala salvaje en la punta de la península, de agua verde y clara entre piedras. Se llega por un sendero corto y no hay quioscos.', cuando: 'Día de mar calmo; llevá agua y comida.' },
      { name: 'Perequê', zona: 'Porto Belo, 13 km por ruta', lat: -27.1502, lng: -48.5751, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Praia_do_Pereque_%2821210041862%29.jpg/1280px-Praia_do_Pereque_%2821210041862%29.jpg', vibe: 'Playa larga y urbana, de agua calma y poco profunda, con edificios bajos y quioscos. Muy familiar.', cuando: 'Todo el día.' }
    ],
    atracciones: [
      { name: 'Mirante do Morro do Macaco', zona: 'Centro', lat: -27.203, lng: -48.4967, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Morro_do_Macaco_-_Bombinhas_-_SC.jpg/1280px-Morro_do_Macaco_-_Bombinhas_-_SC.jpg', dur: '1 h', usd: 0, nota: 'Mirador con vista a Bombinhas, Bombas y la bahía. Se sube en auto o en una caminata empinada.' },
      { name: 'Reserva Biológica Marinha do Arvoredo', zona: 'En barco', lat: -27.2848, lng: -48.3651, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Costa_Sul_Ilha_Arvoredo_SC_Brasil.jpg/1280px-Costa_Sul_Ilha_Arvoredo_SC_Brasil.jpg', dur: '5 h', nota: 'La reserva marina frente a la península, con el agua más clara del sur. Es reserva biológica: adentro la visita está restringida y el buceo con operadoras se hace solo en los puntos autorizados.' },
      { name: 'Trilha da Sepultura', zona: 'Centro', lat: -27.1414, lng: -48.4779, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Praia_da_Sepultura%2C_Bombinhas%2C_Santa_Catarina.jpg/1280px-Praia_da_Sepultura%2C_Bombinhas%2C_Santa_Catarina.jpg', dur: '40 min', usd: 0, nota: 'Sendero corto por la costa desde la Sepultura, con miradores sobre el agua transparente.' },
      { name: 'Ilha de Porto Belo', zona: 'Porto Belo, en barco', dur: 'Medio día', lat: -27.1402, lng: -48.5436, nota: 'La isla frente al pueblo de Porto Belo, con una playa de agua calma, un sendero hasta un mirador y grabados rupestres en la Pedra da Cruz (se ven poco). Se cruza en unos 10 minutos con los barcos de la asociación de pescadores, que salen del muelle del centro de Porto Belo, o en los barcos piratas; la isla no cobra entrada, pagás el barco y lo que consumas. Bar, restaurante y alquileres funcionan del 1 de diciembre al 31 de marzo; el resto del año está abierta pero sin servicios.' },
      { name: 'Igreja Senhor Bom Jesus dos Aflitos', zona: 'Porto Belo, centro', dur: '30 min', usd: 0, lat: -27.1587, lng: -48.5533, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Paroquia_Senhor_Bom_Jesus.jpg/1280px-Paroquia_Senhor_Bom_Jesus.jpg', nota: 'La iglesia matriz de Porto Belo, blanca con detalles amarillos, sobre la Avenida Governador Celso Ramos. Su construcción empezó en 1814 y está protegida por la Fundação Catarinense de Cultura desde 1998. Queda a pocas cuadras del muelle de donde salen los barcos a la isla, así que se combinan en la misma mañana.' },
      { name: 'Museu Comunitário Engenho do Sertão', zona: 'Sertãozinho, 5 km', dur: '1 h', lat: -27.1655, lng: -48.5247, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/RenatoSoares_Museu_Comunitario_Engenho_do_Sertao_Bombinhas_SC_%2827090285438%29.jpg/1280px-RenatoSoares_Museu_Comunitario_Engenho_do_Sertao_Bombinhas_SC_%2827090285438%29.jpg', nota: 'Un engenho de farinha de mandioca de tradición azoriana, con las prensas de madera, los hornos y las ruedas que movían los bueyes. Lo mantiene el Instituto Boimamão, en la Rua Abacate, en el barrio Sertãozinho. De diciembre a febrero abre todos los días; de marzo a noviembre la visita se agenda antes, así que llamá o escribí primero.' },
      { name: 'Mirante Eco 360', zona: 'Canto Grande, camino a la Tainha', dur: '1 h', lat: -27.2108, lng: -48.5009, nota: 'Un mirador en lo alto de un morro sobre el camino de tierra a la Praia da Tainha, con vista a casi toda la península. Se llega por un sendero de unos 15 minutos y cobra entrada; abajo hay un pequeño museo de historia natural. Muchos paseos en 4x4 lo incluyen.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la avenida principal, lejos de la arena.' },
      { name: 'Sequência de camarão', tipo: 'Cena', zona: 'Bombinhas y Zimbros', usd: 25, momento: 'Noche', nota: 'Camarón en seis formas distintas, servido en rondas. Para dos alcanza para tres.' },
      { name: 'Pastel de berbigão', tipo: 'Merienda', zona: 'Puestos de playa', usd: 4, momento: 'Tarde', nota: 'Pastel relleno de un molusco chico de la zona.' },
      { name: 'Mejillones y ostras de cultivo', tipo: 'Almuerzo', zona: 'Zimbros y Canto Grande', momento: 'Mediodía', nota: 'En las bahías de Zimbros y Canto Grande se cultivan mejillones (que acá llaman marisco) y ostras. Pedilos al vapor o gratinados en los restaurantes frente al agua de Zimbros, junto con una caldeirada o una moqueca de pescado.' },
      { name: 'Tainha', tipo: 'Almuerzo', zona: 'Restaurantes de pescado de Zimbros y Porto Belo', momento: 'Mayo a julio', nota: 'La lisa es el pescado del otoño en la costa de Santa Catarina: es la época de la pesca artesanal. Se come asada a la brasa, rellena o escalada (abierta, salada y frita). Fuera de esos meses casi no aparece en las cartas.' }
    ],
    hacer: [
      { name: 'Snorkel en la Sepultura', zona: 'Centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Renato_Soares_Praia_da_Sepultura_Bombinhas_SC_%2841539996032%29.jpg/1280px-Renato_Soares_Praia_da_Sepultura_Bombinhas_SC_%2841539996032%29.jpg', dur: '1 h', usd: 0, nota: 'Desde la orilla y junto a las piedras de la derecha. Agua clara y peces grandes.' },
      { name: 'Bautismo de buceo', zona: 'Bombinhas', dur: '3 h', usd: 70, nota: 'Bombinhas es la capital del buceo del sur. El bautismo se hace sin curso previo.' },
      { name: 'Trilha do Morro do Macaco', zona: 'Centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Morro_do_Macaco_-_Bombinhas_SC.jpg/1280px-Morro_do_Macaco_-_Bombinhas_SC.jpg', dur: '1 h 30', usd: 0, nota: 'Subida con vista a toda la península.' },
      { name: 'Trilha da Tainha', zona: 'Canto Grande, al pie del Morro do Macaco', dur: '2 h', usd: 0, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Praia_da_Tainha_%2820843329920%29.jpg/1280px-Praia_da_Tainha_%2820843329920%29.jpg', nota: 'Sale del mismo punto que la subida al Morro do Macaco, pero en vez de subir va bordeando el mar hasta la Praia da Tainha. Es fácil y lleva cerca de una hora de ida. Llevá agua y calzado cerrado; también se llega en auto por un camino de tierra que con lluvia se llena de pozos.' },
      { name: 'Paseo en barco pirata', zona: 'Prainha (Bombinhas) o Porto Belo', dur: '4 h', nota: 'Escunas con tripulación disfrazada que recorren Bombas, Bombinhas y la Sepultura y siguen hasta la Enseada do Caixa d\'Aço y la Ilha de Porto Belo, con paradas para bañarse. Salen del trapiche de la Prainha, en Bombinhas, o del Porto dos Piratas, en el centro de Porto Belo. Funcionan sobre todo en temporada alta: confirmá horarios el día anterior.' }
    ],
    tips: [
      { titulo: 'La tasa ambiental', texto: 'Del 15 de noviembre al 15 de abril se paga una tasa por vehículo para entrar en auto a la península. Se paga online antes de llegar.' },
      { titulo: 'Sin auto se puede', texto: 'Las playas están cerca y hay ómnibus entre ellas. En temporada el tránsito es lento: caminar es más rápido.' },
      { titulo: 'El agua no es caribeña', texto: 'Es clara pero fría para el estándar del Nordeste: unos 22 grados en verano.' },
      { titulo: 'La Ilha de Porto Belo, solo en verano', texto: 'La isla está abierta todo el año, pero el bar, el restaurante, los alquileres y las actividades funcionan del 1 de diciembre al 31 de marzo. Si vas fuera de esas fechas, llevá agua y algo para comer.' },
      { titulo: 'Arvoredo tiene cupo', texto: 'La reserva marina tiene un límite diario de visitantes y el buceo se hace con operadoras autorizadas que salen de la Prainha. En enero y febrero reservá con anticipación y elegí operadora por horario y precio.' }
    ]
  },

  rosa: {
    resumen: 'Una bahía en forma de herradura con una laguna detrás, cerros verdes y ballenas en invierno. Se recorre a pie por senderos entre playas.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 7, 8, 9, 10, 11], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y la primera quincena de diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. De julio a noviembre la ballena franca entra a la bahía a tener crías: se ve desde la costa.' },
    clima: {
      titulo: 'Clima en Praia do Rosa mes por mes',
      intro: 'El Rosa tiene verano caluroso con el agua fresca para el sur de Brasil, e invierno frío con ballenas en la bahía.',
      meses: [
        { m: 'Ene', max: 29, min: 22, lluvia: 241, mar: 25, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 22, lluvia: 198, mar: 25, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 21, lluvia: 180, mar: 24.5, demanda: 'media' },
        { m: 'Abr', max: 27, min: 19, lluvia: 116, mar: 23.5, demanda: 'media' },
        { m: 'May', max: 24, min: 16, lluvia: 126, mar: 21.5, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 14, lluvia: 86, mar: 19, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 13, lluvia: 101, mar: 17.5, demanda: 'baja' },
        { m: 'Ago', max: 22, min: 14, lluvia: 93, mar: 17.5, demanda: 'baja' },
        { m: 'Sep', max: 22, min: 15, lluvia: 147, mar: 18.5, demanda: 'baja' },
        { m: 'Oct', max: 24, min: 18, lluvia: 153, mar: 20, demanda: 'baja' },
        { m: 'Nov', max: 26, min: 19, lluvia: 147, mar: 21.5, demanda: 'baja' },
        { m: 'Dic', max: 28, min: 21, lluvia: 177, mar: 23, demanda: 'alta' }
      ],
      nota: 'Para playa con el agua todavía en 24 grados y el pueblo tranquilo: marzo y la primera mitad de abril. Enero y febrero son lo más caro, con las posadas llenas y lluvias de tarde. De julio a noviembre el mar está frío, pero la ballena franca entra a la bahía y se ve desde los morros, con precios bajos.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 de la estación Florianópolis (São José), la más cercana con normales recientes. Praia do Rosa queda unos 60 km al sur. Agua: promedios de seatemperature.info para Praia do Rosa.'
    },
    beaches: [
      { name: 'Praia do Rosa', zona: 'Centro', lat: -28.1295, lng: -48.6417, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Prainha_2_Praia_do_Rosa_Sul.jpg/1280px-Prainha_2_Praia_do_Rosa_Sul.jpg', vibe: 'La bahía principal, con olas para surf y una laguna en una punta. Se baja desde el pueblo por calles de tierra.', cuando: 'Mañana para nadar; tarde para el surf.' },
      { name: 'Lagoa de Ibiraquera', zona: 'Noroeste, en Ibiraquera, 3-4 km por ruta', lat: -28.129, lng: -48.6436, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Vista_da_Lagoa_de_Ibiraquera_-_panoramio.jpg/1280px-Vista_da_Lagoa_de_Ibiraquera_-_panoramio.jpg', vibe: 'Una laguna de agua salobre y bajita, ideal para kitesurf y stand-up. Atardeceres sobre el agua.', cuando: 'Atardecer.' },
      { name: 'Ouvidor', zona: 'Norte, 5 km por ruta', lat: -28.092, lng: -48.626, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Praia_do_Ouvidor.jpg/960px-Praia_do_Ouvidor.jpg', vibe: 'Una cala chica entre piedras, de olas fuertes, buena para surf y para mirar.', cuando: 'Tarde.' },
      { name: 'Ferrugem', zona: 'Norte, 18 km por ruta', lat: -28.087, lng: -48.623, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Pedras_na_Praia_da_Ferrugem.jpg/1280px-Pedras_na_Praia_da_Ferrugem.jpg', vibe: 'La playa joven de la zona, con bares y fiesta de noche en verano.', cuando: 'Tarde y noche.' },
      { name: 'Praia Vermelha', zona: 'Norte del Rosa, 6 km por ruta', lat: -28.117, lng: -48.6351, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Praia_Vermelha%2C_Garopaba%2C_mar%C3%A7o_de_2023_%281%29.jpg/1280px-Praia_Vermelha%2C_Garopaba%2C_mar%C3%A7o_de_2023_%281%29.jpg', vibe: 'Una cala chica entre piedras, entre el Rosa y el Ouvidor, a la que se llega a pie por el morro.', cuando: 'Mañana.' },
      { name: 'Praia do Luz', zona: 'Sur del Rosa, 5 km por ruta', lat: -28.1485, lng: -48.6493, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Praia_da_Luz_%2815533186930%29.jpg/1280px-Praia_da_Luz_%2815533186930%29.jpg', vibe: 'Una playa abierta entre el Rosa y la Barra de Ibiraquera, con olas para surf y morros verdes. Se llega por el sendero desde el Rosa o en auto.', cuando: 'Tarde, con olas.' },
      { name: 'Barra de Ibiraquera', zona: 'Ibiraquera, 8 km por ruta', lat: -28.1724, lng: -48.6579, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Nascer_do_sol_no_inverno_na_Barra_da_Ibiraquera.jpg/1280px-Nascer_do_sol_no_inverno_na_Barra_da_Ibiraquera.jpg', vibe: 'Donde la Lagoa de Ibiraquera se abre al mar: playa larga con olas de un lado y la laguna calma del otro, con kitesurf.', cuando: 'Atardecer.' },
      { name: 'Ribanceira', zona: 'Ribanceira, 18 km por ruta', lat: -28.1916, lng: -48.6617, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Dunas_da_Ribanceira_-_Imbituba_-_SC_01.jpg/1280px-Dunas_da_Ribanceira_-_Imbituba_-_SC_01.jpg', vibe: 'Playa larga de mar abierto con dunas grandes detrás, olas y pocas casas.', cuando: 'Tarde.' },
      { name: 'Praia d\'Água', zona: 'Centro de Imbituba, 22 km por ruta', lat: -28.2052, lng: -48.6653, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Praia_D%E2%80%99%C3%A1gua_%2815786215551%29.jpg/1280px-Praia_D%E2%80%99%C3%A1gua_%2815786215551%29.jpg', vibe: 'Una cala chica y escondida entre piedras, cerca del centro de Imbituba.', cuando: 'Mañana.' },
      { name: 'Praia do Porto', zona: 'Centro de Imbituba, 22 km por ruta', lat: -28.2209, lng: -48.6614, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Praia_do_Porto_%2815603300170%29.jpg/1280px-Praia_do_Porto_%2815603300170%29.jpg', vibe: 'La playa del centro de Imbituba, al lado del puerto, de agua más calma.', cuando: 'Mañana.' },
      { name: 'Praia da Vila', zona: 'Vila de Imbituba, 26 km por ruta', lat: -28.281, lng: -48.6815, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Praia_da_Vila_%2815812059485%29.jpg/1280px-Praia_da_Vila_%2815812059485%29.jpg', vibe: 'Playa de olas fuertes frente a la Vila de Imbituba, sede de campeonatos de surf.', cuando: 'Tarde; con olas grandes, solo para surfistas con experiencia.' },
      { name: 'Itapirubá', zona: 'Sur de Imbituba, 33 km por ruta', lat: -28.3308, lng: -48.7066, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Praia_de_Itapirub%C3%A1_-_panoramio.jpg/1280px-Praia_de_Itapirub%C3%A1_-_panoramio.jpg', vibe: 'Playa larga con dunas al sur de Imbituba, con olas y poca gente.', cuando: 'Tarde.' }
    ],
    atracciones: [
      { name: 'Mirante do Rosa', zona: 'Norte de la bahía', dur: '30 min', usd: 0, nota: 'La vista de toda la herradura de arena con la laguna detrás. La foto del Rosa.' },
      { name: 'Ballenas desde la costa', zona: 'Toda la bahía', lat: -28.1293, lng: -48.6402, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Baleia_em_GAROPABA_-_panoramio_-_Ant%C3%B4nio_Jo%C3%A3o.jpg/1280px-Baleia_em_GAROPABA_-_panoramio_-_Ant%C3%B4nio_Jo%C3%A3o.jpg', dur: '1 h', usd: 0, nota: 'De julio a noviembre la ballena franca se ve desde los morros, a veces a cien metros.' },
      { name: 'Trilha do Rosa al Luz', zona: 'Sur', lat: -28.139, lng: -48.645, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/Entre_o_Rosa_e_a_Luz_%2815526034950%29.jpg/1280px-Entre_o_Rosa_e_a_Luz_%2815526034950%29.jpg', dur: '1 h', usd: 0, nota: 'Sendero por el morro entre las dos playas.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro del Rosa', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la calle principal.' },
      { name: 'Camarón de la laguna', tipo: 'Cena', zona: 'Ibiraquera', momento: 'Noche', nota: 'Camarón de la Lagoa de Ibiraquera, de la pesca artesanal de la zona, frito o al ajillo.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Playa', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la arena.' }
    ],
    hacer: [
      { name: 'Clase de surf', zona: 'Praia do Rosa', dur: '2 h', usd: 30, nota: 'Escuelas en la arena con tabla y traje de neoprene incluidos.' },
      { name: 'Kitesurf en la laguna', zona: 'Ibiraquera', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Lagoa_de_Ibiraquera_%2815572288138%29.jpg/1280px-Lagoa_de_Ibiraquera_%2815572288138%29.jpg', dur: '3 h', usd: 60, nota: 'Agua bajita y viento constante: el mejor lugar para aprender.' },
      { name: 'Avistaje de ballenas', zona: 'Desde la costa', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Baleia_em_GAROPABA_-_panoramio.jpg/1280px-Baleia_em_GAROPABA_-_panoramio.jpg', dur: '2 h', nota: 'De julio a noviembre la ballena franca se ve sobre todo desde la costa. Hay pocos operadores de barco autorizados: consultá antes de ir.' }
    ],
    tips: [
      { titulo: 'Calles de tierra y subidas', texto: 'El pueblo está en un morro y la playa abajo. Con lluvia las calles de tierra se ponen difíciles.' },
      { titulo: 'Florianópolis queda a 90 km', texto: 'El aeropuerto más cercano es Florianópolis, a hora y media.' },
      { titulo: 'El agua es fría', texto: 'Incluso en enero el agua está a 21 o 22 grados. El neoprene es normal para surfear.' }
    ]
  },

  bcm: {
    resumen: 'Una ciudad de rascacielos frente al mar, con la playa central siempre llena. Las playas lindas están al sur, por la Interpraias, a pocos minutos.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 7, 8, 9, 10, 11], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y la primera quincena de diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. En Año Nuevo la ciudad recibe más de un millón de personas.' },
    clima: {
      titulo: 'Clima en Balneário Camboriú mes por mes',
      intro: 'Balneário Camboriú tiene verano caluroso con el mar tibio, e invierno fresco con el agua fría.',
      meses: [
        { m: 'Ene', max: 29, min: 21, lluvia: 184, mar: 26, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 21, lluvia: 207, mar: 26.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 20, lluvia: 191, mar: 26, demanda: 'media' },
        { m: 'Abr', max: 27, min: 18, lluvia: 116, mar: 24.5, demanda: 'media' },
        { m: 'May', max: 24, min: 15, lluvia: 126, mar: 22, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 13, lluvia: 86, mar: 20, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 12, lluvia: 109, mar: 18.5, demanda: 'baja' },
        { m: 'Ago', max: 22, min: 13, lluvia: 100, mar: 18, demanda: 'baja' },
        { m: 'Sep', max: 23, min: 14, lluvia: 131, mar: 19.5, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 17, lluvia: 144, mar: 21, demanda: 'baja' },
        { m: 'Nov', max: 27, min: 18, lluvia: 149, mar: 23, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 20, lluvia: 140, mar: 25, demanda: 'alta' }
      ],
      nota: 'Para playa con el agua tibia y precios más bajos: marzo y la primera mitad de abril. Fin de año y enero son lo más caro de todo el sur, con Año Nuevo lleno de gente; febrero es el mes más lluvioso. De junio a septiembre el agua está en 18 grados: la ciudad se disfruta igual por el teleférico, los miradores y los restaurantes, pero no para bañarse.',
      fuente: 'Temperaturas y lluvia: normales 1976-2005 de la estación de Itajaí (Embrapa/INMET), la más cercana con serie larga. Agua: promedios de seatemperature.info para Balneário Camboriú.'
    },
    beaches: [
      { name: 'Praia Central', zona: 'Centro', lat: -26.9889, lng: -48.6296, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Sol_nascendo_em_Balne%C3%A1rio_Cambori%C3%BA_-_Praia_Central_-_panoramio.jpg/1280px-Sol_nascendo_em_Balne%C3%A1rio_Cambori%C3%BA_-_Praia_Central_-_panoramio.jpg', vibe: 'La playa urbana, con edificios altísimos y la rambla nueva. De tarde los edificios hacen sombra en la arena.', cuando: 'Mañana, antes de que llegue la sombra.' },
      { name: 'Praia dos Amores', zona: 'Norte, 4 km', lat: -26.9575, lng: -48.6359, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Praia_dos_Amores_-_SC_%283171254166%29.jpg/960px-Praia_dos_Amores_-_SC_%283171254166%29.jpg', vibe: 'Playa de olas, con surf y paragliding cayendo desde el morro.', cuando: 'Tarde.' },
      { name: 'Taquarinhas', zona: 'Interpraias, 5 km', lat: -26.9979, lng: -48.5829, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Praia_de_Taquarinhas_-_Interpraias.jpg/1280px-Praia_de_Taquarinhas_-_Interpraias.jpg', vibe: 'Una cala chica rodeada de selva, sin edificios. Se llega por la ruta Interpraias o en barco.', cuando: 'Mañana.' },
      { name: 'Estaleiro', zona: 'Interpraias, 7 km', lat: -27.0262, lng: -48.5806, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Praia_do_Estaleiro.jpg/1280px-Praia_do_Estaleiro.jpg', vibe: 'Playa tranquila con restaurantes de pescado y agua clara.', cuando: 'Todo el día.' },
      { name: 'Estaleirinho', zona: 'Interpraias, 8 km', lat: -27.0493, lng: -48.5878, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Praia_do_Estaleirinho_%2821397801002%29.jpg/1280px-Praia_do_Estaleirinho_%2821397801002%29.jpg', vibe: 'La más salvaje de la Interpraias, larga y con pocas casas.', cuando: 'Tarde.' },
      { name: 'Laranjeiras', zona: 'Interpraias, 5 km', lat: -26.9969, lng: -48.589, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Praia_de_Laranjeiras%2Cem_Balne%C3%A1rio_Cambori%C3%BA_sc_-_panoramio.jpg/1280px-Praia_de_Laranjeiras%2Cem_Balne%C3%A1rio_Cambori%C3%BA_sc_-_panoramio.jpg', vibe: 'Una playa de agua calma y verde al pie del morro, con restaurantes sobre la arena. Se llega en el bondinho desde la Barra Sul, en barco o por la ruta Interpraias.', cuando: 'Mañana: desde el mediodía llegan los barcos de paseo y se llena.' },
      { name: 'Praia do Buraco', zona: 'Barra Norte, 4 km por ruta', lat: -26.9674, lng: -48.6274, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/BALNE%C3%81RIO_CAMBORI%C3%9A_%28Praia_do_Buraco%29%2C_Santa_Catarina%2C_Brasil_by_Nivaldo_Cit_Filho_-_panoramio.jpg', vibe: 'Una prainha chica entre piedras, entre la Praia Central y la dos Amores, con olas y poca arena.', cuando: 'Tarde.' },
      { name: 'Taquaras', zona: 'Interpraias, 11 km por ruta', lat: -27.0069, lng: -48.5804, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d6/Praia_de_Taquaras_-_Balne%C3%A1rio_Cambori%C3%BA.jpg/1280px-Praia_de_Taquaras_-_Balne%C3%A1rio_Cambori%C3%BA.jpg', vibe: 'Playa de la Interpraias, más abierta que su vecina Taquarinhas, con algo de ola, restaurantes y casas entre la vegetación.', cuando: 'Tarde.' },
      { name: 'Praia do Pinho', zona: 'Interpraias, 11 km por ruta', lat: -27.0212, lng: -48.5759, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Praia_do_Pinho_%2821436832049%29.jpg/1280px-Praia_do_Pinho_%2821436832049%29.jpg', vibe: 'Una cala entre morros de la Interpraias, la primera playa nudista oficial de Brasil. Tiene reglas propias de acceso y convivencia: consultalas antes de ir.', cuando: 'Día de sol.' }
    ],
    atracciones: [
      { name: 'Parque Unipraias', zona: 'Barra Sul', lat: -27.0052, lng: -48.6034, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Telef%C3%A9rico_do_Parque_Unipraias_com_a_Esta%C3%A7%C3%A3o_Barra_Sul_ao_fundo%2C_Balne%C3%A1rio_Cambori%C3%BA_SC.JPG/1280px-Telef%C3%A9rico_do_Parque_Unipraias_com_a_Esta%C3%A7%C3%A3o_Barra_Sul_ao_fundo%2C_Balne%C3%A1rio_Cambori%C3%BA_SC.JPG', dur: '2 h', usd: 25, nota: 'Teleférico que cruza el Morro da Aguada hasta la Praia de Laranjeiras, con miradores y tirolesa.' },
      { name: 'Cristo Luz', zona: 'Morro da Cruz', lat: -26.9853, lng: -48.6452, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Cristo_Luz_-_Balne%C3%A1rio_Cambori%C3%BA.jpg/1280px-Cristo_Luz_-_Balne%C3%A1rio_Cambori%C3%BA.jpg', dur: '1 h', usd: 6, nota: 'Una estatua de Cristo de 33 metros sobre la ciudad, iluminada de noche.' },
      { name: 'Molhe da Barra Sul', zona: 'Barra Sul', lat: -27.0047, lng: -48.6032, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/DanielVianna_MolheBarraSul_BalnearioCamboriu_SC_%2839233032870%29.jpg/1280px-DanielVianna_MolheBarraSul_BalnearioCamboriu_SC_%2839233032870%29.jpg', dur: '40 min', usd: 0, nota: 'Escollera al final de la playa central, con la vista de los edificios al atardecer.' },
      { name: 'Roda gigante FG Big Wheel', zona: 'Pontal Norte', dur: '1 h', lat: -26.9715, lng: -48.6314, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/13/Balne%C3%A1rio_Cambori%C3%BA_SC_Roda_Gigante.jpg/1280px-Balne%C3%A1rio_Cambori%C3%BA_SC_Roda_Gigante.jpg', nota: 'Una rueda de 65 metros con 32 cabinas con aire acondicionado, en la punta norte de la Praia Central, donde arranca la Estrada da Rainha. La vuelta dura unos 20 minutos: de un lado ves la Praia Central con los edificios y del otro el morro. Las entradas se compran en el sitio oficial con horario reservado, y llegás con las líneas Violeta o Amarela del BC Bus.' },
      { name: 'Capela de Santo Amaro y Passarela da Barra', zona: 'Bairro da Barra', dur: '1 h', usd: 0, lat: -27.0083, lng: -48.6047, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Santo_Amaro%2C_Balne%C3%A1rio_de_Cambori%C3%BA_01.jpg/1280px-Santo_Amaro%2C_Balne%C3%A1rio_de_Cambori%C3%BA_01.jpg', nota: 'Una capilla blanca de comienzos del siglo XIX, arriba de una escalinata frente a la Praça do Pescador, protegida como patrimonio por la Fundação Catarinense de Cultura. Está en el Bairro da Barra, el núcleo más viejo de la ciudad. Desde la Barra Sul se cruza a pie por la Passarela da Barra, de 190 metros y con ascensores, que es gratis y está abierta todo el día; desde arriba se ve la desembocadura del Rio Camboriú.' },
      { name: 'Parque Natural Municipal Raimundo Malta', zona: 'Bairro dos Municípios', dur: '1 h 30', usd: 0, lat: -27.0108, lng: -48.64, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/%C3%81rvores_do_parque_-_Alceu_Francisco_Tabalipa.jpg/1280px-%C3%81rvores_do_parque_-_Alceu_Francisco_Tabalipa.jpg', nota: 'Un pedazo de Mata Atlántica a orillas del Rio Camboriú, con 6 senderos cortos que suman 3,2 km y un mirador sobre el manglar. La entrada es gratis; según la prefeitura abre de 13 a 17 h entre semana y de 10 a 17 h los fines de semana y feriados, y cierra con tormenta o después de lluvias fuertes. Llevá repelente y calzado cerrado: adentro no venden nada.' },
      { name: 'Oceanic Aquarium', zona: 'Barra Sul', dur: '2 h', lat: -27.0058, lng: -48.6164, nota: 'Un acuario con 25 tanques en 2.200 m², acreditado en 2025 por la asociación latinoamericana de zoológicos y acuarios (ALPZA). Abre todos los días de 9 a 20 h y las entradas se venden online. Es un buen plan para un día de lluvia; queda a poco más de 1 km del teleférico del Unipraias y pasan las líneas Violeta, Verde y Azul del BC Bus.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Avenida Brasil', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la avenida paralela a la rambla.' },
      { name: 'Pescado en el Estaleiro', tipo: 'Almuerzo', zona: 'Interpraias', usd: 18, momento: 'Mediodía', nota: 'Restaurantes frente al mar con sequência de camarão (camarón en varias preparaciones) y pescado.' },
      { name: 'Churros y helado en la rambla', tipo: 'Merienda', zona: 'Avenida Atlântica', usd: 3, momento: 'Tarde', nota: 'La merienda de los carritos de la rambla.' },
      { name: 'Pescado fresco en el Bairro da Barra', tipo: 'Almuerzo', zona: 'Bairro da Barra', momento: 'Mediodía', nota: 'La pesca de la zona trae anchova, tainha y pescada, y el camarón está en casi todas las cartas. El Bairro da Barra, junto a la desembocadura del río, tiene restaurantes de pescado y mariscos; lejos de la rambla los precios suelen ser más accesibles.' },
      { name: 'Mejillones y ostras', tipo: 'Cena', zona: 'Restaurantes de mariscos', momento: 'Noche', nota: 'Santa Catarina produce más del 90 % de las ostras y los mejillones de cultivo de Brasil, y Penha, al norte de Balneário, es uno de los municipios que más mejillones saca. Los mejillones van al vapor o gratinados; las ostras, crudas con limón o gratinadas.' }
    ],
    hacer: [
      { name: 'Ruta Interpraias', zona: 'Sur', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Balne%C3%A1rio_Cambori%C3%BA_-_Interpraias.jpg/1280px-Balne%C3%A1rio_Cambori%C3%BA_-_Interpraias.jpg', dur: 'Medio día', usd: 0, nota: 'Ruta panorámica por la costa sur que une seis playas (Laranjeiras, Taquarinhas, Taquaras, Pinho, Estaleiro y Estaleirinho) con miradores. En auto o en ómnibus turístico.' },
      { name: 'Barco pirata', zona: 'Barra Sul', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Embarque_no_Barco_Pirata_no_Rio_Cambori%C3%BA_com_a_Passarela_da_Barra_Sul_ao_fundo%2C_Balne%C3%A1rio_Cambori%C3%BA_SC.JPG/1280px-Embarque_no_Barco_Pirata_no_Rio_Cambori%C3%BA_com_a_Passarela_da_Barra_Sul_ao_fundo%2C_Balne%C3%A1rio_Cambori%C3%BA_SC.JPG', dur: '2 h', usd: 15, nota: 'Paseo en barco por la bahía con parada en Laranjeiras.' },
      { name: 'Paragliding', zona: 'Morro do Careca', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/MORRO_DO_CARECA._BC_-_panoramio.jpg/1280px-MORRO_DO_CARECA._BC_-_panoramio.jpg', dur: '30 min', usd: 70, nota: 'Vuelo doble desde el morro sobre la Praia dos Amores.' },
      { name: 'Una tarde en la Praia Brava', zona: 'Itajaí, 6 km al norte', dur: 'Medio día', usd: 0, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Praia_Brava_Itaja%C3%AD.jpg/1280px-Praia_Brava_Itaja%C3%AD.jpg', nota: 'La playa de mar abierto de Itajaí, pegada al Morro do Careca, con fondo de arena y olas cortas que buscan los surfistas de nivel intermedio. Se llega por la Estrada da Rainha, que sale del Pontal Norte y pasa por la Praia do Buraco y la dos Amores. Al atardecer se ven los parapentes que bajan del morro.' },
      { name: 'Space Adventure', zona: 'Avenida das Flores, junto a la rodoviária', dur: '2 h', nota: 'Un museo con más de 300 piezas originales de la NASA, réplicas y un planetario, al lado de la rodoviária y del Balneário Shopping. Las entradas se compran en el sitio oficial; en temporada alta abre todos los días y el resto del año de martes a domingo. Sirve para un día de lluvia, sobre todo con chicos.' },
      { name: 'Noche en el Green Valley', zona: 'Rio Pequeno, Camboriú', dur: 'Toda la noche', nota: 'Un club de música electrónica metido en el verde, que la revista DJ Mag eligió cinco veces como el mejor del mundo y que estuvo entre los tres primeros todos los años de 2011 a 2024. No abre todas las noches: funciona con fechas de fiesta, sobre todo fines de semana de verano, feriados largos, Año Nuevo y Carnaval. Mirá la agenda, comprá la entrada antes y arreglá la vuelta con tiempo.' }
    ],
    tips: [
      { titulo: 'La sombra de los edificios', texto: 'Después del mediodía los edificios tapan el sol en la playa central. Para la tarde, Interpraias.' },
      { titulo: 'Beto Carrero está cerca', texto: 'El parque temático Beto Carrero World está en Penha, a 40 km. Es un día entero.' },
      { titulo: 'Fin de semana largo, tránsito', texto: 'La BR-101 se colapsa los fines de semana de verano. Llegá un día de semana.' },
      { titulo: 'El ómnibus es gratis', texto: 'El BC Bus no cobra boleto. La línea Violeta recorre la orla de la Barra Sul a la Praia dos Amores más o menos cada 30 minutos, de 6 a 24 h; la Azul va a la Interpraias hasta el Estaleirinho, y la Amarela pasa cerca del Cristo Luz y del Pontal Norte.' },
      { titulo: 'El mar después del ensanche', texto: 'Desde que ensancharon la arena de la Praia Central en 2021 aparecen más bancos de arena y corrientes, y los bomberos reforzaron los guardavidas. Bañate frente a un puesto y respetá las banderas.' },
      { titulo: 'Volá a Navegantes', texto: 'El aeropuerto de Navegantes (NVT) queda a unos 35 km por la BR-101; el de Florianópolis, a unos 90. Si el precio es parecido, Navegantes te ahorra más de una hora de ruta.' }
    ]
  },

  itapema: {
    resumen: 'Una ciudad de edificios frente a Meia Praia, con playas chicas y calas al norte y la península de Porto Belo a minutos.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 7, 8, 9, 10, 11], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y la primera quincena de diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada.' },
    clima: {
      titulo: 'Clima en Itapema mes por mes',
      intro: 'Itapema tiene verano caluroso con el mar calmo y tibio, e invierno fresco.',
      meses: [
        { m: 'Ene', max: 29, min: 21, lluvia: 184, mar: 26, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 21, lluvia: 207, mar: 26.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 20, lluvia: 191, mar: 26, demanda: 'media' },
        { m: 'Abr', max: 27, min: 18, lluvia: 116, mar: 24, demanda: 'media' },
        { m: 'May', max: 24, min: 15, lluvia: 126, mar: 22, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 13, lluvia: 86, mar: 19.5, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 12, lluvia: 109, mar: 18, demanda: 'baja' },
        { m: 'Ago', max: 22, min: 13, lluvia: 100, mar: 18, demanda: 'baja' },
        { m: 'Sep', max: 23, min: 14, lluvia: 131, mar: 19, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 17, lluvia: 144, mar: 21, demanda: 'baja' },
        { m: 'Nov', max: 27, min: 18, lluvia: 149, mar: 23, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 20, lluvia: 140, mar: 24.5, demanda: 'alta' }
      ],
      nota: 'Para playa con el agua tibia y la rambla sin multitudes: marzo y la primera mitad de abril. Enero y febrero son lo más caluroso y lo más caro, con lluvias fuertes de tarde. De junio a septiembre el agua baja a 18 o 19 grados y bajan los precios: sirve para caminar la rambla, no para bañarse.',
      fuente: 'Temperaturas y lluvia: normales 1976-2005 de la estación de Itajaí (Embrapa/INMET), la más cercana con serie larga. Agua: promedios de seatemperature.info para Itapema.'
    },
    beaches: [
      { name: 'Meia Praia', zona: 'Sur del centro', lat: -27.1289, lng: -48.6061, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Renato_Soares_Meia_Praia_vista_da_Ponte_do_Suspiro_Itapema_SC_%2840872082054%29.jpg/1280px-Renato_Soares_Meia_Praia_vista_da_Ponte_do_Suspiro_Itapema_SC_%2840872082054%29.jpg', vibe: 'La playa larga de los edificios, de agua calma y arena ancha. La rambla se camina de punta a punta.', cuando: 'Mañana.' },
      { name: 'Praia Grossa', zona: 'Norte, 2.5 km desde el centro', lat: -27.0864, lng: -48.5963, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Praia_grossa_-_panoramio.jpg/1280px-Praia_grossa_-_panoramio.jpg', vibe: 'Una playa salvaje entre morros, sin edificios, a la que se baja por un sendero. Olas para surf.', cuando: 'Tarde.' },
      { name: 'Ilhota', zona: 'Norte, 3 km desde el centro', lat: -27.076, lng: -48.5948, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Renato_Soares_Praia_da_Ilhota_Itapema_SC_%2841583094621%29.jpg/1280px-Renato_Soares_Praia_da_Ilhota_Itapema_SC_%2841583094621%29.jpg', vibe: 'Una cala chica de agua quieta y transparente, la más linda de Itapema.', cuando: 'Mañana.' },
      { name: 'Canto da Praia', zona: 'Canto da Praia, a pie', lat: -27.0931, lng: -48.6084, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Canto_da_Praia%2C_Itapema_-_SC%2C_Brazil_-_panoramio.jpg/1280px-Canto_da_Praia%2C_Itapema_-_SC%2C_Brazil_-_panoramio.jpg', vibe: 'El extremo norte de la playa del centro de Itapema, con barcos de pescadores, agua calma y el morro al costado.', cuando: 'Mañana.' }
    ],
    atracciones: [
      { name: 'Mirante do Encanto', zona: 'Canto da Praia (Morro do Cabeço)', lat: -27.0876, lng: -48.6037, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/RenatoSoares_Mirante_do_Encanto_Itapema_SC_%2841146279521%29.jpg/1280px-RenatoSoares_Mirante_do_Encanto_Itapema_SC_%2841146279521%29.jpg', dur: '40 min', usd: 0, nota: 'La vista de Meia Praia y de toda la bahía desde el morro.' },
      { name: 'Rambla de Meia Praia', zona: 'Meia Praia', lat: -27.1289, lng: -48.6061, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Renato_Soares_Meia_Praia_vista_da_Ponte_do_Suspiro_Itapema_SC_%2840872082054%29.jpg/1280px-Renato_Soares_Meia_Praia_vista_da_Ponte_do_Suspiro_Itapema_SC_%2840872082054%29.jpg', dur: '1 h', usd: 0, nota: 'Ciclovía y paseo frente al mar, con quioscos.' },
      { name: 'Porto Belo', zona: '10 km', lat: -27.1578, lng: -48.5528, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Muelle_Porto_Belo_%2838587560%29.jpeg/1280px-Muelle_Porto_Belo_%2838587560%29.jpeg', dur: '2 h', usd: 0, nota: 'El pueblo vecino, con la Ilha de Porto Belo enfrente y barcos que cruzan.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en las calles paralelas a la rambla.' },
      { name: 'Sequência de camarão', tipo: 'Cena', zona: 'Rambla', usd: 25, momento: 'Noche', nota: 'Camarón en varias preparaciones, para dos.' },
      { name: 'Pastel de feria', tipo: 'Merienda', zona: 'Centro', usd: 3, momento: 'Tarde', nota: 'Pastel frito con jugo de caña.' }
    ],
    hacer: [
      { name: 'Ilha de Porto Belo', zona: 'Porto Belo', dur: 'Medio día', usd: 15, nota: 'Barco corto a la isla, con playa, sendero y restaurante.' },
      { name: 'Sendero a la Praia Grossa', zona: 'Norte', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Praia_Grossa_%2821082190099%29.jpg/1280px-Praia_Grossa_%2821082190099%29.jpg', dur: '1 h', usd: 0, nota: 'Bajada corta desde la ruta hasta la playa salvaje.' },
      { name: 'Bicicleta por la rambla', zona: 'Meia Praia', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Um_peda%C3%A7o_de_Santa_Catarina%2C_ma%27s_ciclovias_de_Itapema.jpg/1280px-Um_peda%C3%A7o_de_Santa_Catarina%2C_ma%27s_ciclovias_de_Itapema.jpg', dur: '1 h', usd: 0, nota: 'Ciclovía de punta a punta de la playa.' }
    ],
    tips: [
      { titulo: 'Base para Bombinhas', texto: 'Itapema cuesta menos que Bombinhas y está a 20 km: es buena base para ir de día.' },
      { titulo: 'Edificios, sombra de tarde', texto: 'Como en Camboriú, de tarde los edificios tapan el sol en Meia Praia.' },
      { titulo: 'Las calas del norte se llenan', texto: 'Ilhota y Praia Grossa son chicas. Llegá antes de las 10 en enero.' }
    ]
  },

  garopaba: {
    resumen: 'Un pueblo de pescadores con la iglesia frente a la bahía, rodeado de playas de surf, dunas y morros. Las ballenas entran a la bahía en invierno.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 7, 8, 9, 10, 11], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y la primera quincena de diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. De julio a noviembre se ven ballenas francas desde la costa.' },
    clima: {
      titulo: 'Clima en Garopaba mes por mes',
      intro: 'Garopaba tiene verano caluroso con el agua más fresca que en el norte de Santa Catarina, e invierno frío con ballenas.',
      meses: [
        { m: 'Ene', max: 29, min: 22, lluvia: 241, mar: 25, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 22, lluvia: 198, mar: 25, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 21, lluvia: 180, mar: 24.5, demanda: 'media' },
        { m: 'Abr', max: 27, min: 19, lluvia: 116, mar: 23.5, demanda: 'media' },
        { m: 'May', max: 24, min: 16, lluvia: 126, mar: 21.5, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 14, lluvia: 86, mar: 19, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 13, lluvia: 101, mar: 17.5, demanda: 'baja' },
        { m: 'Ago', max: 22, min: 14, lluvia: 93, mar: 17.5, demanda: 'baja' },
        { m: 'Sep', max: 22, min: 15, lluvia: 147, mar: 18.5, demanda: 'baja' },
        { m: 'Oct', max: 24, min: 18, lluvia: 153, mar: 20, demanda: 'baja' },
        { m: 'Nov', max: 26, min: 19, lluvia: 147, mar: 21.5, demanda: 'baja' },
        { m: 'Dic', max: 28, min: 21, lluvia: 177, mar: 23, demanda: 'alta' }
      ],
      nota: 'Para playa y surf con el agua todavía en 24 grados y menos gente: marzo y la primera mitad de abril. Enero y febrero son lo más caluroso y lo más caro, con lluvias de tarde. De julio a noviembre el agua está fría, pero es la temporada de la ballena franca, que se ve desde el Morro da Vigia, con precios bajos.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 de la estación Florianópolis (São José), la más cercana con normales recientes. Garopaba queda unos 50 km al sur. Agua: promedios de seatemperature.info para Garopaba.'
    },
    beaches: [
      { name: 'Silveira', zona: 'Sur, 2 km', lat: -28.0397, lng: -48.6089, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg/1280px-Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg', vibe: 'Una de las playas de surf más famosas de Santa Catarina, entre morros verdes. Agua clara y fría.', cuando: 'Tarde, con olas.' },
      { name: 'Siriú', zona: 'Norte, 7 km', lat: -27.9765, lng: -48.6292, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Praia_do_Siri%C3%BA_in_Garopaba_6_%2821493002004%29.jpg/1280px-Praia_do_Siri%C3%BA_in_Garopaba_6_%2821493002004%29.jpg', vibe: 'Dunas enormes de arena blanca que caen sobre el mar. Se hace sandboard.', cuando: 'Atardecer en las dunas.' },
      { name: 'Ferrugem', zona: 'Sur, 8 km', lat: -28.0784, lng: -48.6282, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Ferrugem_006.jpg/1280px-Ferrugem_006.jpg', vibe: 'La playa joven, con bares, música y surf.', cuando: 'Tarde y noche.' },
      { name: 'Ouvidor', zona: 'Sur, 16 km', lat: -28.1051, lng: -48.6371, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Praia_do_Ouvidor.jpg/960px-Praia_do_Ouvidor.jpg', vibe: 'Una cala de olas fuertes entre piedras.', cuando: 'Tarde.' },
      { name: 'Praia de Garopaba (Centro)', zona: 'Centro, a pie', lat: -28.0178, lng: -48.6213, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Garopaba_-_Praia_do_Centro_%2815082829150%29.jpg/1280px-Garopaba_-_Praia_do_Centro_%2815082829150%29.jpg', vibe: 'La bahía del pueblo, de agua calma, con barcos de pescadores y la iglesia de São Joaquim encima.', cuando: 'Mañana; buena para nadar.' },
      { name: 'Praia da Vigia', zona: 'Centro, 2 km por ruta', lat: -28.0192, lng: -48.6102, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/%C3%81rea_de_Prote%C3%A7%C3%A3o_Ambiental_da_Baleia_Franca_Claudio_Seelig_%2815%29.jpg/1280px-%C3%81rea_de_Prote%C3%A7%C3%A3o_Ambiental_da_Baleia_Franca_Claudio_Seelig_%2815%29.jpg', vibe: 'Una prainha chica al pie del Morro da Vigia, entre el centro y el Silveira, de agua calma.', cuando: 'Mañana; de julio a noviembre, mirá el mar por las ballenas.' },
      { name: 'Praia da Barra', zona: 'Barra, 11 km por ruta', lat: -28.0863, lng: -48.631, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Praia_da_Barra_%2815407710900%29.jpg/1280px-Praia_da_Barra_%2815407710900%29.jpg', vibe: 'La continuación al sur de Ferrugem, donde desemboca la Lagoa da Encantada: más tranquila, con olas de un lado y la laguna del otro.', cuando: 'Tarde.' },
      { name: 'Gamboa', zona: 'Gamboa, 15 km por ruta', lat: -27.9531, lng: -48.6241, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Praia_da_Gamboa_%2815450185972%29.jpg/1280px-Praia_da_Gamboa_%2815450185972%29.jpg', vibe: 'La playa larga del pueblo de pescadores de la Gamboa, al norte de Garopaba, con olas y pocas posadas.', cuando: 'Tarde.' }
    ],
    atracciones: [
      { name: 'Igreja de São Joaquim', zona: 'Centro histórico', lat: -28.0237, lng: -48.6133, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Igreja_Matriz_S%C3%A3o_Joaquim%2C_fevereiro_de_2026_09.jpg/1280px-Igreja_Matriz_S%C3%A3o_Joaquim%2C_fevereiro_de_2026_09.jpg', dur: '20 min', usd: 0, nota: 'La iglesia del siglo XIX frente a la bahía, con las casas de pescadores alrededor.' },
      { name: 'Morro da Vigia', zona: 'Centro', lat: -28.0175, lng: -48.6085, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/%C3%81rea_de_Prote%C3%A7%C3%A3o_Ambiental_da_Baleia_Franca_Claudio_Seelig_%2815%29.jpg/1280px-%C3%81rea_de_Prote%C3%A7%C3%A3o_Ambiental_da_Baleia_Franca_Claudio_Seelig_%2815%29.jpg', dur: '40 min', usd: 0, nota: 'El cerro desde donde los pescadores vigilaban las ballenas. Hoy es el mejor lugar para verlas.' },
      { name: 'Centro histórico', zona: 'Centro', lat: -28.0245, lng: -48.6135, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/RenatoSoares_CentroHist%C3%B3rico_Garopaba_SC_%2839772972480%29.jpg/1280px-RenatoSoares_CentroHist%C3%B3rico_Garopaba_SC_%2839772972480%29.jpg', dur: '1 h', usd: 0, nota: 'Casas de pescadores azorianos frente a la playa central.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la calle principal.' },
      { name: 'Tainha frita', tipo: 'Almuerzo', zona: 'Restaurantes de pescadores', usd: 12, momento: 'Mediodía', nota: 'El pescado de la zona, sobre todo en invierno, frito o asado.' },
      { name: 'Açaí', tipo: 'Merienda', zona: 'Centro', usd: 5, momento: 'Tarde', nota: 'Bowl de açaí después de la playa.' }
    ],
    hacer: [
      { name: 'Sandboard en el Siriú', zona: 'Siriú', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Dunas_do_Siri%C3%BA_%2815226112740%29.jpg/1280px-Dunas_do_Siri%C3%BA_%2815226112740%29.jpg', dur: '2 h', usd: 10, nota: 'Alquiler de tabla para bajar las dunas.' },
      { name: 'Avistaje de ballenas', zona: 'Desde la costa', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Baleia_em_GAROPABA_-_panoramio.jpg/1280px-Baleia_em_GAROPABA_-_panoramio.jpg', dur: '2 h', nota: 'De julio a noviembre la ballena franca se ve sobre todo desde la costa, por ejemplo desde el Morro da Vigia. Hay pocos operadores de barco autorizados: consultá antes de ir.' },
      { name: 'Clase de surf en el Silveira', zona: 'Silveira', dur: '2 h', usd: 30, nota: 'Escuelas con neoprene incluido.' }
    ],
    tips: [
      { titulo: 'Agua fría todo el año', texto: 'Incluso en verano el agua está fría. El neoprene es normal.' },
      { titulo: 'Rosa y Ferrugem al lado', texto: 'Praia do Rosa y Ferrugem están a unos 16 y 8 km: se visitan de día.' },
      { titulo: 'Sin auto, el ómnibus pasa poco', texto: 'Las playas están dispersas. Fuera de temporada el ómnibus entre playas pasa cada mucho.' }
    ]
  },

  ferrugem: {
    resumen: 'Una playa de surf y fiesta entre morros, con una laguna al lado y las calas de Garopaba y el Rosa a pocos minutos.',
    temporada: { alta: [1, 2, 12], baja: [5, 6, 7, 8, 9, 10, 11], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y la primera quincena de diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. Fuera del verano Ferrugem es un pueblo tranquilo de surfistas.' },
    clima: {
      titulo: 'Clima en Ferrugem mes por mes',
      intro: 'Ferrugem tiene verano caluroso con el agua fresca y olas, e invierno frío y tranquilo.',
      meses: [
        { m: 'Ene', max: 29, min: 22, lluvia: 241, mar: 25, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 22, lluvia: 198, mar: 25, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 21, lluvia: 180, mar: 24.5, demanda: 'media' },
        { m: 'Abr', max: 27, min: 19, lluvia: 116, mar: 23.5, demanda: 'media' },
        { m: 'May', max: 24, min: 16, lluvia: 126, mar: 21.5, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 14, lluvia: 86, mar: 19, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 13, lluvia: 101, mar: 17.5, demanda: 'baja' },
        { m: 'Ago', max: 22, min: 14, lluvia: 93, mar: 17.5, demanda: 'baja' },
        { m: 'Sep', max: 22, min: 15, lluvia: 147, mar: 18.5, demanda: 'baja' },
        { m: 'Oct', max: 24, min: 18, lluvia: 153, mar: 20, demanda: 'baja' },
        { m: 'Nov', max: 26, min: 19, lluvia: 147, mar: 21.5, demanda: 'baja' },
        { m: 'Dic', max: 28, min: 21, lluvia: 177, mar: 23, demanda: 'alta' }
      ],
      nota: 'Para playa con el agua todavía en 24 grados y menos gente: marzo y la primera mitad de abril. Enero y febrero son la temporada de fiesta, con bares llenos, precios altos y lluvias de tarde. De junio a septiembre el agua está entre 17 y 19 grados y queda el pueblo de surfistas, con traje de neoprene.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 de la estación Florianópolis (São José), la más cercana con normales recientes. Ferrugem queda unos 55 km al sur. Agua: promedios de seatemperature.info para Garopaba.'
    },
    beaches: [
      { name: 'Ferrugem', zona: 'Centro', lat: -28.0784, lng: -48.6282, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Ferrugem_006.jpg/1280px-Ferrugem_006.jpg', vibe: 'La playa principal, con olas para surf, bares sobre la arena y fiesta de noche en verano.', cuando: 'Tarde y noche.' },
      { name: 'Ouvidor', zona: '18 km por ruta (se entra por el lado del Rosa)', lat: -28.1051, lng: -48.6371, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Praia_do_Ouvidor.jpg/960px-Praia_do_Ouvidor.jpg', vibe: 'Una cala salvaje entre piedras, para mirar el surf.', cuando: 'Tarde.' },
      { name: 'Praia do Rosa', zona: '18 km', lat: -28.1295, lng: -48.6417, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Renato_Soares_Praia_do_Rosa_Garopaba_SC_%2840140102305%29.jpg/1280px-Renato_Soares_Praia_do_Rosa_Garopaba_SC_%2840140102305%29.jpg', vibe: 'La bahía en herradura con laguna detrás, de las más lindas de Santa Catarina.', cuando: 'Mañana.' },
      { name: 'Silveira', zona: '8 km', lat: -28.0397, lng: -48.6089, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg/1280px-Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg', vibe: 'La playa de surf más famosa de la zona, entre morros verdes.', cuando: 'Tarde.' },
      { name: 'Praia da Barra', zona: 'Sur de Ferrugem, a pie por la playa', lat: -28.0863, lng: -48.631, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Praia_da_Barra_%2815407710900%29.jpg/1280px-Praia_da_Barra_%2815407710900%29.jpg', vibe: 'La continuación al sur de Ferrugem, donde desemboca la Lagoa da Encantada: más tranquila, con olas de un lado y la laguna del otro.', cuando: 'Tarde.' },
      { name: 'Praia da Vigia', zona: 'Centro, 9 km por ruta', lat: -28.0192, lng: -48.6102, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/%C3%81rea_de_Prote%C3%A7%C3%A3o_Ambiental_da_Baleia_Franca_Claudio_Seelig_%2815%29.jpg/1280px-%C3%81rea_de_Prote%C3%A7%C3%A3o_Ambiental_da_Baleia_Franca_Claudio_Seelig_%2815%29.jpg', vibe: 'Una prainha chica al pie del Morro da Vigia, entre el centro y el Silveira, de agua calma.', cuando: 'Mañana; de julio a noviembre, mirá el mar por las ballenas.' },
      { name: 'Praia de Garopaba (Centro)', zona: 'Centro, 9 km por ruta', lat: -28.0178, lng: -48.6213, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Garopaba_-_Praia_do_Centro_%2815082829150%29.jpg/1280px-Garopaba_-_Praia_do_Centro_%2815082829150%29.jpg', vibe: 'La bahía del pueblo, de agua calma, con barcos de pescadores y la iglesia de São Joaquim encima.', cuando: 'Mañana; buena para nadar.' },
      { name: 'Siriú', zona: 'Siriú, 13 km por ruta', lat: -27.9922, lng: -48.6302, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Praia_do_Siri%C3%BA_in_Garopaba_6_%2821493002004%29.jpg/1280px-Praia_do_Siri%C3%BA_in_Garopaba_6_%2821493002004%29.jpg', vibe: 'Dunas enormes de arena blanca que caen sobre el mar. Se hace sandboard.', cuando: 'Atardecer en las dunas.' },
      { name: 'Gamboa', zona: 'Gamboa, 23 km por ruta', lat: -27.9531, lng: -48.6241, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Praia_da_Gamboa_%2815450185972%29.jpg/1280px-Praia_da_Gamboa_%2815450185972%29.jpg', vibe: 'La playa larga del pueblo de pescadores de la Gamboa, al norte de Garopaba, con olas y pocas posadas.', cuando: 'Tarde.' }
    ],
    atracciones: [
      { name: 'Mirante da Ferrugem', zona: 'Morro de la punta', lat: -28.0938, lng: -48.6328, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Vista_para_a_Praia_da_Ferrugem_-_panoramio.jpg/1280px-Vista_para_a_Praia_da_Ferrugem_-_panoramio.jpg', dur: '30 min', usd: 0, nota: 'Vista de la playa y de la laguna de la Barra desde el morro.' },
      { name: 'Lagoa da Encantada', zona: 'Barra', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Lagoa_da_Encantada_%28vista_do_alto_do_morro%29_-_panoramio.jpg/1280px-Lagoa_da_Encantada_%28vista_do_alto_do_morro%29_-_panoramio.jpg', dur: '1 h', usd: 0, nota: 'La laguna detrás de la Barra, con atardecer sobre el agua.' },
      { name: 'Centro de Garopaba', zona: '8 km', lat: -28.0245, lng: -48.6135, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Garopaba_-_Praia_do_Centro_%2815082829150%29.jpg/1280px-Garopaba_-_Praia_do_Centro_%2815082829150%29.jpg', dur: '1 h', usd: 0, nota: 'El pueblo de pescadores con la iglesia frente a la bahía.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Calle principal', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso a dos cuadras de la playa.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Playa', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la arena.' },
      { name: 'Hamburguesa de bar de playa', tipo: 'Cena', zona: 'Centro', usd: 9, momento: 'Noche', nota: 'La comida de los bares antes de la fiesta.' }
    ],
    hacer: [
      { name: 'Clase de surf', zona: 'Ferrugem', dur: '2 h', usd: 30, nota: 'Escuelas en la arena con equipo incluido.' },
      { name: 'Stand-up en la laguna', zona: 'Barra', dur: '1 h', usd: 15, nota: 'Agua quieta, buena para aprender.' },
      { name: 'Sendero al Luz', zona: 'En el Rosa, a 18 km', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Entre_o_Rosa_e_a_Luz_%2815525434398%29.jpg/1280px-Entre_o_Rosa_e_a_Luz_%2815525434398%29.jpg', dur: '1 h', usd: 0, nota: 'Sale de la Praia do Rosa y va por el morro hasta la Praia do Luz.' }
    ],
    tips: [
      { titulo: 'Verano: fiesta; resto: calma', texto: 'En enero y febrero Ferrugem es la playa de la noche. El resto del año es un pueblo de surfistas.' },
      { titulo: 'Calles de tierra', texto: 'Con lluvia las calles se embarran. Calzado que se pueda mojar.' },
      { titulo: 'Agua fría', texto: 'Como en toda la zona, el agua es fría incluso en verano.' }
    ]
  },

  picarras: {
    resumen: 'Una playa larga de agua calma y arena ancha, con las calas de Penha a diez minutos y Beto Carrero World al lado.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 8, 9, 10, 11], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas. Marzo y la primera quincena de diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada.' },
    clima: {
      titulo: 'Clima en Piçarras mes por mes',
      intro: 'Verano caliente y húmedo, invierno fresco. El agua es tibia de diciembre a abril y fría de junio a septiembre.',
      meses: [
        { m: 'Ene', max: 29, min: 21, lluvia: 184, mar: 26.5, demanda: 'alta' },
        { m: 'Feb', max: 30, min: 21, lluvia: 207, mar: 26.5, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 20, lluvia: 191, mar: 26, demanda: 'media' },
        { m: 'Abr', max: 27, min: 18, lluvia: 116, mar: 24.5, demanda: 'baja' },
        { m: 'May', max: 24, min: 15, lluvia: 126, mar: 22, demanda: 'baja' },
        { m: 'Jun', max: 22, min: 13, lluvia: 86, mar: 19.5, demanda: 'baja' },
        { m: 'Jul', max: 21, min: 12, lluvia: 109, mar: 18, demanda: 'media' },
        { m: 'Ago', max: 22, min: 13, lluvia: 100, mar: 18, demanda: 'baja' },
        { m: 'Sep', max: 23, min: 14, lluvia: 131, mar: 19.5, demanda: 'baja' },
        { m: 'Oct', max: 25, min: 17, lluvia: 144, mar: 21, demanda: 'baja' },
        { m: 'Nov', max: 27, min: 18, lluvia: 149, mar: 23, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 20, lluvia: 140, mar: 25, demanda: 'alta' }
      ],
      nota: 'Para playa, de diciembre a marzo: el agua pasa los 25 grados. Marzo tiene el mismo calor que febrero con menos gente y precios más bajos. En verano llueve más, casi siempre en chaparrones a la tarde. De junio a septiembre hace fresco y el agua está fría, pero Beto Carrero abre todo el año y en julio se llena con las vacaciones de invierno.',
      fuente: 'Temperaturas y lluvia: promedios climatológicos 1976-2005 de la estación de Itajaí (Embrapa, Atlas Climático da Região Sul), a 12 km. Agua: promedio de 10 años de seatemperature.info para Itajaí.'
    },
    beaches: [
      { name: 'Praia de Piçarras', zona: 'Centro', lat: -26.7642, lng: -48.6709, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Renato_Soares_Praia_de_Pi%C3%A7arras_da_Barra_Sul_Pi%C3%A7arras_SC_%2839971318455%29.jpg/1280px-Renato_Soares_Praia_de_Pi%C3%A7arras_da_Barra_Sul_Pi%C3%A7arras_SC_%2839971318455%29.jpg', vibe: 'Siete kilómetros de arena ancha y agua tranquila, con la rambla y la desembocadura del río en una punta. Ideal con chicos.', cuando: 'Mañana.' },
      { name: 'Praia Vermelha', zona: 'Penha, 8 km', lat: -26.8041, lng: -48.5971, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/RenatoSoares_PraiaVermelha_Penha_SC_%2840434982784%29.jpg/1280px-RenatoSoares_PraiaVermelha_Penha_SC_%2840434982784%29.jpg', vibe: 'Una playa de Penha rodeada de morros verdes, con agua más clara que la de Piçarras y menos movimiento.', cuando: 'Mañana.' },
      { name: 'Praia da Paciência', zona: 'Penha, 7 km', lat: -26.7748, lng: -48.6006, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Penha-SC_Praia_da_Paci%C3%AAncia.jpg/1280px-Penha-SC_Praia_da_Paci%C3%AAncia.jpg', vibe: 'Una playa chica de Penha, con arena y piedras sueltas, a pocos minutos de la Armação. Hay poca gente fuera de enero.', cuando: 'Mañana.' },
      { name: 'Praia das Palmeiras', zona: 'Norte de Piçarras, 2 km', lat: -26.7425, lng: -48.6773, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Renato_Soares_Praia_de_Palmeiras_Pi%C3%A7arras_SC_%2825992965627%29.jpg/1280px-Renato_Soares_Praia_de_Palmeiras_Pi%C3%A7arras_SC_%2825992965627%29.jpg', vibe: 'La continuación de la playa de Piçarras hacia el norte, hasta la Ponta do Jacques, con casas bajas y menos edificios. Agua tranquila y arena ancha.', cuando: 'Mañana; con marea baja se camina hasta las piedras de la punta.' },
      { name: 'Praia Bacia da Vovó', zona: 'Penha, 3 km', lat: -26.7629, lng: -48.6463, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/RenatoSoares_PraiadaVovo_Penha_SC_%2839337624840%29.jpg/1280px-RenatoSoares_PraiadaVovo_Penha_SC_%2839337624840%29.jpg', vibe: 'Una cala chica de Penha con piedras en el agua y morro verde detrás. El mar es calmo y poco profundo.', cuando: 'Mañana, con marea baja.' },
      { name: 'Praia da Armação do Itapocorói', zona: 'Penha, 7 km', lat: -26.7848, lng: -48.6036, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/RenatoSoares_Arma%C3%A7aodoItapocoroi_Penha_SC_%2840251856275%29.jpg/1280px-RenatoSoares_Arma%C3%A7aodoItapocoroi_Penha_SC_%2840251856275%29.jpg', vibe: 'La bahía de los pescadores de Penha, con barcos fondeados, la capilla de São João Batista y restaurantes de mariscos. Agua quieta, sin olas.', cuando: 'Al mediodía, para almorzar frente al mar.' },
      { name: 'Praia do Grant', zona: 'Barra Velha, 8 km', lat: -26.6945, lng: -48.6817, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Praia_do_Grant_em_Barra_Velha%2C_SC_-_panoramio.jpg/1280px-Praia_do_Grant_em_Barra_Velha%2C_SC_-_panoramio.jpg', vibe: 'Una playa larga y abierta entre Piçarras y Barra Velha, con restinga y pocas construcciones. Tiene más olas que Piçarras.', cuando: 'Mañana; con bandera roja no conviene meterse.' },
      { name: 'Praia do Gravatá', zona: 'Navegantes, 10 km', lat: -26.8416, lng: -48.6296, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Renato_Soares_Praia_do_Gravata_Navegantes_SC_%2839772223480%29.jpg/1280px-Renato_Soares_Praia_do_Gravata_Navegantes_SC_%2839772223480%29.jpg', vibe: 'El extremo norte de Navegantes, junto al morro que la separa de Penha, con olas y vuelo libre desde el morro. Hay edificios sobre la avenida costera.', cuando: 'Tarde, para ver los parapentes.' },
      { name: 'Praia do Tabuleiro', zona: 'Barra Velha, 12 km', lat: -26.658, lng: -48.6853, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Praia_do_Tabuleiro.jpg', vibe: 'Una playa de Barra Velha con rambla, palmeras y costa de piedra en los extremos. Tiene olas moderadas.', cuando: 'Mañana.' }
    ],
    atracciones: [
      { name: 'Beto Carrero World', zona: 'Penha, 8 km', lat: -26.8016, lng: -48.6177, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Novo_Castelo_BCW.jpg/1280px-Novo_Castelo_BCW.jpg', dur: 'Día entero', usd: 60, nota: 'El parque temático más grande de América Latina. Comprá la entrada online: sale más barata.' },
      { name: 'Rambla de Piçarras', zona: 'Centro', lat: -26.7651, lng: -48.6705, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/RenatoSoares_PraiadePi%C3%A7arras_Barne%C3%A1rioPi%C3%A7arras_SC_%2840156409464%29.jpg/1280px-RenatoSoares_PraiadePi%C3%A7arras_Barne%C3%A1rioPi%C3%A7arras_SC_%2840156409464%29.jpg', dur: '1 h', usd: 0, nota: 'Paseo frente al mar con ciclovía y quioscos.' },
      { name: 'Mirante de Penha', zona: 'Penha', dur: '30 min', usd: 0, nota: 'Vista de las calas y las islas desde la ruta costera.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso en la avenida principal.' },
      { name: 'Mariscos de Penha', tipo: 'Cena', zona: 'Armação', usd: 15, momento: 'Noche', nota: 'Penha es productora de mejillones: porciones grandes y baratas.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Playa', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la rambla.' }
    ],
    hacer: [
      { name: 'Ruta por las calas de Penha', zona: 'Penha', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/RenatoSoares_PraiaVermelha_Penha_SC_%2841103275922%29.jpg/1280px-RenatoSoares_PraiaVermelha_Penha_SC_%2841103275922%29.jpg', dur: 'Medio día', usd: 0, nota: 'En auto o bicicleta por la costa, parando en Alegre, Saudade y Vermelha.' },
      { name: 'Bicicleta por la rambla', zona: 'Piçarras', dur: '1 h', usd: 0, nota: 'Ciclovía plana de punta a punta de la playa.' },
      { name: 'Paseo en barco por las islas', zona: 'Armação', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/RenatoSoares_PraiadeArma%C3%A7ao_Penha_SC_%2841103368712%29.jpg/1280px-RenatoSoares_PraiadeArma%C3%A7ao_Penha_SC_%2841103368712%29.jpg', dur: '2 h', usd: 15, nota: 'Recorre las islas frente a Penha.' }
    ],
    tips: [
      { titulo: 'Beto Carrero, temprano', texto: 'Las filas crecen después del mediodía. Llegá a la apertura y empezá por las atracciones grandes.' },
      { titulo: 'Agua calma, no caribeña', texto: 'El agua es calma y templada en verano, pero no transparente: para agua clara, las calas de Penha o Bombinhas.' },
      { titulo: 'Camboriú queda a 40 km', texto: 'Se visita de día. Piçarras es más tranquila y barata para dormir.' }
    ]
  },

  torres: {
    resumen: 'La única playa del Río Grande do Sul con acantilados: tres morros de piedra volcánica sobre el mar, con calas entre ellos y un parque arriba.',
    temporada: { alta: [1, 2], baja: [5, 6, 7, 8, 9, 10, 11], nota: 'La costa gaúcha vive de enero a Carnaval: el agua llega a 22 grados y los pueblos se llenan. Fuera de esas semanas hay viento, agua fría y bastante menos movimiento. En abril o mayo se hace el Festival Internacional de Balonismo.' },
    clima: {
      titulo: 'Clima en Torres mes por mes',
      intro: 'Verano templado y ventoso, invierno fresco. La lluvia se reparte en todo el año.',
      meses: [
        { m: 'Ene', max: 27, min: 21, lluvia: 169, mar: 24.5, demanda: 'alta' },
        { m: 'Feb', max: 28, min: 21, lluvia: 172, mar: 25, demanda: 'alta' },
        { m: 'Mar', max: 27, min: 20, lluvia: 153, mar: 24.5, demanda: 'media' },
        { m: 'Abr', max: 25, min: 18, lluvia: 108, mar: 23.5, demanda: 'media' },
        { m: 'May', max: 22, min: 14, lluvia: 121, mar: 20.5, demanda: 'baja' },
        { m: 'Jun', max: 20, min: 12, lluvia: 103, mar: 18, demanda: 'baja' },
        { m: 'Jul', max: 19, min: 11, lluvia: 122, mar: 16, demanda: 'baja' },
        { m: 'Ago', max: 20, min: 12, lluvia: 126, mar: 16.5, demanda: 'baja' },
        { m: 'Sep', max: 20, min: 14, lluvia: 138, mar: 17.5, demanda: 'baja' },
        { m: 'Oct', max: 22, min: 16, lluvia: 144, mar: 19, demanda: 'baja' },
        { m: 'Nov', max: 24, min: 17, lluvia: 113, mar: 20.5, demanda: 'baja' },
        { m: 'Dic', max: 26, min: 19, lluvia: 115, mar: 22.5, demanda: 'media' }
      ],
      nota: 'Para playa, enero y febrero: es cuando el agua está más tibia y los pueblos tienen movimiento. Marzo sigue cálido y ya con poca gente. De mayo a septiembre hace frío para el mar, sopla viento y muchos lugares cierran, aunque los morros y la Guarita se caminan bien. Llueve parejo todo el año, sin una temporada seca.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 del INMET (estación Torres). Agua: promedio de 10 años de seatemperature.info para Torres.'
    },
    beaches: [
      { name: 'Praia Grande', zona: 'Centro', lat: -29.3366, lng: -49.7228, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Praia-grande-torres-rs.JPG/1280px-Praia-grande-torres-rs.JPG', vibe: 'La playa del centro, larga y con olas, entre los Molhes y el Morro do Farol.', cuando: 'Mañana.' },
      { name: 'Prainha', zona: 'Centro, a pie', lat: -29.3436, lng: -49.7262, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Prainha-torres-rs.JPG/1280px-Prainha-torres-rs.JPG', vibe: 'Una cala chica entre el Morro do Farol y el Morro das Furnas, más protegida del viento.', cuando: 'Mediodía.' },
      { name: 'Praia da Cal', zona: 'Centro', lat: -29.3469, lng: -49.7317, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/PRAIA_DA_CAL_-_panoramio_-_rafael_alexandre_de_%E2%80%A6_%283%29.jpg/1280px-PRAIA_DA_CAL_-_panoramio_-_rafael_alexandre_de_%E2%80%A6_%283%29.jpg', vibe: 'Una cala de surf al pie del Morro das Furnas, con las cuevas en la piedra.', cuando: 'Tarde, para ver el surf.' },
      { name: 'Praia da Guarita', zona: 'Parque da Guarita, 3 km', lat: -29.3579, lng: -49.7336, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Praia_da_Guarita_Torres_RS.jpg/1280px-Praia_da_Guarita_Torres_RS.jpg', vibe: 'Una playa al pie de las torres de piedra, dentro del parque. El agua es fría pero, para muchos, es la playa más linda del estado.', cuando: 'Atardecer.' },
      { name: 'Molhes', zona: 'Norte, en la desembocadura del río', lat: -29.3296, lng: -49.7154, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Molhes_-_Torres_-_Brasil0090.JPG/1280px-Molhes_-_Torres_-_Brasil0090.JPG', vibe: 'La escollera del río Mampituba, frontera con Santa Catarina. Pescadores y surfistas.', cuando: 'Tarde.' },
      { name: 'Itapeva', zona: 'Sur, 4 km', lat: -29.3702, lng: -49.7465, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Praia_de_Itapeva_no_Parque_Estadual_de_Itapeva.jpg/1280px-Praia_de_Itapeva_no_Parque_Estadual_de_Itapeva.jpg', vibe: 'Playa larga con dunas y un parque estatal detrás. Sin edificios.', cuando: 'Día entero.' },
      { name: 'Praia da Gaivota', zona: 'Balneário Gaivota (SC), 25 km', lat: -29.1613, lng: -49.5775, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Balne%C3%A1rio_Gaivota.jpg/1280px-Balne%C3%A1rio_Gaivota.jpg', vibe: 'Una playa recta y abierta al norte del río Mampituba, del lado de Santa Catarina, con casas de veraneo y garitas de guardavidas. Olas y viento como en toda esta costa.', cuando: 'Atardecer.' },
      { name: 'Arroio do Sal', zona: 'Arroio do Sal, 28 km', lat: -29.5519, lng: -49.8853, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Arroio_do_Sal2.jpg/1280px-Arroio_do_Sal2.jpg', vibe: 'La playa del pueblo de Arroio do Sal, ancha y recta, con dunas y edificios bajos. Más tranquila que Torres y Capão.', cuando: 'Mañana; a la tarde suele soplar el viento del noreste.' }
    ],
    atracciones: [
      { name: 'Parque da Guarita', zona: 'Sur del centro', lat: -29.3544, lng: -49.7329, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/78bguarita.jpg/1280px-78bguarita.jpg', dur: '2 h', usd: 0, nota: 'Las torres de piedra que dan nombre a la ciudad, con senderos y miradores sobre el mar.' },
      { name: 'Morro do Farol', zona: 'Centro', lat: -29.3462, lng: -49.7293, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Renato_Soares_Morro_do_Farol_e_Prainha_Torres_RS_%2840185087744%29.jpg/1280px-Renato_Soares_Morro_do_Farol_e_Prainha_Torres_RS_%2840185087744%29.jpg', dur: '40 min', usd: 0, nota: 'El cerro del faro, con vista a la Praia Grande y al mar. Se sube a pie o en auto.' },
      { name: 'Ilha dos Lobos', zona: 'Frente a la Praia Grande', lat: -29.3469, lng: -49.7041, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Ilhadoslobostorres.jpg/1280px-Ilhadoslobostorres.jpg', dur: '20 min', usd: 0, nota: 'La isla de los lobos marinos, refugio de vida silvestre. Se ve desde los morros; no se desembarca.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la playa.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Rambla', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la Praia Grande.' },
      { name: 'Tainha asada', tipo: 'Cena', zona: 'Restaurantes del río', usd: 14, momento: 'Noche', nota: 'El pescado de la costa, asado entero.' }
    ],
    hacer: [
      { name: 'Caminata por los tres morros', zona: 'Centro → Guarita', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Parque_da_Guarita_visto_a_partir_do_Morro_do_Farol_em_Torres_-_RS.jpg/1280px-Parque_da_Guarita_visto_a_partir_do_Morro_do_Farol_em_Torres_-_RS.jpg', dur: '3 h', usd: 0, nota: 'Del Morro do Farol a la Guarita por la costa, pasando las calas.' },
      { name: 'Barco a la Ilha dos Lobos', zona: 'Sale del río', dur: '1 h 30', usd: 15, nota: 'Paseo alrededor de la isla para ver lobos marinos. No desembarca.' },
      { name: 'Vuelo en globo', zona: 'Festival de Balonismo', foto: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/BALONISMO_EM_TORRES_-_panoramio.jpg', dur: '1 h', usd: 150, nota: 'En la época del festival hay vuelos para el público.' }
    ],
    tips: [
      { titulo: 'El viento sur manda', texto: 'Con viento sur el agua se enfría y la playa se vacía. Para ese día, la Prainha es la más protegida.' },
      { titulo: 'Fuera de temporada, tranquilo', texto: 'Fuera del verano baja el movimiento y algunos comercios de playa cierran. La ciudad es tranquila y los precios bajan.' },
      { titulo: 'Santa Catarina al lado', texto: 'Cruzando el río está Passo de Torres, en Santa Catarina, con playas más tranquilas.' }
    ]
  },

  canoa: {
    resumen: 'El balneario familiar de la costa gaúcha: playa recta y larga y lagunas de agua dulce a pocos kilómetros.',
    temporada: { alta: [1, 2], baja: [4, 5, 6, 7, 8, 9, 10, 11], nota: 'La costa gaúcha vive de enero a Carnaval: el agua llega a 22 grados y los pueblos se llenan. Fuera de esas semanas hay viento, agua fría y bastante menos movimiento.' },
    clima: {
      titulo: 'Clima en Capão da Canoa mes por mes',
      intro: 'Verano templado y ventoso, invierno fresco. Fuera de enero y febrero, la costa está tranquila.',
      meses: [
        { m: 'Ene', max: 27, min: 21, lluvia: 169, mar: 24.5, demanda: 'alta' },
        { m: 'Feb', max: 28, min: 21, lluvia: 172, mar: 25, demanda: 'alta' },
        { m: 'Mar', max: 27, min: 20, lluvia: 153, mar: 24.5, demanda: 'media' },
        { m: 'Abr', max: 25, min: 18, lluvia: 108, mar: 23, demanda: 'baja' },
        { m: 'May', max: 22, min: 14, lluvia: 121, mar: 20.5, demanda: 'baja' },
        { m: 'Jun', max: 20, min: 12, lluvia: 103, mar: 17.5, demanda: 'baja' },
        { m: 'Jul', max: 19, min: 11, lluvia: 122, mar: 16, demanda: 'baja' },
        { m: 'Ago', max: 20, min: 12, lluvia: 126, mar: 16, demanda: 'baja' },
        { m: 'Sep', max: 20, min: 14, lluvia: 138, mar: 17, demanda: 'baja' },
        { m: 'Oct', max: 22, min: 16, lluvia: 144, mar: 19, demanda: 'baja' },
        { m: 'Nov', max: 24, min: 17, lluvia: 113, mar: 20.5, demanda: 'baja' },
        { m: 'Dic', max: 26, min: 19, lluvia: 115, mar: 22.5, demanda: 'media' }
      ],
      nota: 'La temporada de playa es enero y febrero, hasta Carnaval: agua más tibia, quioscos abiertos y precios altos. En marzo todavía hace calor y hay mucha menos gente. De mayo a septiembre el agua está fría y sopla el viento, mejor para kitesurf en la laguna que para playa. Llueve parejo todo el año.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 del INMET, estación Torres (a 50 km, la normal oficial más cercana sobre la costa). Agua: promedio de 10 años de seatemperature.info para Capão da Canoa.'
    },
    beaches: [
      { name: 'Capão da Canoa', zona: 'Centro', lat: -29.7377, lng: -50.0202, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Cap%C3%A3o_da_Canoa.JPG/1280px-Cap%C3%A3o_da_Canoa.JPG', vibe: 'La playa del centro, recta y ancha, con la rambla, los quioscos y el movimiento de las familias.', cuando: 'Mañana.' },
      { name: 'Atlântida', zona: 'Xangri-lá, 7 km', lat: -29.7849, lng: -50.025, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Plataforma_Mar%C3%ADtima_de_Atl%C3%A2ntida_20260107_%2803%29.jpg/1280px-Plataforma_Mar%C3%ADtima_de_Atl%C3%A2ntida_20260107_%2803%29.jpg', vibe: 'La playa joven, con fiestas y beach clubs en verano.', cuando: 'Tarde y noche.' },
      { name: 'Xangri-lá', zona: 'Sur, 9 km', lat: -29.805, lng: -50.031, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Praia_de_xangri_la_-_3.jpg/1280px-Praia_de_xangri_la_-_3.jpg', vibe: 'Playa de condominios, más ordenada y con buena infraestructura.', cuando: 'Mañana.' },
      { name: 'Lagoa dos Quadros', zona: 'Oeste, 10 km', lat: -29.71, lng: -50.1, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Lagoa_dos_Quadros.JPG/1280px-Lagoa_dos_Quadros.JPG', vibe: 'Una laguna enorme de agua dulce, buena para kitesurf y windsurf.', cuando: 'Tarde, con viento.' },
      { name: 'Atlântida Sul', zona: 'Osório, 14 km', lat: -29.8706, lng: -50.0691, foto: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Praia-atlantida-sul.jpg', vibe: 'El balneario de Osório al sur de Xangri-lá, con casas de veraneo y la escultura de la rosa de los vientos frente al mar. Poca gente fuera de enero.', cuando: 'Mañana.' },
      { name: 'Imbé', zona: 'Imbé, 25 km', lat: -29.9641, lng: -50.1138, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Pessoas_na_praia_de_Imb%C3%A9.jpg/1280px-Pessoas_na_praia_de_Imb%C3%A9.jpg', vibe: 'La playa de Imbé, junto a la desembocadura del río Tramandaí, con arena ancha y guardavidas en verano. En la barra se juntan los pescadores.', cuando: 'Tarde, en la barra del río.' },
      { name: 'Arroio do Sal', zona: 'Norte, 26 km', lat: -29.5519, lng: -49.8853, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Arroio_do_Sal2.jpg/1280px-Arroio_do_Sal2.jpg', vibe: 'La playa del pueblo de Arroio do Sal, ancha y recta, con dunas y edificios bajos. Más tranquila que Capão.', cuando: 'Mañana.' }
    ],
    atracciones: [
      { name: 'Rambla de Capão', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Paseo frente al mar con quioscos y ferias de verano.' },
      { name: 'Feria de artesanía', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Feria nocturna de verano en la plaza central.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso en la avenida principal.' },
      { name: 'Pastel', tipo: 'Merienda', zona: 'Rambla', usd: 3, momento: 'Tarde', nota: 'Pastel frito en los quioscos.' },
      { name: 'Churrasco', tipo: 'Cena', zona: 'Churrascarías', usd: 18, momento: 'Noche', nota: 'Rodizio de carne al estilo gaúcho.' }
    ],
    hacer: [
      { name: 'Kitesurf en la laguna', zona: 'Lagoa dos Quadros', dur: '3 h', usd: 50, nota: 'Agua dulce, plana y con viento: buena para aprender.' },
      { name: 'Bicicleta por la costa', zona: 'Centro → Atlântida', dur: '2 h', usd: 0, nota: 'Por la avenida costera, de Capão a Atlântida.' }
    ],
    tips: [
      { titulo: 'Agua marrón, no sucia', texto: 'El agua es oscura por los sedimentos que trae el mar. Es limpia: no esperes agua transparente.' },
      { titulo: 'Fuera del verano, pueblo tranquilo', texto: 'Fuera del verano baja mucho el movimiento y varios comercios cierran.' },
      { titulo: 'Torres queda cerca', texto: 'Torres, con sus acantilados, está a 60 km: se visita de día.' }
    ]
  },

  rec: {
    resumen: 'La Venecia brasileña, con ríos y puentes en el centro y una playa urbana larga protegida por arrecifes. Olinda colonial queda a veinte minutos.',
    temporada: { alta: [1, 2, 12], baja: [4, 5, 6, 8], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días. De septiembre a marzo hay sol y mar claro; diciembre, enero y febrero son los meses más caros. El Carnaval de Recife y Olinda es de los más grandes del país.' },
    clima: {
      titulo: 'Clima en Recife mes por mes',
      intro: 'Recife tiene calor parejo todo el año. La diferencia está en la lluvia: de abril a julio llueve mucho.',
      meses: [
        { m: 'Ene', max: 31, min: 23, lluvia: 107, mar: 28, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 23, lluvia: 127, mar: 28.5, demanda: 'alta' },
        { m: 'Mar', max: 31, min: 23, lluvia: 197, mar: 29, demanda: 'media' },
        { m: 'Abr', max: 30, min: 23, lluvia: 269, mar: 29, demanda: 'baja' },
        { m: 'May', max: 30, min: 22, lluvia: 317, mar: 28.5, demanda: 'baja' },
        { m: 'Jun', max: 29, min: 22, lluvia: 391, mar: 27.5, demanda: 'baja' },
        { m: 'Jul', max: 28, min: 21, lluvia: 315, mar: 26.5, demanda: 'media' },
        { m: 'Ago', max: 28, min: 21, lluvia: 187, mar: 26.5, demanda: 'baja' },
        { m: 'Sep', max: 29, min: 22, lluvia: 93, mar: 26.5, demanda: 'media' },
        { m: 'Oct', max: 30, min: 22, lluvia: 53, mar: 27, demanda: 'media' },
        { m: 'Nov', max: 30, min: 23, lluvia: 39, mar: 27.5, demanda: 'media' },
        { m: 'Dic', max: 31, min: 23, lluvia: 62, mar: 27.5, demanda: 'alta' }
      ],
      nota: 'Para playa y paseos con sol: de septiembre a febrero; octubre y noviembre son los meses más secos y con precios todavía bajos. De abril a julio llueve fuerte casi todos los días. En Carnaval, Recife y Olinda se llenan y los precios suben mucho.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 del INMET (estación Recife-Curado). Agua: promedio de seatemperature.info.'
    },
    beaches: [
      { name: 'Boa Viagem', zona: 'Zona sur, 8 km', lat: -8.1276, lng: -34.8977, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Cal%C3%A7ad%C3%A3o_e_ciclovia_da_Praia_de_Boa_Viagem_-_Recife%2C_Pernambuco%2C_Brasil.jpg/1280px-Cal%C3%A7ad%C3%A3o_e_ciclovia_da_Praia_de_Boa_Viagem_-_Recife%2C_Pernambuco%2C_Brasil.jpg', vibe: 'La playa urbana, con siete kilómetros de rambla y piscinas naturales en el arrecife con marea baja.', cuando: 'Marea baja, de mañana.' },
      { name: 'Pina', zona: 'Zona sur, 4 km', lat: -8.0945, lng: -34.8817, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/2022-05-_16_Praia_do_Pina%2C_Recife_-_Pernambuco.jpg/1280px-2022-05-_16_Praia_do_Pina%2C_Recife_-_Pernambuco.jpg', vibe: 'La continuación de Boa Viagem hacia el centro, con quioscos y menos edificios.', cuando: 'Tarde.' },
      { name: 'Piedade', zona: 'Jaboatão, 13 km', lat: -8.17, lng: -34.915, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/PE_-_Jaboat%C3%A3o_dos_Guararapes_-_Praia_de_Piedade_1.jpg/1280px-PE_-_Jaboat%C3%A3o_dos_Guararapes_-_Praia_de_Piedade_1.jpg', vibe: 'Playa larga con arrecife, más tranquila que Boa Viagem. Tiene el mismo aviso de tiburones: no nades más allá del arrecife.', cuando: 'Mañana.' },
      { name: 'Candeias', zona: 'Jaboatão, 17 km', lat: -8.205, lng: -34.923, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Praia_de_Candeias.jpg/1280px-Praia_de_Candeias.jpg', vibe: 'Piscinas naturales y quioscos, con gente del lugar. Tiene el mismo aviso de tiburones que Boa Viagem.', cuando: 'Marea baja.' },
      { name: 'Carmo', zona: 'Olinda, 7 km', lat: -8.012, lng: -34.845, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Praia_do_Carmo_e_Fortim_do_Queijo_-_panoramio.jpg/960px-Praia_do_Carmo_e_Fortim_do_Queijo_-_panoramio.jpg', vibe: 'La playa al pie de la ciudad histórica de Olinda, con la iglesia del Carmo enfrente.', cuando: 'Tarde, combinada con Olinda.' },
      { name: 'Barra de Jangada', zona: 'Jaboatão, 20 km al sur', lat: -8.2207, lng: -34.925, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Praia_de_Barra_de_Jangada_-_Jaboat%C3%A3o_dos_Guararapes_03.jpg/1280px-Praia_de_Barra_de_Jangada_-_Jaboat%C3%A3o_dos_Guararapes_03.jpg', vibe: 'La playa donde el río Jaboatão llega al mar, al final de la costa sur de la región. Agua calma en la desembocadura, kioscos y paseos en barco por el río.', cuando: 'Tarde; con marea baja se forman bancos de arena.' },
      { name: 'Praia do Paiva', zona: 'Cabo de Santo Agostinho, 25 km al sur', lat: -8.2395, lng: -34.9384, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_do_Paiva_-_PE_-_panoramio.jpg/1280px-Praia_do_Paiva_-_PE_-_panoramio.jpg', vibe: 'Una playa larga y abierta, con barrios cerrados y poca construcción sobre la arena. Tiene olas y mucho espacio libre.', cuando: 'Mañana; se llega en auto por el puente de Barra de Jangada.' },
      { name: 'Pau Amarelo', zona: 'Paulista, 20 km al norte', lat: -7.9106, lng: -34.8226, foto: 'https://upload.wikimedia.org/wikipedia/commons/4/40/Forte_de_Pau_Amarelo_Paulista_PE.jpg', vibe: 'Una playa de pescadores con un fuerte del siglo XVIII sobre la arena y arrecifes que calman el agua. De acá salen jangadas a las piscinas naturales.', cuando: 'Marea baja.' },
      { name: 'Maria Farinha', zona: 'Paulista, 27 km al norte', lat: -7.8612, lng: -34.8346, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Pontal_de_Maria_Farinha_vista_frontal.jpg/1280px-Pontal_de_Maria_Farinha_vista_frontal.jpg', vibe: 'Una punta de arena entre el mar y el canal de Santa Cruz, con agua calma, bares y lanchas. De acá salen los barcos a la Coroa do Avião.', cuando: 'Marea baja, de mañana.' },
      { name: 'Coroa do Avião', zona: 'Igarassu, en barco desde Maria Farinha', lat: -7.8174, lng: -34.8358, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Coroa_do_Avi%C3%A3o_-_panoramio.jpg/1280px-Coroa_do_Avi%C3%A3o_-_panoramio.jpg', vibe: 'Un islote de arena en la boca del canal de Santa Cruz, con kioscos de pescado y agua calma alrededor. Solo se llega en barco.', cuando: 'Marea baja, cuando la isla está más grande.' },
      { name: 'Forte Orange', zona: 'Ilha de Itamaracá, 45 km al norte', lat: -7.8104, lng: -34.8387, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Forte_Orange%2C_Itamaraca.jpg/1280px-Forte_Orange%2C_Itamaraca.jpg', vibe: 'La playa frente al fuerte holandés de 1631, con agua calma y la Coroa do Avião enfrente. Hay kioscos y barcos que cruzan al islote.', cuando: 'Marea baja, combinada con la visita al fuerte.' }
    ],
    atracciones: [
      { name: 'Olinda', zona: '7 km al norte', lat: -8.0136, lng: -34.8502, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/View_from_Alto_da_Se_-_Olinda_-_Outside_Recife_-_Brazil.jpg/1280px-View_from_Alto_da_Se_-_Olinda_-_Outside_Recife_-_Brazil.jpg', dur: '3 h', usd: 0, nota: 'Ciudad colonial patrimonio de la humanidad, con iglesias sobre colinas y vista al mar.' },
      { name: 'Recife Antigo', zona: 'Centro', lat: -8.0634, lng: -34.871, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Bairro_de_Recife_Antigo_com_Marco_Zero.jpg/1280px-Bairro_de_Recife_Antigo_com_Marco_Zero.jpg', dur: '2 h', usd: 0, nota: 'La isla del centro histórico, con la sinagoga más antigua de América y el Marco Zero.' },
      { name: 'Instituto Ricardo Brennand', zona: 'Várzea', lat: -8.0615, lng: -34.971, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/Instituto_Ricardo_Brennand_1.jpg/1280px-Instituto_Ricardo_Brennand_1.jpg', dur: '2 h', usd: 10, nota: 'Un castillo con colección de arte, armas y la mayor colección de pinturas de Frans Post.' },
      { name: 'Oficina Brennand', zona: 'Várzea', lat: -8.0525, lng: -34.9742, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Oficina_Cer%C3%A2mica_Francisco_Brennand_08.jpg/1280px-Oficina_Cer%C3%A2mica_Francisco_Brennand_08.jpg', dur: '1 h 30', usd: 10, nota: 'Taller-museo del ceramista Francisco Brennand, en una antigua fábrica.' }
    ],
    comer: [
      { name: 'Tapioca de Olinda', tipo: 'Merienda', zona: 'Alto da Sé', usd: 3, momento: 'Tarde', nota: 'Las tapioqueiras del Alto da Sé, con vista a Recife.' },
      { name: 'Bolo de rolo', tipo: 'Postre', zona: 'Panaderías', usd: 3, momento: 'Tarde', nota: 'Bizcocho finísimo enrollado con dulce de guayaba. Patrimonio de Pernambuco.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Boa Viagem', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la rambla.' },
      { name: 'Carne de sol', tipo: 'Cena', zona: 'Restaurantes regionales', usd: 14, momento: 'Noche', nota: 'Con mandioca y queso coalho (queso de la zona, a la plancha).' }
    ],
    hacer: [
      { name: 'Paseo de catamarán por los ríos', zona: 'Recife Antigo', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Catamar%C3%A3_sobre_o_Rio_Capibaribe_-_Recife%2C_Pernambuco%2C_Brasil.jpg/1280px-Catamar%C3%A3_sobre_o_Rio_Capibaribe_-_Recife%2C_Pernambuco%2C_Brasil.jpg', dur: '1 h', usd: 12, nota: 'Recorre los ríos y puentes del centro. Al atardecer es el mejor horario.' },
      { name: 'Marco Zero y Parque das Esculturas', zona: 'Recife Antigo', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/BRUNO_LIMA_PARQUE_DAS_ESCULTURAS_FRANCISCO_BRENNAND_RECIFE_PE.jpg/1280px-BRUNO_LIMA_PARQUE_DAS_ESCULTURAS_FRANCISCO_BRENNAND_RECIFE_PE.jpg', dur: '1 h', usd: 3, nota: 'Barco corto desde el Marco Zero hasta las esculturas de Brennand sobre el arrecife.' },
      { name: 'Paço do Frevo', zona: 'Recife Antigo', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/2016_-_Pa%C3%A7o_do_Frevo_-_Recife_-_Pernambuco.jpg/1280px-2016_-_Pa%C3%A7o_do_Frevo_-_Recife_-_Pernambuco.jpg', dur: '1 h', usd: 3, nota: 'Museo del frevo, la música del Carnaval de Recife.' }
    ],
    tips: [
      { titulo: 'Tiburones en Boa Viagem', texto: 'Hay carteles y es en serio: no nades más allá del arrecife ni con marea alta. Con marea baja, el riesgo es mucho menor dentro de las piscinas del arrecife.' },
      { titulo: 'Olinda de día, en grupo', texto: 'Las calles son empinadas y solitarias fuera del centro. Recorrela de día y con guía local si podés.' },
      { titulo: 'Porto de Galinhas queda a una hora', texto: 'Muchos se alojan en Recife y van de día a Porto de Galinhas.' }
    ]
  },

  joaopessoa: {
    resumen: 'La capital más tranquila del Nordeste, con playas urbanas sin edificios altos sobre la orilla y piscinas naturales en el mar a pocos minutos.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros: julio cae en la época de lluvias, pero se encarece por las vacaciones de invierno.' },
    clima: {
      titulo: 'Clima en João Pessoa mes por mes',
      intro: 'João Pessoa tiene calor parejo todo el año. Lo que cambia es la lluvia, que se concentra entre abril y julio.',
      meses: [
        { m: 'Ene', max: 31, min: 25, lluvia: 86, mar: 29.5, demanda: 'alta' },
        { m: 'Feb', max: 31, min: 25, lluvia: 106, mar: 29.5, demanda: 'alta' },
        { m: 'Mar', max: 31, min: 25, lluvia: 172, mar: 30, demanda: 'baja' },
        { m: 'Abr', max: 31, min: 24, lluvia: 236, mar: 30, demanda: 'baja' },
        { m: 'May', max: 30, min: 23, lluvia: 288, mar: 29, demanda: 'baja' },
        { m: 'Jun', max: 29, min: 22, lluvia: 369, mar: 28, demanda: 'baja' },
        { m: 'Jul', max: 29, min: 22, lluvia: 285, mar: 27, demanda: 'alta' },
        { m: 'Ago', max: 29, min: 22, lluvia: 134, mar: 27, demanda: 'media' },
        { m: 'Sep', max: 29, min: 23, lluvia: 74, mar: 27, demanda: 'media' },
        { m: 'Oct', max: 30, min: 24, lluvia: 31, mar: 27.5, demanda: 'media' },
        { m: 'Nov', max: 31, min: 25, lluvia: 21, mar: 28.5, demanda: 'media' },
        { m: 'Dic', max: 31, min: 25, lluvia: 37, mar: 29, demanda: 'alta' }
      ],
      nota: 'Para playa y para las piscinas naturales: de septiembre a febrero, con poca lluvia y mar claro; octubre y noviembre son los más secos y todavía no es temporada alta. De abril a julio llueve fuerte casi todos los días, y junio es el mes más lluvioso. Julio igual se encarece por las vacaciones de invierno.',
      fuente: 'Temperaturas y lluvia: normales climatológicas INMET 1991-2020 (estación João Pessoa). Temperatura del mar: promedio mensual 2022-2025 del modelo marino de Open-Meteo frente a la costa de João Pessoa.'
    },
    beaches: [
      { name: 'Tambaú', zona: 'Centro de la orla', lat: -7.1153, lng: -34.8223, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Tamba%C3%BA_beach_-_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Tamba%C3%BA_beach_-_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'La playa principal, con la rambla, la feria de artesanía y los barcos que salen a Picãozinho.', cuando: 'Mañana.' },
      { name: 'Cabo Branco', zona: 'Sur de la orla', lat: -7.1329, lng: -34.8207, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Trecho_final_da_Avenida_Cabo_Branco%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Trecho_final_da_Avenida_Cabo_Branco%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'Una rambla larga con ciclovía y el acantilado del Cabo Branco en la punta.', cuando: 'Atardecer.' },
      { name: 'Manaíra', zona: 'Norte de la orla', lat: -7.1043, lng: -34.8293, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Jo%C3%A3o-Pessoa-Praia-Mana%C3%ADra-Tamba%C3%BA.jpg/1280px-Jo%C3%A3o-Pessoa-Praia-Mana%C3%ADra-Tamba%C3%BA.jpg', vibe: 'Agua calma, quioscos y la gente del barrio.', cuando: 'Tarde.' },
      { name: 'Seixas', zona: 'Ponta do Seixas', lat: -7.154, lng: -34.7935, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Piscinas_do_Seixas%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Piscinas_do_Seixas%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'El punto más oriental de las Américas, con piscinas naturales en el arrecife.', cuando: 'Amanecer: el primer amanecer de América continental.' },
      { name: 'Bessa', zona: 'Norte', lat: -7.0767, lng: -34.8297, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Praia_do_Bessa%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Praia_do_Bessa%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'Playa tranquila de casas bajas, con piscinas naturales con marea baja.', cuando: 'Marea baja.' },
      { name: 'Areia Vermelha', zona: 'Cabedelo, en barco', lat: -6.99, lng: -34.818, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Areia_Vermelha_-_Jo%C3%A3o_Pessoa_-_Brasil_%2833361214950%29.jpg/1280px-Areia_Vermelha_-_Jo%C3%A3o_Pessoa_-_Brasil_%2833361214950%29.jpg', vibe: 'Un banco de arena rojiza que aparece en el medio del mar con la marea baja.', cuando: 'Marea baja, en el paseo de barco.' },
      { name: 'Coqueirinho', zona: 'Conde, 25 km', lat: -7.286, lng: -34.803, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Coqueirinho_-_Jo%C3%A3o_Pessoa_-_Para%C3%ADba._%2815936351197%29.jpg/1280px-Coqueirinho_-_Jo%C3%A3o_Pessoa_-_Para%C3%ADba._%2815936351197%29.jpg', vibe: 'Acantilados de colores, cocoteros y agua calma. Una de las playas más lindas de Paraíba.', cuando: 'Día entero.' },
      { name: 'Intermares', zona: 'Cabedelo, 13 km', lat: -7.0466, lng: -34.8413, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Praia_de_Intermares_-_Cabedelo_%28PB%29.jpg/1280px-Praia_de_Intermares_-_Cabedelo_%28PB%29.jpg', vibe: 'Playa abierta de Cabedelo, con olas y viento que atraen surf y kitesurf. Tiene menos edificios que las playas de João Pessoa.', cuando: 'Tarde.' },
      { name: 'Camboinha', zona: 'Cabedelo, 16 km', lat: -7.0068, lng: -34.826, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Praia_de_Camboinha%2C_Cabedelo_%28PB%29.jpg/1280px-Praia_de_Camboinha%2C_Cabedelo_%28PB%29.jpg', vibe: 'Playa calma de casas de veraneo, de donde salen los barcos a la Areia Vermelha. Con marea baja el arrecife forma piscinas.', cuando: 'Marea baja.' },
      { name: 'Penha', zona: 'Sur, 12 km', lat: -7.169, lng: -34.7959, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Praia_da_Penha%2C_em_Jo%C3%A3o_Pessoa%2C_na_Para%C3%ADba.jpg/1280px-Praia_da_Penha%2C_em_Jo%C3%A3o_Pessoa%2C_na_Para%C3%ADba.jpg', vibe: 'Playa de pescadores con el santuario de Nossa Senhora da Penha arriba, al que se sube por una escalinata. Con marea baja el arrecife deja piscinas de agua calma.', cuando: 'Marea baja, de mañana.' },
      { name: 'Jacarapé', zona: 'Sur, 15 km', lat: -7.1964, lng: -34.7959, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Praia_de_Jacarap%C3%AA_em_Jo%C3%A3o_Pessoa.jpg/1280px-Praia_de_Jacarap%C3%AA_em_Jo%C3%A3o_Pessoa.jpg', vibe: 'Playa casi sin construcciones entre acantilados y la boca del río Jacarapé, al sur de la Penha. Es tranquila y se llega en auto.', cuando: 'Mañana.' },
      { name: 'Jacumã', zona: 'Conde, 22 km', lat: -7.2839, lng: -34.7997, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Praia_de_Jacum%C3%A3.jpg/1280px-Praia_de_Jacum%C3%A3.jpg', vibe: 'La playa del pueblo de Jacumã, con acantilados de colores, barracas y piscinas en el arrecife. Es la base para recorrer la costa sur.', cuando: 'Marea baja.' },
      { name: 'Carapibus', zona: 'Conde, 23 km', lat: -7.2994, lng: -34.7991, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/PraiaCarapibusVista.jpg/1280px-PraiaCarapibusVista.jpg', vibe: 'Una ensenada con arrecifes de piedra oscura y agua calma, entre Jacumã y Tabatinga. Tiene pocas barracas.', cuando: 'Marea baja.' },
      { name: 'Tabatinga', zona: 'Conde, 24 km', lat: -7.3148, lng: -34.802, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Praia_de_Tabatinga_na_Paraiba.jpg/1280px-Praia_de_Tabatinga_na_Paraiba.jpg', vibe: 'Una bahía cerrada por acantilados rojos, con agua calma y mirador arriba. Con marea baja el arrecife forma piscinas.', cuando: 'Marea baja.' },
      { name: 'Tambaba', zona: 'Conde, 30 km', lat: -7.3656, lng: -34.7979, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Tambaba_01.jpg/1280px-Tambaba_01.jpg', vibe: 'Playa nudista oficial en su parte sur; la parte norte, con la piedra del cocotero, es de uso libre. Acantilados, arrecifes y agua clara.', cuando: 'Mañana, con marea baja.' }
    ],
    atracciones: [
      { name: 'Farol do Cabo Branco', zona: 'Cabo Branco', lat: -7.1488, lng: -34.7966, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Apr2024._Cabo_Branco_Lighthouse_aka_Farol_do_Cabo_Branco%2C_Jo%C3%A3o_Pessoa%2C_state_of_Para%C3%ADba%2C_Brazil._03.jpg/1280px-Apr2024._Cabo_Branco_Lighthouse_aka_Farol_do_Cabo_Branco%2C_Jo%C3%A3o_Pessoa%2C_state_of_Para%C3%ADba%2C_Brazil._03.jpg', dur: '40 min', usd: 0, nota: 'El faro sobre el acantilado, con la Estação Cabo Branco de Niemeyer al lado.' },
      { name: 'Centro histórico', zona: 'Centro', lat: -7.1135, lng: -34.8885, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Centro_Hist%C3%B3rico_de_Jo%C3%A3o_Pessoa_PB.jpg/1280px-Centro_Hist%C3%B3rico_de_Jo%C3%A3o_Pessoa_PB.jpg', dur: '2 h', usd: 0, nota: 'Iglesias barrocas como la de São Francisco, de las más ricas del Nordeste.' },
      { name: 'Praia do Jacaré', zona: 'Cabedelo', lat: -7.0362, lng: -34.8552, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/P%C3%B4r_do_sol_na_praia_fluvial_do_Jacar%C3%A9_-_Cabedelo_%28PB%29.jpg/1280px-P%C3%B4r_do_sol_na_praia_fluvial_do_Jacar%C3%A9_-_Cabedelo_%28PB%29.jpg', dur: '1 h', usd: 0, nota: 'El atardecer con el Bolero de Ravel tocado en saxo desde un barco en el río.' }
    ],
    comer: [
      { name: 'Tapioca de la orla', tipo: 'Desayuno', zona: 'Tambaú', usd: 3, momento: 'Mañana', nota: 'En los puestos de la rambla.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Manaíra', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato.' },
      { name: 'Caranguejo', tipo: 'Cena', zona: 'Bares de la orla', usd: 14, momento: 'Noche', nota: 'Cangrejo con martillito, para compartir.' }
    ],
    hacer: [
      { name: 'Barco a Picãozinho', zona: 'Sale de Tambaú', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Pic%C3%A3ozinho%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Pic%C3%A3ozinho%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg', dur: '2 h', usd: 15, nota: 'Piscinas naturales en el arrecife frente a la playa, solo con marea baja.' },
      { name: 'Atardecer en el Jacaré', zona: 'Cabedelo', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/P%C3%B4r_do_Sol_-_Praia_do_Jacar%C3%A9_-_Cabedelo_-_Para%C3%ADba_%2815927806544%29.jpg/1280px-P%C3%B4r_do_Sol_-_Praia_do_Jacar%C3%A9_-_Cabedelo_-_Para%C3%ADba_%2815927806544%29.jpg', dur: '1 h 30', usd: 0, nota: 'El Bolero de Ravel en saxo mientras baja el sol.' },
      { name: 'Excursión a la costa sur', zona: 'Conde', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Praia_de_Tabatinga_na_Paraiba.jpg/1280px-Praia_de_Tabatinga_na_Paraiba.jpg', dur: 'Día entero', usd: 25, nota: 'Coqueirinho, Tabatinga y Tambaba en buggy o 4x4.' }
    ],
    tips: [
      { titulo: 'Marea baja para todo', texto: 'Picãozinho, Areia Vermelha y el Seixas dependen de la marea baja. Mirá la tabla del día.' },
      { titulo: 'Rambla segura', texto: 'La orla está iluminada y con movimiento de noche. Es de las capitales más tranquilas del Nordeste.' },
      { titulo: 'Sin edificios en la orilla', texto: 'Por ley no hay edificios altos frente al mar: la playa tiene sol toda la tarde.' }
    ]
  },

  portoseguro: {
    resumen: 'La ciudad donde llegaron los portugueses: centro histórico en lo alto, playas de barracas con música al norte y Arraial d’Ajuda cruzando el río.',
    temporada: { alta: [1, 2, 7, 12], baja: [3, 4, 5, 6, 8, 9, 10, 11], nota: 'De abril a junio llueve más. En julio llegan los grupos de estudiantes y en verano las barracas de playa tienen show todo el día. Septiembre a noviembre es lo más tranquilo.' },
    clima: {
      titulo: 'Clima en Porto Seguro mes por mes',
      intro: 'Porto Seguro tiene calor todo el año. Lo que cambia es la lluvia y cuánta gente hay en las barracas.',
      meses: [
        { m: 'Ene', max: 29, min: 24, lluvia: 88, mar: 26.5, demanda: 'alta' },
        { m: 'Feb', max: 29, min: 24, lluvia: 75, mar: 27, demanda: 'alta' },
        { m: 'Mar', max: 29, min: 24, lluvia: 81, mar: 27, demanda: 'baja' },
        { m: 'Abr', max: 28, min: 23, lluvia: 163, mar: 27, demanda: 'baja' },
        { m: 'May', max: 27, min: 22, lluvia: 138, mar: 26.5, demanda: 'baja' },
        { m: 'Jun', max: 26, min: 21, lluvia: 122, mar: 25.5, demanda: 'baja' },
        { m: 'Jul', max: 25, min: 20, lluvia: 85, mar: 25, demanda: 'alta' },
        { m: 'Ago', max: 25, min: 20, lluvia: 91, mar: 25, demanda: 'baja' },
        { m: 'Sep', max: 26, min: 22, lluvia: 74, mar: 25, demanda: 'baja' },
        { m: 'Oct', max: 27, min: 23, lluvia: 95, mar: 25.5, demanda: 'baja' },
        { m: 'Nov', max: 28, min: 23, lluvia: 203, mar: 25.5, demanda: 'baja' },
        { m: 'Dic', max: 29, min: 23, lluvia: 156, mar: 26, demanda: 'alta' }
      ],
      nota: 'Para playa, de enero a marzo hay más sol y el agua más tibia, pero en verano está lleno y caro. Septiembre y octubre tienen poca lluvia, precios bajos y menos gente. Noviembre es el mes más lluvioso; en julio hace menos calor y llegan los grupos de estudiantes.',
      fuente: 'Temperaturas y lluvia: promedio 2015-2024 del reanálisis ERA5 (Open-Meteo) para el punto del destino; no hay normal INMET 1991-2020 publicada para esta localidad. Temperatura del agua: Weatherspark.'
    },
    beaches: [
      { name: 'Taperapuã', zona: 'Orla norte, 5 km', lat: -16.404, lng: -39.043, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Vista_da_Praia_de_Taperapu%C3%A3%2C_Porto_Seguro_BA.JPG/1280px-Vista_da_Praia_de_Taperapu%C3%A3%2C_Porto_Seguro_BA.JPG', vibe: 'La playa de las megabarracas, con piscinas en el arrecife, música y shows todo el día.', cuando: 'Marea baja de mañana.' },
      { name: 'Coroa Vermelha', zona: 'Santa Cruz Cabrália, 14 km', lat: -16.3532, lng: -39.0143, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG/1280px-Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG', vibe: 'Donde se dio la primera misa del Brasil, con una cruz frente al mar y piscinas en el arrecife.', cuando: 'Marea baja.' },
      { name: 'Mucugê (Arraial d’Ajuda)', zona: 'Cruzando el río en balsa, 6 km', lat: -16.4948, lng: -39.0687, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG/1280px-Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG', vibe: 'La playa a la que se baja desde el pueblo de Arraial, con barracas, agua calma y piscinas en el arrecife. Más tranquila que las de Porto Seguro.', cuando: 'Marea baja, de mañana.' },
      { name: 'Pitinga (Arraial d’Ajuda)', zona: 'Cruzando el río en balsa, 8 km', lat: -16.5125, lng: -39.0739, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg/1280px-Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg', vibe: 'Acantilados rojos, arena dorada y piscinas naturales. La más linda de la zona y menos llena que Mucugê.', cuando: 'Marea baja.' },
      { name: 'Taípe (Arraial d’Ajuda)', zona: 'Sur, 12 km', lat: -16.5534, lng: -39.0863, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg/1280px-Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg', vibe: 'Acantilados altos de colores sobre una playa casi vacía, camino a Trancoso.', cuando: 'Tarde, cuando el sol pega en el acantilado.' },
      { name: 'Itacimirim', zona: 'Orla norte, 3 km', lat: -16.4203, lng: -39.0535, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/MARCIO_FILHO_PRAIA_ITACIMIRIM_PORTO_SEGURO_BAHIA_%2840977238011%29.jpg/1280px-MARCIO_FILHO_PRAIA_ITACIMIRIM_PORTO_SEGURO_BAHIA_%2840977238011%29.jpg', vibe: 'La playa de la orla norte más cerca del centro de Porto Seguro: agua calma protegida por el arrecife, barracas y hoteles frente al mar.', cuando: 'Marea baja, de mañana.' },
      { name: 'Mundaí', zona: 'Orla norte, 4 km', lat: -16.41, lng: -39.048, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/MARCIO_FILHO_PRAIA_MUNDAI_PORTO_SEGURO_BAHIA_%2840084162605%29.jpg/1280px-MARCIO_FILHO_PRAIA_MUNDAI_PORTO_SEGURO_BAHIA_%2840084162605%29.jpg', vibe: 'Playa larga de la orla norte de Porto Seguro, de agua tranquila con arrecife cerca de la orilla y barracas más tranquilas que las de Taperapuã.', cuando: 'Marea baja, de mañana.' },
      { name: 'Santo André', zona: 'Norte, 25 km por ruta y balsa', lat: -16.2494, lng: -39.0111, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Praia_de_Santo_Andr%C3%A9_by_Diego_Baravelli.jpg/1280px-Praia_de_Santo_Andr%C3%A9_by_Diego_Baravelli.jpg', vibe: 'Una vila tranquila del otro lado del río João de Tiba, que se cruza en balsa desde Santa Cruz Cabrália. Playa larga de agua calma, con arrecifes y pocas posadas.', cuando: 'Mañana, con marea baja.' }
    ],
    atracciones: [
      { name: 'Cidade Histórica', zona: 'Centro alto', lat: -16.44, lng: -39.0651, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Cidade_Hist%C3%B3rica_-_Porto_Seguro-BA_-_panoramio_%281%29.jpg/1280px-Cidade_Hist%C3%B3rica_-_Porto_Seguro-BA_-_panoramio_%281%29.jpg', dur: '2 h', usd: 3, nota: 'El centro histórico sobre el morro, con casas de colores, la iglesia de Nossa Senhora da Pena y vista al mar.' },
      { name: 'Passarela do Descobrimento', zona: 'Centro bajo', dur: '1 h', usd: 0, nota: 'La ex Passarela do Álcool: la calle de bares, artesanía y forró. De noche, el centro de la vida nocturna.' },
      { name: 'Marco do Descobrimento', zona: 'Cidade Histórica', lat: -16.4371, lng: -39.0645, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Primeira_vila_-_panoramio.jpg/1280px-Primeira_vila_-_panoramio.jpg', dur: '20 min', usd: 0, nota: 'El marco de piedra traído por los portugueses en 1503.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso en la Passarela.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Passarela', usd: 4, momento: 'Tarde', nota: 'Las baianas de la Passarela do Descobrimento.' },
      { name: 'Moqueca', tipo: 'Cena', zona: 'Centro', usd: 20, momento: 'Noche', nota: 'Moqueca baiana para dos.' }
    ],
    hacer: [
      { name: 'Barco al Recife de Fora', zona: 'Sale del puerto', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Diving_in_Porto_Seguro.jpg/1280px-Diving_in_Porto_Seguro.jpg', dur: '3 h', usd: 20, nota: 'Piscinas naturales en un arrecife mar adentro, solo con marea baja.' },
      { name: 'Balsa a Arraial d’Ajuda', zona: 'Centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Travessia_de_balsa_do_Rio_Buranh%C3%A9m_entre_Porto_Seguro_e_Arraial_d%27Ajuda_-_Bahia%2C_Brasil.jpg/1280px-Travessia_de_balsa_do_Rio_Buranh%C3%A9m_entre_Porto_Seguro_e_Arraial_d%27Ajuda_-_Bahia%2C_Brasil.jpg', dur: '15 min', usd: 1, nota: 'Cruza el río al pueblo de Arraial, con playas más lindas.' },
      { name: 'Forró en la Passarela', zona: 'Centro', dur: '3 h', usd: 0, nota: 'Música en vivo en los bares de la Passarela, casi todas las noches.' }
    ],
    tips: [
      { titulo: 'Las barracas cobran consumo', texto: 'Las megabarracas no cobran entrada pero sí consumo mínimo. Preguntá antes.' },
      { titulo: 'Arraial y Trancoso al lado', texto: 'Las mejores playas de la zona están en Arraial d’Ajuda y Trancoso, cruzando el río.' },
      { titulo: 'Julio es de estudiantes', texto: 'En julio llegan miles de egresados. Si buscás tranquilidad, evitá esas semanas.' }
    ]
  },

  gram: {
    resumen: 'Un pueblo de montaña con arquitectura alemana, lagos, chocolate y fondue. Es caro y lo sabe: lo mejor es caminarlo y elegir bien dónde gastar.',
    temporada: { alta: [6, 7, 11, 12], baja: [3, 4, 5, 9], nota: 'Julio es el mes del frío, con temperaturas bajo cero algunas noches y el Festival de Cine en agosto. De noviembre a enero está el Natal Luz, con shows y el pueblo iluminado. Marzo, abril y mayo tienen clima templado y precios más bajos.' },
    clima: {
      titulo: 'Clima en Gramado mes por mes',
      intro: 'Clima de sierra a 800 metros: veranos templados e inviernos fríos, con lluvia todo el año.',
      meses: [
        { m: 'Ene', max: 27, min: 18, lluvia: 222, demanda: 'media' },
        { m: 'Feb', max: 26, min: 18, lluvia: 189, demanda: 'media' },
        { m: 'Mar', max: 25, min: 17, lluvia: 174, demanda: 'baja' },
        { m: 'Abr', max: 23, min: 14, lluvia: 133, demanda: 'baja' },
        { m: 'May', max: 19, min: 11, lluvia: 145, demanda: 'baja' },
        { m: 'Jun', max: 18, min: 10, lluvia: 133, demanda: 'alta' },
        { m: 'Jul', max: 18, min: 9, lluvia: 165, demanda: 'alta' },
        { m: 'Ago', max: 20, min: 10, lluvia: 144, demanda: 'media' },
        { m: 'Sep', max: 21, min: 11, lluvia: 180, demanda: 'baja' },
        { m: 'Oct', max: 22, min: 13, lluvia: 221, demanda: 'media' },
        { m: 'Nov', max: 24, min: 14, lluvia: 162, demanda: 'alta' },
        { m: 'Dic', max: 26, min: 17, lluvia: 187, demanda: 'alta' }
      ],
      nota: 'Para ver el pueblo sin multitudes y a mejor precio, marzo, abril y mayo: días templados y noches frescas. Junio y julio son los meses del frío, con heladas algunas noches, y los más caros junto con noviembre y diciembre, cuando está el Natal Luz. Llueve todo el año, más en verano y en octubre.',
      fuente: 'Temperaturas y lluvia: promedios climatológicos de 30 años de Climatempo para Gramado (no hay normal del INMET en el municipio).'
    },
    beaches: [],
    atracciones: [
      { name: 'Lago Negro', zona: 'Centro, 1.5 km', lat: -29.395, lng: -50.8756, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Lago_Negro%2C_Gramado%2C_RS%2C_Brasil.jpg/1280px-Lago_Negro%2C_Gramado%2C_RS%2C_Brasil.jpg', dur: '1 h', usd: 0, nota: 'Un lago rodeado de pinos traídos de la Selva Negra, con botes a pedal en forma de cisne. Gratis para caminar.' },
      { name: 'Rua Coberta', zona: 'Centro', lat: -29.3784, lng: -50.873, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Rua_Coberta_-_Gramado_-_panoramio.jpg/1280px-Rua_Coberta_-_Gramado_-_panoramio.jpg', dur: '40 min', usd: 0, nota: 'Una calle techada con cafés y restaurantes, donde se hacen los eventos del pueblo. Lugar para un chocolate caliente.' },
      { name: 'Igreja Matriz São Pedro', zona: 'Centro', lat: -29.3795, lng: -50.8741, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Igreja_Matriz_S%C3%A3o_Pedro.jpg/1280px-Igreja_Matriz_S%C3%A3o_Pedro.jpg', dur: '20 min', usd: 0, nota: 'La iglesia de piedra en la avenida principal, con vitrales y la plaza de las hortensias enfrente.' },
      { name: 'Lago Joaquina Rita Bier', zona: 'Centro, 1 km', lat: -29.3867, lng: -50.8751, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Lago_Joaquina_Rita_Bier_%28Gramado%29_05.JPG/1280px-Lago_Joaquina_Rita_Bier_%28Gramado%29_05.JPG', dur: '45 min', usd: 0, nota: 'Un lago tranquilo con caminata alrededor y menos gente que el Lago Negro.' },
      { name: 'Mini Mundo', zona: 'Centro', lat: -29.3845, lng: -50.8754, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Renato_Soares_Mini_Mundo_Gramado_RS_13_%2840696106785%29.jpg/1280px-Renato_Soares_Mini_Mundo_Gramado_RS_13_%2840696106785%29.jpg', dur: '1 h 30', usd: 15, nota: 'Una ciudad en miniatura con trenes, castillos y edificios famosos a escala. Ideal con chicos.' }
    ],
    comer: [
      { name: 'Café colonial', tipo: 'Merienda', zona: 'Casas de café de la ruta', usd: 25, momento: 'Tarde', nota: 'Una mesa con más de cincuenta platos dulces y salados de la tradición alemana e italiana. Sirve de merienda y cena.' },
      { name: 'Fondue', tipo: 'Cena', zona: 'Centro', usd: 30, momento: 'Noche', nota: 'Rodizio de fondue de queso, carne y chocolate. Caro, pero es el plato del pueblo.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Calles paralelas a la Borges de Medeiros', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso a dos cuadras de la avenida principal: la forma de comer barato en Gramado.' },
      { name: 'Chocolate artesanal', tipo: 'Merienda', zona: 'Fábricas del centro', usd: 5, momento: 'Tarde', nota: 'Las fábricas dan degustación gratis. Comprá en la fábrica, no en la tienda de la avenida.' }
    ],
    hacer: [
      { name: 'Caminata por la Avenida Borges de Medeiros', zona: 'Centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Av._Borges_de_Medeiros_%281%29%2C_Gramado%2C_junho_de_2021.jpg/1280px-Av._Borges_de_Medeiros_%281%29%2C_Gramado%2C_junho_de_2021.jpg', dur: '1 h', usd: 0, nota: 'Del pórtico a la iglesia, mirando la arquitectura y las vidrieras.' },
      { name: 'Snowland', zona: 'Ruta a Nova Petrópolis', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/RenatoSoares_SnowLand_Gramado_RS_%2840193258034%29.jpg/1280px-RenatoSoares_SnowLand_Gramado_RS_%2840193258034%29.jpg', dur: 'Medio día', usd: 60, nota: 'Parque de nieve bajo techo, con esquí y trineo.' },
      { name: 'Natal Luz', zona: 'Centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Natal_Luz_-_Gramado_-_Show_de_acendimento_-_panoramio_%2810%29.jpg/1280px-Natal_Luz_-_Gramado_-_Show_de_acendimento_-_panoramio_%2810%29.jpg', dur: 'Noche', usd: 0, nota: 'De noviembre a enero, el pueblo iluminado y desfiles en la calle. Los shows grandes son pagos.' }
    ],
    tips: [
      { titulo: 'Canela es más barata', texto: 'Canela está a 8 km, tiene la misma montaña y cuesta menos. Alojarse allá y venir de día ahorra mucho.' },
      { titulo: 'Las atracciones pagas suman', texto: 'Hay una atracción paga en cada esquina. Elegí dos o tres: los lagos y las calles son gratis.' },
      { titulo: 'Abrigo de verdad en invierno', texto: 'En julio hace frío húmedo y bajo cero de noche. Campera, gorro y guantes.' }
    ]
  },

  canela: {
    resumen: 'El pueblo vecino de Gramado, más tranquilo y barato, con la catedral de piedra y la naturaleza más linda de la Serra: cascadas, cañones y bosques de araucarias.',
    temporada: { alta: [6, 7, 12], baja: [3, 4, 5, 9, 10], nota: 'Julio es el mes frío y el más lleno. En primavera y otoño hay clima templado, cascadas con agua y precios bajos.' },
    clima: {
      titulo: 'Clima en Canela mes por mes',
      intro: 'Clima de sierra: veranos templados, inviernos fríos y lluvia repartida en todo el año.',
      meses: [
        { m: 'Ene', max: 25, min: 17, lluvia: 202, demanda: 'media' },
        { m: 'Feb', max: 25, min: 17, lluvia: 174, demanda: 'media' },
        { m: 'Mar', max: 24, min: 16, lluvia: 160, demanda: 'baja' },
        { m: 'Abr', max: 21, min: 13, lluvia: 128, demanda: 'baja' },
        { m: 'May', max: 18, min: 10, lluvia: 142, demanda: 'baja' },
        { m: 'Jun', max: 17, min: 8, lluvia: 132, demanda: 'alta' },
        { m: 'Jul', max: 16, min: 8, lluvia: 163, demanda: 'alta' },
        { m: 'Ago', max: 19, min: 9, lluvia: 138, demanda: 'media' },
        { m: 'Sep', max: 20, min: 10, lluvia: 175, demanda: 'baja' },
        { m: 'Oct', max: 21, min: 12, lluvia: 216, demanda: 'baja' },
        { m: 'Nov', max: 23, min: 13, lluvia: 157, demanda: 'media' },
        { m: 'Dic', max: 25, min: 16, lluvia: 179, demanda: 'alta' }
      ],
      nota: 'Otoño y primavera tienen días templados, cascadas con agua y precios más bajos. Junio y julio son los meses más fríos y los más llenos, igual que diciembre. Llueve todo el año, más en octubre y enero: llevá abrigo y algo para la lluvia en cualquier época.',
      fuente: 'Temperaturas y lluvia: promedios climatológicos de 30 años de Climatempo para Canela (no hay normal del INMET en el municipio).'
    },
    beaches: [],
    atracciones: [
      { name: 'Catedral de Pedra', zona: 'Centro', lat: -29.3638, lng: -50.8092, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Lateral_da_Catedral_de_pedra_%28Canela%29.jpg/1280px-Lateral_da_Catedral_de_pedra_%28Canela%29.jpg', dur: '40 min', usd: 0, nota: 'La catedral gótica de piedra basáltica, con una torre de 65 metros y un carillón que toca todos los días.' },
      { name: 'Cascata do Caracol', zona: 'Parque do Caracol, 8 km', lat: -29.3112, lng: -50.8544, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Cascata_Caracol_-_Canela_RS.jpg/1280px-Cascata_Caracol_-_Canela_RS.jpg', dur: '2 h', usd: 15, nota: 'Una cascada de 131 metros que cae en un cañón de selva. Se ve desde los miradores del parque. La escalera hasta la base (más de 700 escalones) estuvo cerrada varios años: consultá si está habilitada.' },
      { name: 'Parque da Ferradura', zona: '15 km', lat: -29.2707, lng: -50.8449, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Renato_Soares_Parque_da_Ferradura_Canela_RS_%2826699738327%29.jpg/1280px-Renato_Soares_Parque_da_Ferradura_Canela_RS_%2826699738327%29.jpg', dur: '2 h', usd: 10, nota: 'Miradores sobre un cañón en forma de herradura, con el río Santa Cruz al fondo.' },
      { name: 'Castelinho Caracol', zona: 'Camino al Caracol', lat: -29.3355, lng: -50.8502, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Castelinho_Caracol%2C_Canela_RS_%282%29.jpg/1280px-Castelinho_Caracol%2C_Canela_RS_%282%29.jpg', dur: '40 min', usd: 5, nota: 'Una casa de madera de 1913 sin un solo clavo, hoy museo y casa de té con strudel.' },
      { name: 'Mundo a Vapor', zona: 'Ruta a Gramado', lat: -29.3617, lng: -50.8349, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Mundo_a_Vapor%2C_Gramado-Canela_%286051012895%29.jpg/1280px-Mundo_a_Vapor%2C_Gramado-Canela_%286051012895%29.jpg', dur: '1 h', usd: 15, nota: 'Museo de máquinas a vapor con la réplica del famoso accidente de tren de París.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso, más barato que en Gramado.' },
      { name: 'Café colonial', tipo: 'Merienda', zona: 'Ruta a Gramado', usd: 22, momento: 'Tarde', nota: 'Mesa de dulces y salados de la tradición alemana, sirve de merienda y cena.' },
      { name: 'Strudel en el Castelinho', tipo: 'Merienda', zona: 'Castelinho Caracol', usd: 6, momento: 'Tarde', nota: 'Strudel de manzana y café en la casa de madera.' }
    ],
    hacer: [
      { name: 'Escalera al pie del Caracol', zona: 'Parque do Caracol', dur: '2 h', nota: 'Más de 700 escalones hasta la base de la cascada, con la entrada al parque. Estuvo cerrada varios años y se anunció su reapertura con la reforma del parque: consultá antes si está habilitada. La subida es dura.' },
      { name: 'Bondinhos Aéreos', zona: 'Parque da Serra, junto al Caracol', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/BONDINHOS_A%C3%89REOS_NO_PARQUE_DO_CARACOL_RS.jpg/1280px-BONDINHOS_A%C3%89REOS_NO_PARQUE_DO_CARACOL_RS.jpg', dur: '1 h', nota: 'Teleférico en un parque separado, al lado del Parque do Caracol, que cruza el valle con vista a la cascada. Se paga entrada aparte.' }
    ],
    tips: [
      { titulo: 'Base para Gramado', texto: 'Alojarse en Canela cuesta menos y Gramado está a 8 km. El ómnibus entre los dos pasa seguido.' },
      { titulo: 'El Caracol, temprano', texto: 'A la mañana la luz entra en el cañón y hay menos gente en el mirador.' },
      { titulo: 'Niebla en invierno', texto: 'En julio la niebla puede tapar los miradores. Mirá el pronóstico y dejá la Ferradura para un día claro.' }
    ]
  },

  poa: {
    resumen: 'La capital gaúcha, sobre el lago Guaíba: mercado centenario, centros culturales en edificios históricos y el atardecer más famoso del sur de Brasil.',
    temporada: { alta: [], baja: [1, 2, 3, 6, 8, 12], nota: 'Enero y febrero son muy calurosos y húmedos, y la ciudad se vacía porque todos van a la costa. Otoño y primavera tienen el mejor clima para caminarla.' },
    clima: {
      titulo: 'Clima en Porto Alegre mes por mes',
      intro: 'Veranos muy calurosos y húmedos, inviernos frescos. Llueve parejo todo el año.',
      meses: [
        { m: 'Ene', max: 31, min: 21, lluvia: 121, demanda: 'baja' },
        { m: 'Feb', max: 31, min: 21, lluvia: 111, demanda: 'baja' },
        { m: 'Mar', max: 29, min: 20, lluvia: 103, demanda: 'baja' },
        { m: 'Abr', max: 26, min: 17, lluvia: 114, demanda: 'media' },
        { m: 'May', max: 23, min: 14, lluvia: 113, demanda: 'media' },
        { m: 'Jun', max: 20, min: 11, lluvia: 130, demanda: 'baja' },
        { m: 'Jul', max: 20, min: 10, lluvia: 164, demanda: 'media' },
        { m: 'Ago', max: 22, min: 12, lluvia: 120, demanda: 'baja' },
        { m: 'Sep', max: 23, min: 13, lluvia: 148, demanda: 'media' },
        { m: 'Oct', max: 25, min: 16, lluvia: 153, demanda: 'media' },
        { m: 'Nov', max: 28, min: 17, lluvia: 106, demanda: 'media' },
        { m: 'Dic', max: 30, min: 19, lluvia: 112, demanda: 'baja' }
      ],
      nota: 'Para caminar la ciudad, otoño (abril y mayo) y primavera (septiembre a noviembre): temperaturas templadas y atardeceres largos sobre el Guaíba. En enero y febrero hace más de 30 grados con mucha humedad y la ciudad se vacía porque todos se van a la costa. Julio es el mes más lluvioso y frío.',
      fuente: 'Temperaturas y lluvia: normales climatológicas 1991-2020 del INMET (estación Porto Alegre, Jardim Botânico).'
    },
    beaches: [],
    atracciones: [
      { name: 'Usina do Gasômetro', zona: 'Centro', lat: -30.0341, lng: -51.2411, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Usina_do_Gas%C3%B4metro.jpg/1280px-Usina_do_Gas%C3%B4metro.jpg', dur: '1 h', usd: 0, nota: 'Una antigua usina sobre el Guaíba convertida en centro cultural. Desde su muelle se mira el atardecer más famoso de la ciudad.' },
      { name: 'Mercado Público', zona: 'Centro', lat: -30.0275, lng: -51.2278, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Mercado_P%C3%BAblico_de_Porto_Alegre_2021_4.jpg/1280px-Mercado_P%C3%BAblico_de_Porto_Alegre_2021_4.jpg', dur: '1 h', usd: 0, nota: 'El mercado de 1869, con puestos de yerba, especias y carnes, y la Banca 40 con su bomba royal.' },
      { name: 'Casa de Cultura Mario Quintana', zona: 'Centro', lat: -30.0311, lng: -51.2345, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Casa_de_Cultura_Mario_Quintana_por_Rodrigo_Tetsuo_Argenton_%2812%29.jpg/1280px-Casa_de_Cultura_Mario_Quintana_por_Rodrigo_Tetsuo_Argenton_%2812%29.jpg', dur: '1 h', usd: 0, nota: 'Un hotel antiguo donde vivió el poeta, hoy centro cultural con terraza y vista al lago.' },
      { name: 'Fundação Iberê Camargo', zona: 'Zona sur, 4 km', lat: -30.0777, lng: -51.2454, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Funda%C3%A7%C3%A3o_Iber%C3%AA_Camargo_-_Porto_Alegre_2026.jpg/1280px-Funda%C3%A7%C3%A3o_Iber%C3%AA_Camargo_-_Porto_Alegre_2026.jpg', dur: '1 h 30', usd: 0, nota: 'Museo de Álvaro Siza frente al Guaíba, una de las obras de arquitectura más premiadas de Brasil.' },
      { name: 'Parque da Redenção', zona: 'Farroupilha, 2 km', lat: -30.037, lng: -51.2156, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Boitat%C3%A1_no_Parque_Farroupilha_2.jpg/1280px-Boitat%C3%A1_no_Parque_Farroupilha_2.jpg', dur: '1 h', usd: 0, nota: 'El parque central de la ciudad. Los domingos se arma el Brique, feria de antigüedades y artesanía.' },
      { name: 'Orla do Guaíba', zona: 'Centro, junto al lago', lat: -30.0544, lng: -51.2331, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/27-3-2026_-_Imagem_a%C3%A9rea_do_South_Summit_Brazil_em_Porto_Alegre_e_da_orla_do_Gua%C3%ADba_10.jpg/960px-27-3-2026_-_Imagem_a%C3%A9rea_do_South_Summit_Brazil_em_Porto_Alegre_e_da_orla_do_Gua%C3%ADba_10.jpg', dur: '1 h', usd: 0, nota: 'La rambla nueva sobre el lago, con bares, gradas y ciclovía. El plan de fin de tarde.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso en el centro, lo más barato para almorzar.' },
      { name: 'Bomba royal de la Banca 40', tipo: 'Postre', zona: 'Mercado Público', usd: 4, momento: 'Tarde', nota: 'Helado con merengue y frutas, la tradición del mercado desde 1927.' },
      { name: 'Churrasco', tipo: 'Cena', zona: 'Churrascarías', usd: 20, momento: 'Noche', nota: 'Rodizio de carnes al estilo gaúcho, en la capital del churrasco gaúcho.' },
      { name: 'Xis', tipo: 'Cena', zona: 'Cidade Baixa', usd: 7, momento: 'Noche', nota: 'El sándwich gigante gaúcho, con todo adentro. La cena barata de la Cidade Baixa.' }
    ],
    hacer: [
      { name: 'Atardecer en el Gasômetro', zona: 'Centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Por_do_Sol_Usina_do_Gas%C3%B4metro_-_panoramio.jpg/1280px-Por_do_Sol_Usina_do_Gas%C3%B4metro_-_panoramio.jpg', dur: '1 h', usd: 0, nota: 'Llevá mate y sentate en el muelle: la ciudad entera va a mirar el sol caer sobre el Guaíba.' },
      { name: 'Barco por el Guaíba', zona: 'Cais Mauá', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Barco_de_turismo_Porto_Alegre_10_02.jpg/1280px-Barco_de_turismo_Porto_Alegre_10_02.jpg', dur: '1 h', usd: 10, nota: 'Paseo por el lago y las islas frente a la ciudad.' },
      { name: 'Noche en la Cidade Baixa', zona: 'Cidade Baixa', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Jovens_reunidos_na_Rua_Joaquim_Nabuco%2C_Cidade_Baixa%2C_Porto_Alegre%2C_abril_de_2023_%281%29.jpg/1280px-Jovens_reunidos_na_Rua_Joaquim_Nabuco%2C_Cidade_Baixa%2C_Porto_Alegre%2C_abril_de_2023_%281%29.jpg', dur: '3 h', usd: 0, nota: 'El barrio de bares, música en vivo y estudiantes.' }
    ],
    tips: [
      { titulo: 'El centro, de día', texto: 'El centro histórico es animado de día y vacío de noche. Para salir, la Cidade Baixa o Moinhos de Vento.' },
      { titulo: 'El mate es social', texto: 'En la orla y los parques la gente toma chimarrão. Si te ofrecen, se acepta y se devuelve sin decir gracias hasta que no quieras más.' },
      { titulo: 'La Serra queda a dos horas', texto: 'Gramado y Canela están a 120 km: se hacen de día o con una noche.' }
    ]
  }
};

/* ===========================================================================
   GUIAS REGIONALES
   ===========================================================================
   Se aplican a todos los destinos del estado, menos a los que tengan guia de
   ciudad propia. La región sale de DEST[].region en lib/model.js. */

/* Las guias regionales tenian playas, comidas y tips escritos sin fuente, y
   una revision de octubre de 2026 encontro la mayoria falsos: lugares que no
   existen, platos de otro estado, distancias erradas por cientos de km. Como
   los 40 destinos tienen guia de ciudad con las cinco secciones, nadie las
   veia; se dejaron solo con un resumen verificable para que un destino nuevo
   sin guia propia no muestre nada inventado. Si se vuelven a escribir, cada
   dato con su fuente, como en las de ciudad. */
var REGIONES = {

  'santa-catarina': { resumen: 'Costa de Santa Catarina: balnearios con infraestructura al norte (Balneário Camboriú, Itapema, Bombinhas), la isla de Florianópolis en el medio y playas más chicas al sur (Garopaba, Praia do Rosa).' },
  'rio-grande-do-sul': { resumen: 'Rio Grande do Sul: la Serra Gaúcha (Gramado y Canela), la capital Porto Alegre y el litoral norte (Torres, Capão da Canoa).' },
  'rio-de-janeiro': { resumen: 'Estado de Río de Janeiro: la ciudad, la Región de los Lagos (Búzios, Arraial do Cabo, Cabo Frio) y la Costa Verde (Angra dos Reis, Ilha Grande, Paraty).' },
  'bahia': { resumen: 'Bahía: Salvador y una costa larga de pueblos de playa, de Praia do Forte al norte a Porto Seguro y Trancoso al sur.' },
  'pernambuco': { resumen: 'Pernambuco: Recife y Olinda, playas de arrecife como Porto de Galinhas y, mar adentro, Fernando de Noronha.' },
  'ceara': { resumen: 'Ceará: Fortaleza y una costa de dunas, lagunas y viento, con Jericoacoara al oeste.' },
  'sao-paulo': { resumen: 'Estado de São Paulo: la ciudad, que no es destino de playa, y el litoral norte (Ilhabela, Ubatuba).' },
  'alagoas': { resumen: 'Alagoas: Maceió y una costa de arrecifes y piscinas naturales hasta Maragogi.' },
  'rio-grande-do-norte': { resumen: 'Rio Grande do Norte: Natal, con dunas y playas urbanas, y Pipa al sur.' },
  'parana': { resumen: 'Paraná: Curitiba y, en la frontera con Argentina y Paraguay, Foz do Iguaçu y las cataratas.' },
  'paraiba': { resumen: 'Paraíba: João Pessoa, con playas urbanas y la Ponta do Seixas, el punto más oriental de América continental.' },
  'minas-gerais': { resumen: 'Minas Gerais: Belo Horizonte, sin mar, cerca de las ciudades coloniales como Ouro Preto y del museo a cielo abierto de Inhotim.' },
  'buenos-aires': { resumen: 'Buenos Aires: la capital argentina, con barrios para caminar, cafés, teatros y tango.' }

};

/* ===========================================================================
   API
   =========================================================================== */

/* Las regiones se comparan en slug y no con el nombre que muestra
   lib/model.js. La razon: "Ceará" y "Ceará" con tilde son dos strings
   distintas, así que comparar contra el nombre crudo hacia fallar en
   silencio para 8 de las 12 regiones y ninguna se quejaba. El slug se
   normaliza en los dos lados, así que un cambio de tildes en el nombre no
   rompe el match. Es la misma normalizacion que usa inferHotelType
   (app.js:313). */
function regionSlug(region) {
  return String(region || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_ ]+/g, '-')
    .trim();
}

/* Une la guia de ciudad con la regional de su estado, seccion por seccion.
   La ciudad gana donde define algo; la regional aporta lo que la ciudad no
   menciona.

   Por que mezclar en vez de reemplazar: una regional con secciones
   aportaria lo que la ciudad no cubre sin duplicarlo en cada ciudad. Hoy
   las regionales solo tienen resumen (ver REGIONES), asi que en la practica
   gana siempre la ciudad.

   Una seccion cuenta como "definida" si existe y no esta vacia: un
   `beaches: []` explicito (una ciudad sin playa) gana a la regional y no
   se completa sola. */
function mezclarGuia(propia, regional) {
  if (!propia) return regional || null;
  if (!regional) return propia;
  var salida = Object.assign({}, regional, propia);
  // 'atracciones' faltaba en esta lista: la ciudad que la define no perdia
  // nada porque no hay regional con atracciones todavia, pero cualquier
  // regional que las tenga en el futuro se las imporia encima.
  ['beaches', 'atracciones', 'comer', 'hacer', 'tips'].forEach(function (seccion) {
    var dePropia = propia[seccion];
    var deRegional = regional[seccion];
    // Un array, aunque este vacio, es una decision de la ciudad: se respeta.
    // El bug era que `[]` caia en la linea de abajo y se completaba sola con
    // la regional. Sao Paulo declaraba beaches: [] justamente para que la
    // regional de Sao Paulo (Ilhabela y Ubatuba) no le apareciera.
    if (Array.isArray(dePropia)) return;
    if (deRegional === undefined) return;   // la ciudad no lo define: nada que hacer
    salida[seccion] = deRegional;
  });
  return salida;
}

/* Resuelve la guia de un destino. Devuelve null si no hay ninguna escrita:
   quien llame tiene que manejar ese caso, no mostrar otra ciudad. */
function guiaPara(destKey, region) {
  var key = String(destKey || '').toLowerCase();
  var reg = regionSlug(region);
  var regional = (reg && REGIONES[reg]) || null;
  if (GUIAS[key]) return mezclarGuia(GUIAS[key], regional);
  return regional;
}

/* Cuantas guias hay y cuántos destinos cubren. Para verificar en la consola
   que un destino nuevo cae en la región correcta. */
function coberturaGuias(destinos) {
  var propio = 0, regional = 0, sinGuia = [];
  Object.keys(destinos || {}).forEach(function (key) {
    var d = destinos[key] || {};
    if (GUIAS[key]) { propio++; return; }
    if (d.region && REGIONES[regionSlug(d.region)]) { regional++; return; }
    sinGuia.push(key);
  });
  return { propio: propio, regional: regional, sinGuia: sinGuia };
}

// Export dual. El server lo require()a; los tests (test.js,
// test-guias-humo.js) simulan window para poder leer el mismo objeto. El
// global solo existe si hay window, que en el server no hay: si se dejara
// suelto, el require reventaria.
var CS_GUIAS = { guias: GUIAS, regiones: REGIONES, guiaPara: guiaPara, cobertura: coberturaGuias, regionSlug: regionSlug, version: CACHE_VERSION, maxKm: GUIA_MAX_KM };
if (typeof window !== 'undefined') window.CS_GUIAS = CS_GUIAS;
if (typeof module !== 'undefined' && module.exports) module.exports = CS_GUIAS;
