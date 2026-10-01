# CuántoSale

Compará vuelos, buses y alojamiento desde Uruguay y mirá cuánto cuesta REALMENTE el viaje completo.

Es una web con un servidor propio. Requiere Node 18 o superior.

## Qué hay adentro

```
cuantosale/
├─ server.js                  Servidor: API + sirve la web
├─ lib/
│  ├─ model.js                Cálculo de costos, propuestas, ahorros y comparador de fechas
│  └─ providers/
│     ├─ index.js             Agregador de vuelos: cache, dedupe y pausa por cuota
│     ├─ serpapi.js           Vuelos: búsqueda y normalización de Google Flights
│     ├─ (buses)              Buses: estimado (sin proveedor por ahora)
│     └─ hotels.js            Hoteles: Booking.com / RapidAPI
├─ data/
│  ├─ costos-diarios.json     Comida y transporte local por destino (fuente + confianza)
│  ├─ transfer-precios.json   Transfer de aeropuerto por destino (fuente + confianza)
│  └─ distancias-aeropuerto.json  Km reales de OSRM, cacheados
├─ scripts/
│  ├─ build-costos.js         Reparte costos-diarios.json al modelo y al cliente
│  ├─ build-transfer.js       Reparte transfer-precios.json al modelo y al cliente
│  ├─ build-transfer-precios.js  Propone la tabla de transfer desde los anclas y los km
│  ├─ validar-costos.js       Valida costos-diarios.json y sus copias generadas
│  ├─ validar-transfer.js     Valida transfer-precios.json y sus copias generadas
│  ├─ pull-aeropuertos.js     Coordenadas de los 15 aeropuertos, desde OurAirports
│  └─ pull-distancias.js      Km de carretera desde OSRM
├─ public/                    La web (index.html, style.css, app.js)
│  ├─ guiAs.js                Contenido de la Guía Secreta, por destino
│  ├─ daily-costs.js          GENERADO. No editar a mano. Números + procedencia.
│  └─ transfer-precios.js     GENERADO. No editar a mano. Números + procedencia.
├─ test.js                    Pruebas automáticas
├─ .env.example               Plantilla de configuración
└─ package.json
```

## 1. Probarlo en tu computadora (modo demo)

1. Instalá Node.js 18 o superior desde https://nodejs.org
2. En la carpeta del proyecto: `node server.js`
3. Abrí http://localhost:3000

Sin `SERPAPI_API_KEY`, el servidor arranca en modo estimado: la web anda, el buscador de vuelos responde con un aviso controlado y el gráfico de fechas muestra la estimación. No se rompe nada.

## 2. Conectar SerpAPI (vuelos)

1. Creá una cuenta en https://serpapi.com y copiá tu API key del dashboard. Guardala en Vercel (o en tu `.env`) como `SERPAPI_API_KEY`. Es un secreto de servidor: no uses prefijos `NEXT_PUBLIC_`.
2. Redeployá después de guardar o cambiar la key. Las llamadas usan el motor `google_flights` contra `https://serpapi.com/search.json`.
3. Conservá `BOOKING_API_KEY` y `BOOKING_API_HOST` por separado: esas variables siguen correspondiendo únicamente a alojamientos.

Opcionales, con valores por defecto que ya funcionan: `SERPAPI_GL=uy`, `SERPAPI_HL=es`, `SERPAPI_CABIN_COMODO=2`, `SERPAPI_CALENDAR_TTL_H=24`, `SERPAPI_CACHE_MAX=2000`.

### Por qué SerpAPI y no una API de ventas

Duffel, Amadeus Self-Service y Sabre son GDS: emiten boletos y cobran. Además de pedir aprobación, tienen restricciones por mercado, y para este proyecto eso era un bloqueo. SerpAPI no vende nada, no pide aprobación y funciona desde Uruguay.

El costo de esa decisión es explícito: **los precios son reales pero la reserva se completa en Google Flights, no en la web.** No hay comisión por vuelo, no se cobra el pasaje y no hay PNR. El botón de cada tarjeta abre Google Flights con la búsqueda ya cargada.

### Cómo se consume la cuota

Cada búsqueda exitosa es un crédito. Las que fallan no cuentan, y las que SerpAPI tiene cacheadas por una hora son gratis.

| Qué | Créditos |
|---|---|
| Propuesta principal de `/api/cotizar` | 1 |
| Gráfico "mismo viaje, otra fecha" (15 fechas) | 15 |
| Browse de vuelos | 1 |

El browse es de **una sola etapa**: el precio que trae la respuesta ya es el total de ida y vuelta. Se verificó contra la API real — con `outbound_date` + `return_date`, `best_flights[0].price` llega marcado como `type: "Round trip"` y escala exacto con los pasajeros (1 adulto = US$ 249, 2 = US$ 499 en la misma ruta y fechas). Lo que la API **no** devuelve es el tramo de vuelta: `flights[]` viene con un solo segmento, el de ida, y la llamada de vuelta con `departure_token` devuelve cero resultados. Por eso la tarjeta muestra solo el tramo de ida y rotula el precio como "Ida y vuelta".

El cache es lo que hace esto viable. Vive en `lib/providers/index.js` y es **por punto** (ruta, fecha ida, fecha vuelta, pasajeros, cabina) con TTL de 24h, no por serie: dos personas buscando la misma ruta el mismo día comparten casi todos sus puntos. Si el cache fuera por serie, dos búsquedas casi nunca coincidirían y cada visita costaría 15 créditos.

Planes de SerpAPI: 250 búsquedas/mes gratis, luego USD 25 por 1.000. El plan desde USD 150 agrega el *Legal Shield*; no hace falta para arrancar si los precios se presentan como estimación con atribución a Google y link de salida.

### Un detalle que costó un bug: el código de aeropuerto

`model.DEST[...].iata` a veces es el código de la **ciudad** y no del aeropuerto: `rio` vale `RIO` y `sao` vale `SAO`, que no son aeropuertos sino áreas metropolitanas. Con Duffel no pasaba nada porque resolvía el lugar por nombre, pero SerpAPI busca por código de aeropuerto y con `RIO` devuelve una respuesta **vacía y sin error**. La app caía a estimado en silencio, sin una sola línea en los logs, y Río y São Paulo — los dos destinos más buscados — nunca mostraban precio real.

Por eso todo lo que consulta vuelos resuelve el destino con `airportFor()`, que usa `AIR_DESTINATIONS` primero y el modelo después. Hay un test que lo fija: si alguien vuelve a usar `model.DEST[...].iata` para buscar vuelos, falla la suite.

### Alojamientos reales de Booking.com / RapidAPI

La aplicación resuelve el destino con `/api/v1/hotels/searchDestination`, consulta `/api/v1/hotels/searchHotels` en `booking-com15.p.rapidapi.com` usando las fechas y pasajeros elegidos, y pide fotos de hoteles cuando la búsqueda no incluye una. Las claves solo se usan en el servidor. Solo se muestran alojamientos con precio e imagen reales de la respuesta; si RapidAPI no devuelve tres resultados completos, pueden aparecer menos de tres en vez de rellenarse con datos de muestra.

Configura en Vercel `BOOKING_API_KEY` y `BOOKING_API_HOST=booking-com15.p.rapidapi.com`. El endpoint de búsqueda se define por defecto en el código; `BOOKING_API_URL` es opcional.

El `dest_id` que devuelve `searchDestination` se cachea en memoria por host y por nombre (`bookingDestIdCache`): es un id de ciudad, no un precio, así que no cambia. Consultarlo en cada consulta de hoteles era gastar una llamada de más por render, y lo que fallaba peor era que la consulta falla de a ratos —cuando eso pasa el destino entero cae al respaldo de hoteles inventados aunque las fechas y el tipo estén bien. Solo se cachean los aciertos: un fallo puede ser del proveedor o del throttle, y cachearlo dejaría un destino roto para el resto de la vida del proceso.

#### Los seis tipos de alojamiento, y por qué la sección nunca arranca vacía

Al abrir un destino la app elige sola el tipo de alojamiento a partir del estilo de viaje: `ahorro` → económico, `eq` → intermedio, `comodo` → confort (`hotelTypeForStyle`). De ahí vienen los tres tipos del **espectro** —`economico`, `intermedio`, `confort`—, que no son categorías sino bandas de precio: el mismo hotel puede ser uno u otro según cuánto cueste, y `hotelEsDelTipo()` los acepta a todos sin mirar nada. Los otros tres —`boutique`, `resort`, `all-inclusive`— son categorías cerradas, y por eso no admiten sustitución: un loft no es un resort por barato que sea.

Esa distinción es la que sostiene la promesa de que la sección de alojamiento siempre muestra algo:

- **El server nunca devuelve una lista vacía para un tipo del espectro.** La primera pasada pide la banda ajustada, la segunda relaja el precio y completa con cualquier hotel real por debajo del techo de 1,6, y si todavía falta, el respaldo genérico llena hasta tres.
- **`tiposDisponibles` tiene que coincidir con eso.** Es la lista que el `<select>` ofrece y con la que el cliente corrige el tipo elegido si no está. Antes se calculaba con la banda ajustada, que es más estricta que la selección, así que el server podía devolver tres hoteles de tipo `confort` y a la vez declarar que `confort` no era un tipo disponible en ese destino. El cliente cambiaba a `economico` y después filtraba las tres tarjetas por `hotelType === "economico"`: la lista quedaba en cero y en pantalla se leía *"Hoteles para viajar intermedio"* con el selector en *Económico* y *"No encontramos alojamientos de categoría Intermedio"*. Medido antes del arreglo: 9 de 60 combinaciones destino × estilo.
- **El cliente resuelve el tipo una sola vez y antes de calcular nada.** `resolveHotelTypeForMeta()` corre al principio de `hotelOptions()`, así que el título, la insignia, la nota, el mensaje de lista vacía, el selector y el filtro de tarjetas hablan todos del mismo tipo. Antes la corrección vivía dentro de `hotelTypeSelectMarkup()`, que se llama al final y mutaba `meta.hotelType` después de que el perfil ya estuviera calculado.
- **`hotelesQuePasanElTipo()` es el respaldo del respaldo.** Si el filtro de tipo deja todo afuera en un tipo del espectro, se muestran los hoteles igual y se avisa por consola: el server ya los eligió por precio, así que una lista vacía ahí no sería una respuesta sino un desajuste. En los tipos estrictos no se rellena nada, porque el estado vacío dice que no se muestran categorías distintas como reemplazo y tiene que ser cierto.

`test-hoteles.js` (`npm run check:hoteles`) recorta esas tres funciones del `public/app.js` real y las prueba, incluida una guarda que falla si `hotelTypeSelectMarkup` vuelve a escribir `meta.hotelType` o si `hotelOptions` calcula el perfil antes de resolver el tipo. `test.js` cubre del lado del servidor que el tipo devuelto siempre esté declarado como disponible, que los tres tipos del espectro devuelvan tres con un solo hotel cargado, y que un tipo estricto sin datos no se declare ni se rellene.

### Transfer desde el aeropuerto

`data/transfer-precios.json` es la fuente de verdad del precio del transfer. `npm run build:transfer` la reparte a `TRANSFER_PRICES` en `lib/model.js` (la que cotiza el server) y a `public/transfer-precios.js` (la que dibuja las cards). `npm run check:transfer` la valida.

**El problema que vino a resolver.** El precio estaba en tres lugares y los tres decían una cosa distinta:

| Dónde | Valor | Unidad |
|---|---|---|
| Cards en `public/app.js` | 30 / 150 | por viaje, escritos a mano |
| `getSelectedTransferAmount()` | 30 / 150 | repetidos a mano |
| `transferConfig()` en `server.js` | `OFFICIAL_TRANSFER_PRICE_USD` (35) | por **pasajero** |

Para dos personas el asistente decía 70 y la card decía 30. Y los tres eran iguales para los 44 destinos, lo cual no puede ser: de GIG a Río hay 18 km y de GIG a Búzios hay 174 por la RJ-124.

**La semántica que se fijó**, porque antes estaba mezclada:

- `compartido`: USD por **persona**, solo ida.
- `privado`: USD por **vehículo** de hasta 4 personas, solo ida. No se multiplica por los pasajeros.
- `appRideUsd`: precio de un pedido de Uber/99 por vehículo, cuando se pudo verificar. No es un transfer (no hay meet & greet). Va en su propio campo porque meterlo como si fuera el privado lo subestimaba a menos de la mitad.

**Cómo se investigó.** Por aeropuerto, no por destino: los 44 destinos cuelgan de solo **15 aeropuertos de llegada**, y el precio es función de (aeropuerto → hotel), no del nombre del destino.

| Dato | De dónde sale |
|---|---|
| Coordenadas de los 15 aeropuertos | OurAirports (dominio público), con `npm run pull:aeropuertos` |
| Km de carretera aeropuerto → destino | OSRM (`router.project-osrm.org`), cacheados en `data/distancias-aeropuerto.json`, con `npm run pull:distancias` |
| Precios | Búsqueda web, con la fuente escrita en el `fuente` de cada destino |

**Cuánta confianza hay, sin adornos.** De 88 celdas (44 destinos × 2 modalidades), **5 tienen un precio publicado**: el compartido de Río, Búzios e Ilha Grande, y el privado de São Paulo. Las otras 83 salen de un modelo de distancia calibrado contra esos precios:

```
compartido = 18 + 0,06 * km      (por persona)
privado    = 12 + 0,62 * km      (por vehículo, con piso de 1,6x el compartido)
```

El compartido casi no crece con la distancia, y los datos lo confirman: entre GIG→Río (18 km, US$ 22) y GIG→Búzios (174 km, US$ 29) hay 156 km de diferencia y 7 dólares de precio. Lo que se paga es el chofer y el vehículo, que se reparten entre los pasajeros. **El 94% de la tabla sigue siendo estimación y está marcado como tal**: `confianza: 'baja'` con la derivación escrita en la fila. Para mostrar un precio como real, tiene que haber un precio real.

**Un bug de código de aeropuerto que salió en el camino.** `AIR_DESTINATIONS` en `server.js` dice que `fernando` llega por **NVT**. NVT es el aeropuerto de Navegantes, en Santa Catarina, a 2.900 km de la isla; el código de Fernando de Noronha es **FEN**. Es el mismo tipo de error que el README documenta para `RIO` y `SAO`. La tabla de transfer usa FEN y hay un test que lo fija, pero **el arreglo en `AIR_DESTINATIONS` está pendiente**: la búsqueda de vuelos a Fernando de Noronha sigue apuntando a Santa Catarina.

**Destinos sin carretera.** `ilha` (ferry desde Río o Angra) y `fernando` (vuelo desde REC) llevan un `modo` que no es `car`, y la UI no les ofrece una van. Antes se les ofrecía igual que a Río, que no existe. `soloPrivado` marca los que no tienen traslado compartido.

### Tours y experiencias locales

`toursFor()` decide qué se muestra y es la única fuente: la lista local de `LOCAL_TOURS`, con precio estimado. Estuvo tres escalones —la API B2B que daba el precio de la fecha, un catálogo curado de afiliado, y la lista local al final— y los tres se servían sin reemplazarse entre sí. Civitatis se fue del proyecto (provider, endpoint y catálogo), así que las actividades vuelven a ser orientación y no una reserva: la card rotula "Precio referencial" y el mensaje de WhatsApp dice que el precio es estimado y lo confirma quien lo tome.

La card es horizontal, con la foto a la izquierda y la ficha a la derecha: título, ubicación, estrellas con reseñas (solo si el origen las trae), las etiquetas "Incluye / No incluye" que se sacan del texto de detalle, el precio y las acciones. `tourIncludes()` no inventa: si la frase no está en el detalle, la etiqueta no aparece.

### El checkout: un botón, un pedido

**Hay un solo botón de reservar en la app** y está en el panel "Mi Viaje", arriba de "Ver mi presupuesto". No hay uno en la sección de actividades ni en la de transfer. La app llegó a tener tres: el de la cabecera de actividades, el de transfer y el "Coordinar" del voucher, con tres formularios distintos para la misma acción. Con dos pedidos posibles, tenerlos separados obligaba a recordar en cuál de las dos secciones estabas, y el error era fácil.

El botón se habilita solo cuando hay algo para reservar, y su etiqueta dice qué: "Reservar 2 actividades", "Reservar transfer", "Reservar actividades y transfer". Con nada elegido sale apagado y dice "Elegí algo para reservar", que es mejor que un botón encendido que no abre nada. El total que muestra al lado es el de **lo que se reserva**, no el del viaje: son dos cifras distintas y confundirlas sería el error más caro de la pantalla.

La tarjeta de cada actividad se elige entera: el checkbox va estirado sobre la ficha, así que un clic en cualquier punto la agrega al viaje y el marco ámbar dice que ya está. No hay botón "Agregar" por tarjeta —agregaba y abría el checkout, o sea que era otro camino al mismo pedido y obligaba a recordar en qué sección estabas—. El pedido sale del botón de "Mi Viaje".

Reservar abre un checkout de tres pasos dentro de `#booking-modal`, con el mismo reparto de las agencias de viaje: un resumen del viaje fijo a la izquierda (`checkoutAside()`) y el paso a la derecha.

**Un checkout y un pedido que puede tener las dos cosas.** No es "actividades o transfer": si elegiste dos actividades y un transfer, van en el mismo mensaje. Dos mensajes obligarían a la persona a hacer dos pedidos con dos conversaciones para el mismo viaje, y el operador que los atiende es el mismo.

| Paso | Qué pide | Función |
|---|---|---|
| 1 | Título, nombre, apellido, documento, fecha de nacimiento, nacionalidad, email, teléfono, dirección. Con transfer, además el hotel de destino | `checkoutPanelDatos()` |
| 2 | Con qué medio de pago le resulta cómodo pagar | `checkoutPanelPago()` |
| 3 | Recap y confirmación | `checkoutPanelListo()` |

`checkoutPedido()` es la única fuente de lo que hay para reservar: la usan el botón para decidir si se habilita, el aside para pintar las filas y el mensaje de WhatsApp para listarlas. Tres funciones leyendo el estado por su cuenta, y la primera que se desactualice muestra un pedido vacío.

#### El transfer no tiene horario hasta que el operador lo dice

La app derivaba una hora de la llegada del vuelo y proponía "1 hora después", con tres chips para ajustarla y un campo para escribir otra. Todo eso se fue, y no solo de la pantalla: se fue de la fila de "Mi Viaje", del voucher y del mensaje de WhatsApp.

El motivo es que **esa hora no existe**. El transfer no tiene horario hasta que el operador lo confirma, y una app que propone 15:20 sin saber si el vuelo llega a tierra a esa hora está inventando el dato más importante del traslado —el que decide si alguien puede tomarte en el aeropuerto—. El mensaje de WhatsApp termina pidiendo disponibilidad, horario y punto de encuentro, que es la pregunta real. En la sección queda una línea que dice que el horario se coordina al reservar, y en el recap una fila que dice "A coordinar con el operador": ningún documento de la app da por hecho algo que todavía no está acordado.

**El total del checkout no se calcula: se lee.** `checkoutTransferLine()` llama a `getSelectedTransferAmount()`, que es la misma función que usan "Mi Viaje", el desglose y el voucher. Mira el **total** y no el precio unitario, porque el estado puede quedar desactualizado: si marcaste "compartido" en Río y después cambiaste el destino a uno sin van compartida, `transferType` sigue diciendo `'shared'` y la tabla ya no tiene compartido. Sin esa comprobación entraba una línea de R$ 0 en el pedido.

Y el privado no se parte entre los que viajan: el aside dice "2 personas" y nada más, en vez de inventar un precio por persona de un auto que es uno solo.

El hotel de destino sí se pregunta, en el paso 1, con el que elegiste en alojamiento ya escrito: casi siempre es el mismo y dejarlo en blanco hace que la gente no avance.

#### El paso 2 no cobra y no dice que cobra

El aviso está escrito en la pantalla, arriba de la grilla de medios de pago, porque un botón que dice "Pagar" y no paga es la misma mentira que el README prohíbe para los precios. `CHECKOUT_PAYMENTS` lista los bancos uruguayos (BROU, Santander, BBVA, Scotiabank, OCA, Prex) y tres tarjetas; el paso 3 manda el pedido armado por WhatsApp, que es lo que ya hacía `toursWhatsappUrl()` pero con los datos del viajero y la referencia del pedido adentro.

Los logos de los bancos no se suben al repo: se referencian por URL de Wikimedia Commons y, si la imagen falla, aparece el nombre de la marca pintado en su color. Es el mismo criterio que ya se tomó con las fotos de los tours.

El estado vive en `checkoutState` y se reinicia con cada viaje nuevo (`renderDetalle`), porque los datos de un viajero que quedaron del pedido anterior no son del viaje nuevo.

`node test-checkout.js` corre las cinco combinaciones del checkout —las dos cosas juntas, solo actividades, solo transfer privado, nada elegido, y un destino sin van compartida— sobre los totales, el aside, el panel de datos, el recap y el mensaje de WhatsApp, con las funciones reales extraídas de `app.js` y las dependencias simuladas. Es lo que impide que un cambio en un pedido rompa el otro: las dos ramas comparten el mismo DOM y el mismo código, y un error ahí no se ve como error de sintaxis sino como un checkout que manda la mitad del pedido.

### Guía Secreta: cuándo se abre

**Se abre cuando la persona entra a Booking desde el hotel que eligió.** Es el clic en "Ver opciones" de una ficha de hotel real.

Antes el token de la guía viajaba en la respuesta de `/api/hoteles`, con la sola condición de que algún hotel viniera de Booking (`source === 'booking'`). Con eso la guía se abría **al ver precios**: cualquiera que abriera un destino con la API configurada la tenía, sin tocar nada.

Ahora son dos pasos:

| Paso | Qué pasa |
|---|---|
| `GET /api/guia/token?dest=X` | Emite un token firmado de 30 min. Falla cerrado sin `GUIA_TOKEN_SECRET` ni `BOOKING_API_KEY` |
| `GET /api/guia?dest=X&token=T` | Devuelve la guía. 403 sin token válido, y un token de un destino no abre otro |

El cliente los pide en cadena desde `abrirGuiaPorReserva()`, que solo corre con el click del hotel. El token vive en memoria, no en `localStorage`: es una credencial de 30 minutos y guardarla en disco sería lo que el token evita.

**Lo que esto NO verifica:** que la persona haya reservado. La app abre Booking en otra pestaña y no se entera sola de si la compra se completó — Booking no avisa al sitio. El click es la señal más fuerte que el navegador puede observar.

**Para el "reservado de verdad" está el postback de Travelpayouts** (`POST /api/travelpayouts/postback`), que es lo único que confirma una venta. Marca el rubro `alojamiento` con `confirmado: true` en `reservas_viaje`, y como vive en la base, la guía sigue abierta aunque la persona vuelva al día siguiente. Requiere:

1. Poner esa URL en el panel de Travelpayouts (proyecto → postback).
2. Que el link de hotel lleve el `viaje_id` dentro del marker; con el marker estático actual el postback llega pero no se correlaciona con un viaje y solo queda en el log.

Mientras no se configure, el producto funciona: el click cubre el estado "quiero reservar".

### Guía Secreta

`public/guias.js` tiene el contenido por destino. Se resuelve en tres pasos y se corta en el primero que existe:

1. `GUIAS[destKey]` — guía de ciudad (hoy `fln` y `sao`)
2. `REGIONES[dest.region]` — guía regional, con la región tomada de `DEST[]` en `lib/model.js`
3. `null` — sin guía. La vista lo dice, no muestra otra ciudad

El paso 3 es el que corrige un bug: antes la lista caía siempre en la de Florianópolis, así que Gramado, Canela, Torres, Maragogi, Porto de Galinhas y Buenos Aires veían "buscá prato executivo en el centro de Florianópolis". Un destino sin guía escrita muestra un estado vacío; uno mal escrito hace cruzar el país.

**Ciudad y regional se mezclan, no se reemplazan.** `mezclarGuia()` combina sección por sección: la ciudad gana donde define algo, la regional aporta lo que la ciudad no menciona. Sin esto, la guía de Gramado perdía el aviso de la regional sobre el clima de la Serra, que sigue siendo cierto. Un `beaches: []` explícito sí gana a la regional, que es lo correcto para una ciudad sin playa.

Las regiones se comparan en **slug** y no con el nombre de `DEST[]`: "Ceará" y "Ceara" son dos strings distintas, y comparar contra el nombre crudo hacía fallar en silencio para 8 de 13 regiones sin que nada se quejara. `regionSlug()` normaliza en los dos lados, igual que `inferHotelType` en `app.js`.

**Secciones:** `beaches`, `atracciones`, `comer`, `hacer`, `tips`, más `temporada` y `resumen`. `atracciones` y `hacer` están separadas a propósito: si se empieza y termina en menos de una hora es atracción, si hay que reservar media jornada es un plan. Mezcladas no se puede responder "tengo dos horas, qué hago".

**No hay sección de tours a propósito.** En `app.js` hay 111 tours escritos, y la guía los volvería a escribir. La guía pide los tours al render con `toursFor()`, la misma función que usa la sección de experiencias: una sola lista y un solo lugar donde se rotula el precio.

Con la estructura actual, 13 guías regionales cubren los 44 destinos. Agregar una guía de ciudad es sumar una entrada; agregar una región es cubrir un estado entero sin tocar nada más.

**Cómo se escribe contenido nuevo.** En texto plano primero y con revisión a mano, después un script lo pasa a objetos. Escribir la prosa directo en el `.js` salió varias veces con palabras de otro idioma y frases sin sentido, y eso solo se detecta leyendo. Las fotos se verifican contra la **descripción** del archivo en Commons, no contra el nombre: hay homónimos ("São Francisco do Sul" a 300 km, "Praia do Forte do Cão" en Portugal) y licencias restringidas a Brasil (`CC BY-SA 2.0 br`).

El schema y las reglas de contenido están documentados en la cabecera del archivo.

### Qué es real y qué es estimado

| Componente | Origen |
|---|---|
| Pasajes de avión desde Montevideo | Google Flights vía SerpAPI cuando hay `SERPAPI_API_KEY`; el presupuesto suma tarifas en USD |
| Comparador de fechas ("mismo viaje, otra fecha") | Precio real de vuelo por fecha cuando el punto se pudo consultar; estimado en los puntos que fallaron |
| Alojamiento | Booking.com / RapidAPI, con tarifa y foto reales |
| Tours | **Estimado** (`LOCAL_TOURS` en `public/app.js`); la card lo rotula "Precio referencial" |
| **Transfer de aeropuerto** | **5 de 88 celdas con precio publicado** (`data/transfer-precios.json`); el resto sale de un modelo de distancia con km reales de OSRM y está marcado `confianza: 'baja'` |
| Cruce a Buenos Aires, buses y ferry | Estimado (sin proveedor por ahora) |
| Comidas, transporte local, valijas, seguro | Estimado (`lib/model.js` y `data/costos-diarios.json`) |

El gráfico de fechas mezcla las dos cosas a propósito, pero las marca: las barras con precio real van sólidas y las estimadas con borde punteado, y el subtítulo dice cuántas de las N fechas son reales. Un precio inventado presentado como real sería peor que no mostrar el gráfico.

### "De dónde salen los valores" (se quitó de la pantalla)

El desglose dice **cuánto** va a cada rubro. Debajo hubo un panel en `<details>` que decía **de qué** sale cada número: el proveedor del que salió, la fecha de verificación y cuánta confianza tenía. **Ya no se dibuja.** Era el único consumidor de la procedencia en el cliente, así que se fueron con él `fuentesPanel()`, `fuentesDe()`, `fuenteBadge()`, `getDailyCostsProvenance()`, `getTransferProvenance()` y las reglas `.fuentes*` / `.fuente-fila*` / `.conf-*` de `public/style.css`.

Lo que **no** se fue es la procedencia en los datos: `npm run build:costos` y `npm run build:transfer` siguen emitiendo `CS_DESTINATION_DAILY_COSTS_PROVENANCE` y `CS_TRANSFER_PRICES_PROVENANCE` en el mismo archivo generado, y `validar-costos.js` y `validar-transfer.js` la siguen validando. En `lib/model.js` y en `data/*.json` el `fuente`, el `confianza`, el `verificado` y el `derivacion` de cada destino siguen siendo la fuente de verdad. Lo que cambió es que hoy no se muestran en la web: si el panel vuelve, el trabajo de datos está hecho.

**Por qué se quitó.** Ocupaba el lugar entre el desglose y los hoteles, que es donde están las decisiones que hacen avanzar el viaje, y empujaba hacia abajo las secciones que sí convierten. Un "estimado" a secas no deja decidir nada, pero la respuesta estaba costingiendo el recorrido completo.

**Lo que la calculadora de costos todavía no hace:** editar un rubro o agregar un margen, que es lo que hace la calculadora de Noma. Editar tiene que entrar por `getBudgetBreakdown()` (`public/app.js`), que es la única función que suma el total, para que un cambio mueva a la vez el número grande, el desglose, "A dónde va tu plata" y el voucher que se comparte.

### Dos paradas, en los dos sentidos

El control "¿Sumás una segunda parada?" ofrece **95 pares**, y un par va en los dos sentidos.

**El filtro miraba una sola parada.** Cada par se escribe una vez en `DESTINATION_GROUPS`, con `key` = primera parada y `secondKey` = segunda, y el filtro comparaba el destino elegido **solo** contra `key`. El resultado era asimétrico y era el bug reportado: con Destino = Natal aparecía "Natal + Fortaleza" y con Destino = Fortaleza el menú se abría vacío con *"Desde Fortaleza no hay combinaciones de dos paradas"*. La misma ruta, en un sentido sí y en el otro no.

**La lista de datos no se duplicó.** Lo que se invierte es la lectura:

| Función | Qué hace |
|---|---|
| `comboPasaElFiltro()` | pasa el par si el destino elegido es **cualquiera** de las dos paradas |
| `comboInvertido()` | dice si hay que leerlo al revés (el destino elegido es la segunda parada) |
| `comboLabel()` | el nombre del par en el orden en que se va a cotizar, y es el único que lo arma |
| `chooseCombo()` | al elegir un par invertido manda la segunda parada del dato como `secondKeyForzado` |
| `selectDestination(…, secondKeyForzado)` | con ese argumento, `S.second` no se deduce del nombre sino de la opción elegida |

El server ya sabía ir en cualquier orden: cotiza con `?dest=` y `?second=` y la combinabilidad la decide `model.comboTransfer()`, que mira la geografía y es simétrica. El problema era solo de la lista. `prueba-pares.js` tiene un punto 8 que evalúa las cuatro funciones reales contra los 190 sentidos de los 95 pares.

**"Fortaleza / Jericoacoara" eran dos ciudades con una barra.** Son 358 km una de la otra, con costos, traslados y actividades propias, y el nombre no decía a cuál de las dos pertenecía el precio. Ahora son dos destinos y un par: **Fortaleza** sola, **Jericoacoara** sola y **"Fortaleza + Jeri"** como viaje de dos paradas. Jericoacoara ya estaba en `DEST` con costos, traslados, guía y actividades: lo que no estaba era en la lista, o sea que era data que nadie podía cotizar. Pasó también a `HOME_DESTINATION_KEYS` en `server.js`.

**Jericoacoara NO se sommó a las `keys` del Nordeste.** El modelo combina dos paradas a menos de `COMBO_MAX_KM` (1.100 km) por carretera: de Fortaleza a Jeri son 358, pero de Recife a Jeri son 1.100 y de Maceió 1.170. Un grupo es el conjunto de destinos que se combinan entre sí, así que Jeri va en grupo propio y solo ofrece los tres pares que se pueden cotizar (con Fortaleza, Natal y Pipa). Por eso `prueba-pares.js` ya **no** compara el total contra `C(n,2)`: ese cálculo da por hecho que todo par de un grupo se puede cotizar, que es falso, y obligaba a ofrecer combinaciones que el server rechaza con un 400. Ahora el total se cuenta con `comboTransfer()`.

### El calendario no pasa de un año

`maxDepartureDate()` es `hoy + 1 año` con `setFullYear`, y es el último día habilitable. El motivo: a esa altura el precio del vuelo sale del modelo, y `/api/vuelos/calendario` compara 15 fechas alrededor de la elegida, que a dos años caen todas fuera de cualquier temporada real. El tope se aplica a los dos pasos (ida y vuelta), la flecha de "mes siguiente" se apaga en el mismo límite —si no, se puede scrollear hasta un mes entero de días tachados— y el panel lo dice por texto en `[data-calendar-limit]`, porque una grilla con la última fila en gris no explica por qué no se puede seguir.

### El tema sigue al sistema

`prefers-color-scheme` manda **hasta que alguien toca el botón**, y después manda la elección. El bug era que `aplicarTema()` escribía siempre en `localStorage` y la llamaba también el arranque: con solo abrir la página en un celular en claro se guardaba `'light'`, y a partir de ahí la app dejaba de seguir al sistema para siempre. Ahora `aplicarTema(t, guardar)` solo escribe cuando `guardar` es `true`, y lo único que lo pasa es el click. Hay un listener de `change` sobre la media query para que el tema cambie en vivo al pasar el celular de claro a oscuro.

`scripts/validar-tema.js` lo vigila: que exista `aplicarTema(t, guardar)`, que **un solo** lugar pase `true` (si el arranque o el listener guardaran, vuelve el bug) y que al menos uno pase `false`.

### Endpoints

| Ruta | Qué hace | Costo |
|---|---|---|
| `GET /api/cotizar` | Propuesta recomendada + serie de fechas estimada | 1 crédito |
| `GET /api/vuelos/calendario` | Precio real de vuelo de las 15 fechas vecinas | 15 créditos |
| `POST /api/vuelos/buscar` | Browse de vuelos (el precio ya es total de ida y vuelta) | 1 crédito |

`/api/vuelos/calendario` devuelve 200 con `puntos: []` cuando no hay credenciales, y también cuando falla: es una mejora sobre la estimación, nunca la única fuente. Un fallo nunca rompe la pantalla de resultados.

### Costos y límites de las consultas

- El contador de cuota es de SerpAPI, no de la app. Es el número que hay que mirar antes de habilitar tráfico público.
- Cada persona puede hacer `RATE_LIMIT_PER_MIN` búsquedas por minuto (30 por defecto), y los endpoints caros tienen cubos separados de los gratuitos.
- **Límite conocido:** el cache y el rate limit viven en la memoria del proceso. En Vercel cada instancia es efímera, así que dos instancias distintas no comparten cache: el mismo precio puede pagarse dos veces si la petición cae en otra instancia.

## 3. Publicarlo en internet

Sirve cualquier hosting que ejecute Node (Render, Railway, Fly.io, un VPS, etc.):

- Comando de inicio: `node server.js`
- Variables de entorno: `SERPAPI_API_KEY`; para hoteles, `BOOKING_API_KEY` y `BOOKING_API_HOST`
- El puerto lo define el hosting con `PORT`; el servidor ya lo lee.

## 4. Pruebas

`node test.js` corre pruebas del modelo de costos y el servidor. Las búsquedas reales usan la suscripción de RapidAPI y consumen la cuota del plan; las pruebas locales no deben consumirla.

`npm run test:guias` corre la prueba de humo de la Guía Secreta: rompe el código a propósito, una vez por cada regresión que de verdad ocurrió, y verifica que `test.js` la marque. No toca la red ni consume cuota.

Conviene correrla después de tocar `public/guias.js` o `public/app.js`. Los dos bugs más caros de esa parte fueron silenciosos: renombrar `d.region` a `d.región` dejaba la cobertura de guías en 0 sin tirar error, y renombrar la clave `cuando` a `cuándo` hacía que el render recibiera `undefined` y desapareciera la línea "Cuándo" de las 19 playas. Un test que no falla cuando tiene que fallar no sirve de nada, y por eso el humo existe.

### Tablas de datos y sus validadores

| Comando | Qué hace |
|---|---|
| `npm run build:todo` | Reparte las dos tablas al modelo y al cliente (`prestart` y `pretest` lo corren) |
| `npm run check:todo` | Valida las dos tablas y que las copias generadas estén al día |
| `npm run pull:aeropuertos` | Descarga OurAirports e imprime las coordenadas de los 15 aeropuertos |
| `npm run pull:distancias` | Consulta OSRM y cachea los km de carretera en `data/distancias-aeropuerto.json` |
| `npm run pull:transfer` | Regenera `data/transfer-precios.json` desde los anclas y los km cacheados |

`validar-transfer.js` no es decorativo: durante este trabajo lo hizo fallar cinco veces y cada falla era un error real. Vale la pena correrlo después de tocar la tabla. Entre otras cosas, comprueba que el privado nunca salga más barato que el compartido, que todo destino de carretera tenga km, que los que no la tienen declaren `ferry` o `vuelo`, y que no haya números de transfer escritos a mano en `public/app.js`.

## 5. Qué falta para una versión completa

- **Buses y ferry reales:** Sin proveedor por ahora. Si se integra una fuente, viviría en `lib/providers/`.
- **~~Arreglar `AIR_DESTINATIONS` para `fernando`~~:** Ya arreglado. El código ahora es `FEN` (Fernando de Noronha). Antes decía `NVT` (Navegantes, Santa Catarina).
- **Bajar los precios de transfer del modelo:** 83 de 88 celdas salen de la fórmula de distancia. Cada vez que se encuentre una tarifa publicada, se agrega el ancla a `ANCHORS` en `scripts/build-transfer-precios.js` con su fuente, se corre `npm run pull:transfer` y `npm run build:transfer`, y la celda pasa de `confianza: 'baja'` a `media`.
- **Cobrar de verdad:** el checkout pide los datos del viajero y el medio de pago preferido, pero no cobra. Hoy cierra por WhatsApp. Sumar una pasarela real es un proyecto aparte: hay que elegir proveedor, firmar contrato, guardar el pedido en el servidor, manejar el webhooks de confirmación y devolución, y decidir quién es el merchant of record, porque el precio se pacta con cada operador y no con nosotros.
- **Los datos del checkout no se guardan:** `checkoutState` vive en memoria y se reinicia al cambiar de viaje. Si hay que recordarlos entre visitas, van a `localStorage` (siguen siendo de la persona, no salen del navegador) o al backend, y ese backend es el mismo que hace falta para cobrar.
- **Textos legales:** términos y política de privacidad antes de abrirla al público.
- **Idea:** poné un botón de "Quiero que me avisen" con un formulario externo para medir interés.

### Un detalle que costó una hora de depuración

Los archivos generados se cargan **sin `?v=`**: `/daily-costs.js`, `/transfer-precios.js`, `creditos-fotos.generated.js`. `style.css` y `app.js` sí llevan versión, y el server los sirve con `immutable` de un año, así que subir el número en `index.html` es obligatorio en cada cambio de esos dos.

Los que no llevan versión se sirven con `no-cache`, pero eso obliga a revalidar y el server no manda `ETag` ni `Last-Modified`: el navegador igual puede quedarse con la copia vieja. Cuando `./app` arranca con el error `Falta la procedencia en /daily-costs.js` y `npm run build:costos` dice que todo está al día, el problema es caché del navegador, no el archivo.

## Cambiar destinos y estimaciones

`DEST` y `TIERS` están en `lib/model.js`. Para agregar un destino, sumá la entrada con su código IATA y sus tipos de transporte, y después:

1. Sumalo a `data/costos-diarios.json` (comida y transporte local) y a `data/transfer-precios.json` (transfer del aeropuerto), con `fuente`, `verificado` y `confianza`.
2. Si es un destino nuevo, aggregate su coordenada a `DEST_COORDS` en `lib/model.js` — sin ella no se puede coticar el traslado entre paradas ni medir la distancia al aeropuerto.
3. `npm run pull:distancias` para guardar los km desde OSRM, y `npm run build:todo` para repartir.
4. `npm run check:todo` y `npm test`.

Los tres validadores (`validar-costos.js`, `validar-transfer.js` y `prueba-destinos.js`) están para que un destino agregado a medias se note al instante, no tres meses después.
