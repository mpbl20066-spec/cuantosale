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
│     ├─ civitatis.js         Tours: precio real de la fecha que se está mirando
│     ├─ busbud.js            Buses: pendiente (por ahora estimado)
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
│  ├─ daily-costs.js          GENERADO. No editar a mano.
│  └─ transfer-precios.js     GENERADO. No editar a mano.
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

### Transfer desde el aeropuerto

`data/transfer-precios.json` es la fuente de verdad del precio del transfer. `npm run build:transfer` la reparte a `TRANSFER_PRICES` en `lib/model.js` (la que cotiza el server) y a `public/transfer-precios.js` (la que dibuja las cards). `npm run check:transfer` la valida.

**El problema que vino a resolver.** El precio estaba en tres lugares y los tres decían una cosa distinta:

| Dónde | Valor | Unidad |
|---|---|---|
| Cards en `public/app.js` | 30 / 150 | por viaje, escritos a mano |
| `getSelectedTransferAmount()` | 30 / 150 | repetidos a mano |
| `transferConfig()` en `server.js` | `OFFICIAL_TRANSFER_PRICE_USD` (35) | por **pasajero** |

Para dos personas el wizard decía 70 y la card decía 30. Y los tres eran iguales para los 44 destinos, lo cual no puede ser: de GIG a Río hay 18 km y de GIG a Búzios hay 174 por la RJ-124.

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

La PWA incluye experiencias referenciales para Río de Janeiro, Florianópolis, Maragogi, Praia do Pipa y Gramado/Canela. Cada ficha abre WhatsApp con el mensaje y los datos del viaje ya preparados (`https://wa.me/?text=...`); al no tener un número comercial configurado, la persona elige el contacto al abrir WhatsApp. Los importes son referenciales y se confirman por asistencia.

### Guía Secreta

`public/guias.js` tiene el contenido por destino. Se resuelve en tres pasos y se corta en el primero que existe:

1. `GUIAS[destKey]` — guía de ciudad (hoy `fln` y `sao`)
2. `REGIONES[dest.region]` — guía regional, con la región tomada de `DEST[]` en `lib/model.js`
3. `null` — sin guía. La vista lo dice, no muestra otra ciudad

El paso 3 es el que corrige un bug: antes la lista caía siempre en la de Florianópolis, así que Gramado, Canela, Torres, Maragogi, Porto de Galinhas y Buenos Aires veían "buscá prato executivo en el centro de Florianópolis". Un destino sin guía escrita muestra un estado vacío; uno mal escrito hace cruzar el país.

**Ciudad y regional se mezclan, no se reemplazan.** `mezclarGuia()` combina sección por sección: la ciudad gana donde define algo, la regional aporta lo que la ciudad no menciona. Sin esto, la guía de Gramado perdía el aviso de la regional sobre el clima de la Serra, que sigue siendo cierto. Un `beaches: []` explícito sí gana a la regional, que es lo correcto para una ciudad sin playa.

Las regiones se comparan en **slug** y no con el nombre de `DEST[]`: "Ceará" y "Ceara" son dos strings distintas, y comparar contra el nombre crudo hacía fallar en silencio para 8 de 13 regiones sin que nada se quejara. `regionSlug()` normaliza en los dos lados, igual que `inferHotelType` en `app.js`.

**Secciones:** `beaches`, `atracciones`, `comer`, `hacer`, `tips`, más `temporada` y `resumen`. `atracciones` y `hacer` están separadas a propósito: si se empieza y termina en menos de una hora es atracción, si hay que reservar media jornada es un plan. Mezcladas no se puede responder "tengo dos horas, qué hago".

**No hay sección de tours a propósito.** En `app.js` hay 111 tours escritos y encima el catálogo de Civitatis con el precio de la fecha que está mirando el usuario. Escribirlos también en la guía los convertiría en precio estimado, que es justo lo que Civitatis vino a reemplazar. La guía pide los tours al render con `toursFor()`, la misma función que usa la sección de experiencias.

Con la estructura actual, 13 guías regionales cubren los 44 destinos. Agregar una guía de ciudad es sumar una entrada; agregar una región es cubrir un estado entero sin tocar nada más.

**Cómo se escribe contenido nuevo.** En texto plano primero y con revisión a mano, después un script lo pasa a objetos. Escribir la prosa directo en el `.js` salió varias veces con palabras de otro idioma y frases sin sentido, y eso solo se detecta leyendo. Las fotos se verifican contra la **descripción** del archivo en Commons, no contra el nombre: hay homónimos ("São Francisco do Sul" a 300 km, "Praia do Forte do Cão" en Portugal) y licencias restringidas a Brasil (`CC BY-SA 2.0 br`).

El schema y las reglas de contenido están documentados en la cabecera del archivo.

### Qué es real y qué es estimado

| Componente | Origen |
|---|---|
| Pasajes de avión desde Montevideo | Google Flights vía SerpAPI cuando hay `SERPAPI_API_KEY`; el presupuesto suma tarifas en USD |
| Comparador de fechas ("mismo viaje, otra fecha") | Precio real de vuelo por fecha cuando el punto se pudo consultar; estimado en los puntos que fallaron |
| Alojamiento | Booking.com / RapidAPI, con tarifa y foto reales |
| Tours | Civitatis, con el precio de la fecha que está mirando el usuario |
| **Transfer de aeropuerto** | **5 de 88 celdas con precio publicado** (`data/transfer-precios.json`); el resto sale de un modelo de distancia con km reales de OSRM y está marcado `confianza: 'baja'` |
| Cruce a Buenos Aires, buses y ferry | Estimado (pendiente: Busbud u otra fuente) |
| Comidas, transporte local, valijas, seguro | Estimado (`lib/model.js` y `data/costos-diarios.json`) |

El gráfico de fechas mezcla las dos cosas a propósito, pero las marca: las barras con precio real van sólidas y las estimadas con borde punteado, y el subtítulo dice cuántas de las N fechas son reales. Un precio inventado presentado como real sería peor que no mostrar el gráfico.

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

- **Buses y ferry reales:** Busbud da acceso a sus datos a socios; hay que pedirles un convenio. Completá `lib/providers/busbud.js`.
- **Arreglar `AIR_DESTINATIONS` para `fernando`:** dice `NVT` (Navegantes, Santa Catarina) cuando el código de la isla es `FEN`. La tabla de transfer ya usa `FEN` y hay un test que lo fija, pero la búsqueda de vuelos sigue mandando a la provincia equivocada.
- **Bajar los precios de transfer del modelo:** 83 de 88 celdas salen de la fórmula de distancia. Cada vez que se encuentre una tarifa publicada, se agrega el ancla a `ANCHORS` en `scripts/build-transfer-precios.js` con su fuente, se corre `npm run pull:transfer` y `npm run build:transfer`, y la celda pasa de `confianza: 'baja'` a `media`.
- **Textos legales:** términos y política de privacidad antes de abrirla al público.
- **Idea:** poné un botón de "Quiero que me avisen" con un formulario externo para medir interés.

## Cambiar destinos y estimaciones

`DEST` y `TIERS` están en `lib/model.js`. Para agregar un destino, sumá la entrada con su código IATA y sus tipos de transporte, y después:

1. Sumalo a `data/costos-diarios.json` (comida y transporte local) y a `data/transfer-precios.json` (transfer del aeropuerto), con `fuente`, `verificado` y `confianza`.
2. Si es un destino nuevo, aggregate su coordenada a `DEST_COORDS` en `lib/model.js` — sin ella no se puede coticar el traslado entre paradas ni medir la distancia al aeropuerto.
3. `npm run pull:distancias` para guardar los km desde OSRM, y `npm run build:todo` para repartir.
4. `npm run check:todo` y `npm test`.

Los tres validadores (`validar-costos.js`, `validar-transfer.js` y `prueba-destinos.js`) están para que un destino agregado a medias se note al instante, no tres meses después.
