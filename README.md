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
│     ├─ busbud.js            Buses: pendiente (por ahora estimado)
│     └─ hotels.js            Hoteles: pendiente (por ahora estimado)
├─ public/                    La web (index.html, style.css, app.js)
│  └─ guiAs.js                Contenido de la Guía Secreta, por destino
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
| Cruce a Buenos Aires, buses y ferry | Estimado (pendiente: Busbud u otra fuente) |
| Alojamiento, comidas, transporte local, traslados, valijas, seguro | Estimado (`lib/model.js`) |

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

## 5. Qué falta para una versión completa

- **Buses y ferry reales:** Busbud da acceso a sus datos a socios; hay que pedirles un convenio. Completá `lib/providers/busbud.js`.
- **Textos legales:** términos y política de privacidad antes de abrirla al público.
- **Idea:** poné un botón de "Quiero que me avisen" con un formulario externo para medir interés.

## Cambiar destinos y estimaciones

Todo está en `lib/model.js`: la lista `DEST` (destinos, códigos de aeropuerto, precios base) y `TIERS` (categorías de alojamiento).
Para agregar un destino, sumá una entrada con su código IATA y sus tipos de transporte.
