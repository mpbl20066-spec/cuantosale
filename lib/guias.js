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
   están en atracciones: se mira una cosa y se termina. "Caminata por la Costa
   Verde" y "Bondinho turistico" están en hacer: se hace una cosa y se
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
var CACHE_VERSION = 2;
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
    región: 'santa-catarina',
    resumen: 'Ciudad con la playa a un kilometro. La mejor relacion precio-calidad del sur de Brasil.',
    temporada: {
      alta: [12, 1, 2, 3],
      baja: [6, 7, 8, 9],
      nota: 'Enero y julio son el doble de caro y el doble de lleno. Si las fechas son flexibles, junio o septiembre.'
    },
    beaches: [
      { name: 'Beira-Mar Norte', zona: 'Centro, continental', lat: -27.5786, lng: -48.5241, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Beira_mar_norte_Florian%C3%B3polis_SC.jpg/1280px-Beira_mar_norte_Florian%C3%B3polis_SC.jpg', vibe: 'La que estas viendo si estas en el centro. Orla con ciclovia, sombra y movimiento.', cuando: 'Todo el año. Con marea alta el agua se retira y quedan los bloques de cemento del muro: no la confundas con una playa de verdad.' },
      { name: 'Barra da Lagoa (canal y molhe)', zona: 'Costa este, 20 km del centro', lat: -27.5748, lng: -48.4258, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Barra_da_Lagoa%2C_Florian%C3%B3polis%2C_SC.jpg/1280px-Barra_da_Lagoa%2C_Florian%C3%B3polis%2C_SC.jpg', vibe: 'Pueblo de pescadores donde la laguna se junta con el mar por un canal de agua verde. Restaurantes de pescado sobre el agua, botes y una playa de olas al otro lado del puente.', cuando: 'Todo el año. Con mar picado se nada en el canal, que es protegido. A la hora del almuerzo se llenan los restaurantes del canal: llegá antes de las 13.' },
      { name: 'Praia Mole', zona: 'Costa este, 18 km del centro', lat: -27.6034, lng: -48.4370, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Praia_Mole%2C_Florian%C3%B3polis.jpg/1280px-Praia_Mole%2C_Florian%C3%B3polis.jpg', vibe: 'La playa joven de la isla: olas para surf, bares sobre la arena y gente hasta la noche. Tiene torre de guardavidas y es la más concurrida de la costa este.', cuando: 'Diciembre a marzo para el ambiente; fuera de temporada queda vacía y con olas. El mar es abierto: con bandera roja no se entra.' },
      { name: 'Naufragados', zona: 'Sur de la ilha, 25 km', lat: -27.8335, lng: -48.5619, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Naufragados%2C_Florian%C3%B3polis.jpg/1280px-Naufragados%2C_Florian%C3%B3polis.jpg', vibe: 'La postal de la isla. Desnuda, sin servicios, con el mejor atardecer del estado.', cuando: 'Todo el año. El camino de ida ya es el paseo: 40 minutos de curvas con vista al mar.' },
      { name: 'Canasvieiras', zona: 'Norte, 30 km del centro', lat: -27.4296, lng: -48.4602, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/Playa_Canasvieiras_-_Floripa%2C_Brasil_%281%29.jpg/1280px-Playa_Canasvieiras_-_Floripa%2C_Brasil_%281%29.jpg', vibe: 'La playa de los uruguayos y argentinos: agua calma y poco profunda, mucha infraestructura y todo a pie (supermercados, restaurantes, sombrillas). La elegida para ir con chicos.', cuando: 'Todo el año, y en enero está llenísima. Es la mejor opción cuando el viento o el oleaje cierran las playas de la costa este.' },
      { name: 'Praia da Joaquina', zona: 'Costa este, 20 km del centro', lat: -27.6343, lng: -48.4544, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Praia_da_Joaquina%2C_Florian%C3%B3polis%2C_Santa_Catarina.JPG/1280px-Praia_da_Joaquina%2C_Florian%C3%B3polis%2C_Santa_Catarina.JPG', vibe: 'Olas grandes y las dunas al lado, donde se hace sandboard. Es el lugar de los surfistas de la isla.', cuando: 'Todo el año. Mar abierto y con corrientes: para nadar, quedate cerca de la torre de guardavidas.' },
      { name: 'Praia do Campeche', zona: 'Sur de la ilha, 20 km del centro', lat: -27.6859, lng: -48.4805, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Praia_do_Campeche.jpg/1280px-Praia_do_Campeche.jpg', vibe: 'La más tranquila del sur. El agua casi no se mueve, y hay escuela de surf, kayak y kioscos con sombra.', cuando: 'Todo el año. Es la que se elige cuando hay chicos, o cuando el viento del sur cerró todo lo demás.' },
      { name: 'Lagoa da Conceição', zona: 'Norte de la ilha, 12 km del centro', lat: -27.6032, lng: -48.4654, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/Lagoa_da_Concei%C3%A7%C3%A3o_%283423230047%29.jpg/1280px-Lagoa_da_Concei%C3%A7%C3%A3o_%283423230047%29.jpg', vibe: 'No es mar: es una laguna de agua dulce, protegida y tibia. Se navega en kayak, se hace paddle, y al lado está el parque de dunas.', cuando: 'Todo el año, y llueve menos que en el resto de la isla. Es el plan cuando el tiempo está feo, porque no depende del oleaje.' },
      { name: 'Praia Brava', zona: 'Norte de la ilha, Cachoeira do Bom Jesus', lat: -27.3976, lng: -48.4158, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Floripa_12_2014_Brava_1079.JPG/1280px-Floripa_12_2014_Brava_1079.JPG', vibe: 'Playa chica entre rocas enormes, con arena clara y agua verde-azulada. Se alquilan sombrillas y sillas en la arena y el entorno es más tranquilo que el de Canasvieiras.', cuando: 'Mejor de mañana o con poco viento. Es mar abierto: mirá la bandera antes de entrar.' }
    ],
    atracciones: [
      { name: 'Mercado Público', zona: 'Centro', dur: '1 h', usd: 8, nota: 'Segundo piso con vista al mar y puestos de artesanía y azulejo. Es el mejor lugar para ver el producto de la isla sin entrar en una tienda.' },
      { name: 'Casa da Ribeira', zona: 'Centro', dur: '45 min', usd: 4, nota: 'Una casa del siglo XVIII con la pintura del techo al aire libre, del mismo estilo que las de Portugal. Se entra a mirar el techo, no el mar.' },
      { name: 'Catedral Metropolitana', zona: 'Centro', dur: '30 min', usd: 0, nota: 'Toda de mármol italiano y con una vista de la bahía desde la torre. Es la iglesia más grande de Santa Catarina.' }
    ],
    comer: [
      { name: 'Prato executivo del centro', tipo: 'Almuerzo', zona: 'Centro / Beira-Mar', usd: 9, momento: 'Mediodía, 12 a 14 h', nota: 'Plato, postre y café por menos de lo que salen el café y el postre por separado. Es la comida con mejor relacion precio-cantidad de la ciudad y está en todas partes: busca la pizarra del día, no un restaurante.' },
      { name: 'Feira de productor', tipo: 'Compra', zona: 'Beira-Mar y São Francisco', usd: 5, momento: 'Sábado a la mañana', nota: 'Fruta, pan de queso, jugos naturales y empanadas a precio de productor. Cocinas ahí y comes en la playa: sale menos que cualquier menú y está mejor.' },
      { name: 'Tapioca en la calle', tipo: 'Merienda', zona: 'Todo el centro', usd: 3, momento: 'Cualquier hora', nota: 'Se hace en el momento, con queijo coalho, y se lleva envuelto. La merienda más barata y la más local.' },
      { name: 'Açaí', tipo: 'Desayuno', zona: 'Centro y barrios', usd: 7, momento: '8 a 11 h', nota: 'El açaí de Santa Catarina es leyenda. Busca el que dice "polpa" en el menú: los demás llevan azúcar agregada y no son lo mismo.' },
      { name: 'Sorvete artesanal', tipo: 'Postre', zona: 'Centro', usd: 4, momento: 'Tarde y noche', nota: 'Hay varios afamados en la plaza y en la calle. Un açaí con granola en un bowl chico es el mejor cierre de la tarde.' },
      { name: 'Marmitex en la Beira-Mar', tipo: 'Almuerzo', zona: 'Beira-Mar', usd: 7, momento: 'Mediodía, de 11 a 14 h', nota: 'Bandeja del día servida en la barra, para llevar o para comer en el mostrador. Se vende por peso y cambia todos los días. Es la comida de diario del barrio, y sale menos que cualquier carta turística.' },
      { name: 'Coxinha y café de panadería', tipo: 'Merienda', zona: 'Calles del centro', usd: 3, momento: 'Toda la tarde', nota: 'Coxinha frita, de masa de yuca y pollo, y un café de la panadería de al lado. Se come de pie en la vereda. Es la merienda de la tarde en todo el estado.' },
      { name: 'Pizza por peso', tipo: 'Cena', zona: 'Beira-Mar', usd: 14, momento: 'Noche, de 19 a 23 h', nota: 'Eligen el sabor y pagan por peso, como el buffet. Hay que pedir en la caja antes de sentarse. La masa es fina, de estilo paulista.' }
    ],
    hacer: [
      { name: 'Bondinho turístico', zona: 'Centro', dur: '45 min', usd: 4, nota: 'El bus que recorre el centro y la costa. Sale cada 20 minutos y el boleto se compra en el punto de salida, no adentro. La forma más barata de llegar a cualquier punto de la costa sin taxi.' },
      { name: 'Caminata por la Costa Verde', zona: 'Norte de la ilha', dur: '2 h', usd: 0, nota: 'Tramo de 12 km sobre la ruta SC-402, con vista al mar y sin transporte público. El mejor plan gratis de la isla, y termina en São Francisco.' },
      { name: 'Mirante da Cruz', zona: 'Centro', dur: '1 h', usd: 0, nota: 'El mejor atardecer de la ciudad y es gratis. Se llena al mediodía: subí 45 minutos antes de que se ponga el sol.' },
      { name: 'Escalera y o risco de Santo Antônio', zona: 'Centro', dur: '1 h', usd: 0, nota: 'La escalera larga de la calle Conselheiro Mafra, con la capela al pie. Es la foto más repetida de la ciudad y ahí se hace de verdad. Arriba se ve la bahía.' },
      { name: 'Microcervecerías del centro', zona: 'Centro', dur: '2 h', usd: 18, nota: 'Microcervecerías de barrio, varias por cuadra en el centro. Cada una hace un solo estilo y lo pone en un pizarrín en la puerta. Es la forma de probar la ciudad de noche sin gastar en un bar de hotel.' }
    ],
    tips: [
      { titulo: 'El bondinho no es un bus', texto: 'Es el transporte turístico del centro a la costa y sale mucho más barato que un taxi. El boleto se compra en el punto, no dentro. Si lo pides como si fuera bus urbano te van a hacer esperar.' },
      { titulo: 'Toda la isla es un mismo lugar', texto: 'Florianópolis no es una ciudad con playas: es una ciudad dentro de una isla llena de playas. De la orla a Naufragados hay 40 minutos. Planifica por zona, no por día: cada día haceis una zona y no cruzais el mapa cuatro veces.' },
      { titulo: 'La marea manda, no el pronóstico', texto: 'Media orla es baranda y bloque de cemento. Antes de ir a una playa del centro, mira la tabla de mareas del día: con marea alta el agua desaparece y lo que queda no es un plan de playa.' },
      { titulo: 'Auto solo si vas al sur', texto: 'Para el centro y São Francisco el transporte público alcanza. El auto se justifica unicamente si vas a Naufragados, Bombinhas o a más de una playa del sur en el mismo día. Además, fuera del centro el alojamiento es más barato.' },
      { titulo: 'Horarios raros los fines de semana', texto: 'Muchos lugares del centro cierran a las 15 h un sábado, y el domingo hay más cambios de horario. Para el almuerzo del domingo confirma antes de caminar, o te vas a encontrar todo cerrado.' },
      { titulo: 'La franja no se camina', texto: 'El centro viejo, la Beira-Mar y la plaza se recorren bien a pie, pero entre una cosa y otra hay media hora de caminata con sol. El bondinho pasa por casi todos esos puntos y sale mucho menos que un taxi. Caminar todo el día es la forma más rápida de cansarse sin haber visto nada.' },
      { titulo: 'El centro viejo está donde no lo esperás', texto: 'El centro histórico está en la punta norte de la isla, entre la Beira-Mar y el río. Se llama el viejo porque la parte moderna se construyó hacia el otro lado. Entrar por Beira-Mar Norte y caminar hacia el puente Hercílio es el recorrido que junta todo sin volver atrás.' }
    ]
  },

  sao: {
    region: 'sao-paulo',
    resumen: 'La ciudad más grande del país y la mejor comida de calle de América del sur. No es un destino de playa: es un destino de ciudad.',
    temporada: { alta: [12, 1, 7], baja: [3, 4, 5, 9, 10], nota: 'São Paulo no tiene temporada de playa: tiene temporada de eventos. En verano llueve fuerte casi todas las tardes. De abril a septiembre llueve poco y hace fresco, el mejor momento para caminarla.' },
    beaches: [],
    atracciones: [
      { name: 'Mercado Municipal', zona: 'Centro', lat: -23.5417, lng: -46.6295, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Conservas_en_un_puesto_japones_del_Mercado_Municipal_de_Sao_Paulo.jpg/1280px-Conservas_en_un_puesto_japones_del_Mercado_Municipal_de_Sao_Paulo.jpg', dur: '1 h', usd: 10, nota: 'El edificio de hierro de 1933, con los puestos de comida y el pastel de bacalao. Caro para lo que es, pero es la mejor introducción a la ciudad en una hora.' },
      { name: 'Beco do Batman', zona: 'Vila Madalena', lat: -23.5565, lng: -46.6867, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/ROGERIO_CASSIMIRO_Beco_do_Batman_SAO_PAULO_SP_%2839780582590%29.jpg/1280px-ROGERIO_CASSIMIRO_Beco_do_Batman_SAO_PAULO_SP_%2839780582590%29.jpg', dur: '1 h', usd: 0, nota: 'El callejón de grafitis más famoso de la ciudad. De día es un pasillo con buenas pinturas; de noche es una barra con música en vivo.' },
      { name: 'Catedral da Sé', zona: 'Centro', lat: -23.5513, lng: -46.6344, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/S%C3%A3o_Paulo-_Catedral_da_S%C3%A9_%2815981%29.jpg/1280px-S%C3%A3o_Paulo-_Catedral_da_S%C3%A9_%2815981%29.jpg', dur: '45 min', usd: 0, nota: 'La catedral neogótica más grande de Brasil, con las torres más altas del país. Se sube al mirador y da para ver el centro entero.' },
      { name: 'Museu de Arte de São Paulo', zona: 'Avenida Paulista', lat: -23.5615, lng: -46.656, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/MASP_-_Museu_de_Arte_de_S%C3%A3o_Paulo_%283407312147%29.jpg/1280px-MASP_-_Museu_de_Arte_de_S%C3%A3o_Paulo_%283407312147%29.jpg', dur: '2 h', usd: 6, nota: 'Los cuadros están ordenados por escuela y no por cronología, que es raro y funciona. Se ve de punta a punta en dos horas y es el mejor museo de Brasil.' },
      { name: 'Estação da Luz', zona: 'Centro', lat: -23.5351, lng: -46.6354, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Esta%C3%A7%C3%A3o_da_Luz%2C_S%C3%A3o_Paulo_%280001_50%29.jpg/1280px-Esta%C3%A7%C3%A3o_da_Luz%2C_S%C3%A3o_Paulo_%280001_50%29.jpg', dur: '1 h', usd: 0, nota: 'La estación de tren de 1901, toda de hierro y vidrio, hoy convertida en biblioteca. Se entra gratis, y al lado está la galería de arte, que es de pago pero es chica.' },
      { name: 'Pinacoteca', zona: 'Centro', lat: -23.5343, lng: -46.6339, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Pinacoteca_do_Estado_de_S%C3%A3o_Paulo_%28Lado_oposto%29.jpg/1280px-Pinacoteca_do_Estado_de_S%C3%A3o_Paulo_%28Lado_oposto%29.jpg', dur: '1 h', usd: 5, nota: 'El museo de arte de la ciudad, en un edificio neoclásico. Es la mejor colección de arte brasileño del país, y a diferencia del MASP tiene tiempo para mirar: no son 500 obras de golpe.' },
      { name: 'Memorial da América Latina', zona: 'Barra Funda', lat: -23.5275, lng: -46.6654, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Vista_lateral_3_da_escultura_%22Integra%C3%A7%C3%A3o%22_by_Bruno_Giorgi%2C_1989._Localizada_no_Memorial_da_Am%C3%A9rica_Latina%2C_S%C3%A3o_Paulo_-_SP.jpg/1280px-Vista_lateral_3_da_escultura_%22Integra%C3%A7%C3%A3o%22_by_Bruno_Giorgi%2C_1989._Localizada_no_Memorial_da_Am%C3%A9rica_Latina%2C_S%C3%A3o_Paulo_-_SP.jpg', dur: '2 h', usd: 0, nota: 'Un conjunto de Eichler, Kiko Maugrí y Giancarlo Gasperini, en un parque de 74 hectáreas. Es gratis, es enorme, y casi nadie va: se llena de gente de São Paulo los fines de semana.' },
      { name: 'Edifício Copan', zona: 'Centro', lat: -23.5466, lng: -46.6445, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Edif%C3%ADcio_Copan._-_panoramio_%281%29.jpg/1280px-Edif%C3%ADcio_Copan._-_panoramio_%281%29.jpg', dur: '20 min', usd: 0, nota: 'El edificio ondulado de Oscar Niemeyer, con más de mil departamentos y una forma que se reconoce de lejos. Se mira desde la calle; la azotea se visita con reserva.' },
      { name: 'Theatro Municipal', zona: 'Centro', lat: -23.5453, lng: -46.6386, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Theatro_Municipal_de_S%C3%A3o_Paulo_%2816-06-2024%29.jpg/1280px-Theatro_Municipal_de_S%C3%A3o_Paulo_%2816-06-2024%29.jpg', dur: '45 min', usd: 0, nota: 'La ópera de 1911, con fachada de inspiración parisina y cúpula de vidrio. Se visita por dentro con guía y la plaza de enfrente es de paso obligado en el centro.' },
      { name: 'Edifício Copan', zona: 'Centro', lat: -23.5466, lng: -46.6445, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Edif%C3%ADcio_Copan._-_panoramio_%281%29.jpg/1280px-Edif%C3%ADcio_Copan._-_panoramio_%281%29.jpg', dur: '20 min', usd: 0, nota: 'El edificio ondulado de Oscar Niemeyer, con más de mil departamentos y una forma que se reconoce de lejos. Se mira desde la calle; la azotea se visita con reserva.' },
      { name: 'Theatro Municipal', zona: 'Centro', lat: -23.5453, lng: -46.6386, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Theatro_Municipal_de_S%C3%A3o_Paulo_%2816-06-2024%29.jpg/1280px-Theatro_Municipal_de_S%C3%A3o_Paulo_%2816-06-2024%29.jpg', dur: '45 min', usd: 0, nota: 'La ópera de 1911, con fachada de inspiración parisina y cúpula de vidrio. Se visita por dentro con guía y la plaza de enfrente es de paso obligado en el centro.' }
    ],
    comer: [
      { name: 'Lanche completo', tipo: 'Almuerzo', zona: 'Centro y barrios', usd: 8, momento: 'Mediodía hasta las 15 h', nota: 'Sao Paulo llama "lanches" a lo que en Río es un prato feito: sándwich, papas y bebida por menos de lo que cuesta un café. Es la comida más barata de la ciudad y la del mediodía de la oficina.' },
      { name: 'Cafetería de barrio', tipo: 'Desayuno', zona: 'Vila Madalena y Pinheiros', usd: 5, momento: '7 a 11 h', nota: 'Café con leche y pan con queso. Sentarse en la vereda es parte de la comida. El brunch caro es para el domingo, no entre semana.' },
      { name: 'Feira livre', tipo: 'Compra', zona: 'Cambia por barrio', usd: 5, momento: 'Sábado a la mañana', nota: 'Cada barrio tiene su feria en un día fijo. Averiguá cuál es el tuyo antes de salir y llevá fruta, pan de queso y comida ya hecha.' },
      { name: 'Pastel de feira', tipo: 'Merienda', zona: 'Ferias y bazares', usd: 3, momento: 'Tarde', nota: 'Empanado frito de los que se venden por peso en la feria. Se come caminando y cuesta menos que un refresco.' },
      { name: 'Rodízio de pizza', tipo: 'Cena', zona: 'Perdizes y Mooca', usd: 12, momento: 'Noche', nota: 'Se paga por peso lo que comiste. Es la cena que más rinde de la ciudad si llegaste con hambre.' }
    ],
    hacer: [
      { name: 'Parque Ibirapuera', zona: 'Moema', dur: '2 h', usd: 0, nota: 'El parque más grande de la ciudad, con el museo de arte al lado. Es donde va la gente a correr, y no parece São Paulo: parece cualquier ciudad.' },
      { name: 'Calle de las cervecerías del centro', zona: 'Centro', dur: '3 h', usd: 15, nota: 'Un paseo a pie por el eje São João, probando la cerveza propia de cada bar, que en São Paulo se llama chopp. Es la mejor cerveza de Brasil y sale la mitad que en un restaurante.' }
    ],
    tips: [
      { titulo: 'El metro es la mejor decisión que podés tomar', texto: 'La red es enorme, rápida y cuesta menos que un taxi. Con dos o tres líneas llegás a cualquier barrio en media hora. El problema de São Paulo no es moverse: es el tráfico de superficie, así que evitá el auto.' },
      { titulo: 'Comer en la calle es el plan, no la excepción', texto: 'Esta es la diferencia con el resto de Brasil. Un lanche en la acera sale cinco veces más barato que en un restaurante, y es mejor. La ciudad más grande del mundo come parado.' },
      { titulo: 'Avenida Paulista es para ver, no para comer', texto: 'Paulista es una avenida de lojas de lujo. Para comer, buscá Vila Madalena, Vila Olímpia o el centro: ahí está la comida de verdad a precio de barrio.' },
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
    resumen: 'Las playas famosas de la Zona Sur y la Barra, y las calas chicas entre morros a las que va la gente de Río, todas a menos de una hora del Centro.',
    temporada: { alta: [12, 1, 2, 3], baja: [6, 7, 8], nota: 'De diciembre a marzo hay calor de 35 grados, lluvia corta de tarde y Carnaval con precios al doble. De junio a agosto hace 25 grados, llueve poco y las playas chicas quedan casi vacías entre semana: es la mejor época para esta guía.' },
    beaches: [
      { name: 'Copacabana', zona: 'Zona Sur, 8 km del Centro', lat: -22.9757, lng: -43.1866, foto: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Praia_de_Copacabana_-_Rio_de_Janeiro%2C_Brasil.jpg', vibe: 'Cuatro kilómetros de arena frente al calçadão de mosaico blanco y negro, con vóley, fútbol en la arena y quioscos con agua de coco y cerveza desde temprano. Es la playa con más movimiento de Río y está abierta a toda hora.', cuando: 'Amanecer o atardecer; entre las 11 y las 15 hay más sol y más gente.' },
      { name: 'Ipanema', zona: 'Zona Sur, 9 km del Centro', lat: -22.9873, lng: -43.2021, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Praia_de_Ipanema_Rio_de_Janeiro.jpg/1280px-Praia_de_Ipanema_Rio_de_Janeiro.jpg', vibe: 'Desde la piedra del Arpoador hasta el Leblon, con el Dois Irmãos de fondo. Cada puesto de salvavidas tiene su público: el Arpoador, surfistas y aplausos al sol; el centro, gente joven; hacia el Leblon, familias.', cuando: 'Tarde, para ver el sol caer detrás del Dois Irmãos.' },
      { name: 'Leblon', zona: 'Zona Sur, 10 km del Centro', lat: -22.9879, lng: -43.2244, foto: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Rio_de_Janeiro_Ipanema_%26_Leblon_173_Feb_2006.JPG', vibe: 'La continuación de Ipanema hacia el oeste, más residencial y más tranquila. Es la playa de los vecinos del barrio, con mucha familia y menos ruido que Copacabana.', cuando: 'Mañana, entre semana.' },
      { name: 'Barra da Tijuca', zona: 'Zona Oeste, 19 km del Centro', lat: -23.0132, lng: -43.3197, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Praia_da_Barra_e_Montanhas_do_Parque_Nacional_da_Tijuca.jpg/1280px-Praia_da_Barra_e_Montanhas_do_Parque_Nacional_da_Tijuca.jpg', vibe: 'Una playa larga y ancha de mar abierto, con olas fuertes, quioscos numerados y ciclovía junto a la arena. Hay más espacio que en la Zona Sur y es la playa de los cariocas con auto.', cuando: 'Fin de semana temprano; con olas grandes el baño es riesgoso.' },
      { name: 'Copacabana', zona: 'Zona Sur, 8 km del Centro', lat: -22.9757, lng: -43.1866, foto: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Praia_de_Copacabana_-_Rio_de_Janeiro%2C_Brasil.jpg', vibe: 'Cuatro kilómetros de arena frente al calçadão de mosaico blanco y negro, con vóley, fútbol en la arena y quioscos con agua de coco y cerveza desde temprano. Es la playa con más movimiento de Río y está abierta a toda hora.', cuando: 'Amanecer o atardecer; entre las 11 y las 15 hay más sol y más gente.' },
      { name: 'Ipanema', zona: 'Zona Sur, 9 km del Centro', lat: -22.9873, lng: -43.2021, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Praia_de_Ipanema_Rio_de_Janeiro.jpg/1280px-Praia_de_Ipanema_Rio_de_Janeiro.jpg', vibe: 'Desde la piedra del Arpoador hasta el Leblon, con el Dois Irmãos de fondo. Cada puesto de salvavidas tiene su público: el Arpoador, surfistas y aplausos al sol; el centro, gente joven; hacia el Leblon, familias.', cuando: 'Tarde, para ver el sol caer detrás del Dois Irmãos.' },
      { name: 'Leblon', zona: 'Zona Sur, 10 km del Centro', lat: -22.9879, lng: -43.2244, foto: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Rio_de_Janeiro_Ipanema_%26_Leblon_173_Feb_2006.JPG', vibe: 'La continuación de Ipanema hacia el oeste, más residencial y más tranquila. Es la playa de los vecinos del barrio, con mucha familia y menos ruido que Copacabana.', cuando: 'Mañana, entre semana.' },
      { name: 'Barra da Tijuca', zona: 'Zona Oeste, 19 km del Centro', lat: -23.0132, lng: -43.3197, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Praia_da_Barra_e_Montanhas_do_Parque_Nacional_da_Tijuca.jpg/1280px-Praia_da_Barra_e_Montanhas_do_Parque_Nacional_da_Tijuca.jpg', vibe: 'Una playa larga y ancha de mar abierto, con olas fuertes, quioscos numerados y ciclovía junto a la arena. Hay más espacio que en la Zona Sur y es la playa de los cariocas con auto.', cuando: 'Fin de semana temprano; con olas grandes el baño es riesgoso.' },
      { name: 'Praia Vermelha', zona: 'Urca, 5 km del Centro', lat: -22.9548, lng: -43.164, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_da_Urca_RJ.jpg/1280px-Praia_da_Urca_RJ.jpg', vibe: 'Una cala encajada entre el Pan de Azúcar y el Morro da Babilônia. El agua es calma porque la boca es angosta, y la usan las familias de Urca: el turista pasa por al lado para hacer la fila del bondinho y no baja a la arena.', cuando: 'Todo el año. Temprano entre semana está casi vacía. Es también el punto de partida de la Pista Cláudio Coutinho (ver Qué hacer).' },
      { name: 'Praia do Diabo', zona: 'Entre Arpoador y Copacabana, 9 km del Centro', lat: -22.988, lng: -43.1925, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Arpoador_-_Praia_do_Diabo_RJ.jpg/1280px-Arpoador_-_Praia_do_Diabo_RJ.jpg', vibe: 'Una franja corta de arena entre la Pedra do Arpoador y el Forte de Copacabana. Miles de personas la miran desde la piedra al atardecer y casi nadie baja: es de los surfistas y bodyboarders del barrio.', cuando: 'Con mar calmo, a la mañana. Con olas grandes no es para nadar: la corriente tira hacia las piedras.' },
      { name: 'Praia da Joatinga', zona: 'Joá, entre São Conrado y Barra, 17 km del Centro', lat: -23.0143, lng: -43.2906, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Praia_da_Joatinga_%283539967037%29.jpg/1280px-Praia_da_Joatinga_%283539967037%29.jpg', vibe: 'Una caleta escondida al pie de los acantilados del Joá. Se entra caminando por el condominio y se baja por las piedras. Arena clara, agua verde y casi ningún turista, porque desde la ruta no se ve.', cuando: 'Solo con marea baja: con la alta el mar se come casi toda la arena. Mirá la tabla de mareas antes de ir y no te quedes hasta que oscurezca, porque la subida por las piedras sin luz es peligrosa.' },
      { name: 'Praia do Sossego', zona: 'Niterói, 14 km en línea recta del Centro', lat: -22.9707, lng: -43.0513, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Praia_do_Sossego_-_Niter%C3%B3i_-_RJ_%2815231628881%29.jpg/1280px-Praia_do_Sossego_-_Niter%C3%B3i_-_RJ_%2815231628881%29.jpg', vibe: 'Una cala entre Piratininga y Camboinhas a la que se llega por un sendero corto que baja desde la calle. Sin kioscos ni sillas de alquiler: el nombre ("tranquilidad") es la descripción.', cuando: 'Todo el año, con agua y comida desde el hotel porque no hay nada para comprar. Hay que cruzar el puente Río-Niterói: en auto o Uber es cerca de una hora, más en hora pico.' },
      { name: 'Praia de Itacoatiara', zona: 'Niterói, 16 km en línea recta del Centro', lat: -22.9746, lng: -43.0349, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Praia_de_Itacoatiara_em_Niter%C3%B3i.jpg/1280px-Praia_de_Itacoatiara_em_Niter%C3%B3i.jpg', vibe: 'La playa de los cariocas que cruzan el puente para escaparse de Ipanema. Arena clara entre dos morros del Parque Estadual da Serra da Tiririca, y piletas naturales entre las piedras del costado.', cuando: 'Todo el año. Las olas son fuertes y la bandera roja es frecuente: con mar grande, quedate en las piletas de las piedras y no en el mar abierto. Queda al lado de Sossego y se pueden hacer las dos el mismo día.' },
      { name: 'Ilha de Paquetá', zona: 'Bahía de Guanabara, barca desde Praça XV, 18 km', lat: -22.7602, lng: -43.1063, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Praia_de_Paquet%C3%A1.jpg/1280px-Praia_de_Paquet%C3%A1.jpg', vibe: 'Una isla sin autos dentro de la bahía, con casonas antiguas y playas chicas de agua quieta. Se recorre en bicicleta, y es el paseo de domingo de las familias de la ciudad, no del turismo.', cuando: 'Entre semana, cuando la barca va vacía. El agua de la bahía muchas veces no es apta para bañarse: tomala como un paseo de playa para caminar y mirar, y revisá el boletín de balneabilidad del INEA antes de meterte.' }
    ],
    atracciones: [
      { name: 'Mirante Dona Marta', zona: 'Botafogo', dur: '45 min', usd: 0, nota: 'Desde acá el Cristo queda de frente y el Pan de Azúcar abajo, con toda la bahía de Botafogo en el medio. Es gratis y tiene mucha menos gente que el Corcovado. Se sube en taxi o Uber, y de día.' },
      { name: 'Escadaria Selarón', zona: 'Lapa / Santa Teresa', dur: '30 min', usd: 0, nota: 'La escalera cubierta de azulejos de todo el mundo. Andá temprano: a media mañana se llena de grupos y la foto sale con cincuenta personas.' },
      { name: 'Real Gabinete Português de Leitura', zona: 'Centro', dur: '30 min', usd: 0, nota: 'Una biblioteca del siglo XIX con estanterías de madera tallada hasta el techo. Se entra gratis en horario de oficina y queda a pocas cuadras de cualquier recorrido por el Centro.' }
    ],
    comer: [
      { name: 'Mate de galão y Biscoito Globo', tipo: 'Merienda', zona: 'En la arena, cualquier playa', momento: 'Toda la tarde', nota: 'El mate frío con limón que venden los ambulantes con los tanques al hombro, y la rosquilla de polvilho que viene en bolsa. Es la merienda de playa de todo carioca y no se consigue en un bar.' },
      { name: 'Empada en la Mureta da Urca', tipo: 'Merienda', zona: 'Urca', momento: 'Atardecer', nota: 'Se compran la empada y la cerveza en el bar de la esquina y se comen sentado en el murito, con los pies colgando sobre la bahía. Es el plan de fin de tarde del barrio, a cinco minutos de la Praia Vermelha.' },
      { name: 'Prato feito del Centro', tipo: 'Almuerzo', zona: 'Centro', momento: 'Mediodía, de 11:30 a 14:30', nota: 'Arroz, feijão, farofa, ensalada y una carne por bastante menos que un plato en la Zona Sur. Es la comida de los oficinistas: buscá el cartel escrito a mano en la puerta, no una carta.' },
      { name: 'Pastel con caldo de cana en la feria', tipo: 'Desayuno', zona: 'Ferias de barrio', momento: 'Mañana, hasta las 13', nota: 'Cada barrio tiene su feria libre un día de la semana. El puesto de pastel con jugo de caña recién molido es el desayuno de feria de toda la ciudad.' }
    ],
    hacer: [
      { name: 'Pista Cláudio Coutinho', zona: 'Urca, sale de la Praia Vermelha', dur: '1 h', usd: 0, nota: 'Un camino plano de poco más de un kilómetro al pie del Pan de Azúcar, entre el mar y la selva, con monos tití a la vista. Gratis y con movimiento desde temprano. Es lo más parecido a salir de la ciudad sin salir de ella.' },
      { name: 'Caminho dos Pescadores', zona: 'Leme, punta de Copacabana', dur: '40 min', usd: 0, nota: 'Una pasarela al costado de la Pedra do Leme, sobre el mar, donde pescan los vecinos. Desde la punta se ve Copacabana entera, y casi nadie que se aloja en la otra punta de la playa sabe que existe.' },
      { name: 'Atardecer en la Pedra do Arpoador', zona: 'Arpoador', dur: '1 h', usd: 0, nota: 'El sol se pone detrás del Morro Dois Irmãos y la gente aplaude. Llegá media hora antes para tener lugar en la piedra, y después mirá la Praia do Diabo desde arriba.' }
    ],
    tips: [
      { titulo: 'Prainha y Grumari no están en esta guía', texto: 'Son lindas, pero quedan a casi 40 km del Centro: con el tránsito es más de una hora de ida desde Copacabana. Para medio día de playa, Joatinga o la Praia Vermelha dan lo mismo sin perder la tarde en la ruta.' },
      { titulo: 'La bandera manda', texto: 'Las calas chicas no tienen guardavidas fijo. Bandera roja quiere decir corriente de retorno de verdad, no exageración. En Diabo, Joatinga e Itacoatiara la corriente es el peligro principal.' },
      { titulo: 'No todas las playas están aptas todos los días', texto: 'El INEA publica qué playas están aptas para bañarse. Las de mar abierto casi siempre lo están; las de la bahía (Urca, Paquetá, Botafogo) cambian después de cada lluvia.' },
      { titulo: 'A la arena, liviano', texto: 'Celular en el bolsillo, nada de valor a la vista y un billete chico para el ambulante. En las calas chicas no hay dónde dejar las cosas, así que conviene ir liviano.' }
    ]
  },

  buz: {
    resumen: 'Una península con más de veinte playas a pocos minutos una de otra. Las mejores son las chicas y de agua quieta, no la que sale en la foto de la Rua das Pedras.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'De diciembre a febrero y en Carnaval los precios se duplican y la Rua das Pedras se llena de noche. De abril a junio y en septiembre el agua sigue tibia, hay sol y se consigue lugar en cualquier playa sin madrugar.' },
    beaches: [
      { name: 'Praia dos Ossos', zona: 'Centro', lat: -22.746, lng: -41.8814, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Praia_dos_Ossos%2C_246_-_Village_de_B%C3%BAzios%2C_B%C3%BAzios_-_RJ%2C_28950-000%2C_Brazil_-_panoramio.jpg/1280px-Praia_dos_Ossos%2C_246_-_Village_de_B%C3%BAzios%2C_B%C3%BAzios_-_RJ%2C_28950-000%2C_Brazil_-_panoramio.jpg', vibe: 'La playa del pueblo, al pie de la Igreja de Sant\'Ana, con los barcos de pesca fondeados. El agua es quieta y de acá salen los taxis-barco a las otras playas.', cuando: 'Temprano a la mañana, antes de que lleguen los barcos de paseo.' },
      { name: 'Azeda y Azedinha', zona: 'A pie desde Ossos', lat: -22.7422, lng: -41.8818, foto: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Azeda.jpg', vibe: 'Dos calas de agua transparente a las que se baja por un sendero corto desde Ossos. Son chicas y se llenan rápido: el que llega a las 9 elige lugar.', cuando: 'Mañana. Después del mediodía no queda arena libre en temporada.' },
      { name: 'João Fernandes', zona: 'Norte de la península', lat: -22.7418, lng: -41.8745, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_Jo%C3%A3o_Fernandes_-_Arma%C3%A7%C3%A3o_de_B%C3%BAzios-RJ.jpg/1280px-Praia_Jo%C3%A3o_Fernandes_-_Arma%C3%A7%C3%A3o_de_B%C3%BAzios-RJ.jpg', vibe: 'La mejor para snorkel sin barco: agua verde, quieta y con peces a tres metros de la orilla. Tiene restaurantes sobre la arena, más caros que en el pueblo.', cuando: 'Todo el año. Llevá máscara propia: el alquiler sale casi lo mismo que comprarla.' },
      { name: 'Praia do Forno', zona: 'Detrás de la Praia Brava', lat: -22.7614, lng: -41.8749, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Ba%C3%ADa_da_Praia_do_Forno.JPG/1280px-Ba%C3%ADa_da_Praia_do_Forno.JPG', vibe: 'Arena rojiza y agua fría y clara, en una bahía cerrada a la que se llega por un sendero de diez minutos. No hay calle, así que no hay multitud.', cuando: 'Días sin viento sur. Llevá agua: arriba no venden nada.' },
      { name: 'Praia da Tartaruga', zona: 'Camino a Ferradura', lat: -22.7567, lng: -41.9066, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Praia_da_Tartaruga_-_B%C3%BAzios_-_RJ_Imagem_A%C3%A9rea.jpg/1280px-Praia_da_Tartaruga_-_B%C3%BAzios_-_RJ_Imagem_A%C3%A9rea.jpg', vibe: 'Agua muy calma y tortugas que comen pasto marino cerca de la orilla. Es la que eligen las familias del lugar.', cuando: 'Mañana, cuando el agua está más clara.' },
      { name: 'Geribá', zona: 'Sur de la península', lat: -22.7804, lng: -41.9136, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Praia_de_Gerib%C3%A1_deserta_durante_a_pandemia_de_COVID-19.jpg/1280px-Praia_de_Gerib%C3%A1_deserta_durante_a_pandemia_de_COVID-19.jpg', vibe: 'La playa larga de olas, con surf y la gente joven de Búzios. Es la opción cuando las calas del norte están llenas.', cuando: 'Tarde, para el atardecer del lado de la ruta.' }
    ],
    atracciones: [
      { name: 'Orla Bardot', zona: 'Centro', dur: '45 min', usd: 0, nota: 'La rambla de piedra que une el centro con Ossos, con la estatua de Brigitte Bardot. Se recorre caminando al atardecer, cuando el sol baja sobre la bahía.' },
      { name: 'Mirante do Forno', zona: 'Praia Brava', dur: '30 min', usd: 0, nota: 'El mirador del sendero que baja a la Praia do Forno. Desde arriba se ven las dos bahías: la que sale en todas las fotos de Búzios.' },
      { name: 'Igreja de Sant\'Ana', zona: 'Ossos', dur: '20 min', usd: 0, nota: 'La capilla blanca sobre la piedra, del siglo XVIII. Arriba hay un banco con la mejor vista de la Praia dos Ossos.' }
    ],
    comer: [
      { name: 'Prato feito del centro', tipo: 'Almuerzo', zona: 'Calles de atrás de la Rua das Pedras', usd: 10, momento: 'Mediodía', nota: 'Arroz, feijão, ensalada y pescado del día. A dos cuadras de la rambla cuesta la mitad que en la Rua das Pedras.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro y Manguinhos', usd: 9, momento: 'De 11 a 15 h', nota: 'Bufé que se paga por peso. Es lo que comen los que trabajan en Búzios, y se elige solo lo que se quiere.' },
      { name: 'Pastel y caldo de cana', tipo: 'Merienda', zona: 'Feria de Manguinhos', usd: 4, momento: 'Tarde', nota: 'Pastel frito recién hecho con jugo de caña. La merienda barata de la península.' },
      { name: 'Pescado frito en la playa', tipo: 'Cena', zona: 'Ossos y Manguinhos', usd: 16, momento: 'Noche', nota: 'Porción de pescado frito o casquinha de siri para compartir. Pedí la porción para dos: alcanza para tres.' }
    ],
    hacer: [
      { name: 'Taxi-barco por las calas', zona: 'Sale de Ossos', dur: '3 h', usd: 20, nota: 'Te deja en João Fernandes, Azeda o Tartaruga y te busca a la hora que digas. Sale más barato que el paseo en escuna y no vas con cien personas.' },
      { name: 'Snorkel en João Fernandes', zona: 'Norte', dur: '2 h', usd: 0, nota: 'Con máscara propia y desde la orilla. El lado derecho de la playa, junto a las piedras, es donde hay más peces.' },
      { name: 'Atardecer en la Orla Bardot', zona: 'Centro', dur: '1 h', usd: 0, nota: 'El sol se pone sobre el mar del lado del pueblo. Los bares de la rambla se llenan; en la piedra de la punta hay lugar.' }
    ],
    tips: [
      { titulo: 'Las calas se llenan a media mañana', texto: 'Azeda, Forno y João Fernandes son chicas. En temporada, a las 11 ya no hay arena libre. Ir temprano y volver a comer al pueblo es el plan que funciona.' },
      { titulo: 'La Rua das Pedras es para mirar', texto: 'De noche es la calle más linda de Búzios y la más cara. Para comer conviene ir dos cuadras hacia adentro y volver a caminar por la rambla.' },
      { titulo: 'El agua es fría', texto: 'Búzios recibe corrientes del sur y el agua está bastante más fría que en el Nordeste, incluso en verano. Las calas del norte son las más tibias.' }
    ]
  },

  arraial: {
    resumen: 'El agua más transparente del estado de Río, en playas a las que se llega caminando desde el pueblo o en un barco de pescadores.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'En enero y Carnaval el pueblo recibe más gente de la que entra y los barcos a la Praia do Farol se agotan. En abril, mayo y septiembre el agua sigue clara, hace calor y los paseos salen sin espera.' },
    beaches: [
      { name: 'Praia dos Anjos', zona: 'Puerto', lat: -22.973, lng: -42.0206, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Praia_dos_Anjos.JPG/1280px-Praia_dos_Anjos.JPG', vibe: 'El puerto de los pescadores, de agua quieta y verde. Desde acá salen todos los barcos a la isla del Farol y a las playas sin calle.', cuando: 'Temprano, para salir en el primer barco.' },
      { name: 'Praia do Forno', zona: 'A pie desde Anjos', lat: -22.9661, lng: -42.0154, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Praia_do_Forno_-_Arraial.jpg/1280px-Praia_do_Forno_-_Arraial.jpg', vibe: 'Una bahía de agua transparente a la que se llega por un sendero de quince minutos detrás del puerto, o en barco. Sin calle y sin autos.', cuando: 'Mañana, antes de que lleguen los barcos de paseo.' },
      { name: 'Prainhas do Pontal do Atalaia', zona: 'Pontal do Atalaia', lat: -22.9688, lng: -41.9994, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Pontal_do_Atalaia_Arraial_do_Cabo2.jpg/1280px-Pontal_do_Atalaia_Arraial_do_Cabo2.jpg', vibe: 'Dos playas chicas entre piedras, con una escalera de madera que baja desde el mirador. Es la postal de Arraial y el agua parece de piscina.', cuando: 'Antes de las 10: después se arma fila en la escalera.' },
      { name: 'Praia Grande', zona: 'Centro', lat: -22.9707, lng: -42.0333, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Praia_Grande_-_Arraial_do_Cabo_-_panoramio_%2820%29.jpg/1280px-Praia_Grande_-_Arraial_do_Cabo_-_panoramio_%2820%29.jpg', vibe: 'La playa larga de mar abierto, de agua fría y muy clara. Hay olas y lugar de sobra: es donde va la gente del pueblo.', cuando: 'Tarde, para el atardecer.' },
      { name: 'Praia do Farol', zona: 'Ilha do Cabo Frio, en barco', lat: -23.0015, lng: -42.0038, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/VistaPraiadoFarol-Arraial_do_Cabo-feb2016.jpg/1280px-VistaPraiadoFarol-Arraial_do_Cabo-feb2016.jpg', vibe: 'Arena blanca y agua turquesa en una isla protegida por la Marina. Solo se llega con los barcos autorizados del puerto y la estadía es corta.', cuando: 'Días de mar calmo: con viento el barco no para en la isla.' }
    ],
    atracciones: [
      { name: 'Mirante do Pontal do Atalaia', zona: 'Pontal do Atalaia', dur: '40 min', usd: 0, nota: 'El mirador sobre las Prainhas, con las dos bahías a los costados. Se llega en taxi o en una caminata en subida desde el centro.' },
      { name: 'Gruta Azul', zona: 'Ilha do Cabo Frio', dur: '20 min', usd: 0, nota: 'Una cueva en la roca donde el agua se pone azul eléctrico. Se ve desde el barco, en el paseo que sale de Praia dos Anjos.' },
      { name: 'Igreja de Nossa Senhora dos Remédios', zona: 'Praia dos Anjos', dur: '20 min', usd: 0, nota: 'La iglesia de los pescadores, del siglo XVI, frente al puerto. Al lado está el mercado de pescado.' }
    ],
    comer: [
      { name: 'Pescado del día en el puerto', tipo: 'Almuerzo', zona: 'Praia dos Anjos', usd: 12, momento: 'Mediodía', nota: 'Los restaurantes frente al puerto sirven lo que entró esa mañana, frito o a la plancha, con arroz y pirão.' },
      { name: 'Prato feito', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'El plato del día de los bares del centro, lejos de la rambla. Es la comida barata del pueblo.' },
      { name: 'Açaí en la plaza', tipo: 'Merienda', zona: 'Praça da Bandeira', usd: 5, momento: 'Tarde', nota: 'Bowl de açaí con banana y granola. Después de un día de playa es lo que pide todo el mundo.' }
    ],
    hacer: [
      { name: 'Paseo en barco a la isla del Farol', zona: 'Sale de Praia dos Anjos', dur: '4 h', usd: 20, nota: 'Recorre Forno, Prainhas, Gruta Azul y para en la Praia do Farol. Elegí barco chico y preguntá cuánto tiempo paran en la isla.' },
      { name: 'Sendero a la Praia do Forno', zona: 'Praia dos Anjos', dur: '1 h', usd: 0, nota: 'Sube por detrás del puerto y baja a la bahía. Corto, con piedra suelta: zapatillas, no ojotas.' },
      { name: 'Buceo bautismo', zona: 'Praia dos Anjos', dur: '3 h', usd: 60, nota: 'Arraial es la capital del buceo del país por la claridad del agua. El bautismo con instructor no necesita curso previo.' }
    ],
    tips: [
      { titulo: 'El agua es fría a propósito', texto: 'La claridad viene de una corriente de agua fría del fondo del mar. En verano el agua puede estar a 18 grados. Es normal y no cambia en un mes.' },
      { titulo: 'El barco, temprano', texto: 'Los paseos salen desde las 9 y en temporada se agotan. Reservalo el día anterior en el puerto y pagá en efectivo para conseguir mejor precio.' },
      { titulo: 'El viento decide el día', texto: 'Con viento del nordeste el agua del lado del puerto queda quieta y la Praia Grande con olas. Con viento sur es al revés. Mirá el viento antes de elegir playa.' }
    ]
  },

  cabo: {
    resumen: 'La ciudad más grande de la Región de los Lagos: playa larga de arena blanca, dunas y calas con agua clara a pocos minutos del centro.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'En verano y fines de semana largos la ciudad se llena con gente de Río y la Praia do Forte no tiene lugar. Entre marzo y mayo hay sol, agua clara y precios de temporada baja.' },
    beaches: [
      { name: 'Praia do Forte', zona: 'Centro', lat: -22.8866, lng: -42.0182, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Praia_do_Forte_-_Cabo_Frio_-_RJ_-_panoramio.jpg/1280px-Praia_do_Forte_-_Cabo_Frio_-_RJ_-_panoramio.jpg', vibe: 'La playa principal, larga y de arena muy blanca, con el fuerte de São Mateus en la punta. Agua fría y clara, con olas suaves.', cuando: 'Mañana. En verano, de tarde no hay dónde poner la sombrilla.' },
      { name: 'Ilha do Japonês', zona: 'Canal de Itajuru', lat: -22.8814, lng: -42.0049, foto: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Ilha_do_Japon%C3%AAs_em_Cabo_Frio%2C_Regi%C3%A3o_dos_lagos-RJ.JPG', vibe: 'Una isla chica en el canal, con agua bajita y tibia. Se cruza en bote desde el Bairro da Passagem o caminando con marea baja.', cuando: 'Marea baja: el agua llega a la cintura.' },
      { name: 'Praia das Conchas', zona: 'Peró', lat: -22.8697, lng: -41.9831, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Mirante_da_Praia_das_Conchas_-_Cabo_Frio._%286894111536%29.jpg', vibe: 'Una cala con forma de herradura y agua muy calma, entre piedras. Ideal para nadar sin olas.', cuando: 'Todo el día; es más tranquila entre semana.' },
      { name: 'Praia do Peró', zona: 'Norte', lat: -22.845, lng: -41.9839, foto: 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Praia_do_Per%C3%B3%2C_no_Parque_Estadual_da_costa_do_Sol_em_Cabo_Frio-RJ.JPG', vibe: 'Una playa larga dentro del parque estatal, con dunas detrás y sin edificios. Hay lugar aunque la ciudad esté llena.', cuando: 'Tarde. El viento sube después del mediodía y llegan los kitesurfistas.' },
      { name: 'Praia das Dunas', zona: 'Sur del centro', lat: -22.8963, lng: -42.0273, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Praia_das_Dunas%2C_Cabo_Frio_em_2013.jpg/1280px-Praia_das_Dunas%2C_Cabo_Frio_em_2013.jpg', vibe: 'Dunas altas de arena blanca y mar abierto. Es la continuación de la Praia do Forte, sin la gente.', cuando: 'Mañana. Llevá agua: no hay quioscos en toda la orilla.' }
    ],
    atracciones: [
      { name: 'Forte São Mateus', zona: 'Praia do Forte', dur: '30 min', usd: 1, nota: 'El fuerte del siglo XVII sobre las piedras de la punta. Desde arriba se ve toda la Praia do Forte.' },
      { name: 'Bairro da Passagem', zona: 'Centro', dur: '1 h', usd: 0, nota: 'El barrio colonial junto al canal, con casas bajas y la capilla de São Benedito. Al atardecer se cruzan los botes a la Ilha do Japonês.' },
      { name: 'Morro da Guia', zona: 'Centro', dur: '45 min', usd: 0, nota: 'La capilla del siglo XVIII sobre un cerro, con vista al canal y a las salinas.' }
    ],
    comer: [
      { name: 'Comida por kilo del centro', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso a dos cuadras de la playa. Es el almuerzo de quien vive en la ciudad.' },
      { name: 'Pescado en el canal', tipo: 'Cena', zona: 'Rua dos Biquínis / Passagem', usd: 15, momento: 'Noche', nota: 'Porción de pescado o camarón para compartir en los bares sobre el canal de Itajuru.' },
      { name: 'Milho cozido y queijo coalho', tipo: 'Merienda', zona: 'En la arena', usd: 3, momento: 'Toda la tarde', nota: 'Choclo hervido y queso a la brasa que venden los ambulantes. La merienda de playa más barata.' }
    ],
    hacer: [
      { name: 'Paseo en barco por las islas', zona: 'Sale del canal', dur: '2 h', usd: 15, nota: 'Recorre la Ilha do Japonês, la Praia do Forte y las calas de la costa. Elegí barco chico y preguntá si para a nadar.' },
      { name: 'Caminata por las dunas', zona: 'Praia das Dunas', dur: '1 h 30', usd: 0, nota: 'Desde el final de la Praia do Forte hacia el sur, por arriba de las dunas. Mejor al atardecer.' },
      { name: 'Rua dos Biquínis', zona: 'Gamboa', dur: '1 h', usd: 0, nota: 'Una calle entera de fábricas de bikinis que venden directo. Los precios son de fábrica, no de shopping.' }
    ],
    tips: [
      { titulo: 'Cabo Frio sirve de base', texto: 'Arraial do Cabo está a 15 km y Búzios a 25 km. Si te alojás en Cabo Frio, se llega a las dos en ómnibus urbano.' },
      { titulo: 'Fin de semana, otra ciudad', texto: 'Los sábados y domingos llega la gente de Río y el tránsito en la entrada es de horas. Las playas lejanas, como el Peró, se aprovechan mejor entre semana.' },
      { titulo: 'El agua es clara pero fría', texto: 'Igual que en Arraial, la corriente fría del fondo deja el agua transparente y a menos de 20 grados en algunos días de verano.' }
    ]
  },

  ilha: {
    resumen: 'Una isla sin autos, con selva hasta el agua. Todo se hace a pie o en barco desde la Vila do Abraão, y las mejores playas están a una caminata de distancia.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'De diciembre a febrero llueve casi todas las tardes y la Vila do Abraão se llena. De abril a junio y en septiembre los senderos están secos, el agua sigue tibia y los barcos salen sin espera.' },
    beaches: [
      { name: 'Praia Preta', zona: 'A pie desde Abraão', lat: -23.1318, lng: -44.1699, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/PraiaPreta-IlhaGrande1.jpg/1280px-PraiaPreta-IlhaGrande1.jpg', vibe: 'Una playa de arena oscura a diez minutos del muelle, con las ruinas del antiguo lazareto al lado. Agua calma y sombra de árboles.', cuando: 'Cualquier momento; ideal el primer día, recién llegado.' },
      { name: 'Abraãozinho', zona: 'Sendero o taxi-barco', lat: -23.1349, lng: -44.1516, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Praia_do_Abra%C3%A3ozinho.jpg/1280px-Praia_do_Abra%C3%A3ozinho.jpg', vibe: 'Una cala chica de agua transparente, a media hora a pie por la costa. Hay un solo bar y casi siempre lugar.', cuando: 'Mañana; de tarde llegan los taxi-barcos.' },
      { name: 'Palmas', zona: 'Sendero T10', lat: -23.1458, lng: -44.139, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Praia_de_Palmas%2C_Ilha_Grande%2C_Angra_dos_Reis.jpg/1280px-Praia_de_Palmas%2C_Ilha_Grande%2C_Angra_dos_Reis.jpg', vibe: 'Playa tranquila con un pueblito de pescadores, de camino a Lopes Mendes. Buen lugar para almorzar pescado y seguir caminando.', cuando: 'Mediodía, como parada del sendero.' },
      { name: 'Lopes Mendes', zona: 'Costa sur, sendero o barco + sendero', lat: -23.172, lng: -44.138, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Ilha_Grande_-_Lopes_Mendes_-_panoramio_%2816%29.jpg/1280px-Ilha_Grande_-_Lopes_Mendes_-_panoramio_%2816%29.jpg', vibe: 'Tres kilómetros de arena blanca que cruje al pisar y mar abierto con olas. Es la playa más famosa de la isla y aun así nunca parece llena.', cuando: 'Día entero. Volvé con tiempo: el último taxi-barco de Pouso sale a media tarde.' },
      { name: 'Dois Rios', zona: 'Costa sur, 8 km por camino de tierra', lat: -23.1844, lng: -44.1895, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Dois_Rios_-_panoramio_%289%29.jpg/1280px-Dois_Rios_-_panoramio_%289%29.jpg', vibe: 'Una playa larga entre dos ríos, al lado de lo que fue el presidio de la isla. Casi sin gente y con agua dulce para sacarse la sal.', cuando: 'Día entero de caminata. Llevá comida y agua.' },
      { name: 'Lagoa Azul', zona: 'Norte de la isla, en barco', lat: -23.0831, lng: -44.2291, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Lagoa_Azul_%2831358908884%29.jpg/1280px-Lagoa_Azul_%2831358908884%29.jpg', vibe: 'No es una playa sino una bahía de agua quieta entre islotes, llena de peces. Se nada con máscara desde el barco.', cuando: 'Mañana, con mar calmo, en el paseo de barco.' }
    ],
    atracciones: [
      { name: 'Aqueduto y Cachoeira da Feiticeira', zona: 'A pie desde Abraão', dur: '2 h', usd: 0, nota: 'El acueducto de piedra del siglo XIX en medio de la selva, y una cascada con pozo para bañarse un poco más arriba.' },
      { name: 'Ruínas do Lazareto', zona: 'Praia Preta', dur: '30 min', usd: 0, nota: 'Lo que queda del antiguo hospital de cuarentena, entre la selva y el mar. De camino a la Praia Preta.' },
      { name: 'Igreja de São Sebastião', zona: 'Vila do Abraão', dur: '15 min', usd: 0, nota: 'La iglesia blanca frente al muelle, la foto de llegada de la isla.' }
    ],
    comer: [
      { name: 'Prato feito de la Vila', tipo: 'Almuerzo', zona: 'Calles de adentro de Abraão', usd: 10, momento: 'Mediodía', nota: 'Pescado, arroz, feijão y ensalada. Una cuadra hacia adentro desde la orilla cuesta bastante menos.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila do Abraão', usd: 9, momento: 'De 11 a 15 h', nota: 'Bufé por peso, lo más barato para comer bien antes de un sendero.' },
      { name: 'Pescado en Palmas', tipo: 'Almuerzo', zona: 'Praia de Palmas', usd: 14, momento: 'Mediodía', nota: 'Los bares de pescadores de Palmas sirven el pescado del día de camino a Lopes Mendes.' }
    ],
    hacer: [
      { name: 'Sendero a Lopes Mendes', zona: 'Abraão → Pouso → Lopes Mendes', dur: '2 h 30', usd: 0, nota: 'El sendero T10 cruza la selva por Palmas y Pouso. Se puede ir caminando y volver en taxi-barco desde Pouso.' },
      { name: 'Paseo de barco a Lagoa Azul', zona: 'Sale del muelle', dur: '6 h', usd: 30, nota: 'Para en Lagoa Azul, Lagoa Verde y playas del norte. Se nada con máscara en aguas quietas.' },
      { name: 'Pico do Papagaio', zona: 'Centro de la isla', dur: '6 h', usd: 0, nota: 'La caminata más dura de la isla: casi mil metros de subida. Solo con guía y saliendo de madrugada para ver el amanecer.' }
    ],
    tips: [
      { titulo: 'No hay cajeros confiables', texto: 'En Abraão hay pocos cajeros y se quedan sin plata. Llevá efectivo desde el continente: muchos barcos y bares no aceptan tarjeta.' },
      { titulo: 'El último barco manda', texto: 'Los taxi-barcos de vuelta desde Pouso y Lopes Mendes tienen último horario. Preguntalo al salir: perderlo es caminar dos horas de noche por la selva.' },
      { titulo: 'Lluvia de tarde en verano', texto: 'En verano llueve casi todas las tardes. Los senderos se hacen de mañana y la tarde se deja para la Vila.' }
    ]
  },

  paraty: {
    resumen: 'Un pueblo colonial de calles de piedra frente a una bahía con islas. Las playas del pueblo son tranquilas; las de agua clara están a un barco o a un ómnibus de distancia.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'De diciembre a marzo llueve fuerte casi todas las tardes y con marea alta el agua entra en las calles del centro. Entre mayo y septiembre hay menos lluvia, días claros y precios más bajos.' },
    beaches: [
      { name: 'Praia do Pontal', zona: 'Cruzando el puente del centro', lat: -23.2151, lng: -44.7115, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Turistas_na_Praia_do_Pontal_-_Paraty%28RJ%29.jpg/1280px-Turistas_na_Praia_do_Pontal_-_Paraty%28RJ%29.jpg', vibe: 'La playa del pueblo, con bares sobre la arena y vista a la bahía. No es la del agua clara: es la de la cerveza al atardecer.', cuando: 'Atardecer.' },
      { name: 'Jabaquara', zona: 'Norte del centro', lat: -23.2131, lng: -44.7146, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Praia_do_Jabaquara_-_Paraty_%284157533641%29.jpg/1280px-Praia_do_Jabaquara_-_Paraty_%284157533641%29.jpg', vibe: 'Agua bajita y quieta, con barro de manglar en una punta que la gente usa como mascarilla. La playa de las familias.', cuando: 'Mañana, con marea alta para poder nadar.' },
      { name: 'Praia Vermelha', zona: 'En barco por la bahía', lat: -23.1959, lng: -44.6446, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Praia_Vermelha_-_Paraty.jpg/1280px-Praia_Vermelha_-_Paraty.jpg', vibe: 'Arena rojiza y agua verde y quieta, frente a una isla. Solo se llega en barco o por un sendero desde la ruta.', cuando: 'En el paseo de barco por la bahía.' },
      { name: 'Praia do Meio (Trindade)', zona: 'Trindade, 15 km', lat: -23.3536, lng: -44.7264, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Praia_do_Meio_Trindade_Paraty_BR.jpg/1280px-Praia_do_Meio_Trindade_Paraty_BR.jpg', vibe: 'Una cala entre piedras gigantes con agua quieta, en el pueblo hippie de Trindade. Al lado está la piscina natural del Cachadaço.', cuando: 'Mañana. En verano el estacionamiento se llena a las 10.' },
      { name: 'Cachadaço', zona: 'Trindade, 15 km', lat: -23.3568, lng: -44.7309, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Cachada%C3%A7o_Paraty.jpg/1280px-Cachada%C3%A7o_Paraty.jpg', vibe: 'Una playa salvaje con una piscina natural entre rocas a la que se llega por un sendero desde la Praia do Meio.', cuando: 'Marea baja: con marea alta la piscina se mezcla con el mar.' },
      { name: 'Praia do Sono', zona: 'Sendero desde Laranjeiras, 15 km', lat: -23.3342, lng: -44.6326, foto: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Praia_Sono.jpg', vibe: 'Una playa larga sin calle, con una comunidad de pescadores y camping. Se llega con una caminata de una hora por la selva.', cuando: 'Día entero. Volvé antes de que oscurezca.' }
    ],
    atracciones: [
      { name: 'Centro Histórico', zona: 'Centro', dur: '2 h', usd: 0, nota: 'Calles de piedra irregular y casas coloniales blancas. Sin autos. De noche, con los faroles, es otro pueblo.' },
      { name: 'Igreja de Santa Rita', zona: 'Centro Histórico', dur: '20 min', usd: 1, nota: 'La iglesia blanca frente al agua, la postal de Paraty. Adentro hay un pequeño museo de arte sacro.' },
      { name: 'Forte Defensor Perpétuo', zona: 'Morro do Forte', dur: '40 min', usd: 0, nota: 'Un fuerte del siglo XVIII sobre el cerro, a quince minutos a pie del centro, con vista a la bahía.' }
    ],
    comer: [
      { name: 'Prato feito fuera del centro', tipo: 'Almuerzo', zona: 'Del otro lado de la ruta', usd: 9, momento: 'Mediodía', nota: 'El centro histórico es caro. Del otro lado de la avenida principal el mismo plato cuesta la mitad.' },
      { name: 'Cachaça de alambique', tipo: 'Degustación', zona: 'Alambiques de la ruta', usd: 0, momento: 'Tarde', nota: 'Paraty tiene fama por la cachaça. Los alambiques de la ruta a Cunha dan degustación gratis.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Puestos del puerto', usd: 4, momento: 'Tarde', nota: 'Pastel frito relleno de camarón, en los puestos junto al muelle.' }
    ],
    hacer: [
      { name: 'Paseo en barco por la bahía', zona: 'Sale del muelle', dur: '5 h', usd: 25, nota: 'Para en islas y playas como la Vermelha y la Lula. Hay escunas grandes y barcos chicos; el chico para más y en lugares más tranquilos.' },
      { name: 'Cascadas de la ruta a Cunha', zona: 'Penha, 10 km', dur: '3 h', usd: 0, nota: 'La Cachoeira do Tobogã es una piedra lisa por la que los locales se tiran al pozo. Al lado hay más cascadas chicas.' },
      { name: 'Trindade en ómnibus', zona: 'Sale de la terminal', dur: 'Día entero', usd: 3, nota: 'El ómnibus urbano llega a Trindade en una hora. Es la forma más barata de ir a las playas de agua clara.' }
    ],
    tips: [
      { titulo: 'Las calles de piedra', texto: 'El empedrado es irregular a propósito, para dejar pasar el agua. Ojotas o sandalias planas: con taco no se camina.' },
      { titulo: 'La marea entra al centro', texto: 'Con luna llena y marea alta el agua sube por algunas calles. Es normal, dura una hora y es parte del pueblo.' },
      { titulo: 'Las playas de agua clara están lejos', texto: 'Las del centro son de bahía, de agua quieta y verdosa. Para agua transparente hay que ir a Trindade o salir en barco.' }
    ]
  },

  angra: {
    resumen: 'Una bahía con más de trescientas islas. La ciudad es de paso: lo que vale la pena está en el agua, a un barco de distancia.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'En verano llueve casi todas las tardes y los barcos van llenos. De abril a junio y en septiembre el mar está calmo, el agua sigue tibia y los paseos salen con lugar.' },
    beaches: [
      { name: 'Praia do Bonfim', zona: '3 km del centro', lat: -23.0208, lng: -44.3327, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Ba%C3%ADa_de_angra_Igreja_do_bonfim.jpg/1280px-Ba%C3%ADa_de_angra_Igreja_do_bonfim.jpg', vibe: 'Una playa chica frente a islotes, con la capilla do Bonfim en una isla a la que se cruza caminando. La playa de la ciudad.', cuando: 'Tarde, después de los paseos de barco.' },
      { name: 'Ilha da Gipóia', zona: 'En barco, 20 min', lat: -23.0459, lng: -44.357, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Ilha_da_Gip%C3%B3ia%2C_Angra_dos_Reis_-_RJ%2C_Brazil_-_panoramio_%288%29.jpg/1280px-Ilha_da_Gip%C3%B3ia%2C_Angra_dos_Reis_-_RJ%2C_Brazil_-_panoramio_%288%29.jpg', vibe: 'La isla grande frente a la ciudad, con playas de agua verde como la Praia do Dentista y la Praia da Juliana. Barcos con bar fondean y la gente nada desde la cubierta.', cuando: 'Mañana, en el paseo de barco.' },
      { name: 'Lagoa Azul', zona: 'Ilha Grande, en barco', lat: -23.0831, lng: -44.2291, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Lagoa_Azul_%2831358908884%29.jpg/1280px-Lagoa_Azul_%2831358908884%29.jpg', vibe: 'Bahía de agua quieta y transparente entre islotes, con cardúmenes que se acercan al barco. La parada más famosa de los paseos.', cuando: 'Mañana, con mar calmo.' }
    ],
    atracciones: [
      { name: 'Igreja e Convento do Carmo', zona: 'Centro', dur: '30 min', usd: 0, nota: 'Iglesia colonial del siglo XVII en el centro de Angra. Lo poco del pueblo antiguo que queda en pie.' },
      { name: 'Capela do Bonfim', zona: 'Praia do Bonfim', dur: '30 min', usd: 0, nota: 'Una capilla del siglo XVIII en una isla a la que se cruza por una pasarela. Vista a todas las islas de la bahía.' },
      { name: 'Cais de Santa Luzia', zona: 'Centro', dur: '20 min', usd: 0, nota: 'El muelle de donde salen los barcos a Ilha Grande y a las islas. Al atardecer vuelven las escunas.' }
    ],
    comer: [
      { name: 'Comida por kilo del centro', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato antes o después de un día en barco.' },
      { name: 'Pescado frito en Bonfim', tipo: 'Almuerzo', zona: 'Praia do Bonfim', usd: 14, momento: 'Mediodía', nota: 'Porciones de pescado o calamar para compartir frente a los islotes.' },
      { name: 'Almuerzo en el barco', tipo: 'Almuerzo', zona: 'Paseo de escuna', usd: 15, momento: 'Mediodía', nota: 'Muchos paseos incluyen almuerzo o lo venden a bordo. Preguntá antes: a veces sale más barato llevar el propio.' }
    ],
    hacer: [
      { name: 'Paseo de escuna por las islas', zona: 'Sale del Cais de Santa Luzia', dur: '6 h', usd: 30, nota: 'Recorre Gipóia, Lagoa Azul y playas de Ilha Grande con paradas para nadar. Elegí uno con barco chico.' },
      { name: 'Barco a Ilha Grande', zona: 'Cais de Santa Luzia', dur: '1 h 30', usd: 8, nota: 'La barca pública a la Vila do Abraão es la forma más barata de cruzar. Las lanchas rápidas tardan la mitad y cuestan el triple.' },
      { name: 'Snorkel en Lagoa Azul', zona: 'Ilha Grande', dur: '1 h', usd: 0, nota: 'Llevá máscara propia: en la parada se ven cientos de peces sin bajar más de un metro.' }
    ],
    tips: [
      { titulo: 'La ciudad no es la playa', texto: 'Angra es una ciudad portuaria y comercial. Las playas lindas están en las islas, así que el día se planifica alrededor del barco.' },
      { titulo: 'Escuna chica, mejor paseo', texto: 'Las escunas grandes llevan a cien personas, con música alta y paradas cortas. Los barcos chicos cuestan un poco más y paran donde las grandes no entran.' },
      { titulo: 'Efectivo a mano', texto: 'Muchos barcos y vendedores de las islas no tienen posnet. Llevá reales en efectivo.' }
    ]
  },

  ilhabela: {
    resumen: 'Una isla de montaña con selva hasta el mar. Las playas del lado del continente son tranquilas; las del otro lado, salvajes y difíciles de llegar.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'En verano la balsa desde São Sebastião tiene horas de espera y llueve de tarde. De abril a junio y en septiembre la isla está tranquila y el agua sigue templada.' },
    beaches: [
      { name: 'Praia do Curral', zona: 'Sur, por la ruta costera', lat: -23.8664, lng: -45.4318, foto: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Praia_do_Curral%2C_Ilhabela_%282284333705%29.jpg', vibe: 'La playa con más movimiento de la isla: bares sobre la arena, agua calma y un barco hundido cerca de la orilla para hacer snorkel.', cuando: 'Tarde, para quedarse al atardecer.' },
      { name: 'Praia da Feiticeira', zona: 'Sur', lat: -23.8454, lng: -45.4088, foto: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Praia_da_Feiticeira_-_Ilhabela_-_panoramio.jpg', vibe: 'Una playa chica entre piedras, con una cascada cerca. Es la más linda del lado tranquilo y tiene menos gente que el Curral.', cuando: 'Mañana.' },
      { name: 'Praia do Julião', zona: 'Sur', lat: -23.8539, lng: -45.4141, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Praia_Juli%C3%A3o_-_Ilhabela-_S%C3%A3o_Paulo_-_Por_do_sol_3.JPG/1280px-Praia_Juli%C3%A3o_-_Ilhabela-_S%C3%A3o_Paulo_-_Por_do_sol_3.JPG', vibe: 'Una cala chica de agua verde, con sombra de árboles sobre la arena. Tranquila incluso en temporada.', cuando: 'Mediodía, para la sombra.' },
      { name: 'Castelhanos', zona: 'Lado del mar abierto, 22 km de camino de tierra', lat: -23.8557, lng: -45.2887, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Praia_de_Castelhanos_-_Ilhabela_-_SP.jpg/1280px-Praia_de_Castelhanos_-_Ilhabela_-_SP.jpg', vibe: 'La playa salvaje de la isla, en una bahía grande del otro lado de la montaña. Se llega en 4x4 por un camino de tierra o en barco.', cuando: 'Día entero, con seco: con lluvia el camino se corta.' }
    ],
    atracciones: [
      { name: 'Vila (centro histórico)', zona: 'Vila', dur: '1 h', usd: 0, nota: 'Calles con casas coloniales, la iglesia matriz y restaurantes. De noche es donde está todo.' },
      { name: 'Cachoeira dos Três Tombos', zona: 'Sur', dur: '1 h', usd: 0, nota: 'Una cascada de tres caídas con pozo, a un sendero corto de la ruta.' },
      { name: 'Mirante do Pico do Baepi', zona: 'Centro de la isla', dur: '5 h', usd: 0, nota: 'Caminata dura de subida, con la vista de todo el canal desde arriba. Solo con guía.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Perequê y Vila', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en Perequê, donde vive la gente de la isla. La Vila es más cara.' },
      { name: 'Pescado frito en el Curral', tipo: 'Cena', zona: 'Praia do Curral', usd: 16, momento: 'Atardecer', nota: 'Porción de pescado para compartir en los bares de la arena, mirando el atardecer.' },
      { name: 'Açaí', tipo: 'Merienda', zona: 'Perequê', usd: 5, momento: 'Tarde', nota: 'Bowl de açaí con fruta, la merienda después de la playa.' }
    ],
    hacer: [
      { name: 'Snorkel en el Curral', zona: 'Praia do Curral', dur: '1 h', usd: 0, nota: 'El casco hundido del Aymoré está a pocos metros de la orilla. Con máscara se ve desde la superficie.' },
      { name: 'Excursión a Castelhanos en 4x4', zona: 'Sale de la Vila', dur: 'Día entero', usd: 35, nota: 'Cruza la montaña por un camino de tierra hasta la playa salvaje. Solo con días secos.' },
      { name: 'Cascadas del sur', zona: 'Sur', dur: '2 h', usd: 0, nota: 'Feiticeira, Três Tombos y Laje: cascadas con pozo a pocos minutos de la ruta.' }
    ],
    tips: [
      { titulo: 'El borrachudo existe', texto: 'Un mosquito chico que pica de día y deja ronchas por una semana. Repelente con icaridina desde que bajás de la balsa.' },
      { titulo: 'La balsa, con reserva', texto: 'En temporada la fila para cruzar en auto es de horas. Reservá el horario online o cruzá a pie: la balsa peatonal no tiene espera.' },
      { titulo: 'El lado salvaje no es para medio día', texto: 'Castelhanos y Bonete son hermosas pero llegar lleva horas. Si tenés poco tiempo, quedate en las playas del lado del canal.' }
    ]
  },

  ubatuba: {
    resumen: 'Más de cien playas a lo largo de la ruta, entre la sierra y el mar. Las mejores son calas chicas al norte, donde la selva llega a la arena.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 8, 9], nota: 'Le dicen Ubachuva: llueve mucho, sobre todo en verano. De abril a junio y en septiembre llueve menos, el agua sigue templada y las calas están vacías entre semana.' },
    beaches: [
      { name: 'Praia do Félix', zona: 'Norte, 15 km', lat: -23.3893, lng: -44.9716, foto: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Praia_do_F%C3%A9lix_%28Praia_do_L%C3%BAcio%29%2C_Ubatuba_-_SP%2C_Brazil_-_panoramio_%284%29.jpg', vibe: 'Una playa en forma de media luna, con selva detrás y agua verde. Una punta es calma para nadar y la otra tiene olas.', cuando: 'Mañana, antes del viento.' },
      { name: 'Vermelha do Norte', zona: 'Norte, 5 km', lat: -23.4177, lng: -45.0372, foto: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Praia-vermelha-do-norte-ubatuba-170114-189.jpg', vibe: 'Playa de surf con arena rojiza, rodeada de morros verdes. Hay escuelas de surf y bares sencillos.', cuando: 'Tarde, cuando entra la ola.' },
      { name: 'Itamambuca', zona: 'Norte, 12 km', lat: -23.4011, lng: -45.0013, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Praia_de_Itamambuca.jpg/1280px-Praia_de_Itamambuca.jpg', vibe: 'La playa de surf más conocida, con un río que desemboca en una punta: un lado de olas y otro de agua dulce y quieta.', cuando: 'Mañana para el río; tarde para el surf.' },
      { name: 'Domingas Dias', zona: 'Sur, 9 km', lat: -23.4979, lng: -45.1445, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Praia_Domingas_Dias_-_Ubatuba_%2826528569621%29.jpg/1280px-Praia_Domingas_Dias_-_Ubatuba_%2826528569621%29.jpg', vibe: 'Una cala chica de agua transparente y calma, entre condominios y selva. Ideal para nadar y hacer snorkel.', cuando: 'Mañana; entre semana casi vacía.' },
      { name: 'Praia do Lázaro', zona: 'Sur, 9 km', lat: -23.4998, lng: -45.1345, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/Praia_do_L%C3%A1zaro_-_Ubatuba_%2825981770484%29.jpg/1280px-Praia_do_L%C3%A1zaro_-_Ubatuba_%2825981770484%29.jpg', vibe: 'Agua quieta y bares sobre la arena. Desde acá sale el sendero a Domingas Dias y los barcos a la Ilha Anchieta.', cuando: 'Todo el día.' },
      { name: 'Praia Grande', zona: 'Centro sur, 3 km', lat: -23.4697, lng: -45.0672, foto: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Praia_Grande_Ubatuba_04.jpg', vibe: 'La playa urbana de Ubatuba, larga y con olas, con quioscos y movimiento. Para quien no tiene auto.', cuando: 'Tarde.' }
    ],
    atracciones: [
      { name: 'Projeto Tamar', zona: 'Centro', dur: '1 h', usd: 6, nota: 'Centro de conservación de tortugas marinas, con tanques y tortugas en recuperación. Bueno para un día de lluvia.' },
      { name: 'Centro histórico', zona: 'Centro', dur: '45 min', usd: 0, nota: 'La Casa da Cultura y el sobrado do Porto, frente a la bahía. Poco, pero es lo que queda del pueblo antiguo.' },
      { name: 'Mirante do Félix', zona: 'Ruta Rio-Santos, norte', dur: '20 min', usd: 0, nota: 'El mirador de la ruta sobre la Praia do Félix. Parada obligada camino al norte.' }
    ],
    comer: [
      { name: 'Prato feito caiçara', tipo: 'Almuerzo', zona: 'Centro y playas del norte', usd: 10, momento: 'Mediodía', nota: 'Pescado frito con arroz, feijão y ensalada en los bares de las playas.' },
      { name: 'Azul marinho', tipo: 'Almuerzo', zona: 'Restaurantes caiçaras', usd: 15, momento: 'Mediodía', nota: 'El plato típico: pescado cocido con banana verde, que deja el caldo azulado.' },
      { name: 'Pastel en la feria', tipo: 'Merienda', zona: 'Centro', usd: 3, momento: 'Mañana', nota: 'Pastel frito con jugo de caña en la feria del centro.' }
    ],
    hacer: [
      { name: 'Barco a la Ilha Anchieta', zona: 'Sale de Praia do Lázaro / Saco da Ribeira', dur: '4 h', usd: 20, nota: 'Una isla parque estatal, con playas de agua clara y las ruinas de un antiguo presidio.' },
      { name: 'Sendero de Domingas Dias', zona: 'Praia do Lázaro', dur: '30 min', usd: 0, nota: 'Camino corto por la costa desde el Lázaro hasta la cala.' },
      { name: 'Clase de surf', zona: 'Itamambuca o Vermelha do Norte', dur: '2 h', usd: 30, nota: 'Las escuelas dan tabla, traje y clase en la playa. Ubatuba es la capital del surf del litoral paulista.' }
    ],
    tips: [
      { titulo: 'Sin auto, difícil', texto: 'Las playas lindas están a lo largo de 80 km de ruta. Hay ómnibus urbano, pero pasa poco. Con auto se ven tres playas en un día.' },
      { titulo: 'Mirá el pronóstico', texto: 'Ubatuba es una de las ciudades más lluviosas del país. Planeá las calas lejanas para los días de sol y dejá los museos para la lluvia.' },
      { titulo: 'Borrachudos en las playas de río', texto: 'En las playas con río, como Itamambuca, hay mosquito borrachudo. Repelente desde que llegás.' }
    ]
  },

  porto: {
    resumen: 'Un pueblo de pescadores convertido en balneario, con piscinas naturales en el arrecife frente a la arena. El secreto es la marea, no la playa.',
    temporada: { alta: [12, 1, 7], baja: [4, 5, 6], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días y el agua pierde transparencia. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros.' },
    beaches: [
      { name: 'Praia de Porto de Galinhas', zona: 'Centro de la vila', lat: -8.5008, lng: -35.003, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Porto_de_Galinhas_-_Pernambuco_-_Brasil%282%29.jpg/1280px-Porto_de_Galinhas_-_Pernambuco_-_Brasil%282%29.jpg', vibe: 'La playa del pueblo, con el arrecife a doscientos metros. Con marea baja se forman las piscinas naturales y se llega en jangada.', cuando: 'Marea baja de 0.5 o menos. Mirá la tabla de mareas: sin marea baja no hay piscinas.' },
      { name: 'Maracaípe', zona: 'Sur', lat: -8.5258, lng: -35.0071, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/WalberMoura_PontalDeMaracaipe_Ipojuca_PE_%2840908724281%29.jpg/1280px-WalberMoura_PontalDeMaracaipe_Ipojuca_PE_%2840908724281%29.jpg', vibe: 'La playa de surf, con olas fuertes y mucho menos gente que la vila. Se llega en bicicleta o buggy.', cuando: 'Tarde, para ver el surf.' },
      { name: 'Pontal de Maracaípe', zona: 'Desembocadura del río', lat: -8.54, lng: -35.0085, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/BRUNO_LIMA_PONTAL_DE_MARACAIPE_IPOJUCA_PE_%2826036000327%29.jpg/1280px-BRUNO_LIMA_PONTAL_DE_MARACAIPE_IPOJUCA_PE_%2826036000327%29.jpg', vibe: 'Donde el río se encuentra con el mar, con manglar y caballitos de mar que los jangadeiros muestran sin sacarlos del agua.', cuando: 'Atardecer: el sol se pone sobre el río.' },
      { name: 'Cupe', zona: 'Norte', lat: -8.4741, lng: -34.9949, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Praia_do_Cupe-PE.jpg/1280px-Praia_do_Cupe-PE.jpg', vibe: 'Playa larga y tranquila con piscinas en el arrecife, frente a los resorts. Casi sin vendedores.', cuando: 'Marea baja, de mañana.' },
      { name: 'Muro Alto', zona: 'Norte, 10 km', lat: -8.4198, lng: -34.9738, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/BRUNO_LIMA_PRAIA_DE_MURO_ALTO_IPOJUCA_PE_%289%29_%2839776720770%29.jpg/1280px-BRUNO_LIMA_PRAIA_DE_MURO_ALTO_IPOJUCA_PE_%289%29_%2839776720770%29.jpg', vibe: 'Un arrecife largo forma una piscina natural de dos kilómetros: agua calma y tibia todo el día, sin depender de la marea.', cuando: 'Todo el día, ideal con chicos.' },
      { name: 'Serrambi', zona: 'Sur, 7 km', lat: -8.562, lng: -35.017, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Vista_da_praia_de_Serrambi%2C_Ipojuca-PE.jpg/1280px-Vista_da_praia_de_Serrambi%2C_Ipojuca-PE.jpg', vibe: 'Playa de arrecifes y piscinas, con muchos menos turistas que Porto. Agua muy clara con marea baja.', cuando: 'Marea baja.' }
    ],
    atracciones: [
      { name: 'Piscinas naturais', zona: 'Frente a la vila', dur: '1 h', usd: 5, nota: 'Las piscinas del arrecife, con peces de colores. Se llega en jangada con marea baja; el precio es por persona y es fijo.' },
      { name: 'Vila de Porto de Galinhas', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Calles peatonales con esculturas de gallinas, artesanía y bares. De noche se llena.' },
      { name: 'Pontal de Maracaípe al atardecer', zona: 'Maracaípe', dur: '1 h', usd: 0, nota: 'El mejor atardecer de la zona, sobre el río y el manglar.' }
    ],
    comer: [
      { name: 'Tapioca en la vila', tipo: 'Desayuno', zona: 'Centro', usd: 3, momento: 'Mañana', nota: 'Tapioca de queijo coalho y coco, en los puestos de la plaza.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la playa. Más barato que cualquier restaurante de la orilla.' },
      { name: 'Agua de coco', tipo: 'Merienda', zona: 'En la arena', usd: 2, momento: 'Toda la tarde', nota: 'Coco verde frío, abierto en el momento.' },
      { name: 'Peixe na telha', tipo: 'Cena', zona: 'Vila', usd: 20, momento: 'Noche', nota: 'Pescado cocinado en teja de barro, para compartir entre dos.' }
    ],
    hacer: [
      { name: 'Jangada a las piscinas', zona: 'Frente a la vila', dur: '1 h', usd: 5, nota: 'Las balsas de vela salen con marea baja. Llevá máscara: el agua llega a la cintura.' },
      { name: 'Buggy por las playas', zona: 'Sale de la vila', dur: '4 h', usd: 25, nota: 'Recorre Muro Alto, Cupe, Maracaípe y el Pontal. Se comparte entre cuatro.' },
      { name: 'Paseo de caballitos de mar', zona: 'Pontal de Maracaípe', dur: '1 h', usd: 6, nota: 'Jangada por el río para ver caballitos de mar en el manglar.' }
    ],
    tips: [
      { titulo: 'La tabla de mareas manda', texto: 'Las piscinas solo existen con marea baja, y cambia de horario todos los días. Planeá el día al revés: primero la marea, después todo lo demás.' },
      { titulo: 'No pises el coral', texto: 'El arrecife está vivo y es área protegida. Hay multas por pisarlo o dar de comer a los peces.' },
      { titulo: 'Recife queda a una hora', texto: 'El aeropuerto está en Recife, a 60 km. El ómnibus sale más barato que el transfer, pero tarda el doble.' }
    ]
  },

  mcz: {
    resumen: 'Una capital con playa urbana de agua verde y piscinas naturales frente a la rambla. Lo mejor es la costa al norte y al sur, a menos de media hora.',
    temporada: { alta: [12, 1, 7], baja: [4, 5, 6], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días y el agua pierde transparencia. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros.' },
    beaches: [
      { name: 'Pajuçara', zona: 'Rambla, 2 km', lat: -9.6694, lng: -35.7136, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Praia_de_Paju%C3%A7ara%2C_Macei%C3%B3%2C_Alagoas_%2851381092942%29.jpg/1280px-Praia_de_Paju%C3%A7ara%2C_Macei%C3%B3%2C_Alagoas_%2851381092942%29.jpg', vibe: 'La playa de las piscinas naturales: con marea baja salen las jangadas hasta el arrecife, a dos kilómetros de la orilla.', cuando: 'Marea baja de mañana.' },
      { name: 'Ponta Verde', zona: 'Rambla, 4 km', lat: -9.6603, lng: -35.6971, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Ponta_Verde_Beach%2C_Macei%C3%B3%2C_Brazil.jpg/1280px-Ponta_Verde_Beach%2C_Macei%C3%B3%2C_Brazil.jpg', vibe: 'Agua verde y quieta protegida por el arrecife, con la rambla, los quioscos y el famoso cocotero solitario de la punta.', cuando: 'Mañana.' },
      { name: 'Jatiúca', zona: 'Rambla, 4 km', lat: -9.646, lng: -35.702, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Praia_da_Jati%C3%BAca%2C_Macei%C3%B3.jpg/1280px-Praia_da_Jati%C3%BAca%2C_Macei%C3%B3.jpg', vibe: 'La continuación de Ponta Verde, con olas suaves y menos piscinas. Es la playa de los hoteles grandes.', cuando: 'Tarde.' },
      { name: 'Cruz das Almas', zona: 'Norte, 6 km', lat: -9.6289, lng: -35.695, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Praia_de_Cruz_das_Almas%2C_Macei%C3%B3_%2851386956519%29.jpg/1280px-Praia_de_Cruz_das_Almas%2C_Macei%C3%B3_%2851386956519%29.jpg', vibe: 'Playa con olas, buena para surf y para caminar. Menos gente que la rambla.', cuando: 'Tarde.' },
      { name: 'Ipioca', zona: 'Litoral norte, 20 km', lat: -9.5317, lng: -35.6054, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Praia_de_Ipioca_-_Macei%C3%B3_-_Alagoas_%2811394587604%29.jpg/1280px-Praia_de_Ipioca_-_Macei%C3%B3_-_Alagoas_%2811394587604%29.jpg', vibe: 'Playa larga de cocoteros, con piscinas en el arrecife y clubes de playa. La primera de la costa norte que parece fuera de la ciudad.', cuando: 'Día entero.' },
      { name: 'Praia do Francês', zona: 'Marechal Deodoro, 18 km al sur', lat: -9.77, lng: -35.838, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Praia_do_Franc%C3%AAs.jpg/1280px-Praia_do_Franc%C3%AAs.jpg', vibe: 'Un lado protegido por arrecife, con agua quieta, y otro con olas para surf. Bares sobre la arena.', cuando: 'Todo el día; se llena el fin de semana.' }
    ],
    atracciones: [
      { name: 'Feirinha de artesanato da Pajuçara', zona: 'Pajuçara', dur: '1 h', usd: 0, nota: 'Puestos de artesanía y bordado filé, típico de Alagoas. Se negocia el precio.' },
      { name: 'Mirante de São Gonçalo', zona: 'Centro', dur: '30 min', usd: 0, nota: 'Mirador sobre la ciudad y el mar, en el barrio de Farol.' },
      { name: 'Museu Théo Brandão', zona: 'Centro', dur: '1 h', usd: 2, nota: 'Museo de cultura popular alagoana, en un caserón frente al mar.' }
    ],
    comer: [
      { name: 'Tapioca de la rambla', tipo: 'Desayuno', zona: 'Pajuçara', usd: 3, momento: 'Mañana', nota: 'Las tapioqueiras de la rambla, con coco y queijo coalho.' },
      { name: 'Sururu', tipo: 'Almuerzo', zona: 'Restaurantes regionales', usd: 10, momento: 'Mediodía', nota: 'Un molusco de la laguna Mundaú, en caldo o en arroz. El plato de Maceió.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Ponta Verde', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la rambla.' },
      { name: 'Camarón en los quioscos', tipo: 'Cena', zona: 'Rambla', usd: 15, momento: 'Noche', nota: 'Porción de camarón frito para compartir mirando el mar.' }
    ],
    hacer: [
      { name: 'Jangada a las piscinas de Pajuçara', zona: 'Pajuçara', dur: '1 h 30', usd: 8, nota: 'Salen con marea baja desde la arena. Precio fijo por persona, tabla en el puesto.' },
      { name: 'Bicicleta por la rambla', zona: 'Pajuçara a Cruz das Almas', dur: '1 h', usd: 0, nota: 'Ciclovía plana de casi 10 km frente al mar. Hay bicicletas públicas.' },
      { name: 'Barco por la Lagoa Mundaú', zona: 'Pontal da Barra', dur: '3 h', usd: 15, nota: 'Recorre las islas de la laguna. Sale del Pontal, el barrio de las bordadoras de filé.' }
    ],
    tips: [
      { titulo: 'La marea, de nuevo', texto: 'Las piscinas de Pajuçara solo aparecen con marea baja. Los jangadeiros te dicen el horario del día.' },
      { titulo: 'El Gunga, mejor con excursión', texto: 'La Praia do Gunga, la de los acantilados, queda a más de 30 km. Si querés ir, conviene la excursión: el ómnibus no llega.' },
      { titulo: 'Pajuçara para comer, Ponta Verde para dormir', texto: 'Las dos playas están pegadas. Los restaurantes baratos y la feria están en Pajuçara; los hoteles con vista, en Ponta Verde.' }
    ]
  },

  maragogi: {
    resumen: 'Le dicen el Caribe brasileño por los galés: piscinas en un arrecife a seis kilómetros mar adentro. En tierra, playas de cocoteros casi vacías.',
    temporada: { alta: [12, 1, 7], baja: [4, 5, 6], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días y el agua pierde transparencia. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros. Los galés dependen de la marea baja y de la luna: en cuarto creciente o menguante las mareas son flojas.' },
    beaches: [
      { name: 'São Bento', zona: 'Sur, 4 km', lat: -9.0495, lng: -35.2392, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Praia_de_S%C3%A3o_Bento_%2851724223470%29.jpg/1280px-Praia_de_S%C3%A3o_Bento_%2851724223470%29.jpg', vibe: 'Una vila de pescadores con capilla frente al mar y piscinas naturales en la orilla con marea baja.', cuando: 'Marea baja.' },
      { name: 'Antunes', zona: 'Norte, 6 km', lat: -8.9746, lng: -35.18, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Praia_de_Antunes-3_%2851723356401%29.jpg/1280px-Praia_de_Antunes-3_%2851723356401%29.jpg', vibe: 'Cocoteros hasta la arena, agua quieta y la isla de Croa frente a la playa. La más linda de Maragogi.', cuando: 'Mañana.' },
      { name: 'Barra Grande', zona: 'Norte, 10 km', lat: -8.9369, lng: -35.1677, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/Praia_de_Barra_Grande_-_Maragogi-7_%2851711885497%29.jpg/1280px-Praia_de_Barra_Grande_-_Maragogi-7_%2851711885497%29.jpg', vibe: 'Playa larga con una lengua de arena que se forma con marea baja y entra en el mar.', cuando: 'Marea baja.' },
      { name: 'Japaratinga', zona: 'Sur, 9 km', lat: -9.088, lng: -35.258, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/Praia_de_Japaratinga_-_Alagoas._%2813125129473%29.jpg/1280px-Praia_de_Japaratinga_-_Alagoas._%2813125129473%29.jpg', vibe: 'Un pueblo vecino con playa de agua muy quieta y cocoteros. Tranquilo incluso en enero.', cuando: 'Todo el día.' },
      { name: 'Patacho', zona: 'Porto de Pedras, 18 km', lat: -9.16, lng: -35.296, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Vista_da_Praia_do_Patacho.jpg/1280px-Vista_da_Praia_do_Patacho.jpg', vibe: 'Arena blanca, cocoteros y piscinas naturales, en la Ruta Ecológica. Una de las playas más lindas de Alagoas.', cuando: 'Marea baja, de mañana.' }
    ],
    atracciones: [
      { name: 'Galés de Maragogi', zona: '6 km mar adentro', dur: '3 h', usd: 30, nota: 'Las piscinas naturales en el arrecife, con agua cristalina y peces. Solo se llega en catamarán y con marea baja; hay cupo diario.' },
      { name: 'Capela de São Bento', zona: 'São Bento', dur: '20 min', usd: 0, nota: 'Capilla blanca frente al mar en la vila de pescadores.' },
      { name: 'Rota Ecológica dos Milagres', zona: 'Sur, desde Japaratinga', dur: 'Medio día', usd: 0, nota: 'La ruta costera hacia São Miguel dos Milagres, con playas desiertas y pueblos chicos.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso en el centro, lejos de los resorts.' },
      { name: 'Pescado en São Bento', tipo: 'Almuerzo', zona: 'São Bento', usd: 13, momento: 'Mediodía', nota: 'Los bares de los pescadores sirven el pescado del día frente a las piscinas.' },
      { name: 'Agua de coco', tipo: 'Merienda', zona: 'Cualquier playa', usd: 2, momento: 'Tarde', nota: 'Coco verde de los cocoteros de la misma playa.' }
    ],
    hacer: [
      { name: 'Catamarán a los galés', zona: 'Sale de la Praia de Maragogi', dur: '3 h', usd: 30, nota: 'Salen con marea baja; reservá con un día de anticipación. Los días de marea floja el paseo no sale.' },
      { name: 'Buggy por la costa', zona: 'Centro', dur: '4 h', usd: 25, nota: 'Recorre Antunes, Barra Grande y São Bento. Se comparte entre cuatro.' },
      { name: 'Barco a la isla de Croa', zona: 'Antunes', dur: '1 h', usd: 6, nota: 'La isla de arena frente a Antunes, con agua bajita.' }
    ],
    tips: [
      { titulo: 'Los galés tienen cupo', texto: 'La cantidad de visitantes por día es limitada. En temporada se agotan: reservá apenas llegues.' },
      { titulo: 'Sin marea baja no hay galés', texto: 'Si la tabla dice marea mayor a 0.4 m, las piscinas no se forman. Pedí que te lo confirmen antes de pagar.' },
      { titulo: 'Las mejores playas no están en el centro', texto: 'El centro es de paso. Antunes, Patacho y Japaratinga valen el viaje en buggy o en auto.' }
    ]
  },

  nat: {
    resumen: 'La capital de las dunas: playas urbanas con el Morro do Careca de fondo y, a media hora, dunas móviles que se recorren en buggy.',
    temporada: { alta: [12, 1, 7], baja: [4, 5, 6], nota: 'Natal tiene sol casi todo el año. Llueve más entre abril y julio, pero en ráfagas cortas. Diciembre, enero y julio son los meses caros.' },
    beaches: [
      { name: 'Ponta Negra', zona: 'Zona sur, 10 km', lat: -5.8736, lng: -35.1766, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Foto_da_manh%C3%A3_na_Praia_de_Ponta_Negra.jpg/1280px-Foto_da_manh%C3%A3_na_Praia_de_Ponta_Negra.jpg', vibe: 'La playa de los hoteles, con el Morro do Careca en la punta. Agua tibia, olas suaves y una rambla con bares.', cuando: 'Mañana; de tarde el sol pega de frente.' },
      { name: 'Praia do Forte', zona: 'Zona este, 4 km', lat: -5.7632, lng: -35.1962, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Praia_do_Forte%2C_Natal_%28RN%29.jpg/1280px-Praia_do_Forte%2C_Natal_%28RN%29.jpg', vibe: 'La playa del Forte dos Reis Magos, con piscinas naturales en el arrecife cuando baja la marea.', cuando: 'Marea baja.' },
      { name: 'Areia Preta', zona: 'Zona este, 2 km', lat: -5.786, lng: -35.189, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Areia-Preta-Natal.jpg/1280px-Areia-Preta-Natal.jpg', vibe: 'Una playa urbana con arrecife y la avenida costera. Cerca del centro y casi sin turistas.', cuando: 'Mañana.' },
      { name: 'Genipabu', zona: 'Norte, cruzando el puente, 11 km', lat: -5.696, lng: -35.208, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Genipabu%2C_Natal%2C_RN%2C_Brazil.jpg/1280px-Genipabu%2C_Natal%2C_RN%2C_Brazil.jpg', vibe: 'Dunas gigantes que caen sobre una laguna y el mar. Es el paseo en buggy más famoso de Natal.', cuando: 'Mañana, antes del calor fuerte sobre la arena.' },
      { name: 'Cotovelo', zona: 'Parnamirim, 19 km', lat: -5.96, lng: -35.148, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Praia_de_Cotovelo_-_Parnamirim_-_Rio_Grande_do_Norte.jpg/1280px-Praia_de_Cotovelo_-_Parnamirim_-_Rio_Grande_do_Norte.jpg', vibe: 'Playa tranquila de acantilados bajos y agua calma, donde veranea la gente de Natal.', cuando: 'Tarde.' },
      { name: 'Pirangi do Norte', zona: 'Parnamirim, 22 km', lat: -5.985, lng: -35.118, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_de_Pirangi_do_norte_-_panoramio.jpg/1280px-Praia_de_Pirangi_do_norte_-_panoramio.jpg', vibe: 'Agua quieta y piscinas naturales. Al lado está el cajueiro más grande del mundo.', cuando: 'Marea baja, de mañana.' }
    ],
    atracciones: [
      { name: 'Forte dos Reis Magos', zona: 'Praia do Forte', dur: '1 h', usd: 3, nota: 'Fuerte con forma de estrella del siglo XVI, sobre el arrecife. Con marea alta parece flotar.' },
      { name: 'Cajueiro de Pirangi', zona: 'Pirangi do Norte', dur: '45 min', usd: 2, nota: 'Un solo árbol de cajú que ocupa una manzana entera. Hay mirador arriba.' },
      { name: 'Ponte Newton Navarro', zona: 'Redinha', dur: '20 min', usd: 0, nota: 'El puente atirantado sobre el río Potengi, con vista a la ciudad y al fuerte.' }
    ],
    comer: [
      { name: 'Ginga com tapioca', tipo: 'Merienda', zona: 'Redinha', usd: 4, momento: 'Tarde', nota: 'Pescaditos fritos en tapioca. Típico del mercado de la Redinha.' },
      { name: 'Carne de sol con macaxeira', tipo: 'Almuerzo', zona: 'Restaurantes regionales', usd: 12, momento: 'Mediodía', nota: 'Carne salada y secada al sol, con mandioca frita y manteca de garrafa.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Ponta Negra', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la rambla.' },
      { name: 'Camarón al coco', tipo: 'Cena', zona: 'Ponta Negra', usd: 18, momento: 'Noche', nota: 'Camarón en salsa de coco, el plato del litoral potiguar.' }
    ],
    hacer: [
      { name: 'Buggy por Genipabu', zona: 'Norte', dur: '4 h', usd: 30, nota: 'Con o sin emoción: el bugueiro te pregunta. Incluye la laguna y la tirolesa sobre el agua.' },
      { name: 'Dromedarios en Genipabu', zona: 'Genipabu', dur: '30 min', usd: 15, nota: 'Paseo corto en dromedario por las dunas, la foto de Natal.' },
      { name: 'Piscinas de Maracajaú', zona: 'Norte, en excursión', dur: 'Día entero', usd: 40, nota: 'Arrecifes a 7 km de la costa, con agua clara. Está a más de 50 km: solo en excursión.' }
    ],
    tips: [
      { titulo: 'No subas al Morro do Careca', texto: 'Está prohibido para proteger la duna y hay multa. Se mira desde la playa.' },
      { titulo: 'Bugueiro credenciado', texto: 'Contratá el buggy con un bugueiro credenciado (tiene la credencial a la vista). Los no credenciados no pueden entrar a las dunas de Genipabu.' },
      { titulo: 'Ponta Negra de noche', texto: 'La parte alta de Ponta Negra concentra la vida nocturna. Usá auto o Uber de noche para volver.' }
    ]
  },

  pip: {
    resumen: 'Una vila sobre acantilados rojos, con delfines que entran a la bahía y tortugas que desovan en la arena. Todo se hace a pie o caminando por la playa con marea baja.',
    temporada: { alta: [12, 1, 7], baja: [4, 5, 6], nota: 'De abril a julio llueve más. De septiembre a marzo, sol todos los días. Las caminatas por la orilla dependen de la marea baja: con marea alta el mar llega a los acantilados.' },
    beaches: [
      { name: 'Praia do Centro', zona: 'Vila de Pipa', lat: -6.225, lng: -35.064, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/PipaBeachView.JPG/1280px-PipaBeachView.JPG', vibe: 'La playa del pueblo, con barcos de pescadores y piscinas naturales en el arrecife con marea baja.', cuando: 'Mañana.' },
      { name: 'Praia do Amor', zona: 'Sur de la vila, 1 km', lat: -6.2318, lng: -35.0418, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Humberto_Sales_Praia_do_Amor_Tibau_do_Sul_RN_%2840015141315%29.jpg/1280px-Humberto_Sales_Praia_do_Amor_Tibau_do_Sul_RN_%2840015141315%29.jpg', vibe: 'La del acantilado con forma de corazón, vista desde el mirador. Abajo, olas para surf.', cuando: 'Tarde, para el surf y el atardecer en el Chapadão.' },
      { name: 'Chapadão', zona: 'Entre el centro y la Praia do Amor', lat: -6.2392, lng: -35.0376, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Humberto_Sales_Chapad%C3%A3o_Tibau_do_Sul_RN_%2840866701872%29.jpg/1280px-Humberto_Sales_Chapad%C3%A3o_Tibau_do_Sul_RN_%2840866701872%29.jpg', vibe: 'No es playa sino el mirador sobre los acantilados, con la vista de la Praia do Amor. Es el atardecer de Pipa.', cuando: 'Atardecer.' },
      { name: 'Baía dos Golfinhos', zona: 'Norte de la vila, a pie con marea baja', lat: -6.2246, lng: -35.0612, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Ba%C3%ADa_dos_Golfinhos_%287900989416%29.jpg/1280px-Ba%C3%ADa_dos_Golfinhos_%287900989416%29.jpg', vibe: 'Una bahía chica al pie del acantilado, donde los delfines entran a nadar cerca de la gente. Se llega caminando por la arena con marea baja.', cuando: 'Marea baja de mañana: con marea alta no se puede volver caminando.' },
      { name: 'Madeiro', zona: 'Norte, 3 km', lat: -6.2174, lng: -35.0752, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Praia_do_Madeiro_%285302194070%29.jpg/1280px-Praia_do_Madeiro_%285302194070%29.jpg', vibe: 'Una bahía de agua calma bajo acantilados con selva, con escuelas de surf y tortugas cerca de la orilla.', cuando: 'Todo el día; bajada por escalera.' }
    ],
    atracciones: [
      { name: 'Mirante do Chapadão', zona: 'Vila', dur: '1 h', usd: 0, nota: 'El atardecer sobre la Praia do Amor desde lo alto del acantilado.' },
      { name: 'Santuário Ecológico de Pipa', zona: 'Norte', dur: '1 h 30', usd: 6, nota: 'Senderos de mata atlántica con miradores sobre la Baía dos Golfinhos.' },
      { name: 'Lagoa de Guaraíras', zona: 'Tibau do Sul, 10 km', dur: '1 h', usd: 0, nota: 'La laguna donde el atardecer se mira desde los bares de Tibau. Hay paseos en barco.' }
    ],
    comer: [
      { name: 'Tapioca en la vila', tipo: 'Desayuno', zona: 'Avenida principal', usd: 3, momento: 'Mañana', nota: 'Tapioca de coco y queso en los puestos de la calle principal.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato de un pueblo caro.' },
      { name: 'Crepe de la calle', tipo: 'Cena', zona: 'Avenida principal', usd: 6, momento: 'Noche', nota: 'Los puestos de crepe y pastel de la avenida son la cena barata de Pipa.' }
    ],
    hacer: [
      { name: 'Caminata a la Baía dos Golfinhos', zona: 'Desde el centro', dur: '2 h', usd: 0, nota: 'Por la arena con marea baja, al pie del acantilado. Calculá la vuelta: la marea sube rápido.' },
      { name: 'Clase de surf en Madeiro', zona: 'Madeiro', dur: '2 h', usd: 30, nota: 'Ola suave y larga, ideal para aprender.' },
      { name: 'Paseo de barco con delfines', zona: 'Sale del centro', dur: '1 h 30', usd: 15, nota: 'El barco recorre la costa y los delfines suelen acompañarlo.' }
    ],
    tips: [
      { titulo: 'La marea decide el camino', texto: 'Las playas se unen caminando solo con marea baja. Con marea alta el mar llega al acantilado: mirá la tabla antes de salir.' },
      { titulo: 'No toques a los delfines', texto: 'Entran a la bahía porque están tranquilos. Tocarlos o perseguirlos está prohibido y los aleja.' },
      { titulo: 'Pipa es cara para lo que es', texto: 'Los precios son de balneario de moda. Comer en la calle y en los kilos baja mucho el gasto.' }
    ]
  },

  trancoso: {
    resumen: 'Un pueblo de casitas de colores alrededor de una plaza de pasto, el Quadrado, sobre un acantilado. Las playas están abajo, a una bajada de cinco minutos.',
    temporada: { alta: [12, 1, 2, 7], baja: [4, 5, 6], nota: 'En Año Nuevo y Carnaval los precios se multiplican. De marzo a junio llueve más, pero el pueblo está tranquilo y los precios bajan a la mitad.' },
    beaches: [
      { name: 'Nativos', zona: 'Abajo del Quadrado', lat: -16.5893, lng: -39.0903, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Praia_dos_Nativos%2C_APA_Cara%C3%ADva_Trancoso.JPG/1280px-Praia_dos_Nativos%2C_APA_Cara%C3%ADva_Trancoso.JPG', vibe: 'La playa a la que se baja desde el pueblo, con el río Trancoso que desemboca y bares de playa.', cuando: 'Mañana; de tarde se llena.' },
      { name: 'Coqueiros', zona: 'Sur, 1 km', lat: -16.5971, lng: -39.09, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Vista_da_Praia_dos_Coqueiros_em_Trancoso%2C_Porto_Seguro_BA.JPG/1280px-Vista_da_Praia_dos_Coqueiros_em_Trancoso%2C_Porto_Seguro_BA.JPG', vibe: 'Agua calma con piscinas en el arrecife y cocoteros. La playa de los locales.', cuando: 'Marea baja.' },
      { name: 'Taípe', zona: 'Norte, 4 km', lat: -16.5534, lng: -39.0863, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg/1280px-Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg', vibe: 'Una playa larga entre Trancoso y Arraial d’Ajuda, con acantilados de colores y casi nadie. Se llega por la playa con marea baja o en auto por camino de tierra.', cuando: 'Tarde, cuando el sol pega en el acantilado.' },
      { name: 'Praia do Espelho', zona: 'Sur, 15 km', lat: -16.7258, lng: -39.1225, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Coqueiros_Praia_do_Espelho.jpg/1280px-Coqueiros_Praia_do_Espelho.jpg', vibe: 'Agua quieta como un espejo con marea baja, acantilados de colores y piscinas naturales. Una de las playas más lindas de Brasil.', cuando: 'Marea baja; día entero.' }
    ],
    atracciones: [
      { name: 'Quadrado', zona: 'Centro', dur: '1 h', usd: 0, nota: 'La plaza de pasto con la Igreja de São João Batista en la punta y casas de colores alrededor. De noche se iluminan con faroles.' },
      { name: 'Igreja de São João Batista', zona: 'Quadrado', dur: '15 min', usd: 0, nota: 'La iglesia blanca del siglo XVII sobre el acantilado, con vista al mar.' },
      { name: 'Mirante del Quadrado', zona: 'Detrás de la iglesia', dur: '20 min', usd: 0, nota: 'La vista de la desembocadura y la playa desde lo alto. El atardecer del pueblo.' }
    ],
    comer: [
      { name: 'Prato feito fuera del Quadrado', tipo: 'Almuerzo', zona: 'Calles de atrás', usd: 10, momento: 'Mediodía', nota: 'El Quadrado es carísimo. A dos cuadras, en los barrios, el plato cuesta un tercio.' },
      { name: 'Moqueca baiana', tipo: 'Cena', zona: 'Quadrado', usd: 25, momento: 'Noche', nota: 'Pescado con leche de coco y dendê, en cazuela de barro. Para dos.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Puestos de la entrada', usd: 4, momento: 'Tarde', nota: 'Bollo de feijão frito en dendê con camarón y vatapá.' }
    ],
    hacer: [
      { name: 'Excursión a la Praia do Espelho', zona: 'Sale del pueblo', dur: 'Día entero', usd: 20, nota: 'Por camino de tierra. Calculá la marea baja para llegar en el mejor momento.' },
      { name: 'Caminata por la costa al sur', zona: 'Nativos → Rio Verde', dur: '2 h', usd: 0, nota: 'Por la arena con marea baja, pasando Coqueiros y Rio Verde.' },
      { name: 'Atardecer en el Quadrado', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Cuando el sol baja, todo el pueblo sube a la plaza.' }
    ],
    tips: [
      { titulo: 'Efectivo y paciencia', texto: 'Hay pocos cajeros y los caminos son de tierra. Llevá efectivo y no planees horarios ajustados.' },
      { titulo: 'Arraial d’Ajuda está cerca', texto: 'A 25 km por ruta, con precios más bajos. Puede ser base para visitar Trancoso de día.' },
      { titulo: 'El Espelho es por la marea', texto: 'Con marea alta el Espelho es una playa linda más. Con marea baja es la que sale en las fotos.' }
    ]
  },

  ssa: {
    resumen: 'La ciudad más africana de Brasil, con playas urbanas de agua calma en la Barra y playas de cocoteros y arrecife al norte, a media hora del Pelourinho.',
    temporada: { alta: [12, 1, 2], baja: [4, 5, 6], nota: 'De abril a junio llueve casi todos los días. De septiembre a marzo hay sol y calor; Carnaval y Año Nuevo son los momentos más caros y más llenos del año.' },
    beaches: [
      { name: 'Porto da Barra', zona: 'Barra, 4 km', lat: -13.0043, lng: -38.5328, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_do_Porto_da_Barra--Forte_de_Santa_Maria_Salvador_Bahia_2021-7598.jpg/1280px-Praia_do_Porto_da_Barra--Forte_de_Santa_Maria_Salvador_Bahia_2021-7598.jpg', vibe: 'Una bahía de agua quieta entre dos fuertes, donde el sol se pone sobre el mar. Es la playa de los soteropolitanos y la más animada de la ciudad.', cuando: 'Atardecer: la gente aplaude cuando se pone el sol.' },
      { name: 'Buracão', zona: 'Rio Vermelho, 6 km', lat: -13.015, lng: -38.4833, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Praia_do_Burac%C3%A3o%2C_Salvador.jpg/1280px-Praia_do_Burac%C3%A3o%2C_Salvador.jpg', vibe: 'Una cala escondida entre edificios, a la que se baja por una escalera. Olas y gente del barrio.', cuando: 'Mañana; de tarde da sombra.' },
      { name: 'Ribeira', zona: 'Cidade Baixa, 7 km', lat: -12.911, lng: -38.4975, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Praia_da_Ribeira%2C_Salvador_-_4.jpg/1280px-Praia_da_Ribeira%2C_Salvador_-_4.jpg', vibe: 'Del lado de la bahía, con agua calma y las heladerías más famosas de Salvador. El plan de domingo de las familias.', cuando: 'Domingo a la tarde.' },
      { name: 'Itapuã', zona: 'Norte, 16 km', lat: -12.9535, lng: -38.3612, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Itapua_Beach_Bahia_04.jpg/1280px-Itapua_Beach_Bahia_04.jpg', vibe: 'La playa de la canción, con el faro, cocoteros y piscinas en el arrecife. Barrio de pescadores y bares de playa.', cuando: 'Marea baja.' },
      { name: 'Flamengo', zona: 'Norte, 21 km', lat: -12.9288, lng: -38.318, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/MARCIO_FILHO_PRAIA_DO_FLAMENGO_SALVADOR_BAHIA_%2841078840821%29.jpg/1280px-MARCIO_FILHO_PRAIA_DO_FLAMENGO_SALVADOR_BAHIA_%2841078840821%29.jpg', vibe: 'Playa larga y limpia, de las mejores de la ciudad, con quioscos y olas para surf.', cuando: 'Día entero.' }
    ],
    atracciones: [
      { name: 'Pelourinho', zona: 'Centro Histórico', dur: '3 h', usd: 0, nota: 'Calles de piedra con casas coloniales de colores, iglesias barrocas y música en la calle. Los martes a la noche hay ensayos de tambores.' },
      { name: 'Elevador Lacerda', zona: 'Centro', dur: '20 min', usd: 0.1, nota: 'El ascensor que une la Cidade Alta con la Baixa. Cuesta centavos y tiene la mejor vista de la bahía.' },
      { name: 'Igreja de São Francisco', zona: 'Pelourinho', dur: '40 min', usd: 3, nota: 'Iglesia barroca con el interior cubierto de oro. Una de las más ricas de Brasil.' },
      { name: 'Forte de Santo Antônio da Barra', zona: 'Barra', dur: '1 h', usd: 3, nota: 'El faro de la Barra, con el museo náutico adentro. El atardecer desde las murallas.' }
    ],
    comer: [
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Puestos de las baianas', usd: 4, momento: 'Tarde', nota: 'Bollo de feijão frito en dendê, con camarón, vatapá y pimienta. Pedilo "frio" si no querés picante.' },
      { name: 'Moqueca baiana', tipo: 'Almuerzo', zona: 'Rio Vermelho y Pelourinho', usd: 20, momento: 'Mediodía', nota: 'Pescado en leche de coco y dendê, con arroz y pirão. Para dos.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Barra y Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso, con platos baianos en la mesa.' },
      { name: 'Sorvete da Ribeira', tipo: 'Postre', zona: 'Ribeira', usd: 3, momento: 'Tarde', nota: 'Helados de frutas regionales, en la heladería tradicional frente a la bahía.' }
    ],
    hacer: [
      { name: 'Atardecer en el Porto da Barra', zona: 'Barra', dur: '1 h', usd: 0, nota: 'Llevá una lata, sentate en la arena o en el muro del fuerte y mirá cómo el sol cae sobre la bahía.' },
      { name: 'Mercado Modelo', zona: 'Cidade Baixa', dur: '1 h', usd: 0, nota: 'El mercado de artesanía al pie del Elevador Lacerda. Hay capoeira en la puerta.' },
      { name: 'Barco a la Ilha dos Frades', zona: 'Sale del Terminal Náutico', dur: 'Día entero', usd: 25, nota: 'Islas de la bahía con playas de agua quieta. El paseo para en Frades e Itaparica.' }
    ],
    tips: [
      { titulo: 'El Pelourinho, de día', texto: 'De día está lleno de policía y gente. De noche, quedate en las calles principales y volvé en taxi o Uber.' },
      { titulo: 'Las cintas de Bonfim no se regalan', texto: 'Te atan una cinta en la muñeca y después piden plata. Si no la querés, decí que no antes de que te la pongan.' },
      { titulo: 'La Barra es la base', texto: 'Alojarse en la Barra deja playa, atardecer y comida a pie, y el Pelourinho a 15 minutos.' }
    ]
  },

  for: {
    resumen: 'La capital del sol del Nordeste, con playas urbanas para comer y bailar forró. Las playas de agua para nadar están en las afueras, a menos de media hora.',
    temporada: { alta: [12, 1, 7], baja: [3, 4, 5], nota: 'De febrero a mayo es la época de lluvias. De julio a diciembre no llueve y sopla viento fuerte, ideal para kitesurf. Hace calor todo el año.' },
    beaches: [
      { name: 'Praia de Iracema', zona: 'Centro, 2 km', lat: -3.7206, lng: -38.5085, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Pier_da_praia_de_Iracema_%28Fortaleza%29_01.jpg/1280px-Pier_da_praia_de_Iracema_%28Fortaleza%29_01.jpg', vibe: 'La playa del muelle de los ingleses, con atardecer sobre el mar y bares alrededor. No es para nadar: es para caminar y salir.', cuando: 'Atardecer, en el Ponte dos Ingleses.' },
      { name: 'Meireles', zona: '3 km', lat: -3.7235, lng: -38.5018, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Praia_do_Meireles%2C_Fortaleza%2C_Cear%C3%A1.jpg/1280px-Praia_do_Meireles%2C_Fortaleza%2C_Cear%C3%A1.jpg', vibe: 'La rambla de los hoteles, con feria de artesanía de noche y quioscos. Agua con algo de olas.', cuando: 'Noche, para la feria.' },
      { name: 'Mucuripe', zona: '4 km', lat: -3.7242, lng: -38.4903, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Mucuripe_Beach%2C_Fortaleza%2C_Brazil_1.jpg/1280px-Mucuripe_Beach%2C_Fortaleza%2C_Brazil_1.jpg', vibe: 'Las jangadas de los pescadores, que vuelven al atardecer con el pescado que se vende en el mercado de al lado.', cuando: 'Tarde, cuando vuelven las jangadas.' },
      { name: 'Praia do Futuro', zona: '8 km', lat: -3.7312, lng: -38.4564, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Fortaleza_do_Futuro.jpg/1280px-Fortaleza_do_Futuro.jpg', vibe: 'La playa para bañarse de la ciudad: larga, con olas y barracas enormes que tienen piscina, show y caranguejo los jueves.', cuando: 'Jueves a la noche, por el caranguejo.' },
      { name: 'Cumbuco', zona: 'Caucaia, 25 km', lat: -3.627, lng: -38.731, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Cumbuco_Beach%2C_Fortaleza%2C_Cear%C3%A1%2C_Brasil_-_panoramio.jpg/1280px-Cumbuco_Beach%2C_Fortaleza%2C_Cear%C3%A1%2C_Brasil_-_panoramio.jpg', vibe: 'Dunas, lagunas y viento constante: la capital del kitesurf. Se llega en buggy o en ómnibus.', cuando: 'De julio a diciembre, con viento.' },
      { name: 'Porto das Dunas', zona: 'Aquiraz, 19 km', lat: -3.838, lng: -38.395, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Praia_de_Porto_das_Dunas_11.jpg/1280px-Praia_de_Porto_das_Dunas_11.jpg', vibe: 'Playa tranquila de dunas, donde está el parque acuático Beach Park.', cuando: 'Día entero.' }
    ],
    atracciones: [
      { name: 'Ponte dos Ingleses', zona: 'Praia de Iracema', dur: '40 min', usd: 0, nota: 'El muelle sobre el mar, con delfines algunos días y el mejor atardecer de la ciudad.' },
      { name: 'Centro Dragão do Mar', zona: 'Praia de Iracema', dur: '1 h', usd: 0, nota: 'Centro cultural con museos, planetario y bares alrededor. De noche hay música.' },
      { name: 'Mercado Central', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Cuatro pisos de artesanía, castañas de cajú y hamacas. Se negocia.' }
    ],
    comer: [
      { name: 'Caranguejo en la Praia do Futuro', tipo: 'Cena', zona: 'Praia do Futuro', usd: 15, momento: 'Jueves a la noche', nota: 'Los jueves todas las barracas sirven cangrejo con martillito. Es una tradición de la ciudad.' },
      { name: 'Baião de dois', tipo: 'Almuerzo', zona: 'Restaurantes regionales', usd: 10, momento: 'Mediodía', nota: 'Arroz con feijão verde y queso coalho. El plato de Ceará.' },
      { name: 'Tapioca de Messejana', tipo: 'Merienda', zona: 'Centro das Tapioqueiras', usd: 3, momento: 'Tarde', nota: 'Un centro entero de puestos de tapioca, camino al sur.' },
      { name: 'Pescado en el Mucuripe', tipo: 'Almuerzo', zona: 'Mercado de pescado', usd: 12, momento: 'Mediodía', nota: 'Comprás el pescado o el camarón y te lo cocinan en los puestos de al lado.' }
    ],
    hacer: [
      { name: 'Forró en la Praia de Iracema', zona: 'Iracema', dur: '3 h', usd: 6, nota: 'Casas de forró con banda en vivo varias noches por semana. Nadie se queda sentado.' },
      { name: 'Buggy en Cumbuco', zona: 'Cumbuco', dur: '3 h', usd: 25, nota: 'Dunas, lagunas y el "esquibunda": bajar las dunas en tabla y caer al agua.' },
      { name: 'Feria de Meireles', zona: 'Meireles', dur: '1 h', usd: 0, nota: 'Feria de artesanía todas las noches en la rambla.' }
    ],
    tips: [
      { titulo: 'No te bañes frente al centro', texto: 'Las playas entre Iracema y Mucuripe no suelen estar aptas para el baño. Para nadar, Praia do Futuro o las de afuera.' },
      { titulo: 'El viento es el clima', texto: 'De julio a diciembre sopla fuerte todo el día. Es bueno para el kite y alivia el calor, pero en la playa vuela la arena.' },
      { titulo: 'Jeri queda lejos', texto: 'Jericoacoara está a 300 km. No es una salida de día: son 5 horas por trayecto.' }
    ]
  },

  jericoacoara: {
    resumen: 'Una vila de calles de arena dentro de un parque nacional, entre dunas y lagunas de agua dulce. Todo se hace a pie, en buggy o en 4x4.',
    temporada: { alta: [7, 8, 9, 10, 12, 1], baja: [3, 4, 5], nota: 'De marzo a mayo llueve y las lagunas se llenan. De julio a diciembre no llueve, sopla viento fuerte y es temporada de kitesurf; las lagunas bajan hacia el final del año.' },
    beaches: [
      { name: 'Praia da Vila', zona: 'Frente a la vila', lat: -2.7965, lng: -40.5187, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Jijoca_de_Jericoacoara.jpg/1280px-Jijoca_de_Jericoacoara.jpg', vibe: 'La playa de la vila, de agua tibia y calma, con la duna del atardecer en una punta. Barcos y caipirinhas en carritos.', cuando: 'Mañana para nadar; atardecer en la duna.' },
      { name: 'Duna do Pôr do Sol', zona: 'Oeste de la vila', lat: -2.8036, lng: -40.5188, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Imensid%C3%A3o_do_mar_vista_da_Duna_do_P%C3%B4r_do_Sol_-_Praia_de_Jericoacoara.jpg/1280px-Imensid%C3%A3o_do_mar_vista_da_Duna_do_P%C3%B4r_do_Sol_-_Praia_de_Jericoacoara.jpg', vibe: 'La duna grande donde todo el pueblo sube a ver el sol caer en el mar. Después hay capoeira en la playa.', cuando: 'Media hora antes del atardecer.' },
      { name: 'Malhada', zona: 'Este de la vila, a pie', lat: -2.7916, lng: -40.5183, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Pedras_na_praia_da_Malhada.jpg/1280px-Pedras_na_praia_da_Malhada.jpg', vibe: 'Playa de piedras y arena camino a la Pedra Furada, con olas buenas para surf.', cuando: 'Marea baja, de camino a la Pedra Furada.' },
      { name: 'Pedra Furada', zona: 'Este, 3 km a pie', lat: -2.7885, lng: -40.4917, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/02_-_Pedra-Furada-Jericoacoara-Ce_Helio_Bastos_salmon140722.jpg', vibe: 'El arco de piedra sobre el mar, símbolo de Jeri. Se llega caminando por la playa con marea baja.', cuando: 'Marea baja. En julio el sol se pone justo en el agujero.' },
      { name: 'Lagoa do Paraíso', zona: 'Jijoca, 15 km', lat: -2.9091, lng: -40.4311, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Lagoa_do_Para%C3%ADso_Jijoca_de_Jericoacoara.jpg/1280px-Lagoa_do_Para%C3%ADso_Jijoca_de_Jericoacoara.jpg', vibe: 'Una laguna de agua dulce, azul y tibia, con hamacas dentro del agua. La postal de Jeri.', cuando: 'Mediodía, cuando el agua está más azul.' },
      { name: 'Lagoa Azul', zona: 'Jijoca, 12 km', lat: -2.895, lng: -40.47, foto: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/20--LagoaAzul-Jericoacoara%2CCe_Helio-Bastos-Salmon-110722.jpg', vibe: 'La laguna vecina a la del Paraíso, más chica y con menos gente.', cuando: 'Después de la Lagoa do Paraíso.' }
    ],
    atracciones: [
      { name: 'Árvore da Preguiça', zona: 'Este, 5 km', dur: '20 min', usd: 0, nota: 'Un árbol torcido por el viento hasta quedar acostado. Parada del paseo del este.' },
      { name: 'Serrote', zona: 'Detrás de la vila', dur: '1 h', usd: 0, nota: 'El cerro con el faro, a una caminata desde la vila, con vista de las dunas y el mar.' },
      { name: 'Rua Principal de noche', zona: 'Vila', dur: '2 h', usd: 0, nota: 'Calles de arena con bares, música en vivo y forró. La vida nocturna de Jeri.' }
    ],
    comer: [
      { name: 'Tapioca en la Rua Principal', tipo: 'Desayuno', zona: 'Vila', usd: 3, momento: 'Mañana', nota: 'Tapioca rellena en los puestos de la calle principal.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato de un pueblo caro.' },
      { name: 'Caipirinha en carrito', tipo: 'Atardecer', zona: 'Playa', usd: 4, momento: 'Atardecer', nota: 'Carritos de caipirinha y frutas en la arena, frente a la duna.' },
      { name: 'Peixe na brasa', tipo: 'Cena', zona: 'Vila', usd: 18, momento: 'Noche', nota: 'Pescado a la parrilla en los restaurantes de la calle de la playa.' }
    ],
    hacer: [
      { name: 'Buggy del este', zona: 'Sale de la vila', dur: '5 h', usd: 35, nota: 'Pedra Furada, Árvore da Preguiça, Lagoa do Paraíso y Lagoa Azul. Se comparte entre cuatro.' },
      { name: 'Kitesurf en el Preá', zona: 'Preá, 10 km', dur: '3 h', usd: 60, nota: 'El viento más constante de Brasil. Hay escuelas con clases para empezar.' },
      { name: 'Caminata a la Pedra Furada', zona: 'Desde la vila', dur: '2 h', usd: 0, nota: 'Por la playa con marea baja o por el cerro con marea alta.' }
    ],
    tips: [
      { titulo: 'Hay que pagar la tasa', texto: 'Jeri cobra una tasa de turismo por día de estadía. Se paga online antes de llegar o en la entrada.' },
      { titulo: 'Sin auto común', texto: 'Desde Jijoca solo se entra en 4x4 o buggy: las calles son de arena. El transfer desde Fortaleza ya hace el cambio de vehículo.' },
      { titulo: 'Efectivo y cajeros', texto: 'Hay pocos cajeros y a veces sin plata. Llevá efectivo desde Fortaleza o Jijoca.' }
    ]
  },

  morro: {
    resumen: 'Una isla sin autos, donde las playas se llaman por número: Primeira, Segunda, Terceira y Quarta. Se llega en barco desde Salvador y todo se recorre a pie.',
    temporada: { alta: [12, 1, 2, 7], baja: [4, 5, 6], nota: 'De abril a junio llueve más y el mar se pone movido. De septiembre a marzo hay sol; en Año Nuevo y Carnaval la isla está llena y los precios suben mucho.' },
    beaches: [
      { name: 'Primeira Praia', zona: 'Al lado de la vila', lat: -13.3779, lng: -38.9141, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/MARCIO_FILHO_PRIMEIRA_PRAIA_MORRO_DE_S%C3%83O_PAULO_BAHIA_%2826104106967%29.jpg/1280px-MARCIO_FILHO_PRIMEIRA_PRAIA_MORRO_DE_S%C3%83O_PAULO_BAHIA_%2826104106967%29.jpg', vibe: 'Una playa chica de olas, debajo del cerro del faro, donde están las posadas más baratas.', cuando: 'Mañana.' },
      { name: 'Segunda Praia', zona: '5 min a pie', lat: -13.3797, lng: -38.912, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Segunda_praia_-_panoramio.jpg/1280px-Segunda_praia_-_panoramio.jpg', vibe: 'La playa de la fiesta: bares, música y gente hasta la madrugada. De día, agua calma y piscinas con marea baja.', cuando: 'Tarde y noche.' },
      { name: 'Terceira Praia', zona: '10 min a pie', lat: -13.3833, lng: -38.9088, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Segunda_e_terceira_praia_-_panoramio.jpg/1280px-Segunda_e_terceira_praia_-_panoramio.jpg', vibe: 'Agua muy quieta protegida por el arrecife, con la isla de Caitá enfrente. La más tranquila para nadar.', cuando: 'Marea baja de mañana.' },
      { name: 'Quarta Praia', zona: '25 min a pie', lat: -13.3946, lng: -38.9072, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Mar%C3%A9_Baixa_-_Quarta_Praia.jpg/1280px-Mar%C3%A9_Baixa_-_Quarta_Praia.jpg', vibe: 'Una playa larga de cocoteros con piscinas naturales enormes con marea baja. Cuanto más lejos, menos gente.', cuando: 'Marea baja; día entero.' },
      { name: 'Garapuá', zona: 'Sur, 10 km', lat: -13.4756, lng: -38.9216, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Garapu%C3%A1_Foto_Tatiana_Azeviche_%2845236378984%29.jpg/1280px-Garapu%C3%A1_Foto_Tatiana_Azeviche_%2845236378984%29.jpg', vibe: 'Una vila de pescadores con arrecife y agua transparente, a la que se llega en barco o en tractor por la playa.', cuando: 'Día entero, en el paseo de la isla.' }
    ],
    atracciones: [
      { name: 'Farol do Morro', zona: 'Cerro de la vila', dur: '40 min', usd: 0, nota: 'El faro sobre el cerro, con vista a todas las playas. De ahí sale la tirolesa a la Primeira Praia.' },
      { name: 'Fortaleza de Tapirandu', zona: 'Vila', dur: '30 min', usd: 0, nota: 'Ruinas del fuerte del siglo XVII junto al muelle. El atardecer se mira desde sus murallas.' },
      { name: 'Portaló', zona: 'Entrada de la vila', dur: '15 min', usd: 0, nota: 'El portal de piedra por donde se entra al pueblo desde el muelle.' }
    ],
    comer: [
      { name: 'Prato feito de la vila', tipo: 'Almuerzo', zona: 'Calles de la vila', usd: 10, momento: 'Mediodía', nota: 'Pescado, arroz, feijão y ensalada. Más barato en la vila que en las playas.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Plaza de la vila', usd: 4, momento: 'Tarde', nota: 'Las baianas de la plaza, al atardecer.' },
      { name: 'Moqueca', tipo: 'Cena', zona: 'Segunda Praia', usd: 22, momento: 'Noche', nota: 'Moqueca baiana para dos, en los restaurantes de la playa.' }
    ],
    hacer: [
      { name: 'Volta à ilha', zona: 'Sale de la Segunda Praia', dur: 'Día entero', usd: 30, nota: 'Barco que da la vuelta a Tinharé con paradas en Garapuá, piscinas de Moreré y Boipeba.' },
      { name: 'Tirolesa del faro', zona: 'Primeira Praia', dur: '20 min', usd: 15, nota: 'Del cerro del faro hasta el mar de la Primeira Praia.' },
      { name: 'Atardecer en el fuerte', zona: 'Vila', dur: '1 h', usd: 0, nota: 'Desde las ruinas de la fortaleza, mirando hacia el continente.' }
    ],
    tips: [
      { titulo: 'Tasa de entrada', texto: 'Se paga una tasa al llegar al muelle. Guardá el comprobante.' },
      { titulo: 'El barco desde Salvador marea', texto: 'El catamarán tarda dos horas y el mar suele estar movido. Si te mareás, la ruta por Valença es más larga pero con menos mar abierto.' },
      { titulo: 'Las valijas, en carretilla', texto: 'No hay autos: los carretilleros llevan las valijas del muelle a la posada. Acordá el precio antes.' }
    ]
  },

  itacare: {
    resumen: 'Un pueblo de surf donde la selva atlántica llega al mar. Las mejores playas son calas a las que se llega por senderos cortos desde la ruta.',
    temporada: { alta: [12, 1, 2, 7], baja: [4, 5, 6], nota: 'Llueve repartido todo el año, con más lluvia de abril a julio. De septiembre a marzo hay más sol. Las olas son mejores en invierno.' },
    beaches: [
      { name: 'Praia da Concha', zona: 'Pueblo, 1 km', lat: -14.2752, lng: -38.9905, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/MARCIO_FILHO_PRAIA_DA_CONCHA_ITACARE_BAHIA_%283%29_%2841572951511%29.jpg/1280px-MARCIO_FILHO_PRAIA_DA_CONCHA_ITACARE_BAHIA_%283%29_%2841572951511%29.jpg', vibe: 'La playa del pueblo, de agua calma junto a la desembocadura del río, con el faro en la punta.', cuando: 'Atardecer, desde el faro.' },
      { name: 'Tiririca', zona: '1.5 km', lat: -14.2861, lng: -38.9854, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/MARCIO_FILHO_PRAIA_DA_TIRIRICA_ITACARE_BAHIA_%2840974478571%29.jpg/1280px-MARCIO_FILHO_PRAIA_DA_TIRIRICA_ITACARE_BAHIA_%2840974478571%29.jpg', vibe: 'La playa de los surfistas, con las mejores olas del pueblo y bares sencillos.', cuando: 'Tarde, para ver el surf.' },
      { name: 'Ribeira', zona: '2 km', lat: -14.29, lng: -38.988, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Arriba_da_Praia_da_Ribeira_do_Cavalo.jpg/1280px-Arriba_da_Praia_da_Ribeira_do_Cavalo.jpg', vibe: 'Agua calma en una punta y un río con cascada chica en la otra, donde la gente se tira desde una cuerda.', cuando: 'Mediodía.' },
      { name: 'Prainha', zona: 'Sendero desde la Ribeira, 3 km', lat: -14.308, lng: -38.9891, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/MARCIO_FILHO_PRAINHA_ITACARE_BAHIA_%2840974466101%29.jpg/1280px-MARCIO_FILHO_PRAINHA_ITACARE_BAHIA_%2840974466101%29.jpg', vibe: 'Una cala de cocoteros a la que se llega por un sendero de media hora por la selva. Para muchos, la más linda de Itacaré.', cuando: 'Mañana; volvé antes de las 16.' },
      { name: 'Itacarezinho', zona: 'Ruta a Ilhéus, 12 km', lat: -14.3816, lng: -39.0101, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Praia_de_Itacar%C3%A9zinho_-_Itacar%C3%A9_-_Bahia_-_Brasil_%288552602430%29.jpg/1280px-Praia_de_Itacar%C3%A9zinho_-_Itacar%C3%A9_-_Bahia_-_Brasil_%288552602430%29.jpg', vibe: 'Una playa larga y casi vacía, con cascada sobre la arena en un extremo.', cuando: 'Día entero.' }
    ],
    atracciones: [
      { name: 'Farol de Itacaré', zona: 'Praia da Concha', dur: '30 min', usd: 0, nota: 'El faro en la punta de la Concha, con el atardecer sobre el río.' },
      { name: 'Rua Pituba', zona: 'Centro', dur: '1 h', usd: 0, nota: 'La calle peatonal del pueblo, con bares, crepes y música. Es la noche de Itacaré.' },
      { name: 'Igreja de São Miguel', zona: 'Centro', dur: '15 min', usd: 0, nota: 'Iglesia colonial frente al río, de las más antiguas del sur de Bahía.' }
    ],
    comer: [
      { name: 'Prato feito', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'El plato del día de los bares del centro, lejos de la Pituba.' },
      { name: 'Moqueca de banana-da-terra', tipo: 'Cena', zona: 'Pituba', usd: 15, momento: 'Noche', nota: 'La versión vegetariana de la moqueca, con banana de cocinar.' },
      { name: 'Chocolate de cacao local', tipo: 'Merienda', zona: 'Centro', usd: 4, momento: 'Tarde', nota: 'El sur de Bahía es tierra de cacao: hay chocolaterías con barras de fazendas de la zona.' }
    ],
    hacer: [
      { name: 'Sendero de las cuatro playas', zona: 'Sale de la ruta', dur: '4 h', usd: 15, nota: 'Une Prainha, São José, Jeribucaçu y Arruda por la selva. Se hace con guía.' },
      { name: 'Clase de surf', zona: 'Tiririca', dur: '2 h', usd: 30, nota: 'Itacaré es uno de los mejores lugares de Brasil para aprender.' },
      { name: 'Rafting en el Rio de Contas', zona: 'Taboquinhas', dur: 'Medio día', usd: 40, nota: 'Rápidos en el río que desemboca en el pueblo, en excursión.' }
    ],
    tips: [
      { titulo: 'Senderos, de día', texto: 'Las calas de la selva no tienen luz ni guardavidas. Volvé antes de que oscurezca y no lleves nada de valor.' },
      { titulo: 'La ruta es de Ilhéus', texto: 'El aeropuerto más cercano es Ilhéus, a 70 km por una ruta linda entre cacaotales.' },
      { titulo: 'Mosquitos de tarde', texto: 'Por la selva y los ríos, al atardecer hay mosquitos. Repelente antes de que baje el sol.' }
    ]
  },

  forte: {
    resumen: 'Una vila peatonal de pescadores con piscinas naturales frente a la playa y el centro de tortugas del Projeto Tamar. Al norte y al sur, playas de cocoteros casi vacías.',
    temporada: { alta: [12, 1, 2, 7], baja: [4, 5, 6], nota: 'De abril a junio llueve más. De septiembre a marzo hay sol, y de septiembre a marzo las tortugas desovan en la playa. Julio y verano son los meses caros.' },
    beaches: [
      { name: 'Praia do Forte', zona: 'Frente a la vila', lat: -12.5775, lng: -38.0064, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Barcos-PraiaDoForte.jpg/1280px-Barcos-PraiaDoForte.jpg', vibe: 'La playa del pueblo, con piscinas naturales en el arrecife cuando baja la marea y la capilla de São Francisco en la punta.', cuando: 'Marea baja, de mañana.' },
      { name: 'Itacimirim', zona: 'Sur, 6 km', lat: -12.62, lng: -38.045, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Praia_de_Itacimirim%2C_Cama%C3%A7ari%2C_Bahia_-_20250729_104908.jpg/1280px-Praia_de_Itacimirim%2C_Cama%C3%A7ari%2C_Bahia_-_20250729_104908.jpg', vibe: 'Agua quieta y piscinas grandes en el arrecife, con casas de veraneo y poca gente entre semana.', cuando: 'Marea baja.' },
      { name: 'Guarajuba', zona: 'Sur, 10 km', lat: -12.648, lng: -38.064, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Pescadores_Guarajuba_%282671595439%29.jpg/1280px-Pescadores_Guarajuba_%282671595439%29.jpg', vibe: 'Una playa de arrecifes con agua verde y calma, de las más limpias del litoral norte de Bahía.', cuando: 'Mañana.' },
      { name: 'Imbassaí', zona: 'Norte, 11 km', lat: -12.489, lng: -37.962, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Imbassa%C3%AD%2C_Mata_de_S%C3%A3o_Jo%C3%A3o%2C_Bahia_-_20250729_152829.jpg/1280px-Imbassa%C3%AD%2C_Mata_de_S%C3%A3o_Jo%C3%A3o%2C_Bahia_-_20250729_152829.jpg', vibe: 'Un río de agua oscura que corre paralelo al mar, separado por una franja de arena: se nada en agua dulce y en agua salada a veinte metros.', cuando: 'Día entero.' }
    ],
    atracciones: [
      { name: 'Projeto Tamar', zona: 'Vila', dur: '1 h 30', usd: 10, nota: 'La base principal de conservación de tortugas marinas de Brasil, con tanques, tortugas y tiburones de arrecife.' },
      { name: 'Castelo Garcia d\'Ávila', zona: '3 km de la vila', dur: '1 h', usd: 5, nota: 'Ruinas de un castillo del siglo XVI, el primer edificio de piedra del Brasil portugués.' },
      { name: 'Capela de São Francisco', zona: 'Punta de la playa', dur: '15 min', usd: 0, nota: 'La capilla blanca sobre la arena, al final de la calle principal.' }
    ],
    comer: [
      { name: 'Acarajé de la vila', tipo: 'Merienda', zona: 'Alameda do Sol', usd: 4, momento: 'Tarde', nota: 'Las baianas de la calle principal, al atardecer.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Vila', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en las calles de atrás de la principal.' },
      { name: 'Moqueca', tipo: 'Cena', zona: 'Vila', usd: 22, momento: 'Noche', nota: 'Moqueca baiana para dos en los restaurantes de la alameda.' }
    ],
    hacer: [
      { name: 'Snorkel en las piscinas', zona: 'Frente a la vila', dur: '1 h', usd: 0, nota: 'Con marea baja se nada desde la arena hasta las piscinas. Llevá máscara propia.' },
      { name: 'Reserva de Sapiranga', zona: '5 km', dur: '3 h', usd: 15, nota: 'Selva atlántica con senderos, río y tirolesa.' },
      { name: 'Ver el desove de tortugas', zona: 'Playa', dur: '1 h', usd: 0, nota: 'De septiembre a marzo, con suerte, el Tamar libera tortuguitas al atardecer.' }
    ],
    tips: [
      { titulo: 'La vila es peatonal', texto: 'Los autos se dejan en el estacionamiento de la entrada. Todo lo demás es a pie.' },
      { titulo: 'Salvador queda cerca', texto: 'El aeropuerto de Salvador está a 55 km por la Estrada do Coco. Se llega en ómnibus o transfer en una hora.' },
      { titulo: 'Las tortugas no se tocan', texto: 'Si ves una tortuga en la playa, no la toques ni la alumbres. Avisá al Tamar.' }
    ]
  },

  ajuda: {
    resumen: 'Un pueblo sobre un acantilado frente a Porto Seguro, con calles de bares y una escalera que baja a playas de arrecife y cocoteros.',
    temporada: { alta: [12, 1, 2, 7], baja: [4, 5, 6], nota: 'De abril a junio llueve más. En Año Nuevo y Carnaval el pueblo está lleno y caro. Septiembre, octubre y noviembre tienen sol y precios bajos.' },
    beaches: [
      { name: 'Mucugê', zona: 'Abajo del pueblo', lat: -16.4948, lng: -39.0687, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG/1280px-Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG', vibe: 'La playa a la que se baja por la calle del Mucugê, con barracas, agua calma y piscinas en el arrecife.', cuando: 'Marea baja, de mañana.' },
      { name: 'Pitinga', zona: 'Sur, 6 km', lat: -16.5125, lng: -39.0739, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg/1280px-Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg', vibe: 'Acantilados rojos, arena dorada y piscinas naturales. La más linda de Arraial y menos llena que Mucugê.', cuando: 'Marea baja.' },
      { name: 'Taípe', zona: 'Sur, 11 km', lat: -16.5534, lng: -39.0863, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg/1280px-Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg', vibe: 'Acantilados altos de colores sobre una playa casi vacía, camino a Trancoso.', cuando: 'Tarde, cuando el sol pega en el acantilado.' }
    ],
    atracciones: [
      { name: 'Rua do Mucugê', zona: 'Centro', dur: '1 h', usd: 0, nota: 'La calle de bares, tiendas y restaurantes que baja a la playa. De noche se ilumina con faroles.' },
      { name: 'Igreja Matriz de Nossa Senhora d\'Ajuda', zona: 'Plaza', dur: '20 min', usd: 0, nota: 'Iglesia del siglo XVI sobre el acantilado, con un mirador al mar.' },
      { name: 'Mirante de la plaza', zona: 'Plaza', dur: '20 min', usd: 0, nota: 'Detrás de la iglesia, la vista de la costa hasta Porto Seguro.' }
    ],
    comer: [
      { name: 'Prato feito', tipo: 'Almuerzo', zona: 'Calles de atrás', usd: 9, momento: 'Mediodía', nota: 'El plato del día fuera de la Rua do Mucugê.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Plaza', usd: 4, momento: 'Tarde', nota: 'Las baianas de la plaza de la iglesia.' },
      { name: 'Pescado en la barraca', tipo: 'Almuerzo', zona: 'Mucugê y Pitinga', usd: 15, momento: 'Mediodía', nota: 'Porción de pescado para compartir en las barracas de playa.' }
    ],
    hacer: [
      { name: 'Caminata por la playa a Pitinga', zona: 'Desde Mucugê', dur: '1 h', usd: 0, nota: 'Por la arena con marea baja, pasando por piscinas naturales.' },
      { name: 'Balsa a Porto Seguro', zona: 'Muelle', dur: '15 min', usd: 1, nota: 'La balsa cruza el río a Porto Seguro: la ciudad histórica queda del otro lado.' },
      { name: 'Excursión a Trancoso', zona: 'Sale del pueblo', dur: 'Medio día', usd: 10, nota: 'El Quadrado de Trancoso está a 25 km. Se va en ómnibus o en buggy por la playa.' }
    ],
    tips: [
      { titulo: 'Bajada empinada', texto: 'Del pueblo a la playa es una bajada fuerte de diez minutos. La vuelta, al sol, se siente.' },
      { titulo: 'Base barata para Trancoso', texto: 'Arraial cuesta bastante menos que Trancoso y está a media hora.' },
      { titulo: 'Las barracas cobran consumo', texto: 'Algunas barracas de playa cobran consumo mínimo por las reposeras. Preguntá antes de sentarte.' }
    ]
  },

  fernando: {
    resumen: 'Un archipiélago parque nacional con el agua más transparente de Brasil, delfines, tortugas y tiburones de arrecife. Hay cupo de visitantes y cada playa tiene sus reglas.',
    temporada: { alta: [9, 10, 11, 12, 1], baja: [4, 5, 6], nota: 'De agosto a enero el mar está calmo y el agua más clara. De diciembre a marzo llegan las olas del norte. De marzo a julio llueve más. La isla cuesta lo mismo todo el año: la tasa es fija.' },
    beaches: [
      { name: 'Baía do Sancho', zona: 'Mar de adentro', lat: -3.8545, lng: -32.443, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Fernando_de_Noronha_-_PE_-_Baia_do_Sancho.jpg/1280px-Fernando_de_Noronha_-_PE_-_Baia_do_Sancho.jpg', vibe: 'Elegida varias veces la mejor playa del mundo. Se baja por una escalera dentro de una grieta del acantilado y abajo hay tortugas y peces a la orilla.', cuando: 'Mañana, antes de los barcos.' },
      { name: 'Baía dos Porcos', zona: 'Mar de adentro', lat: -3.8505, lng: -32.44, foto: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Ba%C3%ADa_dos_Porcos%2C_Fernando_de_Noronha.jpg', vibe: 'Una cala chica con piscinas naturales y la vista de los Dois Irmãos. Se llega por las piedras desde la Cacimba do Padre.', cuando: 'Marea baja.' },
      { name: 'Conceição', zona: 'Vila, al pie del Morro do Pico', lat: -3.8409, lng: -32.4163, foto: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Morro_do_Pico_and_Concei%C3%A7%C3%A3o_Beach_in_Fernando_de_Noronha.jpg', vibe: 'Una playa larga de arena dorada, con bar y el atardecer frente al Morro do Pico.', cuando: 'Atardecer.' },
      { name: 'Cachorro', zona: 'Vila dos Remédios', lat: -3.839, lng: -32.4109, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Praia_do_Cachorro%2C_Fernando_de_Noronha_01.jpg/1280px-Praia_do_Cachorro%2C_Fernando_de_Noronha_01.jpg', vibe: 'La playa del pueblo, con piscina natural y bares. Es donde va la gente de la isla.', cuando: 'Tarde.' },
      { name: 'Sueste', zona: 'Mar de afuera', lat: -3.8662, lng: -32.4256, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Forte_S%C3%A3o_Joaquim_do_Sueste.JPG/1280px-Forte_S%C3%A3o_Joaquim_do_Sueste.JPG', vibe: 'Una bahía de agua calma donde se nada con tortugas y tiburones limón en el fondo. Snorkel con guía.', cuando: 'Mañana, con marea alta.' },
      { name: 'Leão', zona: 'Mar de afuera', lat: -3.87, lng: -32.4373, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/PE_-_Parque_Nacional_Marinho_Fernando_de_Noronha_-_Praia_do_Le%C3%A3o.jpg/1280px-PE_-_Parque_Nacional_Marinho_Fernando_de_Noronha_-_Praia_do_Le%C3%A3o.jpg', vibe: 'Playa salvaje donde desovan las tortugas. El baño es restringido; se va a mirar.', cuando: 'Atardecer.' },
      { name: 'Atalaia', zona: 'Mar de afuera', lat: -3.878, lng: -32.43, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Praia_da_Atalaia_-_panoramio_%281%29.jpg/1280px-Praia_da_Atalaia_-_panoramio_%281%29.jpg', vibe: 'Una piscina natural con cupo diario y reglas estrictas: sin protector solar, tiempo limitado. Agua como un acuario.', cuando: 'Marea baja; se reserva en el ICMBio.' }
    ],
    atracciones: [
      { name: 'Mirante dos Golfinhos', zona: 'Baía dos Golfinhos', dur: '1 h', usd: 0, nota: 'Desde el acantilado se ven cientos de delfines rotadores que entran a descansar a la bahía. Temprano a la mañana.' },
      { name: 'Forte dos Remédios', zona: 'Vila dos Remédios', dur: '40 min', usd: 0, nota: 'Fuerte del siglo XVIII sobre el pueblo, con vista al Morro do Pico y a las playas del norte.' },
      { name: 'Mirante do Boldró', zona: 'Boldró', dur: '1 h', usd: 0, nota: 'El atardecer de la isla, con los Dois Irmãos de frente.' }
    ],
    comer: [
      { name: 'Prato feito de la vila', tipo: 'Almuerzo', zona: 'Vila dos Remédios', usd: 15, momento: 'Mediodía', nota: 'En la isla todo llega en barco o avión: el plato del día es lo más barato que hay.' },
      { name: 'Tapioca de la plaza', tipo: 'Merienda', zona: 'Vila dos Remédios', usd: 5, momento: 'Tarde', nota: 'Puestos de tapioca en la plaza del pueblo.' },
      { name: 'Festival gastronómico', tipo: 'Cena', zona: 'Restaurantes de posadas', usd: 50, momento: 'Noche', nota: 'Varias posadas abren su cocina con menú degustación una noche por semana. Caro, pero es el plan de la isla.' }
    ],
    hacer: [
      { name: 'Paseo de barco', zona: 'Porto de Santo Antônio', dur: '3 h', usd: 50, nota: 'Recorre el mar de adentro hasta la Ponta da Sapata, con delfines casi seguros.' },
      { name: 'Ilha tour', zona: 'Toda la isla', dur: 'Día entero', usd: 45, nota: 'Recorrido en buggy o camioneta por las playas y miradores con guía local. Bueno para el primer día.' },
      { name: 'Planasub', zona: 'Porto', dur: '1 h 30', usd: 60, nota: 'Te remolca una lancha sobre una tabla bajo el agua. Se ve el fondo como volando.' }
    ],
    tips: [
      { titulo: 'Dos tasas obligatorias', texto: 'La TPA, por día de estadía, y el ingreso al Parque Nacional, que vale por diez días. Las dos se pagan online antes de viajar.' },
      { titulo: 'Reservá Atalaia y Sancho', texto: 'Algunas playas tienen cupo diario y se reservan en el centro de visitantes del ICMBio. Hacelo el primer día.' },
      { titulo: 'Todo es caro', texto: 'Comida, agua y transporte cuestan bastante más que en el continente. Llevá snacks y protector solar desde casa.' }
    ]
  },

  bombinhas: {
    resumen: 'Una península chica con más de treinta playas y el agua más transparente del sur de Brasil. Las mejores son calas entre morros, a minutos una de otra.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 7, 8, 9], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. En temporada alta se cobra una tasa ambiental para entrar con auto.' },
    beaches: [
      { name: 'Bombinhas', zona: 'Centro', lat: -27.1471, lng: -48.4936, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Renato_Soares_Praia_de_Bombinhas_Bombinhas_SC_%2839151782420%29.jpg/1280px-Renato_Soares_Praia_de_Bombinhas_Bombinhas_SC_%2839151782420%29.jpg', vibe: 'La playa del centro, de agua verde y quieta, con restaurantes y la mayor parte de los hoteles.', cuando: 'Mañana; de tarde se llena.' },
      { name: 'Sepultura', zona: 'Centro, a pie', lat: -27.1414, lng: -48.4778, foto: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Praia_da_Sepultura_-_Bombinhas%2C_Santa_Catarina%2C_Brasil.jpg', vibe: 'Una cala chica entre piedras con el agua más clara de la península. La mejor para snorkel desde la orilla.', cuando: 'Temprano: entra poca gente y a las 10 ya no hay lugar.' },
      { name: 'Quatro Ilhas', zona: 'Este, 1.5 km', lat: -27.1569, lng: -48.4849, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Quatroilhas4.jpg/1280px-Quatroilhas4.jpg', vibe: 'Playa larga de arena blanca frente a cuatro islotes. Hay olas y lugar de sobra.', cuando: 'Tarde.' },
      { name: 'Mariscal', zona: 'Sur, 4 km', lat: -27.1774, lng: -48.4998, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Renato_Soares_Praia_do_Mariscal_Bombinhas_SC_%2839151781020%29.jpg/1280px-Renato_Soares_Praia_do_Mariscal_Bombinhas_SC_%2839151781020%29.jpg', vibe: 'Una playa abierta y larga, de mar más bravo, con dunas y restinga detrás. La de los surfistas.', cuando: 'Tarde, con olas.' },
      { name: 'Bombas', zona: 'Oeste, 3 km', lat: -27.1391, lng: -48.509, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/Renato_Soares_Praia_de_Bombas_Bombinhas_SC_%2840252057674%29.jpg/1280px-Renato_Soares_Praia_de_Bombas_Bombinhas_SC_%2840252057674%29.jpg', vibe: 'La playa familiar, larga y de agua calma, con quioscos y buena infraestructura.', cuando: 'Todo el día.' }
    ],
    atracciones: [
      { name: 'Mirante do Morro do Macaco', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Mirador con vista a Bombinhas, Bombas y la bahía. Se sube en auto o en una caminata empinada.' },
      { name: 'Reserva Marinha do Arvoredo', zona: 'En barco', dur: '5 h', usd: 50, nota: 'La reserva marina frente a la península, con el agua más clara del sur. Buceo y snorkel con operadoras.' },
      { name: 'Trilha da Sepultura', zona: 'Centro', dur: '40 min', usd: 0, nota: 'Sendero corto por la costa desde la Sepultura, con miradores sobre el agua transparente.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la avenida principal, lejos de la arena.' },
      { name: 'Sequência de camarão', tipo: 'Cena', zona: 'Bombinhas y Zimbros', usd: 25, momento: 'Noche', nota: 'Camarón en seis formas distintas, servido en rondas. Para dos alcanza para tres.' },
      { name: 'Pastel de berbigão', tipo: 'Merienda', zona: 'Puestos de playa', usd: 4, momento: 'Tarde', nota: 'Pastel relleno de un molusco chico de la zona.' }
    ],
    hacer: [
      { name: 'Snorkel en la Sepultura', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Desde la orilla y junto a las piedras de la derecha. Agua clara y peces grandes.' },
      { name: 'Bautismo de buceo', zona: 'Bombinhas', dur: '3 h', usd: 70, nota: 'Bombinhas es la capital del buceo del sur. El bautismo se hace sin curso previo.' },
      { name: 'Trilha do Morro do Macaco', zona: 'Centro', dur: '1 h 30', usd: 0, nota: 'Subida con vista a toda la península.' }
    ],
    tips: [
      { titulo: 'La tasa ambiental', texto: 'De noviembre a abril se paga una tasa para entrar en auto a la península. Se paga online antes de llegar.' },
      { titulo: 'Sin auto se puede', texto: 'Las playas están cerca y hay ómnibus entre ellas. En temporada el tránsito es lento: caminar es más rápido.' },
      { titulo: 'El agua no es caribeña', texto: 'Es clara pero fría para el estándar del Nordeste: unos 22 grados en verano.' }
    ]
  },

  rosa: {
    resumen: 'Una bahía en forma de herradura con una laguna detrás, cerros verdes y ballenas en invierno. Se recorre a pie por senderos entre playas.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 7, 8, 9], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. De julio a noviembre la ballena franca entra a la bahía a tener crías: se ve desde la costa.' },
    beaches: [
      { name: 'Praia do Rosa', zona: 'Centro', lat: -28.1295, lng: -48.6417, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Prainha_2_Praia_do_Rosa_Sul.jpg/1280px-Prainha_2_Praia_do_Rosa_Sul.jpg', vibe: 'La bahía principal, con olas para surf y una laguna en una punta. Se baja desde el pueblo por calles de tierra.', cuando: 'Mañana para nadar; tarde para el surf.' },
      { name: 'Lagoa de Ibiraquera', zona: 'Norte, detrás de la playa', lat: -28.129, lng: -48.6436, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Vista_da_Lagoa_de_Ibiraquera_-_panoramio.jpg/1280px-Vista_da_Lagoa_de_Ibiraquera_-_panoramio.jpg', vibe: 'Una laguna de agua salobre y bajita, ideal para kitesurf y stand-up. Atardeceres sobre el agua.', cuando: 'Atardecer.' },
      { name: 'Ouvidor', zona: 'Norte, 4 km', lat: -28.092, lng: -48.626, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Praia_do_Ouvidor.jpg', vibe: 'Una cala chica entre piedras, de olas fuertes, buena para surf y para mirar.', cuando: 'Tarde.' },
      { name: 'Ferrugem', zona: 'Norte, 5 km', lat: -28.087, lng: -48.623, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Pedras_na_Praia_da_Ferrugem.jpg/1280px-Pedras_na_Praia_da_Ferrugem.jpg', vibe: 'La playa joven de la zona, con bares y fiesta de noche en verano.', cuando: 'Tarde y noche.' }
    ],
    atracciones: [
      { name: 'Mirante do Rosa', zona: 'Norte de la bahía', dur: '30 min', usd: 0, nota: 'La vista de toda la herradura de arena con la laguna detrás. La foto del Rosa.' },
      { name: 'Ballenas desde la costa', zona: 'Toda la bahía', dur: '1 h', usd: 0, nota: 'De julio a noviembre la ballena franca se ve desde los morros, a veces a cien metros.' },
      { name: 'Trilha do Rosa al Luz', zona: 'Sur', dur: '1 h', usd: 0, nota: 'Sendero por el morro entre las dos playas.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro del Rosa', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la calle principal.' },
      { name: 'Ostras de la laguna', tipo: 'Cena', zona: 'Ibiraquera', usd: 12, momento: 'Noche', nota: 'Ostras frescas de la zona, crudas o gratinadas.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Playa', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la arena.' }
    ],
    hacer: [
      { name: 'Clase de surf', zona: 'Praia do Rosa', dur: '2 h', usd: 30, nota: 'Escuelas en la arena con tabla y traje de neoprene incluidos.' },
      { name: 'Kitesurf en la laguna', zona: 'Ibiraquera', dur: '3 h', usd: 60, nota: 'Agua bajita y viento constante: el mejor lugar para aprender.' },
      { name: 'Avistaje de ballenas', zona: 'Embarque en Garopaba', dur: '2 h', usd: 40, nota: 'De julio a noviembre, en barco autorizado.' }
    ],
    tips: [
      { titulo: 'Calles de tierra y subidas', texto: 'El pueblo está en un morro y la playa abajo. Con lluvia las calles de tierra se ponen difíciles.' },
      { titulo: 'Florianópolis queda a 90 km', texto: 'El aeropuerto más cercano es Florianópolis, a hora y media.' },
      { titulo: 'El agua es fría', texto: 'Incluso en enero el agua está a 21 o 22 grados. El neoprene es normal para surfear.' }
    ]
  },

  bcm: {
    resumen: 'Una ciudad de rascacielos frente al mar, con la playa central siempre llena. Las playas lindas están al sur, por la Interpraias, a pocos minutos.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 7, 8, 9], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. En Año Nuevo la ciudad recibe más de un millón de personas.' },
    beaches: [
      { name: 'Praia Central', zona: 'Centro', lat: -26.9889, lng: -48.6296, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Sol_nascendo_em_Balne%C3%A1rio_Cambori%C3%BA_-_Praia_Central_-_panoramio.jpg/1280px-Sol_nascendo_em_Balne%C3%A1rio_Cambori%C3%BA_-_Praia_Central_-_panoramio.jpg', vibe: 'La playa urbana, con edificios altísimos y la rambla nueva. De tarde los edificios hacen sombra en la arena.', cuando: 'Mañana, antes de que llegue la sombra.' },
      { name: 'Praia dos Amores', zona: 'Norte, 4 km', lat: -26.9575, lng: -48.6359, foto: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/Praia_dos_Amores_-_SC_%283171254166%29.jpg', vibe: 'Playa de olas, con surf y paragliding cayendo desde el morro.', cuando: 'Tarde.' },
      { name: 'Taquarinhas', zona: 'Interpraias, 5 km', lat: -26.9979, lng: -48.5829, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Praia_de_Taquarinhas_-_Interpraias.jpg/1280px-Praia_de_Taquarinhas_-_Interpraias.jpg', vibe: 'Una cala chica rodeada de selva, sin edificios. Se llega por la ruta Interpraias o en barco.', cuando: 'Mañana.' },
      { name: 'Estaleiro', zona: 'Interpraias, 7 km', lat: -27.0262, lng: -48.5806, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Praia_do_Estaleiro.jpg/1280px-Praia_do_Estaleiro.jpg', vibe: 'Playa tranquila con restaurantes de pescado y agua clara.', cuando: 'Todo el día.' },
      { name: 'Estaleirinho', zona: 'Interpraias, 8 km', lat: -27.0493, lng: -48.5878, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Praia_do_Estaleirinho_%2821397801002%29.jpg/1280px-Praia_do_Estaleirinho_%2821397801002%29.jpg', vibe: 'La más salvaje de la Interpraias, larga y con pocas casas.', cuando: 'Tarde.' }
    ],
    atracciones: [
      { name: 'Parque Unipraias', zona: 'Barra Sul', dur: '2 h', usd: 25, nota: 'Teleférico que cruza el Morro da Aguada hasta la Praia de Laranjeiras, con miradores y tirolesa.' },
      { name: 'Cristo Luz', zona: 'Morro da Cruz', dur: '1 h', usd: 6, nota: 'Una estatua de Cristo de 33 metros sobre la ciudad, iluminada de noche.' },
      { name: 'Molhe da Barra Sul', zona: 'Barra Sul', dur: '40 min', usd: 0, nota: 'Escollera al final de la playa central, con la vista de los edificios al atardecer.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Avenida Brasil', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la avenida paralela a la rambla.' },
      { name: 'Pescado en el Estaleiro', tipo: 'Almuerzo', zona: 'Interpraias', usd: 18, momento: 'Mediodía', nota: 'Restaurantes frente al mar con sequência de camarão y pescado.' },
      { name: 'Churros y helado en la rambla', tipo: 'Merienda', zona: 'Avenida Atlântica', usd: 3, momento: 'Tarde', nota: 'La merienda de los carritos de la rambla.' }
    ],
    hacer: [
      { name: 'Ruta Interpraias', zona: 'Sur', dur: 'Medio día', usd: 0, nota: 'Ruta panorámica por la costa sur que une cinco playas con miradores. En auto o en ómnibus turístico.' },
      { name: 'Barco pirata', zona: 'Barra Sul', dur: '2 h', usd: 15, nota: 'Paseo en barco por la bahía con parada en Laranjeiras.' },
      { name: 'Paragliding', zona: 'Morro do Careca', dur: '30 min', usd: 70, nota: 'Vuelo doble desde el morro sobre la Praia dos Amores.' }
    ],
    tips: [
      { titulo: 'La sombra de los edificios', texto: 'Después del mediodía los edificios tapan el sol en la playa central. Para la tarde, Interpraias.' },
      { titulo: 'Beto Carrero está cerca', texto: 'El parque temático Beto Carrero World está en Penha, a 40 km. Es un día entero.' },
      { titulo: 'Fin de semana largo, tránsito', texto: 'La BR-101 se colapsa los fines de semana de verano. Llegá un día de semana.' }
    ]
  },

  itapema: {
    resumen: 'Una ciudad de edificios frente a Meia Praia, con playas chicas y calas al norte y la península de Porto Belo a minutos.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 7, 8, 9], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada.' },
    beaches: [
      { name: 'Meia Praia', zona: 'Sur del centro', lat: -27.1289, lng: -48.6061, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Renato_Soares_Meia_Praia_vista_da_Ponte_do_Suspiro_Itapema_SC_%2840872082054%29.jpg/1280px-Renato_Soares_Meia_Praia_vista_da_Ponte_do_Suspiro_Itapema_SC_%2840872082054%29.jpg', vibe: 'La playa larga de los edificios, de agua calma y arena ancha. La rambla se camina de punta a punta.', cuando: 'Mañana.' },
      { name: 'Praia Grossa', zona: 'Norte, 2 km', lat: -27.0864, lng: -48.5963, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Praia_grossa_-_panoramio.jpg/1280px-Praia_grossa_-_panoramio.jpg', vibe: 'Una playa salvaje entre morros, sin edificios, a la que se baja por un sendero. Olas para surf.', cuando: 'Tarde.' },
      { name: 'Ilhota', zona: 'Norte, 2.5 km', lat: -27.076, lng: -48.5948, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Renato_Soares_Praia_da_Ilhota_Itapema_SC_%2841583094621%29.jpg/1280px-Renato_Soares_Praia_da_Ilhota_Itapema_SC_%2841583094621%29.jpg', vibe: 'Una cala chica de agua quieta y transparente, la más linda de Itapema.', cuando: 'Mañana.' }
    ],
    atracciones: [
      { name: 'Mirante do Encanto', zona: 'Morro do Encanto', dur: '40 min', usd: 0, nota: 'La vista de Meia Praia y de toda la bahía desde el morro.' },
      { name: 'Rambla de Meia Praia', zona: 'Meia Praia', dur: '1 h', usd: 0, nota: 'Ciclovía y paseo frente al mar, con quioscos.' },
      { name: 'Porto Belo', zona: '10 km', dur: '2 h', usd: 0, nota: 'El pueblo vecino, con la Ilha de Porto Belo enfrente y barcos que cruzan.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en las calles paralelas a la rambla.' },
      { name: 'Sequência de camarão', tipo: 'Cena', zona: 'Rambla', usd: 25, momento: 'Noche', nota: 'Camarón en varias formas, para dos.' },
      { name: 'Pastel de feria', tipo: 'Merienda', zona: 'Centro', usd: 3, momento: 'Tarde', nota: 'Pastel frito con caldo de cana.' }
    ],
    hacer: [
      { name: 'Ilha de Porto Belo', zona: 'Porto Belo', dur: 'Medio día', usd: 15, nota: 'Barco corto a la isla, con playa, sendero y restaurante.' },
      { name: 'Sendero a la Praia Grossa', zona: 'Norte', dur: '1 h', usd: 0, nota: 'Bajada corta desde la ruta hasta la playa salvaje.' },
      { name: 'Bicicleta por la rambla', zona: 'Meia Praia', dur: '1 h', usd: 0, nota: 'Ciclovía de punta a punta de la playa.' }
    ],
    tips: [
      { titulo: 'Base para Bombinhas', texto: 'Itapema cuesta menos que Bombinhas y está a 15 km: es buena base para ir de día.' },
      { titulo: 'Edificios, sombra de tarde', texto: 'Como en Camboriú, de tarde los edificios tapan el sol en Meia Praia.' },
      { titulo: 'Las calas del norte se llenan', texto: 'Ilhota y Praia Grossa son chicas. Llegá antes de las 10 en enero.' }
    ]
  },

  garopaba: {
    resumen: 'Un pueblo de pescadores con la iglesia frente a la bahía, rodeado de playas de surf, dunas y morros. Las ballenas entran a la bahía en invierno.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 7, 8, 9], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. De julio a noviembre se ven ballenas francas desde la costa.' },
    beaches: [
      { name: 'Silveira', zona: 'Sur, 2 km', lat: -28.0397, lng: -48.6089, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg/1280px-Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg', vibe: 'La playa de surf más famosa de Santa Catarina, entre morros verdes. Agua clara y fría.', cuando: 'Tarde, con olas.' },
      { name: 'Siriú', zona: 'Norte, 6 km', lat: -27.9765, lng: -48.6292, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Praia_do_Siri%C3%BA_in_Garopaba_6_%2821493002004%29.jpg/1280px-Praia_do_Siri%C3%BA_in_Garopaba_6_%2821493002004%29.jpg', vibe: 'Dunas enormes de arena blanca que caen sobre el mar. Se hace sandboard.', cuando: 'Atardecer en las dunas.' },
      { name: 'Ferrugem', zona: 'Sur, 6 km', lat: -28.0784, lng: -48.6282, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Ferrugem_006.jpg/1280px-Ferrugem_006.jpg', vibe: 'La playa joven, con bares, música y surf.', cuando: 'Tarde y noche.' },
      { name: 'Ouvidor', zona: 'Sur, 9 km', lat: -28.1051, lng: -48.6371, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Praia_do_Ouvidor.jpg', vibe: 'Una cala de olas fuertes entre piedras.', cuando: 'Tarde.' }
    ],
    atracciones: [
      { name: 'Igreja de São Joaquim', zona: 'Centro histórico', dur: '20 min', usd: 0, nota: 'La iglesia del siglo XIX frente a la bahía, con las casas de pescadores alrededor.' },
      { name: 'Morro da Vigia', zona: 'Centro', dur: '40 min', usd: 0, nota: 'El cerro desde donde los pescadores vigilaban las ballenas. Hoy es el mejor lugar para verlas.' },
      { name: 'Centro histórico', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Casas de pescadores azorianos frente a la playa central.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso en la calle principal.' },
      { name: 'Tainha frita', tipo: 'Almuerzo', zona: 'Restaurantes de pescadores', usd: 12, momento: 'Mediodía', nota: 'El pescado de la zona, sobre todo en invierno, frito o asado.' },
      { name: 'Açaí', tipo: 'Merienda', zona: 'Centro', usd: 5, momento: 'Tarde', nota: 'Bowl de açaí después de la playa.' }
    ],
    hacer: [
      { name: 'Sandboard en el Siriú', zona: 'Siriú', dur: '2 h', usd: 10, nota: 'Alquiler de tabla para bajar las dunas.' },
      { name: 'Avistaje de ballenas', zona: 'Embarque en el centro', dur: '2 h', usd: 40, nota: 'De julio a noviembre, en barco autorizado.' },
      { name: 'Clase de surf en el Silveira', zona: 'Silveira', dur: '2 h', usd: 30, nota: 'Escuelas con neoprene incluido.' }
    ],
    tips: [
      { titulo: 'Agua fría todo el año', texto: 'Incluso en verano el agua está fría. El neoprene es normal.' },
      { titulo: 'Rosa y Ferrugem al lado', texto: 'Praia do Rosa y Ferrugem están a menos de 15 km: se visitan de día.' },
      { titulo: 'Sin auto, el ómnibus pasa poco', texto: 'Las playas están dispersas. Fuera de temporada el ómnibus entre playas pasa cada mucho.' }
    ]
  },

  ferrugem: {
    resumen: 'Una playa de surf y fiesta entre morros, con una laguna al lado y las calas de Garopaba y el Rosa a pocos minutos.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 7, 8, 9], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas de argentinos y uruguayos. Marzo y diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada. Fuera del verano Ferrugem es un pueblo tranquilo de surfistas.' },
    beaches: [
      { name: 'Ferrugem', zona: 'Centro', lat: -28.0784, lng: -48.6282, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Ferrugem_006.jpg/1280px-Ferrugem_006.jpg', vibe: 'La playa principal, con olas para surf, bares sobre la arena y fiesta de noche en verano.', cuando: 'Tarde y noche.' },
      { name: 'Ouvidor', zona: '2.5 km', lat: -28.1051, lng: -48.6371, foto: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Praia_do_Ouvidor.jpg', vibe: 'Una cala salvaje entre piedras, para mirar el surf.', cuando: 'Tarde.' },
      { name: 'Praia do Rosa', zona: '5 km', lat: -28.1295, lng: -48.6417, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Renato_Soares_Praia_do_Rosa_Garopaba_SC_%2840140102305%29.jpg/1280px-Renato_Soares_Praia_do_Rosa_Garopaba_SC_%2840140102305%29.jpg', vibe: 'La bahía en herradura con laguna detrás, de las más lindas de Santa Catarina.', cuando: 'Mañana.' },
      { name: 'Silveira', zona: '5 km', lat: -28.0397, lng: -48.6089, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg/1280px-Renato_Soares_Praia_do_Silveira_Garopaba_SC_%2826712815257%29.jpg', vibe: 'La playa de surf más famosa de la zona, entre morros verdes.', cuando: 'Tarde.' }
    ],
    atracciones: [
      { name: 'Mirante da Ferrugem', zona: 'Morro de la punta', dur: '30 min', usd: 0, nota: 'Vista de la playa y de la laguna de la Barra desde el morro.' },
      { name: 'Lagoa da Encantada', zona: 'Barra', dur: '1 h', usd: 0, nota: 'La laguna detrás de la Barra, con atardecer sobre el agua.' },
      { name: 'Centro de Garopaba', zona: '6 km', dur: '1 h', usd: 0, nota: 'El pueblo de pescadores con la iglesia frente a la bahía.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Calle principal', usd: 10, momento: 'Mediodía', nota: 'Bufé por peso a dos cuadras de la playa.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Playa', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la arena.' },
      { name: 'Hamburguesa de bar de playa', tipo: 'Cena', zona: 'Centro', usd: 9, momento: 'Noche', nota: 'La comida de los bares antes de la fiesta.' }
    ],
    hacer: [
      { name: 'Clase de surf', zona: 'Ferrugem', dur: '2 h', usd: 30, nota: 'Escuelas en la arena con equipo incluido.' },
      { name: 'Stand-up en la laguna', zona: 'Barra', dur: '1 h', usd: 15, nota: 'Agua quieta, buena para aprender.' },
      { name: 'Sendero al Luz', zona: 'Desde el Rosa', dur: '1 h', usd: 0, nota: 'Por el morro entre el Rosa y la Praia do Luz.' }
    ],
    tips: [
      { titulo: 'Verano: fiesta; resto: calma', texto: 'En enero y febrero Ferrugem es la playa de la noche. El resto del año es un pueblo de surfistas.' },
      { titulo: 'Calles de tierra', texto: 'Con lluvia las calles se embarran. Calzado que se pueda mojar.' },
      { titulo: 'Agua fría', texto: 'Como en toda la zona, el agua es fría incluso en verano.' }
    ]
  },

  picarras: {
    resumen: 'Una playa larga de agua calma y arena ancha, con las calas de Penha a diez minutos y Beto Carrero World al lado.',
    temporada: { alta: [12, 1, 2], baja: [5, 6, 7, 8, 9], nota: 'Enero y febrero son los meses de agua tibia, precios altos y rutas llenas. Marzo y diciembre tienen el mismo sol con la mitad de la gente. De mayo a septiembre hace frío y el agua está helada.' },
    beaches: [
      { name: 'Praia de Piçarras', zona: 'Centro', lat: -26.7642, lng: -48.6709, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Renato_Soares_Praia_de_Pi%C3%A7arras_da_Barra_Sul_Pi%C3%A7arras_SC_%2839971318455%29.jpg/1280px-Renato_Soares_Praia_de_Pi%C3%A7arras_da_Barra_Sul_Pi%C3%A7arras_SC_%2839971318455%29.jpg', vibe: 'Siete kilómetros de arena ancha y agua tranquila, con la rambla y la desembocadura del río en una punta. Ideal con chicos.', cuando: 'Mañana.' },
      { name: 'Praia Vermelha', zona: 'Penha, 8 km', lat: -26.8041, lng: -48.5971, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/RenatoSoares_PraiaVermelha_Penha_SC_%2840434982784%29.jpg/1280px-RenatoSoares_PraiaVermelha_Penha_SC_%2840434982784%29.jpg', vibe: 'Una playa de Penha rodeada de morros verdes, con agua más clara que la de Piçarras y menos movimiento.', cuando: 'Mañana.' },
      { name: 'Praia da Paciência', zona: 'Penha, 7 km', lat: -26.7748, lng: -48.6006, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Penha-SC_Praia_da_Paci%C3%AAncia.jpg/1280px-Penha-SC_Praia_da_Paci%C3%AAncia.jpg', vibe: 'Una playa chica de Penha, con arena y piedras sueltas, a pocos minutos de la Armação. Hay poca gente fuera de enero.', cuando: 'Mañana.' }
    ],
    atracciones: [
      { name: 'Beto Carrero World', zona: 'Penha, 8 km', dur: 'Día entero', usd: 60, nota: 'El parque temático más grande de América Latina. Comprá la entrada online: sale más barata.' },
      { name: 'Rambla de Piçarras', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Paseo frente al mar con ciclovía y quioscos.' },
      { name: 'Mirante de Penha', zona: 'Penha', dur: '30 min', usd: 0, nota: 'Vista de las calas y las islas desde la ruta costera.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso en la avenida principal.' },
      { name: 'Mariscos de Penha', tipo: 'Cena', zona: 'Armação', usd: 15, momento: 'Noche', nota: 'Penha es productora de mejillones: porciones grandes y baratas.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Playa', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la rambla.' }
    ],
    hacer: [
      { name: 'Ruta por las calas de Penha', zona: 'Penha', dur: 'Medio día', usd: 0, nota: 'En auto o bicicleta por la costa, parando en Alegre, Saudade y Vermelha.' },
      { name: 'Bicicleta por la rambla', zona: 'Piçarras', dur: '1 h', usd: 0, nota: 'Ciclovía plana de punta a punta de la playa.' },
      { name: 'Paseo en barco por las islas', zona: 'Armação', dur: '2 h', usd: 15, nota: 'Recorre las islas frente a Penha.' }
    ],
    tips: [
      { titulo: 'Beto Carrero, temprano', texto: 'Las filas crecen después del mediodía. Llegá a la apertura y empezá por las atracciones grandes.' },
      { titulo: 'Agua calma, no caribeña', texto: 'El agua es calma y templada en verano, pero no transparente: para agua clara, las calas de Penha o Bombinhas.' },
      { titulo: 'Camboriú queda a 40 km', texto: 'Se visita de día. Piçarras es más tranquila y barata para dormir.' }
    ]
  },

  torres: {
    resumen: 'La única playa del Río Grande do Sul con acantilados: tres morros de piedra volcánica sobre el mar, con calas entre ellos y un parque arriba.',
    temporada: { alta: [1, 2], baja: [5, 6, 7, 8], nota: 'La costa gaúcha vive de enero a Carnaval: el agua llega a 22 grados y los pueblos se llenan. Fuera de esas semanas hay viento, agua fría y muchos comercios cerrados. En abril o mayo se hace el Festival Internacional de Balonismo.' },
    beaches: [
      { name: 'Praia Grande', zona: 'Centro', lat: -29.3366, lng: -49.7228, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Praia-grande-torres-rs.JPG/1280px-Praia-grande-torres-rs.JPG', vibe: 'La playa del centro, larga y con olas, entre el Morro do Farol y el Morro das Furnas.', cuando: 'Mañana.' },
      { name: 'Prainha', zona: 'Centro, a pie', lat: -29.3436, lng: -49.7262, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Prainha-torres-rs.JPG/1280px-Prainha-torres-rs.JPG', vibe: 'Una cala chica entre el Morro do Farol y el Morro das Furnas, más protegida del viento.', cuando: 'Mediodía.' },
      { name: 'Praia da Cal', zona: 'Centro', lat: -29.3469, lng: -49.7317, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/PRAIA_DA_CAL_-_panoramio_-_rafael_alexandre_de_%E2%80%A6_%283%29.jpg/1280px-PRAIA_DA_CAL_-_panoramio_-_rafael_alexandre_de_%E2%80%A6_%283%29.jpg', vibe: 'Una cala de surf al pie del Morro das Furnas, con las cuevas en la piedra.', cuando: 'Tarde, para ver el surf.' },
      { name: 'Praia da Guarita', zona: 'Parque da Guarita, 3 km', lat: -29.3579, lng: -49.7336, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Praia_da_Guarita_Torres_RS.jpg/1280px-Praia_da_Guarita_Torres_RS.jpg', vibe: 'Una playa al pie de las torres de piedra, dentro del parque. El agua es fría pero es la playa más linda del estado.', cuando: 'Atardecer.' },
      { name: 'Molhes', zona: 'Norte, en la desembocadura del río', lat: -29.3296, lng: -49.7154, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Molhes_-_Torres_-_Brasil0090.JPG/1280px-Molhes_-_Torres_-_Brasil0090.JPG', vibe: 'La escollera del río Mampituba, frontera con Santa Catarina. Pescadores y surfistas.', cuando: 'Tarde.' },
      { name: 'Itapeva', zona: 'Sur, 4 km', lat: -29.3702, lng: -49.7465, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Praia_de_Itapeva_no_Parque_Estadual_de_Itapeva.jpg/1280px-Praia_de_Itapeva_no_Parque_Estadual_de_Itapeva.jpg', vibe: 'Playa larga con dunas y un parque estatal detrás. Sin edificios.', cuando: 'Día entero.' }
    ],
    atracciones: [
      { name: 'Parque da Guarita', zona: 'Sur del centro', dur: '2 h', usd: 0, nota: 'Las torres de piedra que dan nombre a la ciudad, con senderos y miradores sobre el mar.' },
      { name: 'Morro do Farol', zona: 'Centro', dur: '40 min', usd: 0, nota: 'El cerro del faro, con vista a la Praia Grande y al mar. Se sube a pie o en auto.' },
      { name: 'Ilha dos Lobos', zona: 'Frente a la Praia Grande', dur: '20 min', usd: 0, nota: 'La isla de los lobos marinos, refugio de vida silvestre. Se ve desde los morros; no se desembarca.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la playa.' },
      { name: 'Pastel de camarón', tipo: 'Merienda', zona: 'Rambla', usd: 4, momento: 'Tarde', nota: 'En los quioscos de la Praia Grande.' },
      { name: 'Tainha asada', tipo: 'Cena', zona: 'Restaurantes del río', usd: 14, momento: 'Noche', nota: 'El pescado de la costa, asado entero.' }
    ],
    hacer: [
      { name: 'Caminata por los tres morros', zona: 'Centro → Guarita', dur: '3 h', usd: 0, nota: 'Del Morro do Farol a la Guarita por la costa, pasando las calas.' },
      { name: 'Barco a la Ilha dos Lobos', zona: 'Sale del río', dur: '1 h 30', usd: 15, nota: 'Paseo alrededor de la isla para ver lobos marinos. No desembarca.' },
      { name: 'Vuelo en globo', zona: 'Festival de Balonismo', dur: '1 h', usd: 150, nota: 'En la época del festival hay vuelos para el público.' }
    ],
    tips: [
      { titulo: 'El viento sur manda', texto: 'Con viento sur el agua se enfría y la playa se vacía. Para ese día, la Prainha es la más protegida.' },
      { titulo: 'Fuera de temporada, cerrado', texto: 'De marzo a diciembre muchos comercios y restaurantes cierran. La ciudad es tranquila y los precios bajan.' },
      { titulo: 'Santa Catarina al lado', texto: 'Cruzando el río está Passo de Torres, en Santa Catarina, con playas más tranquilas.' }
    ]
  },

  canoa: {
    resumen: 'El balneario familiar de la costa gaúcha: playa recta y larga, agua más tibia que el resto del estado y lagunas de agua dulce a pocos kilómetros.',
    temporada: { alta: [1, 2], baja: [5, 6, 7, 8], nota: 'La costa gaúcha vive de enero a Carnaval: el agua llega a 22 grados y los pueblos se llenan. Fuera de esas semanas hay viento, agua fría y muchos comercios cerrados.' },
    beaches: [
      { name: 'Capão da Canoa', zona: 'Centro', lat: -29.7377, lng: -50.0202, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Cap%C3%A3o_da_Canoa_centro_sul.JPG/1280px-Cap%C3%A3o_da_Canoa_centro_sul.JPG', vibe: 'La playa del centro, recta y ancha, con la rambla, los quioscos y el movimiento de las familias.', cuando: 'Mañana.' },
      { name: 'Atlântida', zona: 'Xangri-lá, 6 km', lat: -29.7931, lng: -50.0294, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Plataforma_Mar%C3%ADtima_de_Atl%C3%A2ntida_20260107_%2803%29.jpg/1280px-Plataforma_Mar%C3%ADtima_de_Atl%C3%A2ntida_20260107_%2803%29.jpg', vibe: 'La playa joven, con fiestas y beach clubs en verano.', cuando: 'Tarde y noche.' },
      { name: 'Xangri-lá', zona: 'Sur, 4 km', lat: -29.7931, lng: -50.0294, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Praia_de_xangri_la_-_3.jpg/1280px-Praia_de_xangri_la_-_3.jpg', vibe: 'Playa de condominios, más ordenada y con buena infraestructura.', cuando: 'Mañana.' },
      { name: 'Lagoa dos Quadros', zona: 'Oeste, 10 km', lat: -29.71, lng: -50.1, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Lagoa_dos_Quadros.JPG/1280px-Lagoa_dos_Quadros.JPG', vibe: 'Una laguna enorme de agua dulce, buena para kitesurf y windsurf.', cuando: 'Tarde, con viento.' }
    ],
    atracciones: [
      { name: 'Rambla de Capão', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Paseo frente al mar con quioscos y ferias de verano.' },
      { name: 'Plataforma de pesca', zona: 'Atlântida', dur: '30 min', usd: 2, nota: 'Muelle sobre el mar para pescar y mirar el atardecer.' },
      { name: 'Feria de artesanía', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Feria nocturna de verano en la plaza central.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso en la avenida principal.' },
      { name: 'Pastel', tipo: 'Merienda', zona: 'Rambla', usd: 3, momento: 'Tarde', nota: 'Pastel frito en los quioscos.' },
      { name: 'Churrasco', tipo: 'Cena', zona: 'Churrascarías', usd: 18, momento: 'Noche', nota: 'Rodizio de carne al estilo gaúcho.' }
    ],
    hacer: [
      { name: 'Kitesurf en la laguna', zona: 'Lagoa dos Quadros', dur: '3 h', usd: 50, nota: 'Agua dulce, plana y con viento: buena para aprender.' },
      { name: 'Bicicleta por la costa', zona: 'Centro → Atlântida', dur: '2 h', usd: 0, nota: 'Ciclovía a lo largo de los balnearios.' },
      { name: 'Parque acuático', zona: 'Imbé / Tramandaí', dur: 'Medio día', usd: 20, nota: 'En verano hay parques acuáticos en los balnearios vecinos.' }
    ],
    tips: [
      { titulo: 'Agua marrón, no sucia', texto: 'El agua es oscura por los sedimentos de las lagunas. Es limpia: no esperes agua transparente.' },
      { titulo: 'Fuera de enero, pueblo vacío', texto: 'De marzo a diciembre la mayoría de los comercios cierra.' },
      { titulo: 'Torres queda cerca', texto: 'Torres, con sus acantilados, está a 60 km: se visita de día.' }
    ]
  },

  rec: {
    resumen: 'La Venecia brasileña, con ríos y puentes en el centro y una playa urbana larga protegida por arrecifes. Olinda colonial queda a veinte minutos.',
    temporada: { alta: [12, 1, 2], baja: [4, 5, 6, 7], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros. El Carnaval de Recife y Olinda es de los más grandes del país.' },
    beaches: [
      { name: 'Boa Viagem', zona: 'Zona sur, 8 km', lat: -8.1276, lng: -34.8977, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Cal%C3%A7ad%C3%A3o_e_ciclovia_da_Praia_de_Boa_Viagem_-_Recife%2C_Pernambuco%2C_Brasil.jpg/1280px-Cal%C3%A7ad%C3%A3o_e_ciclovia_da_Praia_de_Boa_Viagem_-_Recife%2C_Pernambuco%2C_Brasil.jpg', vibe: 'La playa urbana, con siete kilómetros de rambla y piscinas naturales en el arrecife con marea baja.', cuando: 'Marea baja, de mañana.' },
      { name: 'Pina', zona: 'Zona sur, 4 km', lat: -8.0945, lng: -34.8817, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/2022-05-_16_Praia_do_Pina%2C_Recife_-_Pernambuco.jpg/1280px-2022-05-_16_Praia_do_Pina%2C_Recife_-_Pernambuco.jpg', vibe: 'La continuación de Boa Viagem hacia el centro, con quioscos y menos edificios.', cuando: 'Tarde.' },
      { name: 'Piedade', zona: 'Jaboatão, 13 km', lat: -8.17, lng: -34.915, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/PE_-_Jaboat%C3%A3o_dos_Guararapes_-_Praia_de_Piedade_1.jpg/1280px-PE_-_Jaboat%C3%A3o_dos_Guararapes_-_Praia_de_Piedade_1.jpg', vibe: 'Playa larga con arrecife, más tranquila que Boa Viagem.', cuando: 'Mañana.' },
      { name: 'Candeias', zona: 'Jaboatão, 17 km', lat: -8.205, lng: -34.923, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Praia_de_Candeias.jpg/1280px-Praia_de_Candeias.jpg', vibe: 'Piscinas naturales y quioscos, con gente del lugar.', cuando: 'Marea baja.' },
      { name: 'Carmo', zona: 'Olinda, 7 km', lat: -8.012, lng: -34.845, foto: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Praia_do_Carmo_e_Fortim_do_Queijo_-_panoramio.jpg', vibe: 'La playa al pie de la ciudad histórica de Olinda, con la iglesia del Carmo enfrente.', cuando: 'Tarde, combinada con Olinda.' }
    ],
    atracciones: [
      { name: 'Olinda', zona: '7 km al norte', dur: '3 h', usd: 0, nota: 'Ciudad colonial patrimonio de la humanidad, con iglesias sobre colinas y vista al mar.' },
      { name: 'Recife Antigo', zona: 'Centro', dur: '2 h', usd: 0, nota: 'La isla del centro histórico, con la sinagoga más antigua de América y el Marco Zero.' },
      { name: 'Instituto Ricardo Brennand', zona: 'Várzea', dur: '2 h', usd: 10, nota: 'Un castillo con colección de arte, armas y la mayor colección de pinturas de Frans Post.' },
      { name: 'Oficina Brennand', zona: 'Várzea', dur: '1 h 30', usd: 10, nota: 'Taller-museo del ceramista Francisco Brennand, en una antigua fábrica.' }
    ],
    comer: [
      { name: 'Tapioca de Olinda', tipo: 'Merienda', zona: 'Alto da Sé', usd: 3, momento: 'Tarde', nota: 'Las tapioqueiras del Alto da Sé, con vista a Recife.' },
      { name: 'Bolo de rolo', tipo: 'Postre', zona: 'Panaderías', usd: 3, momento: 'Tarde', nota: 'Bizcocho finísimo enrollado con dulce de guayaba. Patrimonio de Pernambuco.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Boa Viagem', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso a una cuadra de la rambla.' },
      { name: 'Carne de sol', tipo: 'Cena', zona: 'Restaurantes regionales', usd: 14, momento: 'Noche', nota: 'Con macaxeira y queso coalho.' }
    ],
    hacer: [
      { name: 'Paseo de catamarán por los ríos', zona: 'Recife Antigo', dur: '1 h', usd: 12, nota: 'Recorre los ríos y puentes del centro. Al atardecer es el mejor horario.' },
      { name: 'Marco Zero y Parque das Esculturas', zona: 'Recife Antigo', dur: '1 h', usd: 3, nota: 'Barco corto desde el Marco Zero hasta las esculturas de Brennand sobre el arrecife.' },
      { name: 'Paço do Frevo', zona: 'Recife Antigo', dur: '1 h', usd: 3, nota: 'Museo del frevo, la música del Carnaval de Recife.' }
    ],
    tips: [
      { titulo: 'Tiburones en Boa Viagem', texto: 'Hay carteles y es en serio: no nades más allá del arrecife ni con marea alta. Con marea baja, en las piscinas, no hay riesgo.' },
      { titulo: 'Olinda de día, en grupo', texto: 'Las calles son empinadas y solitarias fuera del centro. Recorrela de día y con guía local si podés.' },
      { titulo: 'Porto de Galinhas queda a una hora', texto: 'Muchos se alojan en Recife y van de día a Porto de Galinhas.' }
    ]
  },

  joaopessoa: {
    resumen: 'La capital más tranquila del Nordeste, con playas urbanas sin edificios altos sobre la orilla y piscinas naturales en el mar a pocos minutos.',
    temporada: { alta: [12, 1, 7], baja: [4, 5, 6], nota: 'De abril a julio es la época de lluvias: llueve fuerte un rato casi todos los días. De septiembre a marzo hay sol y mar claro; diciembre, enero y julio son los meses más caros.' },
    beaches: [
      { name: 'Tambaú', zona: 'Centro de la orla', lat: -7.1153, lng: -34.8223, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Tamba%C3%BA_beach_-_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Tamba%C3%BA_beach_-_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'La playa principal, con la rambla, la feria de artesanía y los barcos que salen a Picãozinho.', cuando: 'Mañana.' },
      { name: 'Cabo Branco', zona: 'Sur de la orla', lat: -7.1329, lng: -34.8207, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Trecho_final_da_Avenida_Cabo_Branco%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Trecho_final_da_Avenida_Cabo_Branco%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'Una rambla larga con ciclovía y el acantilado del Cabo Branco en la punta.', cuando: 'Atardecer.' },
      { name: 'Manaíra', zona: 'Norte de la orla', lat: -7.1043, lng: -34.8293, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Jo%C3%A3o-Pessoa-Praia-Mana%C3%ADra-Tamba%C3%BA.jpg/1280px-Jo%C3%A3o-Pessoa-Praia-Mana%C3%ADra-Tamba%C3%BA.jpg', vibe: 'Agua calma, quioscos y la gente del barrio.', cuando: 'Tarde.' },
      { name: 'Seixas', zona: 'Ponta do Seixas', lat: -7.154, lng: -34.7935, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Piscinas_do_Seixas%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Piscinas_do_Seixas%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'El punto más oriental de las Américas, con piscinas naturales en el arrecife.', cuando: 'Amanecer: el sol sale primero acá.' },
      { name: 'Bessa', zona: 'Norte', lat: -7.0767, lng: -34.8297, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Praia_do_Bessa%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg/1280px-Praia_do_Bessa%2C_Jo%C3%A3o_Pessoa_%28PB%29.jpg', vibe: 'Playa tranquila de casas bajas, con piscinas naturales con marea baja.', cuando: 'Marea baja.' },
      { name: 'Areia Vermelha', zona: 'Cabedelo, en barco', lat: -6.99, lng: -34.818, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Areia_Vermelha_-_Jo%C3%A3o_Pessoa_-_Brasil_%2833361214950%29.jpg/1280px-Areia_Vermelha_-_Jo%C3%A3o_Pessoa_-_Brasil_%2833361214950%29.jpg', vibe: 'Un banco de arena rojiza que aparece en el medio del mar con la marea baja.', cuando: 'Marea baja, en el paseo de barco.' },
      { name: 'Coqueirinho', zona: 'Conde, 25 km', lat: -7.286, lng: -34.803, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Coqueirinho_-_Jo%C3%A3o_Pessoa_-_Para%C3%ADba._%2815936351197%29.jpg/1280px-Coqueirinho_-_Jo%C3%A3o_Pessoa_-_Para%C3%ADba._%2815936351197%29.jpg', vibe: 'Acantilados de colores, cocoteros y agua calma. Una de las playas más lindas de Paraíba.', cuando: 'Día entero.' }
    ],
    atracciones: [
      { name: 'Farol do Cabo Branco', zona: 'Cabo Branco', dur: '40 min', usd: 0, nota: 'El faro sobre el acantilado, con la Estação Cabo Branco de Niemeyer al lado.' },
      { name: 'Centro histórico', zona: 'Centro', dur: '2 h', usd: 0, nota: 'Iglesias barrocas como la de São Francisco, de las más ricas del Nordeste.' },
      { name: 'Praia do Jacaré', zona: 'Cabedelo', dur: '1 h', usd: 0, nota: 'El atardecer con el Bolero de Ravel tocado en saxo desde un barco en el río.' }
    ],
    comer: [
      { name: 'Tapioca de la orla', tipo: 'Desayuno', zona: 'Tambaú', usd: 3, momento: 'Mañana', nota: 'En los puestos de la rambla.' },
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Manaíra', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso, lo más barato.' },
      { name: 'Caranguejo', tipo: 'Cena', zona: 'Bares de la orla', usd: 14, momento: 'Noche', nota: 'Cangrejo con martillito, para compartir.' }
    ],
    hacer: [
      { name: 'Barco a Picãozinho', zona: 'Sale de Tambaú', dur: '2 h', usd: 15, nota: 'Piscinas naturales en el arrecife frente a la playa, solo con marea baja.' },
      { name: 'Atardecer en el Jacaré', zona: 'Cabedelo', dur: '1 h 30', usd: 0, nota: 'El Bolero de Ravel en saxo mientras baja el sol.' },
      { name: 'Excursión a la costa sur', zona: 'Conde', dur: 'Día entero', usd: 25, nota: 'Coqueirinho, Tabatinga y Tambaba en buggy o 4x4.' }
    ],
    tips: [
      { titulo: 'Marea baja para todo', texto: 'Picãozinho, Areia Vermelha y el Seixas dependen de la marea baja. Mirá la tabla del día.' },
      { titulo: 'Rambla segura', texto: 'La orla está iluminada y con movimiento de noche. Es de las capitales más tranquilas del Nordeste.' },
      { titulo: 'Sin edificios en la orilla', texto: 'Por ley no hay edificios altos frente al mar: la playa tiene sol toda la tarde.' }
    ]
  },

  portoseguro: {
    resumen: 'La ciudad donde llegaron los portugueses: centro histórico en lo alto, playas de barracas con música al norte y Arraial d’Ajuda cruzando el río.',
    temporada: { alta: [12, 1, 2, 7], baja: [4, 5, 6], nota: 'De abril a junio llueve más. En julio llegan los grupos de estudiantes y en verano las barracas de playa tienen show todo el día. Septiembre a noviembre es lo más tranquilo.' },
    beaches: [
      { name: 'Taperapuã', zona: 'Orla norte, 5 km', lat: -16.404, lng: -39.043, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Vista_da_Praia_de_Taperapu%C3%A3%2C_Porto_Seguro_BA.JPG/1280px-Vista_da_Praia_de_Taperapu%C3%A3%2C_Porto_Seguro_BA.JPG', vibe: 'La playa de las megabarracas, con piscinas en el arrecife, música y shows todo el día.', cuando: 'Marea baja de mañana.' },
      { name: 'Coroa Vermelha', zona: 'Santa Cruz Cabrália, 11 km', lat: -16.3532, lng: -39.0143, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG/1280px-Vista_da_Praia_Coroa_Vermelha%2C_Santa_Cruz_Cabr%C3%A1lia_BA2.JPG', vibe: 'Donde se dio la primera misa del Brasil, con una cruz frente al mar y piscinas en el arrecife.', cuando: 'Marea baja.' },
      { name: 'Mucugê (Arraial d’Ajuda)', zona: 'Cruzando el río en balsa, 6 km', lat: -16.4948, lng: -39.0687, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG/1280px-Vista_da_Praia_do_Mucug%C3%AA_em_Arraial_d%27Ajuda%2C_Porto_Seguro_BA2.JPG', vibe: 'La playa a la que se baja desde el pueblo de Arraial, con barracas, agua calma y piscinas en el arrecife. Más tranquila que las de Porto Seguro.', cuando: 'Marea baja, de mañana.' },
      { name: 'Pitinga (Arraial d’Ajuda)', zona: 'Cruzando el río en balsa, 8 km', lat: -16.5125, lng: -39.0739, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg/1280px-Voo_Parapnte%2C_Praia_da_Pitinga%2C_Rota_do_Descobrimento_-_Arraial_d%27Ajuda_-_BA.jpg', vibe: 'Acantilados rojos, arena dorada y piscinas naturales. La más linda de la zona y menos llena que Mucugê.', cuando: 'Marea baja.' },
      { name: 'Taípe (Arraial d’Ajuda)', zona: 'Sur, 12 km', lat: -16.5534, lng: -39.0863, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg/1280px-Praia_de_Taipe_-_Trancoso_-_Porto_Seguro-BA_-_panoramio.jpg', vibe: 'Acantilados altos de colores sobre una playa casi vacía, camino a Trancoso.', cuando: 'Tarde, cuando el sol pega en el acantilado.' }
    ],
    atracciones: [
      { name: 'Cidade Histórica', zona: 'Centro alto', dur: '2 h', usd: 3, nota: 'El centro histórico sobre el morro, con casas de colores, la iglesia de Nossa Senhora da Pena y vista al mar.' },
      { name: 'Passarela do Descobrimento', zona: 'Centro bajo', dur: '1 h', usd: 0, nota: 'La calle de bares, artesanía y forró. De noche, el centro de la vida nocturna.' },
      { name: 'Marco do Descobrimento', zona: 'Cidade Histórica', dur: '20 min', usd: 0, nota: 'El marco de piedra traído por los portugueses en 1503.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso en la Passarela.' },
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Passarela', usd: 4, momento: 'Tarde', nota: 'Las baianas de la Passarela do Descobrimento.' },
      { name: 'Moqueca', tipo: 'Cena', zona: 'Centro', usd: 20, momento: 'Noche', nota: 'Moqueca baiana para dos.' }
    ],
    hacer: [
      { name: 'Barco al Recife de Fora', zona: 'Sale del puerto', dur: '3 h', usd: 20, nota: 'Piscinas naturales en un arrecife mar adentro, solo con marea baja.' },
      { name: 'Balsa a Arraial d’Ajuda', zona: 'Centro', dur: '15 min', usd: 1, nota: 'Cruza el río al pueblo de Arraial, con playas más lindas.' },
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
      { name: 'Caminata por la Avenida Borges de Medeiros', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Del pórtico a la iglesia, mirando la arquitectura y las vidrieras.' },
      { name: 'Snowland', zona: 'Ruta a Nova Petrópolis', dur: 'Medio día', usd: 60, nota: 'Parque de nieve bajo techo, con esquí y trineo.' },
      { name: 'Natal Luz', zona: 'Centro', dur: 'Noche', usd: 0, nota: 'De noviembre a enero, el pueblo iluminado y desfiles en la calle. Los shows grandes son pagos.' }
    ],
    tips: [
      { titulo: 'Canela es más barata', texto: 'Canela está a 8 km, tiene la misma montaña y cuesta menos. Alojarse allá y venir de día ahorra mucho.' },
      { titulo: 'Las atracciones pagas suman', texto: 'Hay una atracción paga en cada esquina. Elegí dos o tres: los lagos y las calles son gratis.' },
      { titulo: 'Abrigo de verdad en invierno', texto: 'En julio hace frío húmedo y bajo cero de noche. Campera, gorro y guantes.' }
    ]
  },

  canela: {
    resumen: 'El pueblo vecino de Gramado, más tranquilo y barato, con la catedral de piedra y la naturaleza más linda de la Serra: cascadas, cañones y bosques de araucarias.',
    temporada: { alta: [6, 7, 12], baja: [3, 4, 5, 9], nota: 'Julio es el mes frío y el más lleno. En primavera y otoño hay clima templado, cascadas con agua y precios bajos.' },
    beaches: [],
    atracciones: [
      { name: 'Catedral de Pedra', zona: 'Centro', lat: -29.3638, lng: -50.8092, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Lateral_da_Catedral_de_pedra_%28Canela%29.jpg/1280px-Lateral_da_Catedral_de_pedra_%28Canela%29.jpg', dur: '40 min', usd: 0, nota: 'La catedral gótica de piedra basáltica, con una torre de 65 metros y un carillón que toca todos los días.' },
      { name: 'Cascata do Caracol', zona: 'Parque do Caracol, 8 km', lat: -29.3112, lng: -50.8544, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Cascata_Caracol_-_Canela_RS.jpg/1280px-Cascata_Caracol_-_Canela_RS.jpg', dur: '2 h', usd: 15, nota: 'Una cascada de 131 metros que cae en un cañón de selva. Se ve desde un mirador o bajando 927 escalones.' },
      { name: 'Parque da Ferradura', zona: '7 km', lat: -29.2707, lng: -50.8449, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Renato_Soares_Parque_da_Ferradura_Canela_RS_%2826699738327%29.jpg/1280px-Renato_Soares_Parque_da_Ferradura_Canela_RS_%2826699738327%29.jpg', dur: '2 h', usd: 10, nota: 'Miradores sobre un cañón en forma de herradura, con el río Santa Cruz al fondo.' },
      { name: 'Castelinho Caracol', zona: 'Camino al Caracol', lat: -29.3355, lng: -50.8502, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Castelinho_Caracol%2C_Canela_RS_%282%29.jpg/1280px-Castelinho_Caracol%2C_Canela_RS_%282%29.jpg', dur: '40 min', usd: 5, nota: 'Una casa de madera de 1913 sin un solo clavo, hoy museo y casa de té con strudel.' },
      { name: 'Mundo a Vapor', zona: 'Ruta a Gramado', lat: -29.3617, lng: -50.8349, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Mundo_a_Vapor%2C_Gramado-Canela_%286051012895%29.jpg/1280px-Mundo_a_Vapor%2C_Gramado-Canela_%286051012895%29.jpg', dur: '1 h', usd: 15, nota: 'Museo de máquinas a vapor con la réplica del famoso accidente de tren de París.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 9, momento: 'Mediodía', nota: 'Bufé por peso, más barato que en Gramado.' },
      { name: 'Café colonial', tipo: 'Merienda', zona: 'Ruta a Gramado', usd: 22, momento: 'Tarde', nota: 'Mesa de dulces y salados de la tradición alemana, sirve de merienda y cena.' },
      { name: 'Strudel en el Castelinho', tipo: 'Merienda', zona: 'Castelinho Caracol', usd: 6, momento: 'Tarde', nota: 'Strudel de manzana y café en la casa de madera.' }
    ],
    hacer: [
      { name: 'Bajar al pie del Caracol', zona: 'Parque do Caracol', dur: '2 h', usd: 0, nota: 'Los 927 escalones hasta la base de la cascada. La subida es dura: calculá el doble de tiempo.' },
      { name: 'Teleférico del Caracol', zona: 'Parque do Caracol', dur: '1 h', usd: 20, nota: 'Cruza el cañón frente a la cascada.' },
      { name: 'Arborismo y tirolesa', zona: 'Parque da Ferradura', dur: '2 h', usd: 25, nota: 'Circuitos en los árboles con vista al cañón.' }
    ],
    tips: [
      { titulo: 'Base para Gramado', texto: 'Alojarse en Canela cuesta menos y Gramado está a 8 km. El ómnibus entre los dos pasa seguido.' },
      { titulo: 'El Caracol, temprano', texto: 'A la mañana la luz entra en el cañón y hay menos gente en el mirador.' },
      { titulo: 'Niebla en invierno', texto: 'En julio la niebla puede tapar los miradores. Mirá el pronóstico y dejá la Ferradura para un día claro.' }
    ]
  },

  poa: {
    resumen: 'La capital gaúcha, sobre el lago Guaíba: mercado centenario, centros culturales en edificios históricos y el atardecer más famoso del sur de Brasil.',
    temporada: { alta: [9, 10, 11], baja: [1, 2], nota: 'Enero y febrero son muy calurosos y húmedos, y la ciudad se vacía porque todos van a la costa. Otoño y primavera tienen el mejor clima para caminarla.' },
    beaches: [],
    atracciones: [
      { name: 'Usina do Gasômetro', zona: 'Centro', lat: -30.0341, lng: -51.2411, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Usina_do_Gas%C3%B4metro.jpg/1280px-Usina_do_Gas%C3%B4metro.jpg', dur: '1 h', usd: 0, nota: 'Una antigua usina sobre el Guaíba convertida en centro cultural. Desde su muelle se mira el atardecer más famoso de la ciudad.' },
      { name: 'Mercado Público', zona: 'Centro', lat: -30.0275, lng: -51.2278, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Mercado_P%C3%BAblico_de_Porto_Alegre_2021_4.jpg/1280px-Mercado_P%C3%BAblico_de_Porto_Alegre_2021_4.jpg', dur: '1 h', usd: 0, nota: 'El mercado de 1869, con puestos de yerba, especias y carnes, y la Banca 40 con su bomba royal.' },
      { name: 'Casa de Cultura Mario Quintana', zona: 'Centro', lat: -30.0311, lng: -51.2345, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Casa_de_Cultura_Mario_Quintana_por_Rodrigo_Tetsuo_Argenton_%2812%29.jpg/1280px-Casa_de_Cultura_Mario_Quintana_por_Rodrigo_Tetsuo_Argenton_%2812%29.jpg', dur: '1 h', usd: 0, nota: 'Un hotel antiguo donde vivió el poeta, hoy centro cultural con terraza y vista al lago.' },
      { name: 'Fundação Iberê Camargo', zona: 'Zona sur, 4 km', lat: -30.0777, lng: -51.2454, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Funda%C3%A7%C3%A3o_Iber%C3%AA_Camargo_-_Porto_Alegre_2026.jpg/1280px-Funda%C3%A7%C3%A3o_Iber%C3%AA_Camargo_-_Porto_Alegre_2026.jpg', dur: '1 h 30', usd: 0, nota: 'Museo de Álvaro Siza frente al Guaíba, una de las obras de arquitectura más premiadas de Brasil.' },
      { name: 'Parque da Redenção', zona: 'Farroupilha, 2 km', lat: -30.037, lng: -51.2156, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Boitat%C3%A1_no_Parque_Farroupilha_2.jpg/1280px-Boitat%C3%A1_no_Parque_Farroupilha_2.jpg', dur: '1 h', usd: 0, nota: 'El parque central de la ciudad. Los domingos se arma el Brique, feria de antigüedades y artesanía.' },
      { name: 'Orla do Guaíba', zona: 'Centro, junto al lago', lat: -30.0544, lng: -51.2331, foto: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/27-3-2026_-_Imagem_a%C3%A9rea_do_South_Summit_Brazil_em_Porto_Alegre_e_da_orla_do_Gua%C3%ADba_10.jpg', dur: '1 h', usd: 0, nota: 'La rambla nueva sobre el lago, con bares, gradas y ciclovía. El plan de fin de tarde.' }
    ],
    comer: [
      { name: 'Comida por kilo', tipo: 'Almuerzo', zona: 'Centro', usd: 8, momento: 'Mediodía', nota: 'Bufé por peso en el centro, lo más barato para almorzar.' },
      { name: 'Bomba royal de la Banca 40', tipo: 'Postre', zona: 'Mercado Público', usd: 4, momento: 'Tarde', nota: 'Helado con merengue y frutas, la tradición del mercado desde 1927.' },
      { name: 'Churrasco', tipo: 'Cena', zona: 'Churrascarías', usd: 20, momento: 'Noche', nota: 'Rodizio de carnes al estilo gaúcho, en la ciudad que lo inventó.' },
      { name: 'Xis', tipo: 'Cena', zona: 'Cidade Baixa', usd: 7, momento: 'Noche', nota: 'El sándwich gigante gaúcho, con todo adentro. La cena barata de la Cidade Baixa.' }
    ],
    hacer: [
      { name: 'Atardecer en el Gasômetro', zona: 'Centro', dur: '1 h', usd: 0, nota: 'Llevá mate y sentate en el muelle: la ciudad entera va a mirar el sol caer sobre el Guaíba.' },
      { name: 'Barco por el Guaíba', zona: 'Cais Mauá', dur: '1 h', usd: 10, nota: 'Paseo por el lago y las islas frente a la ciudad.' },
      { name: 'Noche en la Cidade Baixa', zona: 'Cidade Baixa', dur: '3 h', usd: 0, nota: 'El barrio de bares, música en vivo y estudiantes.' }
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
var REGIONES = {

  'santa-catarina': {
    resumen: 'Costa de Santa Catarina: balnearios de familia al norte, Praia do Rosa y Garopaba al sur, y la isla en el medio.',
    beaches: [
      { name: 'Balneário Camboriú', zona: 'Costa norte, 60 km de la ilha', vibe: 'El balneario más caro y más vertical del estado: torres de treinta pisos pegadas a la arena. La fama se la dan la escala y el precio. La playa de verdad es la de al lado, Praia do Norte, con los acantilados que salen en todas las fotos de Brazil.', cuando: 'De diciembre a marzo es el pico absoluto. Fuera de eso baja a pueblo de veraneo y los precios se caen a la mitad.' },
      { name: 'Bombinhas', zona: 'Costa norte, entre Camboriú e Itapema', vibe: 'Una serie de caletas y playas chicas, todas protegidas del oleaje por los islotes. Es la costa más tranquila del norte y la más familiar: poca gente joven, muchas familias con niños.', cuando: 'Todo el año, y es la que mejor aguanta los días de viento del sur, porque el agua queda encerrada.' },
      { name: 'Praia do Rosa', zona: 'Costa sur, 40 km al sur de la ilha', vibe: 'El pueblo más lindo de la costa. Sin torres, sin música alta, con casas de colores y arena blanca y fina. Es donde va la gente de Santa Catarina, no el turismo de São Paulo.', cuando: 'Todo el año, y llueve menos que en el norte del estado.' },
      { name: 'Garopaba', zona: 'Costa sur, sobre una península', vibe: 'Pueblo de surf con vida de pueblo chico. La playa principal está entre dos penínsulas y la segunda tiene un faro que se ve desde cualquier lado de la bahía.', cuando: 'Todo el año. El kitesurf tiene su temporada de mayo a septiembre.' },
      { name: 'Itapema', zona: 'Costa norte, entre Camboriú y Blumenau', vibe: 'El balneario premium de hoy, y más caro que Camboriú. Tiene la mejor oferta de playa y de restaurante del estado, que es decir que también los precios más altos.', cuando: 'De diciembre a marzo, con los precios de temporada alta del resto de la costa.' }
    ],
    comer: [
      { name: 'Pastel catarinense', tipo: 'Merienda', zona: 'Todos los pueblos de la costa', usd: 4, momento: 'Toda la tarde', nota: 'La empanada frita que es propia del estado: carne deshebrada, concha de almeja y aceituna. Es distinta a la pastel de São Paulo y sale en la barra de la feria.' },
      { name: 'Risoles de la feria', tipo: 'Merienda', zona: 'Ferias y bazares de cada pueblo', usd: 4, momento: 'Tarde y noche', nota: 'Rellenos de carne o de queso, fritos, con chimichurri. Cada pueblo tiene su feria en un día de la semana distinto: el de Garopaba es el miércoles y el de Bombinhas el jueves. Es la merienda de la tarde de todo el estado.' }
    ],
    tips: [
      { titulo: 'La BR-101 es el eje de todo', texto: 'Todos los pueblos de la costa están sobre la misma ruta. Sin auto el bus entre pueblos funciona, pero la frecuencia cae fuerte después de las 20 h. Planificá el regreso antes de la salida, no en el lugar.' },
      { titulo: 'Dos Santa Catarinas distintas', texto: 'La costa norte es estructura y familia. La costa sur (Rosa, Garopaba, Ferrugem) es más chica, más tranquila y más barata. No son el mismo viaje, aunque compartan bus y aeropuerto.' },
      { titulo: 'Camboriú no es una playa: es un edificio', texto: 'El balneario más caro del estado, con torres de 30 pisos sobre la arena. La playa que todos quieren ver es la de al lado y la vas a poder ver gratis desde la costa sur.' }
    ],
    atracciones: [
      { name: 'Serra do Tabuleiro', zona: 'Sur de la ilha, hacia Imbituba', dur: '4 h', usd: 0, nota: 'La tabla más alta de Santa Catarina. El sendero hasta arriba son cuatro horas de ida y vuelta y hay que anotarse en el ICMBio antes de ir. Es el plan de un día entero, no una parada.' },
      { name: 'Faro de Garopaba', zona: 'Garopaba', dur: '1 h', usd: 0, nota: 'El faro de la segunda península, con la mejor vista de la bahía. Gratis, y se llega en veinte minutos caminando desde el centro del pueblo.' }
    ],
    hacer: [
      { name: 'Recorrer la BR-101 en bus', zona: 'Toda la costa', dur: '3 h', usd: 8, nota: 'El bus entre pueblos funciona bien y es la forma de recorrer la costa sin auto. La frecuencia se cae fuerte después de las 20 h: el regreso hay que mirarlo antes de subir.' }
    ],
  },

  'rio-grande-do-sul': {
    resumen: 'Serra Gaucha y el litoral sur del estado: vino, fondue y balnearios más baratos que el lado norte.',
    beaches: [
      { name: 'Torres', zona: 'Litoral sur, 300 km de Porto Alegre', vibe: 'El balneario del acantilado más alto de la costa gaúcha, de unos cuarenta metros. La ciudad es de casas bajas y la playa es larga.', cuando: 'Todo el año, con temporada fuerte de diciembre a marzo. En enero el precio se multiplica.' },
      { name: 'Capão da Canoa', zona: 'Litoral sur, 100 km al sur de Torres', vibe: 'El balneario más familiar de la costa y el más barato. No está armado como Torres, pero tiene la misma estructura y la mitad del precio.', cuando: 'Todo el año. Es la opción cuando se busca playa sin pagar un balneario de verdad.' },
      { name: 'Praia de Tramandaí', zona: 'Litoral norte, 40 km de Porto Alegre', vibe: 'La playa de Porto Alegre. Es larga y tiene movimiento de ciudad, no de balneario. Es la más cercana si el vuelo cae en el aeropuerto.', cuando: 'Todo el año, con temporada de verano. Los fines de semana de enero se llena mucho.' }
    ],
    comer: [
      { name: 'Chimarrão', tipo: 'Merienda', zona: 'Toda la Serra y el litoral', usd: 4, momento: 'Toda la tarde', nota: 'Mate con yerba y sal, servido en una bombilla con agua caliente. Se comparte el mismo mate pasando la bombilla. Es la bebida de la Serra: se compra en un mercado y se lleva a la playa.' },
      { name: 'Prato feito gaúcho', tipo: 'Almuerzo', zona: 'Todos los pueblos', usd: 10, momento: 'Mediodía', nota: 'Con chimarrão, arroz con leche y pastel de carne. Es mucho más pesado que el resto de Brasil y las porciones son enormes.' },
      { name: 'Pastel de carne', tipo: 'Merienda', zona: 'Confiterías de los pueblos', usd: 5, momento: 'Tarde', nota: 'Cocido en su propio jugo, se come caliente con la mano. Es la merienda más barata de la costa y se compra en cualquier confitería.' }
    ],
    tips: [
      { titulo: 'Gramado es caro y hay motivo', texto: 'Es la ciudad más famosa de la Serra y los precios lo reflejan. Canela está a 5 km, cuesta un tercio y tiene la misma vista y el mismo clima.' },
      { titulo: 'La costa es otro viaje', texto: 'Si lo que querés es playa, Torres y Capão da Canoa son más baratas y más tranquilas que todo el lado norte. No son comparables a los balnearios de Santa Catarina.' },
      { titulo: 'La Serra no es un destino de sol', texto: 'En la Serra Gaucha llueve todo el año y casi no sale el sol. Nadie va a la playa: se va por la montaña, el vino y los parques. Si buscas calor, alojate en el litoral, no en la ciudad.' }
    ],
    atracciones: [
      { name: 'Parque da Guarita', zona: 'Torres', dur: '2 h', usd: 0, nota: 'El parque de la punta de Torres, con el mirador que da a todo el mar. Se llega a pie o en tren. Gratis, y la mejor vista de la costa.' },
      { name: 'Estrada do Caminho da Colônia', zona: 'Entre Torres e Santo Antônio', dur: '3 h', usd: 6, nota: 'O caminho velho dos gauchos que ia de Porto Alegre a costa, hoje empedrado. Se percorre em auto entre campos, com as colonias e as feiras de queijo ao lado.' }
    ],
    hacer: [
      { name: 'Tren turístico de Torres', zona: 'Torres', dur: '1 h', usd: 3, nota: 'Recorre la costa desde el centro hasta el acantilado, con el mar de un lado. Es la forma barata de ver lo mejor de la ciudad.' }
    ],
  },

  'rio-de-janeiro': {
    resumen: 'La ciudad y la Costa Verde. Mucho para ver, precios turísticos en Copacabana e Ipanema, y comida de calle excelente en el centro.',
    beaches: [
      { name: 'Búzios', zona: 'Península, 2 h desde Rio', vibe: 'El pueblo de barcos de la Costa Verde. Calle empedrada, puerto con veleros y una calle de tiendas. Se llega en bus o por la carretera.', cuando: 'Todo el año. En verano se llena de gente de Rio y suben los precios.' },
      { name: 'Arraial do Cabo', zona: 'Península, 3 h desde Rio', vibe: 'La punta más al sur. Tiene la Praia dos Anjos y la Praia do Amor, una cala con forma de corazón. Es la más lejos y la más tranquila.', cuando: 'Todo el año. El sendero de la Praia do Amor se inunda con la marea alta, así que hay que ir por la mañana.' },
      { name: 'Paraty', zona: 'Costa Verde, 4 h desde Rio', vibe: 'El pueblo colonial más conservado de la costa. Casas del siglo XVIII con las puertas pintadas de colores y una calle empedrada. Es el que más se parece a una postal.', cuando: 'Todo el año. Julio es la temporada fuerte, con el festival de jazz.' },
      { name: 'Ilha Grande', zona: 'Isla, ferry desde Angra dos Reis', vibe: 'Una isla que es casi toda parque nacional. No hay vehículos: se recorre caminando. Es de las islas mejor conservadas de Brasil.', cuando: 'Todo el año. El ferry sale de Angra dos o tres veces por día, así que el pasaje hay que reservarlo antes.' },
      { name: 'Angra dos Reis', zona: 'Bahía, 2 h desde Rio', vibe: 'No es una playa: es una bahía con tres mil islas y agua tranquila. Lo que se visita es el centro histórico, que es colonial.', cuando: 'Todo el año. Las playas están en islas, así que hay que combinarse con un ferry o una excursión.' }
    ],
    comer: [
      { name: 'Cachaça artesanal', tipo: 'Compra', zona: 'Paraty', usd: 12, momento: 'Cualquiera', nota: 'Paraty es la capital de la cachaça de caña de la Costa Verde, y hay destilerías que se pueden visitar. La artesanal sale menos que la de supermercado.' },
      { name: 'Feira de artesanía', tipo: 'Compra', zona: 'Búzios', usd: 8, momento: 'Sábado a la mañana', nota: 'La feria de Búzios tiene puestos de cerámica, ropa y artesanía. Conviene mirar el cartel de precios antes de comprar: en la calle principal cambian.' }
    ],
    tips: [
      { titulo: 'La Zona Sur es la turística, la Zona Norte es la ciudad', texto: 'El café y la comida de calidad están en Ipanema y Botafogo. Los precios de comida callejera y los mercados están en el centro y en la Zona Norte. Con tres días, cruzate a comer.' },
      { titulo: 'El moqueco es domingo al mediodía', texto: 'El comidazo más grande del Brasil es un domingo al mediodía: montaña de arroz, costillar y farofa. Es un desayuno, no un almuerzo. Buscate un lugar con esse, no uno turístico.' },
      { titulo: 'Angra y Paraty se llegan en bus o auto', texto: 'Están a 2 o 3 horas de la ciudad. El bus es mucho más barato y funciona bien. El auto se justifica solo si hacés más de un destino en el mismo día.' },
      { titulo: 'Una favela no es una atracción', texto: 'Es un barrio real con gente real, y el tour guiado de dos horas es la forma correcta y razonable de verlo. Se visita a la luz del día y acompañado. Sin eso, no se sube: el resto de la ciudad alcanza y sobra.' }
    ],
    atracciones: [
      { name: 'Centro histórico de Paraty', zona: 'Paraty', dur: '2 h', usd: 0, nota: 'El conjunto de casas coloniales del siglo XVIII, con las puertas pintadas y las ventanas con reja de hierro. Se recorre entero a pie y es gratis.' },
      { name: 'Forte de Santa Catarina', zona: 'Centro de Rio', dur: '1 h', usd: 5, nota: 'La fortaleza portuguesa de 1637, en la punta de la isla. Es la parte vieja de Rio y el arranque de la Ruta Bandeirante.' }
    ],
    hacer: [
      { name: 'Paseo en barco por la bahía', zona: 'Angra dos Reis', dur: '3 h', usd: 15, nota: 'La forma de llegar a las playas de la bahía es en barco, y se contrata en el puerto. Un paseo a una isla deshabitada es el mejor plan de la zona.' },
      { name: 'Bajada a la Praia do Amor', zona: 'Arraial do Cabo', dur: '2 h', usd: 0, nota: 'Se baja por unas escaleras de doscientos peldaños entre las rocas, y se vuelve subiendo. Con marea alta el sendero queda bajo agua.' }
    ],
  },

  'bahia': {
    resumen: 'Salvador, la Costa Doce y Trancoso. Cultura afro, comida de mar, la calle más famosa del país y un litoral de pueblos de playa.',
    beaches: [
      { name: 'Trancoso', zona: 'Costa Doce, 2 h de Salvador', vibe: 'El pueblo de playa más caro de Bahia. Casitas blancas, calle de arena y la iglesia de madera de colores al borde del mar.', cuando: 'Todo el año. Julio es la temporada fuerte, con el festival de jazz del pueblo.' },
      { name: 'Morro de São Paulo', zona: 'Costa Doce, sur de Salvador', vibe: 'Un pueblo al que se llega en barco y se sube por una escalera. No hay calle para autos: arriba hay un caserío pequeño y el atardecer.', cuando: 'Todo el año. El barco es la única entrada, así que hay que confirmar el horario antes de salir.' },
      { name: 'Porto Seguro', zona: 'Costa Doce, 3 h de Salvador', vibe: 'La versión más grande y más barata de Trancoso. Mismo mar y misma costa, con más movimiento y precios de barrio.', cuando: 'Todo el año. Es la opción cuando Trancoso queda fuera de presupuesto.' },
      { name: 'Itacaré', zona: 'Costa Doce, entre Salvador e Ilhéus', vibe: 'Pueblo de playa con la Praia do Amor y varias caletas tranquilas. Es la parada para quien quiere playa sin la movida de Trancoso.', cuando: 'Todo el año. La temporada fuerte va de diciembre a marzo.' },
      { name: 'Praia do Forte', zona: 'Litoral norte, 70 km de Salvador', vibe: 'El balneario de la clase media de la capital. Tiene estructura y está más cerca que los pueblos de la Costa Doce.', cuando: 'Todo el año. Es la más práctica para un baño de día desde Salvador.' }
    ],
    comer: [
      { name: 'Acarajé', tipo: 'Merienda', zona: 'Largo de Santana y las playas', usd: 4, momento: 'Tarde', nota: 'La merienda de Bahia. Viene con camarão, vatapá y urucum. Es barato y es abundante. En la plaza de Salvador las vendedoras son las que saben.' },
      { name: 'Moqueca', tipo: 'Almuerzo', zona: 'Porto Seguro e Itacaré', usd: 12, momento: 'Mediodía', nota: 'El guiso de pescado con aceite de coco y naranja. Es la marca de la cocina de Bahia y se come con arroz y banana.' },
      { name: 'Pastel de acarajé', tipo: 'Merienda', zona: 'Las playas', usd: 4, momento: 'Tarde', nota: 'El pastelillo frito de camarón que acompaña al acarajé. Viene con salsa de ajo y es la combinación de siempre en la playa.' }
    ],
    tips: [
      { titulo: 'Salvador tiene dos caras', texto: 'El Pelourinho es la postal: más movimiento y precios altos. La Ciudad Baja, detrás, es donde Salvador vive de verdad y donde se come mejor por menos. Bajate de las escaleras y cruzate.' },
      { titulo: 'Trancoso y Arraial d’Ajuda son caros y no lo discuten', texto: 'Son 7 km de costa pero dos pueblos distintos, y los dos son de los más caros de Bahía. Arraial d’Ajuda es el más barato de los dos, y en cualquier caso Porto Seguro e Itacaré dan la misma costa por menos de la mitad.' },
      { titulo: 'A Arraial d’Ajuda se llega en barca', texto: 'La carretera termina en Porto Seguro. Si vas a Arraial d’Ajuda sin auto, cruzás la balsa con el coche cargado en un scanner, y la última parte de la playa es un callejón de restaurants sin vereda. Trancoso se puede llegar por tierra sin problema.' },
      { titulo: 'El moqueco de Salvador es el original', texto: 'El carnaval de la ciudad tiene su propia versión del moqueco, con más ritmo y más comida. Es el mejor plan de una noche si estás en la capital.' }
    ],
    atracciones: [
      { name: 'Centro histórico de Salvador', zona: 'Salvador', dur: '3 h', usd: 0, nota: 'El Pelourinho, con sus casas coloniales de colores y sus iglesias barrocas. Se camina entero a pie y no hay que pagar entrada.' },
      { name: 'Igreja de São Sebastião', zona: 'Trancoso', dur: '30 min', usd: 3, nota: 'La iglesia de madera pintada que está sobre la arena. Es el símbolo del pueblo y una de las fotos más repetidas de la costa de Bahia.' }
    ],
    hacer: [
      { name: 'Barco a Morro de São Paulo', zona: 'Morro de São Paulo', dur: '1 h', usd: 10, nota: 'El barco deja en la base de la escalera. Es la única forma de llegar, y hay que confirmar el horario del día antes.' }
    ],
  },

  'pernambuco': {
    resumen: 'Recife y Olinda, Porto de Galinhas y Fernando de Noronha. Cultura, la muela y la muña del nordeste y las mejores playas del estado.',
    beaches: [
      { name: 'Boa Viagem', zona: 'Recife', vibe: 'La playa urbana de Recife, con un reef de coral que frena el oleaje. Tiene movimiento de ciudad y servicios a lo largo de toda la orla.', cuando: 'Todo el año. El agua es más tranquila que en el resto del nordeste gracias al reef.' },
      { name: 'Porto de Galinhas', zona: 'A 40 km al sur de Recife', vibe: 'El pueblo de las pools naturales. El agua es verde y tranquila, y los botes de jangada salen hacia el arrecife. Es la playa más familiar del estado.', cuando: 'Todo el año. En invierno el oleaje sube y hay días de bandera roja.' },
      { name: 'Fernando de Noronha', zona: 'Isla, a 350 km de Recife', vibe: 'Una isla protegida con cupos diarios. El agua es tan clara que se ven los peces desde el avión. No es un paseo: es un plan que hay que reservar con semanas.', cuando: 'Todo el año, con los precios más altos entre diciembre y marzo. Hay que reservar el cupo antes de comprar el pasaje.' }
    ],
    comer: [
      { name: 'Carne de sol', tipo: 'Almuerzo', zona: 'Recife y el interior', usd: 10, momento: 'Mediodía', nota: 'La carne curada al sol, con queso de leche y harina de mandioca. Es la carne más característica del nordeste. Sale en el mercado de Santo Amaro, en Recife.' },
      { name: 'Cuscuz', tipo: 'Desayuno', zona: 'Recife y Olinda', usd: 4, momento: '7 a 10 h', nota: 'Un bol de maíz cocido, que se come temprano con queso y aceite. Es barato y llena, y es el desayuno de la calle.' },
      { name: 'Acarajé de Olinda', tipo: 'Merienda', zona: 'Olinda', usd: 4, momento: 'Tarde', nota: 'El bollo de yuca y camarón de Bahia llega hasta acá, frito y con salsa picante. En las casas del centro histórico de Olinda.' }
    ],
    tips: [
      { titulo: 'Olinda está a 30 minutos y vale el viaje', texto: 'Olinda es colonial, con las casonas pintadas de la iglesia y el frevo en cada esquina, y se recorre casi entera a pie. Es el mejor plan de día desde Recife.' },
      { titulo: 'Fernando de Noronha no es una excursión', texto: 'Es una isla protegida, con cupo diario y tarifas altas. Hay que reservar con semanas de anticipación. Si no reservaste, no vayas: vale, pero como último día y no improvisado.' },
      { titulo: 'Recife es la mejor base', texto: 'La ciudad es el mejor punto de partida para Olinda y Porto de Galinhas. Recife esplanada y con poco que ver caminando, pero el aprendizaje está en la comida y en el movimiento.' }
    ],
    atracciones: [
      { name: 'Olinda', zona: 'A 30 km de Recife', dur: '1 dia', usd: 0, nota: 'La ciudad colonial con las casonas de colores, las iglesias de barroco y el frevo en la calle. Se recorre entera a pie. Es el mejor plan de día desde Recife.' },
      { name: 'Centro histórico de Recife', zona: 'Recife', dur: '2 h', usd: 0, nota: 'El centro histórico con las iglesias de piedra caliza y las escaleras del siglo XVII. Y de noche, el maracatu: los tambores no paran hasta el amanecer.' }
    ],
    hacer: [
      { name: 'Paseo en jangada', zona: 'Porto de Galinhas', dur: '2 h', usd: 25, nota: 'La barca que sale del pueblo hasta el arrecife, con guía y equipo. Es lo que hace famoso el lugar: se ve el coral desde arriba y se nadan las pozas.' }
    ],
  },

  'ceara': {
    resumen: 'Fortaleza y Jericoacoara. Dunas, lagunas y la costa más ventosa del Brasil.',
    beaches: [
      { name: 'Praia do Futuro', zona: 'Fortaleza', vibe: 'La playa urbana de la capital: cuatro kilómetros de arena, con barra y movimiento los fines de semana. Es playa de ciudad, no de balneario.', cuando: 'Todo el año. En la desembocadura del Mucuripe hay corriente de aire: no se nada ahí.' },
      { name: 'Jericoacoara', zona: 'A 500 km de Fortaleza, en el extremo del estado', vibe: 'El pueblo de las lagunas y las dunas. La Laguna do Jeri se llena con la marea y la duna se sube a caballo o en buggy. Es la playa más famosa del nordeste y no se parece a ninguna otra.', cuando: 'Todo el año, con temporada fuerte de junio a enero. Con poco viento las dunas se pueden subir a caballo; con mucho viento, no.' },
      { name: 'Canoa', zona: 'Entre Fortaleza y Jericoacoara', vibe: 'El pueblo de las redes de pesca tiradas sobre la arena, con las barcas de los pescadores tiradas en la calle. Es la parada más tranquila del recorrido.', cuando: 'Todo el año. Es la que se elige cuando Jericoacoara queda de lado.' }
    ],
    comer: [
      { name: 'Carne de sol', tipo: 'Almuerzo', zona: 'Fortaleza y el interior', usd: 10, momento: 'Mediodía', nota: 'La carne curada al sol de Ceará, que se come con queso de leche y pasta de caña. Es la carne más característica del estado y sale en el mercado central.' },
      { name: 'Peixe frito', tipo: 'Almuerzo', zona: 'Puerto de Fortaleza', usd: 11, momento: 'Mediodía', nota: 'El pescado frito con chambinho, que se compra en el mercado del puerto y se come ahí mismo. La pesca del estado es fuerte, así que sale barato.' },
      { name: 'Cuscuz', tipo: 'Desayuno', zona: 'Fortaleza y Jericoacoara', usd: 4, momento: '7 a 10 h', nota: 'El bol de maíz cocido, con queso y aceite. Es el desayuno de la calle en todo el nordeste.' }
    ],
    tips: [
      { titulo: 'Fortaleza es la base, no el destino', texto: 'Fortaleza es ciudad y playa urbana. Si viniste por las dunas y las lagunas, basate cerca de Jericoacoara o en la costa, no en la capital.' },
      { titulo: 'El viento hay que planificarlo', texto: 'El kitesurf y el windsurf son el fuerte de la costa. Si no te interesan, anda en los momentos de poco viento. Y con el doble de protector solar: aquí el sol pega más fuerte.' },
      { titulo: 'Jericoacoara necesita tiempo', texto: 'La laguna, las dunas y el pueblo se recorren a caballo o en buggy por la arena. No se puede en auto normal hasta casi la orilla. Reserve el paseo al llegar.' }
    ],
    atracciones: [
      { name: 'Centro histórico de Fortaleza', zona: 'Fortaleza', dur: '2 h', usd: 0, nota: 'El centro con los teatros de piedra, la Plaza da República y el Museu da Cachaça. Se camina entero y no hay que pagar entrada.' },
      { name: 'Dunas de Jericoacoara', zona: 'Jericoacoara', dur: '3 h', usd: 35, nota: 'El paseo en buggy por las dunas hasta la laguna, con un guía que baja a la laguna. Es la actividad que define el lugar y hay que reservarla al llegar.' }
    ],
    hacer: [
      { name: 'Paseo en buggy por las dunas', zona: 'Jericoacoara', dur: '3 h', usd: 35, nota: 'Es la forma de llegar a la laguna, porque en auto normal no se pasa. Hay que reservar el paseo el día anterior, y va con guía.' }
    ],
  },

  'sao-paulo': {
    resumen: 'La ciudad más grande del país, con la mejor comida de calle de América del sur. No es un destino de playa.',
    beaches: [],
    comer: [
      { name: 'Prato feito paulista', tipo: 'Almuerzo', zona: 'Sao Paulo y Ubatuba', usd: 8, momento: 'Mediodía hasta las 15 h', nota: 'El plato hecho del día con arroz, feijão, carne, ensalada y postre. En la ciudad lo llaman lanche, y en la costa prato feito.' },
      { name: 'Camarão de Ubatuba', tipo: 'Almuerzo', zona: 'Ubatuba', usd: 13, momento: 'Mediodía', nota: 'El camarón a la plancha o al vapor, con aceite y limón. La pesca de la costa norte es fuerte, así que sale barato.' }
    ],
    tips: [
      { titulo: 'São Paulo no es un plan de playa', texto: 'Si elegiste São Paulo, no vas a una playa: vas a comer la mejor comida de Brasil y a ver la ciudad. El metro es enorme, rápido y barato, y te ahorra el taxi siempre.' },
      { titulo: 'La mejor cocina del país está aca', texto: 'São Paulo tiene la mayor densidad de restaurantes de alta cocina de América Latina, y a precios que en Europa serían un menú de tres platos.' }
    ],
    beaches: [
      { name: 'Ilhabela', zona: 'Litoral norte, a 2 h de Sao Paulo', vibe: 'La isla sin construccion. Casi toda es parque nacional: son senderos entre selva y agua. Se recorre a pie o en barco.', cuando: 'Todo el año, con temporada de diciembre a marzo. En enero y febrero se llena.' },
      { name: 'Ubatuba', zona: 'Litoral norte, a 3 h de Sao Paulo', vibe: 'La costa con la menor cantidad de gente del estado. Son kilómetros de playa con agua verde, bosque hasta la arena y pocos hoteles.', cuando: 'Todo el año. De mayo a septiembre hay viento, y es cuando funciona el kitesurf.' }
    ],
    atracciones: [
      { name: 'Ilha Bela', zona: 'Ilhabela', dur: '1 dia', usd: 0, nota: 'La isla que da nombre a la región, con los senderos de playa y las mejores fotos del litoral norte. Es la caminata de un día entero.' },
      { name: 'Parque Estadual de Ubatuba', zona: 'Ubatuba', dur: '3 h', usd: 0, nota: 'El parque que va desde la playa hasta la selva alta. Se recorre a pie, con el bosque pegado a la arena. Gratis.' }
    ],
    hacer: [
      { name: 'Barco a Ilha Bela', zona: 'Ilhabela', dur: '1 dia', usd: 45, nota: 'El barco desde Sao Sebastião hasta la isla, con tiempo para la caminata. Es el mejor plan de un día del litoral norte.' }
    ],
  },

  'alagoas': {
    resumen: 'Maceió y Maragogi. El litoral de playas de coral, con los precios más bajos del nordeste.',
    beaches: [
      { name: 'Pajuçara', zona: 'Maceió', vibe: 'La playa del centro de Maceió, con la iglesia de arriba mirándola y un movimiento de ciudad. El agua tiene coral abajo y se ve.', cuando: 'Todo el año. Los domingos se llena de gente de la ciudad.' },
      { name: 'Jatiúca', zona: 'Maceió', vibe: 'La playa mejor armada de la ciudad, con quiosco, tablero y arbolado. La arena es más blanca y el agua más turbia que en Pajuçara.', cuando: 'Todo el año. Es la más cómoda para un día de playa con familia.' },
      { name: 'Maragogi', zona: 'A 2 h de Maceió', vibe: 'El pueblo de las lagunas y las pozas. El agua es muy tranquila y verde, y se llega nadando a las pozas entre los corales. Es la playa más tranquila del nordeste.', cuando: 'Todo el año. Con marea baja las pozas quedan al aire y son el mejor momento para nadar.' }
    ],
    comer: [
      { name: 'Prato feito alagoano', tipo: 'Almuerzo', zona: 'Maceió', usd: 7, momento: 'Mediodía', nota: 'El plato hecho con carne de sol, cassoulet y mariscos frescos. Es el más barato del nordeste, con precios de ciudad chica.' },
      { name: 'Cuscuz', tipo: 'Desayuno', zona: 'Maceió y Maragogi', usd: 4, momento: '7 a 10 h', nota: 'El bol de maíz cocido con queso y aceite. Barato, llena, y el desayuno de la calle en todo el nordeste.' },
      { name: 'Tapioca', tipo: 'Desayuno', zona: 'Maceió', usd: 4, momento: '7 a 10 h', nota: 'La masa de tapioca hecha en el momento, con queijo coalho, mantega y carne. Es lo más típico de la zona.' }
    ],
    tips: [
      { titulo: 'Maragogi tiene el agua más limpia', texto: 'Sus lagunas naturales son lo mejor del nordeste. Está a 2 horas de Maceió, así que basate en Maceió o comprá un pasaje con tiempo.' },
      { titulo: 'Es la parada barata del circuito', texto: 'La comida y la playa son baratas de verdad, pero en la temporada de feriados los precios se disparan igual que en todo el nordeste.' }
    ],
    atracciones: [
      { name: 'Praia de São Miguel dos Milagres', zona: 'Entre Maragogi y Porto Calvo', dur: '2 h', usd: 0, nota: 'La playa que le da nombre a las canoneras del sur: un brazo de mar sin oleaje y con el agua tan quieta que parece pileta. Se llega por la estrada.' },
      { name: 'Mercado de Maceió', zona: 'Centro de Maceió', dur: '1 h', usd: 5, nota: 'El mercado de artesanía y comida con la producción de la región. Los soaps y las piezas de artesanía salen más baratos que en las tiendas.' }
    ],
    hacer: [
      { name: 'Paseo a las pozas de Maragogi', zona: 'Maragogi', dur: '2 h', usd: 20, nota: 'La lancha que sale del pueblo a las pozas entre los corales, con guía. Es lo que hace famoso el lugar: nadar en agua quieta y verde.' }
    ],
  },

  'rio-grande-do-norte': {
    resumen: 'Natal, Pipa y la costa. Natal es la ciudad-playa de siempre; Pipa es la del backpacker y la de la noche.',
    beaches: [
      { name: 'Ponta Negra', zona: 'Natal', vibe: 'La playa con el morro de arena al final, que tiene un mirador con la mejor puesta de sol de la ciudad. Es la orla de Natal: con barra y movimiento.', cuando: 'Todo el año. En la punta del morro hay un faro y un chiringuito.' },
      { name: 'Morro do Careca', zona: 'Natal', vibe: 'El morro de arena más famoso de la costa, con el mirador de la Duna. Se sube en menos de diez minutos.', cuando: 'Todo el año. El mirador cierra cuando hay lluvia, así que conviene ir de mañana.' },
      { name: 'Pipa', zona: 'A 80 km al sur de Natal', vibe: 'El pueblo de la noche. Playa de mar abierto con la barra al lado, y de noche una calle de bares con música que no baja hasta la madrugada.', cuando: 'Todo el año, con la mayor actividad de diciembre a marzo. En julio y agosto está vacío y barato.' }
    ],
    comer: [
      { name: 'Prato feito potiguar', tipo: 'Almuerzo', zona: 'Natal y Pipa', usd: 7, momento: 'Mediodía', nota: 'El plato hecho con carne, cuscuz, feijão y queijo. En Pipa los restaurantes de la calle suben el precio por la movida del barrio.' },
      { name: 'Camarão na chapa', tipo: 'Cena', zona: 'Pipa', usd: 14, momento: 'Noche', nota: 'El camarón a la plancha con ajo y limón, que se come en la playa o en un simple kiosco. Es la cena de Pipa.' }
    ],
    tips: [
      { titulo: 'Natal y Pipa son dos viajes distintos', texto: 'Natal es ciudad grande, con playa y vida urbana normal. Pipa es pueblo chico, con la movida nocturna. No intentes hacer las dos en el mismo día sin auto.' },
      { titulo: 'El kitesurf vive acá', texto: 'La costa de Rio Grande do Norte está entre las mejores del mundo para kitesurf. El viento pega fuerte entre mayo y septiembre.' },
      { titulo: 'Ponta Negra de noche no es de noche', texto: 'La calle de shops y bares de la playa se llena a partir de las 22 h y no baja nunca. Si querés cenar tranquilo, no ahí: a unas cuadras adentro, en el centro.' }
    ],
    atracciones: [
      { name: 'Mirante da Duna', zona: 'Natal', dur: '1 h', usd: 0, nota: 'La escalera de madera que sube al Morro do Careca, con el punto más alto de la duna. Gratis, y es la mejor foto de Natal.' },
      { name: 'Mirante da Praia do Amor', zona: 'Pipa', dur: '1 h', usd: 3, nota: 'El mirador de la punta de Pipa, sobre la playa más chica. Se ve toda la costa y es el atardecer del pueblo.' }
    ],
    hacer: [
      { name: 'Paseo en buggy por las dunas', zona: 'Natal', dur: '3 h', usd: 30, nota: 'El buggy que recorre las dunas de Genipabu y Praia do Dreams, con parada para nadar. Se reserva el día anterior, en la ciudad.' }
    ],
  },

  'parana': {
    resumen: 'Foz de Iguazú y Curitiba. Las cataratas más grandes del mundo y la ciudad más verde del Brasil.',
    beaches: [],
    comer: [
      { name: 'Barbecue de Foz', tipo: 'Almuerzo', zona: 'Foz de Iguaçu', usd: 11, momento: 'Almuerzo y cena', nota: 'La carne a la parrilla que se come en el sur de Brazil, con mani y farofa. Foz tiene un montón de casas de rodizio con esa carne.' },
      { name: 'Pão de queijo de Curitiba', tipo: 'Merienda', zona: 'Curitiba', usd: 3, momento: 'Toda la tarde', nota: 'El pan de queso de sabor real, recién hecho. Sale de cualquier panadería de la calle y es mejor que el congelado.' }
    ],
    tips: [
      { titulo: 'Las cataratas no se ven de un solo lado', texto: 'Un lado son las cataratas y el otro el Parque de las Aves. El ticket único cubre los dos, y un día entero es el mínimo para verlos sin correr.' },
      { titulo: 'Iguazú no es Curitiba', texto: 'Están a 4 horas en el mismo estado. No se ven las cataratas y la ciudad el mismo día sin madrugar mucho.' },
      { titulo: 'Foz no es una ciudad bonita', texto: 'Es una ciudad de tránsito, con malls y una avenida larga. No esperes charm. Lo único que justifica la parada es pasar a las cataratas.' }
    ],
    beaches: [
    ],
    atracciones: [
      { name: 'Cataratas do Iguaçu', zona: 'Foz de Iguaçu', dur: '1 dia', usd: 0, nota: 'Las cataratas más grandes del país, con 275 saltos. El ticket cubre el lado argentino y el Parque das Aves, que tiene el nido de la guacamaya azul. El paseo en tren hasta la base es obligatorio.' },
      { name: 'Parque das Aves', zona: 'Foz de Iguaçu', dur: '3 h', usd: 0, nota: 'El parque de aves exóticas de América Latina, con el nido de la guacamaya azul y el corre de las avestruces. Va pegado a las cataratas y se hace en el mismo día.' },
      { name: 'Jardim Botânico de Curitiba', zona: 'Curitiba', dur: '2 h', usd: 0, nota: 'El jardín con la estufa de cristal, que es la estufa más grande del país. Está en el centro y se recorre a pie.' }
    ],
    hacer: [
      { name: 'Tren hasta la base de las cataratas', zona: 'Foz de Iguaçu', dur: '2 h', usd: 8, nota: 'El tren que va hasta el mirador. Es incluido en el ticket y es la única forma de llegar a la base sin caminar dos horas.' }
    ],
  },

  'paraiba': {
    resumen: 'João Pessoa y la costa. El balneario más barato del nordeste, con la pared de coral más famosa del país.',
    beaches: [
      { name: 'Praia da Penha', zona: 'João Pessoa', vibe: 'La playa con el acantilado de piedra caliza en la punta, que aparece en todas las fotos. El mar es abierto y hay tabla sobre las rocas.', cuando: 'Todo el año. Con marea baja la punta de la Penha se puede caminar y está llena de gente.' },
      { name: 'Bica do Roque', zona: 'Centro de João Pessoa', vibe: 'La playa del centro, con el faro al final. Es la que se ve desde el hotel, y tiene puesta de sol sobre el mar.', cuando: 'Todo el año. Es la más tranquila de las tres y la más cómoda para ir a diario.' },
      { name: 'Praia do Amor', zona: 'A 20 km de João Pessoa', vibe: 'La playa con la quebra de agua que forma un corazón cuando la marea está baja. Está llena de gente y muchas familias.', cuando: 'Todo el año. La forma del corazón se ve con la marea baja, al atardecer.' }
    ],
    comer: [
      { name: 'Bolo de rolo', tipo: 'Postre', zona: 'João Pessoa', usd: 4, momento: 'Cualquier hora', nota: 'La torta de rollo con queso de leche por dentro. Viene fría, en porción, y es el postre que identifica a Paraíba. Se compra en cualquier panadería del centro.' },
      { name: 'Cozido paraibano', tipo: 'Almuerzo', zona: 'João Pessoa', usd: 9, momento: 'Mediodía', nota: 'La carne hervida con verduras y mandioca, que es la forma de Paraíba de servirla. Sale más barato que la carne de sol y es igual de típica.' },
      { name: 'Tapioca', tipo: 'Desayuno', zona: 'João Pessoa', usd: 4, momento: '7 a 10 h', nota: 'La masa de tapioca hecha en el momento, con queso, carne o queijo coalho. Es el desayuno de la calle.' }
    ],
    tips: [
      { titulo: 'Es el nordeste sin los precios del nordeste', texto: 'João Pessoa tiene playa de ciudad, kitesurf de clase mundial y comida de puerto, y es bastante más barata que Recife o Salvador. La infraestructura hotelera todavía es más chico, así que el alojamiento sale barato también.' },
      { titulo: 'El kitesurf vive acá', texto: 'La costa de Paraíba es de las mejores del mundo para kitesurf, con viento constante. La temporada fuerte va de mayo a septiembre, con viento de mar.' },
      { titulo: 'Cachaça de calidad en vez de vino', texto: 'Paraíba tiene su propia producción de cachaça de caña, que se visita y se prueba en un mismo lugar. Es un plan de medio día distinto al de la Serra Gaucha y bastante más barato.' }
    ],
    atracciones: [
      { name: 'Monumento das Cruzes', zona: 'João Pessoa', dur: '45 min', usd: 0, nota: 'El conjunto de cruces de piedra en lo alto de la Penha, que se ve desde toda la ciudad. Es el punto más viejo de Paraíba. Gratis, y es la mejor vista.' },
      { name: 'Centro histórico de João Pessoa', zona: 'Centro', dur: '2 h', usd: 0, nota: 'La plaza y la calle de casonas del siglo XIX, con el teatro y la catedral. Se camena en una tarde y no hay que pagar entrada.' }
    ],
    hacer: [
      { name: 'Paseo en barca por el río Paraíba', zona: 'João Pessoa', dur: '2 h', usd: 20, nota: 'La barca que sale del centro y sube por el río, que es uno de los más anchos de Brasil. Se ve la ciudad desde el agua, y es el mejor paseo.' }
    ],
  },

  'minas-gerais': {
    resumen: 'Belo Horizonte. La ciudad de las torres y la cocina más completa del interior de Brasil. Sin playa y sin naturaleza.',
    beaches: [],
    comer: [
      { name: 'Prato feito mineiro', tipo: 'Almuerzo', zona: 'Centro y Savassi', usd: 8, momento: 'Mediodía', nota: 'El más completo de Brazil: plato, legumbre, espagueti, feijão, guarana y postre. Es la mejor relación precio-calidad del interior del pais.' },
      { name: 'Pão de queijo de Minas', tipo: 'Merienda', zona: 'Toda la ciudad', usd: 3, momento: 'Toda la tarde', nota: 'El pan de queso de la region, con receta propia. La diferencia con el de Sao Paulo es el uso del queso de minas y el sabor ahumado.' },
      { name: 'Pastel de feijão', tipo: 'Merienda', zona: 'Toda la ciudad', usd: 4, momento: 'Tarde', nota: 'El pastelito de masa de feijão con picadillo de carne, que es la merienda típica de Minas. Se compra en cualquier panaderia.' }
    ],
    tips: [
      { titulo: 'Belo Horizonte no es un destino turístico', texto: 'Es una ciudad de negocios de cinco millones de habitantes. Si no tenés un motivo claro, la ciudad no tiene nada que ofrecer. Pero es muy barata y se come muy bien.' },
      { titulo: 'No confundas la región con la ciudad', texto: 'Minas Gerais tiene la mejor cocina del país, pero la mayor parte de esa comida está en BH. Si viniste por la comida, come en la ciudad; el resto de Minas es campo y montaña.' }
    ],
    beaches: [
    ],
    atracciones: [
      { name: 'Praça da Liberdade', zona: 'Centro de Belo Horizonte', dur: '1 h', usd: 0, nota: 'La plaza con las iglesias coloniales alrededor. Es el centro histórico de la ciudad y se cruza entero a pie.' },
      { name: 'Igreja São Francisco de Assis', zona: 'Centro de Belo Horizonte', dur: '30 min', usd: 0, nota: 'La iglesia barroca de 1771, con las imágenes de Aleijadinho. Es la pieza más importante de Minas y entra gratis.' }
    ],
    hacer: [
      { name: 'Mercado Municipal', zona: 'Centro', dur: '1 h', usd: 6, nota: 'El mercado con el queso de Minas y los puestos de artesanía. Es el mejor lugar para comprar queso para llevar.' }
    ],
  },

  'buenos-aires': {
    resumen: 'La ciudad más grande de Hispanoamérica. Cultura, milongas, y el mejor café de la región.',
    beaches: [],
    comer: [
      { name: 'Empanada de carne', tipo: 'Merienda', zona: 'Centro y Palermo', usd: 2, momento: 'Cualquier hora', nota: 'La empanada de carne cortada a cuchillo, que es distinta a la de pollo. Media docena en cualquier confitería del centro es el almuerzo más barato.' },
      { name: 'Milanesa napolitana', tipo: 'Almuerzo', zona: 'Centro y Palermo', usd: 9, momento: 'Mediodía', nota: 'El filete empanado con jamon y queso, con pure. Es el plato casero por excelencia y se come en cualquier casa de comida.' },
      { name: 'Parrilla porteña', tipo: 'Cena', zona: 'Palermo y San Telmo', usd: 22, momento: 'Noche', nota: 'La parrilla con la carne argentina. Es la cena más cara de la región y vale la pena: un bife de chorizo o un bife de cuadril.' }
    ],
    tips: [
      { titulo: 'El cambio, con tarjeta y en el banco', texto: 'Con tarjeta el cambio es el oficial. El cambio informal de la calle te deja un 20% menos. Para gastar en pesos, retira en un cajero y no en la casa de cambio.' },
      { titulo: 'La noche arranca tarde', texto: 'Cenar a las 21 h es merienda, no cena. Si tenés una sola noche: la milonga arranca a la medianoche y sigue hasta el amanecer. Cenar temprano es el error más caro del viaje.' },
      { titulo: 'El subte es serio', texto: 'La linea H es la única que cruza la ciudad de norte a sur: rápida, segura y te muestra la vida real de un porteño. Se paga con la SUBE, que se compra en cualquier kiosco.' }
    ],
    beaches: [
    ],
    atracciones: [
      { name: 'Teatro Colón', zona: 'Centro', dur: '1 h', usd: 8, nota: 'El templo de la opera, con la fachada de mármol. La entrada guiada sale más cara que el show, así que conviene ver el edificio y después elegir qué show.' },
      { name: 'Recorrido por San Telmo', zona: 'San Telmo', dur: '2 h', usd: 0, nota: 'El barrio de las tiendas de antigüedades, los conventillos y los tangos de la calle. Es la mejor caminata de la ciudad y no se paga nada.' },
      { name: 'Mercado de San Telmo', zona: 'San Telmo', dur: '1 h', usd: 0, nota: 'El mercado techado con puestos de antigüedades y artesanía. Los domingos hay feria de anticüedades y es cuando está lleno.' }
    ],
    hacer: [
      { name: 'Cambio de moneda con tarjeta', zona: 'Banco', dur: '1 h', usd: 0, nota: 'El cambio con tarjeta al cambio oficial. El cambio informal de la calle deja un veinte por ciento menos. Para pesos, mejor cajero automático.' }
    ],
  }

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

   Por que mezclar en vez de reemplazar: la guia de Gramado describe la
   ciudad, pero el tip de la regional sobre el clima de la Serra Gaucha
   ("llueve todo el ano, nadie va por la playa") sigue siendo cierto y
   aplica igual. Reemplazando, Gramado perdia ese aviso; escribiendo las
   13 regionales al pie de cada ciudad, el contenido se duplica y se
   desincroniza.

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
