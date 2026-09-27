'use strict';
/* Guia Secreta: contenido por destino. Se carga antes de app.js (ver
   index.html) y publica un global, igual que daily-costs.js, por la misma
   razon: son datos, no logica, y app.js los lee al armar la vista.

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
   Porque los tours ya existen y son reales. En public/app.js hay
   LOCAL_TOURS (111 entradas escritas a mano) y encima el catálogo de
   Civitatis, que trae el precio de la fecha que está mirando el usuario,
   con rating y cancelación gratis.

   Escribirlos tambien acá los convertiría en precio estimado, que es
   exactamente lo que Civitatis vino a reemplazar. Y duplicaría 111
   entradas que ya hay que mantener.

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
      { name: 'Beira-Mar Norte', zona: 'Centro, continental', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Beira_mar_norte_Florian%C3%B3polis_SC.jpg/1280px-Beira_mar_norte_Florian%C3%B3polis_SC.jpg', vibe: 'La que estas viendo si estas en el centro. Orla con ciclovia, sombra y movimiento.', cuando: 'Todo el año. Con marea alta el agua se retira y quedan los bloques de cemento del muro: no la confundas con una playa de verdad.' },
      { name: 'Molhe da Barra', zona: 'Sur del centro, 5 min en bondinho', vibe: 'La mejor de la ciudad para el atardecer y para un banado corto. El muelle de madera arma una pileta natural que retiene el agua cuando baja la marea.', cuando: 'Cualquier día, pero con viento del sur el oleaje se rompe y no se puede nadar. De tarde, no al mediodía.' },
      { name: 'Praia da Conceição', zona: 'A 4 km del centro', vibe: 'Donde va la gente de la ciudad, no los turistas. Más chica y más de barrio, con pizzerías de familia que cuestan la mitad que en la orla.', cuando: 'Todo el año. Fines de semana se llena temprano: después de las 10 no hay lugar.' },
      { name: 'Naufragados', zona: 'Sur de la ilha, 25 km', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Naufragados%2C_Florian%C3%B3polis.jpg/1280px-Naufragados%2C_Florian%C3%B3polis.jpg', vibe: 'La postal de la isla. Desnuda, sin servicios, con el mejor atardecer del estado.', cuando: 'Todo el año. El camino de ida ya es el paseo: 40 minutos de curvas con vista al mar.' },
      { name: 'Praia de São Francisco', zona: 'Norte, 20 km', vibe: 'La familiar y la protegida. Para nadar tranquilo en familia, esta y no la orla.', cuando: 'Todo el año. Tiene estructura y huele a balneario, así que es de las pocas que sirven con lluvia.' },
      { name: 'Praia do Campeche', zona: 'Sur de la ilha, 20 km del centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Praia_do_Campeche.jpg/1280px-Praia_do_Campeche.jpg', vibe: 'La más tranquila del sur. El agua casi no se mueve, y hay escuela de surf, kayak y kioscos con sombra.', cuando: 'Todo el año. Es la que se elige cuando hay chicos, o cuando el viento del sur cerró todo lo demás.' },
      { name: 'Lagoa da Conceição', zona: 'Norte de la ilha, 12 km del centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/Lagoa_da_Concei%C3%A7%C3%A3o_%283423230047%29.jpg/1280px-Lagoa_da_Concei%C3%A7%C3%A3o_%283423230047%29.jpg', vibe: 'No es mar: es una laguna de agua dulce, protegida y tibia. Se navega en kayak, se hace paddle, y al lado está el parque de dunas.', cuando: 'Todo el año, y llueve menos que en el resto de la isla. Es el plan cuando el tiempo está feo, porque no depende del oleaje.' },
      { name: 'Praia Brava', zona: 'Sur de la ilha, extremo, 35 km del centro', foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Floripa_12_2014_Brava_1079.JPG/1280px-Floripa_12_2014_Brava_1079.JPG', vibe: 'Salvaje y sin servicios. Se llega caminando dos horas por un sendero de acantilado, o con guía. No hay nada construido, ni quiosco, ni sombra: eso es lo que la hace especial.', cuando: 'De octubre a marzo, con marea baja. Fuera de esa ventana el sendero se vuelve peligroso por el agua.' }
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
      { name: 'Costa norte (Itapema, Piçarras, Balneário Camboriú)', zona: 'BR-101, hasta 60 km al norte de la isla', vibe: 'Balnearios de familia. Mucha estructura, caro en verano y lleno de gente de São Paulo.', cuando: 'De diciembre a marzo es el pico absoluto: el precio se duplica y hay que reservar con meses.' }
    ],
    comer: [
      { name: 'Prato feito de balneario', tipo: 'Almuerzo', zona: 'Todos los pueblos de la costa', usd: 8, momento: 'Mediodía', nota: 'El plato del día con acompañamiento: arroz, feijão, carne, ensalada y postre, a precio fijo y a la vista antes de pedir.' }
    ],
    tips: [
      { titulo: 'La BR-101 es el eje de todo', texto: 'Todos los pueblos de la costa están sobre la misma ruta. Sin auto el bus entre pueblos funciona, pero la frecuencia cae fuerte después de las 20 h. Planificá el regreso antes de la salida, no en el lugar.' },
      { titulo: 'Dos Santa Catarinas distintas', texto: 'La costa norte es estructura y familia. La costa sur (Rosa, Garopaba, Ferrugem) es más chica, más tranquila y más barata. No son el mismo viaje, aunque compartan bus y aeropuerto.' },
      { titulo: 'Camboriú no es una playa: es un edificio', texto: 'El balneario más caro del estado, con torres de 30 pisos sobre la arena. La playa que todos quieren ver es la de al lado y la vas a poder ver gratis desde la costa sur.' }
    ]
  },

  'rio-grande-do-sul': {
    resumen: 'Serra Gaucha y el litoral sur del estado: vino, fondue y balnearios más baratos que el lado norte.',
    beaches: [
      { name: 'Torres y Capão da Canoa', zona: 'Litoral sur, unos 200 km de Porto Alegre', vibe: 'Balnearios de familia con toda la estructura. Más baratos y más vacíos que el lado norte del estado.', cuando: 'Todo el año, con temporada fuerte de diciembre a marzo.' }
    ],
    comer: [
      { name: 'Fondue y vino', tipo: 'Cena', zona: 'Gramado y Canela', usd: 28, momento: 'Noche', nota: 'La experiencia obligatoria de la Serra Gaucha y la comida más cara del viaje. Hay que ir a un lugar de la región, no a cualquier restaurante con "fondue" en la carta.' },
      { name: 'Prato feito gaúcho', tipo: 'Almuerzo', zona: 'Toda la región', usd: 10, momento: 'Mediodía', nota: 'Chimarrão, arroz con leche y pastel de carne. Mucho más pesado que el resto de Brasil y las porciones son enormes.' }
    ],
    tips: [
      { titulo: 'Gramado es caro y hay motivo', texto: 'Es la ciudad más famosa de la Serra y los precios lo reflejan. Canela está a 5 km, cuesta un tercio y tiene la misma vista y el mismo clima.' },
      { titulo: 'La costa es otro viaje', texto: 'Si lo que querés es playa, Torres y Capão da Canoa son más baratas y más tranquilas que todo el lado norte. No son comparables a los balnearios de Santa Catarina.' },
      { titulo: 'La Serra no es un destino de sol', texto: 'En la Serra Gaucha llueve todo el año y casi no sale el sol. Nadie va a la playa: se va por la montaña, el vino y los parques. Si buscas calor, alojate en el litoral, no en la ciudad.' }
    ]
  },

  'rio-de-janeiro': {
    resumen: 'La ciudad y la Costa Verde. Mucho para ver, precios turísticos en Copacabana e Ipanema, y comida de calle excelente en el centro.',
    beaches: [
      { name: 'Copacabana e Ipanema', zona: 'Zona Sur', vibe: 'Las clásicas: sol, movimiento y precio turístico. La arena es buena, los precios no.', cuando: 'Todo el año. En verano (diciembre a marzo) se llenan de forasteros.' },
      { name: 'Praia do Arpoador', zona: 'Entre Copacabana e Ipanema', vibe: 'La mejor para ver el atardecer, y gratis. No es para bañarse: tiene olas fuertes y no tiene servicios.', cuando: 'Cualquier día, 40 minutos antes del atardecer.' }
    ],
    comer: [
      { name: 'Prato feito en el centro', tipo: 'Almuerzo', zona: 'Centro / Catete', usd: 9, momento: 'Mediodía hasta las 15 h', nota: 'El negocio de la ciudad. Millones de personas lo comen todos los días y no es un plan turístico. Un poco más caro que en el interior, y lo vale.' },
      { name: 'Feira livre', tipo: 'Compra', zona: 'Cambia según el barrio', usd: 5, momento: 'Sábado a la mañana', nota: 'Fruta, pasteles, jugos y comida ya hecha a precio de barrio. Cada barrio tiene su día: averiguá cuál cae antes de ir.' }
    ],
    tips: [
      { titulo: 'La Zona Sur es la turística, la Zona Norte es la ciudad', texto: 'El café y la comida de calidad están en Ipanema y Botafogo. Los precios de comida callejera y los mercados están en el centro y en la Zona Norte. Con tres días, cruzate a comer.' },
      { titulo: 'El moqueco es domingo al mediodía', texto: 'El comidazo más grande del Brasil es un domingo al mediodía: montaña de arroz, costillar y farofa. Es un desayuno, no un almuerzo. Buscate un lugar con esse, no uno turístico.' },
      { titulo: 'Angra y Paraty se llegan en bus o auto', texto: 'Están a 2 o 3 horas de la ciudad. El bus es mucho más barato y funciona bien. El auto se justifica solo si hacés más de un destino en el mismo día.' },
      { titulo: 'Una favela no es una atracción', texto: 'Es un barrio real con gente real, y el tour guiado de dos horas es la forma correcta y razonable de verlo. Se visita a la luz del día y acompañado. Sin eso, no se sube: el resto de la ciudad alcanza y sobra.' }
    ]
  },

  'bahia': {
    resumen: 'Salvador, la Costa Doce y Trancoso. Cultura afro, comida de mar, la calle más famosa del país y un litoral de pueblos de playa.',
    beaches: [
      { name: 'Porto da Barra y el Pelourinho', zona: 'Centro de Salvador', vibe: 'La playa urbana más famosa de Brasil, con el elevador y la iglesia detrás. Es un lugar para ver, no para bañarse.', cuando: 'Todo el año. Fines de semana se llena hasta la calle.' },
      { name: 'Praia do Forte', zona: 'A 100 km al norte de la capital', vibe: 'El balneario de clase media de Salvador. Más tranquilo que la capital y a una hora de ida.', cuando: 'Todo el año, con estructura de balneario.' }
    ],
    comer: [
      { name: 'acarajé de las bahianas', tipo: 'Merienda', zona: 'Largo de Santana, frente a la iglesia', usd: 4, momento: 'Tarde', nota: 'El plato más famoso de Bahía: viene con camarão, vatapa y urucum, y es barato y abundante. Las vendedoras en la plaza son las que saben; la primera vez pedí la cuenta con los extras antes de ordenar.' },
      { name: 'Prato feito baiano', tipo: 'Almuerzo', zona: 'Centro, lejos de la zona turística', usd: 8, momento: 'Mediodía', nota: 'La cocina de Bahía es de las mejores del país: dende, cazabe, vatapa. Un plato hecho con aceite de palma bien servido y está en todas partes, pero en el Pelourinho el precio se paga por la ubicación.' }
    ],
    tips: [
      { titulo: 'Salvador tiene dos caras', texto: 'El Pelourinho es la postal: más movimiento y precios altos. La Ciudad Baja, detrás, es donde Salvador vive de verdad y donde se come mejor por menos. Bajate de las escaleras y cruzate.' },
      { titulo: 'Trancoso es caro y nadie lo discute', texto: 'Trancoso y Arraial d’Ajuda es el pueblo de playa más caro de Bahía. Vale la pena, pero no es un destino de presupuesto. Porto Seguro e Itacaré dan la misma costa por menos de la mitad.' },
      { titulo: 'El moqueco de Salvador es el original', texto: 'El carnaval de la ciudad tiene su propia versión del moqueco, con más ritmo y más comida. Es el mejor plan de una noche si estás en la capital.' }
    ]
  },

  'pernambuco': {
    resumen: 'Recife y Olinda, Porto de Galinhas y Fernando de Noronha. Cultura, la muela y la muña del nordeste y las mejores playas del estado.',
    beaches: [
      { name: 'Boa Viagem', zona: 'Recife', vibe: 'La playa urbana de Recife, con los arrecifes de coral al lado. Con movimiento y servicios.', cuando: 'Todo el año.' },
      { name: 'Porto de Galinhas', zona: 'A 40 km al sur de Recife', vibe: 'La de las pools naturales y las jangadas. Agua tranquila y verde, y la excursión de botes llena la playa.', cuando: 'Todo el año, con oleaje más fuerte en invierno.' }
    ],
    comer: [
      { name: 'Tapioca y cuscuz', tipo: 'Desayuno', zona: 'Recife y Olinda', usd: 4, momento: '7 a 10 h', nota: 'El cuscuz nordestino es un bol de maíz de primera, barato y llena. La tapioca es el desayuno de la calle en todo el nordeste.' },
      { name: 'Prato feito pernambucano', tipo: 'Almuerzo', zona: 'Recife', usd: 8, momento: 'Mediodía', nota: 'El negocio local, con carne de sol, pescado y acarajé, igual que en el resto de Brasil.' }
    ],
    tips: [
      { titulo: 'Olinda está a 30 minutos y vale el viaje', texto: 'Olinda es colonial, con las casonas pintadas de la iglesia y el frevo en cada esquina, y se recorre casi entera a pie. Es el mejor plan de día desde Recife.' },
      { titulo: 'Fernando de Noronha no es una excursión', texto: 'Es una isla protegida, con cupo diario y tarifas altas. Hay que reservar con semanas de anticipación. Si no reservaste, no vayas: vale, pero como último día y no improvisado.' },
      { titulo: 'Recife es la mejor base', texto: 'La ciudad es el mejor punto de partida para Olinda y Porto de Galinhas. Recife esplanada y con poco que ver caminando, pero el aprendizaje está en la comida y en el movimiento.' }
    ]
  },

  'ceara': {
    resumen: 'Fortaleza y Jericoacoara. Dunas, lagunas y la costa más ventosa del Brasil.',
    beaches: [
      { name: 'Praia do Futuro', zona: 'Fortaleza', vibe: 'La playa urbana más larga: 4 km de arena y movimiento. Donde va la ciudad los fines de semana.', cuando: 'Todo el año. En la desembocadura del Mucuripe hay corriente: no se nada ahí.' }
    ],
    comer: [
      { name: 'Carne de sol', tipo: 'Almuerzo', zona: 'Fortaleza y el interior', usd: 12, momento: 'Mediodía', nota: 'La carne curada al sol que se come en todo el estado, servida con queso de leche y tapioca. Es la carne más característica de Ceará y sale en el mercado central.' },      { name: 'Camarao', tipo: 'Almuerzo', zona: 'Puerto', usd: 10, momento: 'Mediodía', nota: 'La pesca de Ceará es fuerte, así que el camarão sale barato. En el mercado del puerto, no en la orla.' }
    ],
    tips: [
      { titulo: 'Fortaleza es la base, no el destino', texto: 'Fortaleza es ciudad y playa urbana. Si viniste por las dunas y las lagunas, basate cerca de Jericoacoara o en la costa, no en la capital.' },
      { titulo: 'El viento hay que planificarlo', texto: 'El kitesurf y el windsurf son el fuerte de la costa. Si no te interesan, anda en los momentos de poco viento. Y con el doble de protector solar: aquí el sol pega más fuerte.' },
      { titulo: 'Jericoacoara necesita tiempo', texto: 'La laguna, las dunas y el pueblo se recorren a caballo o en buggy por la arena. No se puede en auto normal hasta casi la orilla. Reserve el paseo al llegar.' }
    ]
  },

  'sao-paulo': {
    resumen: 'La ciudad más grande del país, con la mejor comida de calle de América del sur. No es un destino de playa.',
    beaches: [],
    comer: [
      { name: 'Lanche completo (PF)', tipo: 'Almuerzo', zona: 'Centro y barrios', usd: 8, momento: 'Mediodía hasta las 15 h', nota: 'São Paulo llama “lanches” a lo que en Río es un prato feito: sandwich, papas y bebida por menos de lo que cuesta un café. Es la comida más barata de la ciudad.' },
      { name: 'Feira livre', tipo: 'Compra', zona: 'Cambia por barrio y por día', usd: 5, momento: 'Sábado a la mañana', nota: 'Cada barrio tiene su feira en un día fijo de la semana. Averiguá cuál es el tuyo antes de salir, y llevá fruta, pan de queso y comida ya hecha.' }
    ],
    tips: [
      { titulo: 'São Paulo no es un plan de playa', texto: 'Si elegiste São Paulo, no vas a una playa: vas a comer la mejor comida de Brasil y a ver la ciudad. El metro es enorme, rápido y barato, y te ahorra el taxi siempre.' },
      { titulo: 'La mejor cocina del país está aca', texto: 'São Paulo tiene la mayor densidad de restaurantes de alta cocina de América Latina, y a precios que en Europa serían un menú de tres platos.' }
    ]
  },

  'alagoas': {
    resumen: 'Maceió y Maragogi. El litoral de playas de coral, con los precios más bajos del nordeste.',
    beaches: [
      { name: 'Pajuçara y Jatiúca', zona: 'Maceió', vibe: 'Las dos playas de la ciudad. Jatiúca tiene la arena más blanca y mejor equipada; Pajuçara, más movimiento.', cuando: 'Todo el año.' }
    ],
    comer: [
      { name: 'Prato feito alagoano', tipo: 'Almuerzo', zona: 'Maceió', usd: 7, momento: 'Mediodía', nota: 'El más barato del nordeste: carne de sol, cuscuz y mariscos frescos a precios de ciudad chica.' }
    ],
    tips: [
      { titulo: 'Maragogi tiene el agua más limpia', texto: 'Sus lagunas naturales son lo mejor del nordeste. Está a 2 horas de Maceió, así que basate en Maceió o comprá un pasaje con tiempo.' },
      { titulo: 'Es la parada barata del circuito', texto: 'La comida y la playa son baratas de verdad, pero en la temporada de feriados los precios se disparan igual que en todo el nordeste.' }
    ]
  },

  'rio-grande-do-norte': {
    resumen: 'Natal, Pipa y la costa. Natal es la ciudad-playa de siempre; Pipa es la del backpacker y la de la noche.',
    beaches: [
      { name: 'Ponta Negra y el Morro do Careca', zona: 'Natal', vibe: 'La playa con el icono de la ciudad: un morro de arena con mirador al final y la puesta de sol más famosa de Natal.', cuando: 'Todo el año.' },
      { name: 'Pipa', zona: 'A 80 km al sur de Natal', vibe: 'La capital del backpacker con la noche más intensa de la costa. Playa, gente y barra hasta la madrugada.', cuando: 'Todo el año, con la mayor actividad de diciembre a marzo.' }
    ],
    comer: [
      { name: 'Prato feito potiguar', tipo: 'Almuerzo', zona: 'Natal y Pipa', usd: 7, momento: 'Mediodía', nota: 'El negocio local: carne, feijão, cuscuz y queso. En Pipa los restaurantes de la calle suben el precio por la movida del barrio.' }
    ],
    tips: [
      { titulo: 'Natal y Pipa son dos viajes distintos', texto: 'Natal es ciudad grande, con playa y vida urbana normal. Pipa es pueblo chico, con la movida nocturna. No intentes hacer las dos en el mismo día sin auto.' },
      { titulo: 'El kitesurf vive acá', texto: 'La costa de Rio Grande do Norte está entre las mejores del mundo para kitesurf. El viento pega fuerte entre mayo y septiembre.' },
      { titulo: 'Ponta Negra de noche no es de noche', texto: 'La calle de shops y bares de la playa se llena a partir de las 22 h y no baja nunca. Si querés cenar tranquilo, no ahí: a unas cuadras adentro, en el centro.' }
    ]
  },

  'parana': {
    resumen: 'Foz de Iguazú y Curitiba. Las cataratas más grandes del mundo y la ciudad más verde del Brasil.',
    beaches: [],
    comer: [
      { name: 'Prato feito en Foz', tipo: 'Almuerzo', zona: 'Foz', usd: 8, momento: 'Mediodía', nota: 'La ciudad más barata del circuito, porque no es destino de playa sino de naturaleza. Comida simple y abundante.' }
    ],
    tips: [
      { titulo: 'Las cataratas no se ven de un solo lado', texto: 'Un lado son las cataratas y el otro el Parque de las Aves. El ticket único cubre los dos, y un día entero es el mínimo para verlos sin correr.' },
      { titulo: 'Iguazú no es Curitiba', texto: 'Están a 4 horas en el mismo estado. No se ven las cataratas y la ciudad el mismo día sin madrugar mucho.' },
      { titulo: 'Foz no es una ciudad bonita', texto: 'Es una ciudad de tránsito, con malls y una avenida larga. No esperes charm. Lo único que justifica la parada es pasar a las cataratas.' }
    ]
  },

  'paraiba': {
    resumen: 'João Pessoa y la costa. El balneario más barato del nordeste, con la pared de coral más famosa del país.',
    beaches: [
      { name: 'Praia do Tambaba', zona: 'João Pessoa', vibe: 'La playa de las paredes de coral: un acantilado de color a diez metros de la arena. Es la foto del estado y casi nunca hay gente.', cuando: 'Todo el año. Con marea baja el agua baja y el coral queda al descubierto.' },
      { name: 'Bica do Roque', zona: 'Centro de João Pessoa', vibe: 'La playa del centro, con un faro y el mejor atardecer de la costa. Tranquila y larga.', cuando: 'Todo el año, y de las pocas con puesta de sol sobre el mar en el nordeste.' }
    ],
    comer: [
      { name: 'Bolo de rolo', tipo: 'Postre', zona: 'Centro de João Pessoa', usd: 4, momento: 'Cualquier hora', nota: 'La torta de rollo es de Coremas, en el interior del estado, y llega a João Pessoa entera en fila. Se come fría, con queso de leche y un café con ella. Es el postre que identifica a Paraíba.' },
      { name: 'Prato feito paraibano', tipo: 'Almuerzo', zona: 'Centro y barrios', usd: 7, momento: 'Mediodía', nota: 'El negocio local, con carne de cozimento (que se hierve en vez de secarse al sol, al contrario que en Ceará) y pastel de harina. Muy barato.' }
    ],
    tips: [
      { titulo: 'Es el nordeste sin los precios del nordeste', texto: 'João Pessoa tiene playa de ciudad, kitesurf de clase mundial y comida de puerto, y es bastante más barata que Recife o Salvador. La infraestructura hotelera todavía es más chico, así que el alojamiento sale barato también.' },
      { titulo: 'El kitesurf vive acá', texto: 'La costa de Paraíba es de las mejores del mundo para kitesurf, con viento constante. La temporada fuerte va de mayo a septiembre, con viento de mar.' },
      { titulo: 'Cachaça de calidad en vez de vino', texto: 'Paraíba tiene su propia producción de cachaça de caña, que se visita y se prueba en un mismo lugar. Es un plan de medio día distinto al de la Serra Gaucha y bastante más barato.' }
    ]
  },

  'minas-gerais': {
    resumen: 'Belo Horizonte. La ciudad de las torres y la cocina más completa del interior de Brasil. Sin playa y sin naturaleza.',
    beaches: [],
    comer: [
      { name: 'Prato feito mineiro', tipo: 'Almuerzo', zona: 'Centro y Savassi', usd: 8, momento: 'Mediodía', nota: 'El más completo de Brasil: plato, legumbre, espagueti, guarana y postre. Es la mejor relación precio-calidad del interior.' }
    ],
    tips: [
      { titulo: 'Belo Horizonte no es un destino turístico', texto: 'Es una ciudad de negocios de cinco millones de habitantes. Si no tenés un motivo claro, la ciudad no tiene nada que ofrecer. Pero es muy barata y se come muy bien.' },
      { titulo: 'No confundas la región con la ciudad', texto: 'Minas Gerais tiene la mejor cocina del país, pero la mayor parte de esa comida está en BH. Si viniste por la comida, come en la ciudad; el resto de Minas es campo y montaña.' }
    ]
  },

  'buenos-aires': {
    resumen: 'La ciudad más grande de Hispanoamérica. Cultura, milongas, y el mejor café de la región.',
    beaches: [],
    comer: [
      { name: 'Empanada de carne', tipo: 'Merienda', zona: 'Centro y Palermo', usd: 2, momento: 'Cualquiera', nota: 'La clásica: carne cortada a cuchillo a cuchillo. Pide la de carne, no la de pollo, y no la de humita. Media docena en cualquier confiteria del centro es el almuerzo más barato y el más argentino.' },
      { name: 'Parrilla porteña', tipo: 'Cena', zona: 'Palermo y San Telmo', usd: 22, momento: 'Noche', nota: 'La carne más cara de la región, y vale la pena. Un bife de chorizo, milanesa con pure y una chopper, todo por menos de lo que cuesta un vuelo de una hora.' }
    ],
    tips: [
      { titulo: 'El cambio, con tarjeta y en el banco', texto: 'Con tarjeta el cambio es el oficial. El cambio informal de la calle te deja un 20% menos. Para gastar en pesos, retira en un cajero y no en la casa de cambio.' },
      { titulo: 'La noche arranca tarde', texto: 'Cenar a las 21 h es merienda, no cena. Si tenés una sola noche: la milonga arranca a la medianoche y sigue hasta el amanecer. Cenar temprano es el error más caro del viaje.' },
      { titulo: 'El subte es serio', texto: 'La linea H es la única que cruza la ciudad de norte a sur: rápida, segura y te muestra la vida real de un porteño. Se paga con la SUBE, que se compra en cualquier kiosco.' }
    ]
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
  ['beaches', 'comer', 'hacer', 'tips'].forEach(function (seccion) {
    var dePropia = propia[seccion];
    var deRegional = regional[seccion];
    if (Array.isArray(dePropia) && dePropia.length) return;           // la ciudad manda
    if (Array.isArray(dePropia) && !deRegional) return;                // vacio explicito, sin regional
    salida[seccion] = deRegional || dePropia;
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

window.CS_GUIAS = { guias: GUIAS, regiones: REGIONES, guiaPara: guiaPara, cobertura: coberturaGuias, regionSlug: regionSlug, version: CACHE_VERSION };
