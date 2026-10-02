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
   nueva se pasa de los 30 km o viene sin foto. Las guias REGIONALES todavia
   no cumplen la regla: son de estado entero y nombran pueblos a horas de
   distancia. Se reemplazan escribiendo la guia de ciudad, como se hizo con
   Rio, no estirando la regional.

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
var CACHE_VERSION = 1;
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
    beaches: [],
    atracciones: [
      { name: 'Mercado Municipal', zona: 'Centro', dur: '1 h', usd: 10, nota: 'El edificio de hierro de 1933, con los puestos de comida y el pastel de bacalao. Caro para lo que es, pero es la mejor introducción a la ciudad en una hora.' },
      { name: 'Beco do Batman', zona: 'Vila Madalena', dur: '1 h', usd: 0, nota: 'El callejón de grafitis más famoso de la ciudad. De día es un pasillo con buenas pinturas; de noche es una barra con música en vivo.' },
      { name: 'Mirante do Santana', zona: 'Santana', dur: '1 h', usd: 0, nota: 'El mirador que da a toda la ciudad desde arriba. Gratis, y la mejor foto del verticalismo de São Paulo.' },
      { name: 'Catedral da Sé', zona: 'Centro', dur: '45 min', usd: 0, nota: 'La catedral neogótica más grande de Brasil, con las torres más altas del país. Se sube al mirador y da para ver el centro entero.' },
      { name: 'Museu de Arte de São Paulo', zona: 'Avenida Paulista', dur: '2 h', usd: 6, nota: 'Los cuadros están ordenados por escuela y no por cronología, que es raro y funciona. Se ve de punta a punta en dos horas y es el mejor museo de Brasil.' },
      { name: 'Estação da Luz', zona: 'Centro', dur: '1 h', usd: 0, nota: 'La estación de tren de 1901, toda de hierro y vidrio, hoy convertida en biblioteca. Se entra gratis, y al lado está la galería de arte, que es de pago pero es chica.' },
      { name: 'Pinacoteca', zona: 'Centro', dur: '1 h', usd: 5, nota: 'El museo de arte de la ciudad, en un edificio neoclásico. Es la mejor colección de arte brasileño del país, y a diferencia del MASP tiene tiempo para mirar: no son 500 obras de golpe.' },
      { name: 'Memorial da América Latina', zona: 'Barra Funda', dur: '2 h', usd: 0, nota: 'Un conjunto de Eichler, Kiko Maugrí y Giancarlo Gasperini, en un parque de 74 hectáreas. Es gratis, es enorme, y casi nadie va: se llena de gente de São Paulo los fines de semana.' }
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
    resumen: 'Las playas chicas de la ciudad: calas entre morros, a menos de una hora de Copacabana, donde va la gente de Río y no el micro de excursión.',
    temporada: {
      alta: [12, 1, 2, 3],
      baja: [6, 7, 8],
      nota: 'De diciembre a marzo hay calor de 35 grados, lluvia corta de tarde y Carnaval con precios al doble. De junio a agosto hace 25 grados, llueve poco y las playas chicas quedan casi vacías entre semana: es la mejor época para esta guía.'
    },
    beaches: [
      { name: 'Praia Vermelha', zona: 'Urca, 5 km del Centro', lat: -22.9548, lng: -43.1640, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Praia_da_Urca_RJ.jpg/1280px-Praia_da_Urca_RJ.jpg', vibe: 'Una cala encajada entre el Pan de Azúcar y el Morro da Babilônia. El agua es calma porque la boca es angosta, y la usan las familias de Urca: el turista pasa por al lado para hacer la fila del bondinho y no baja a la arena.', cuando: 'Todo el año. Temprano entre semana está casi vacía. Es también el punto de partida de la Pista Cláudio Coutinho (ver Qué hacer).' },
      { name: 'Praia do Diabo', zona: 'Entre Arpoador y Copacabana, 9 km del Centro', lat: -22.9880, lng: -43.1925, foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Arpoador_-_Praia_do_Diabo_RJ.jpg/1280px-Arpoador_-_Praia_do_Diabo_RJ.jpg', vibe: 'Una franja corta de arena entre la Pedra do Arpoador y el Forte de Copacabana. Miles de personas la miran desde la piedra al atardecer y casi nadie baja: es de los surfistas y bodyboarders del barrio.', cuando: 'Con mar calmo, a la mañana. Con olas grandes no es para nadar: la corriente tira hacia las piedras.' },
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
