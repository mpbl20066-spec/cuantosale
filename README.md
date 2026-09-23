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
│     ├─ skyscrapper.js       Búsqueda de vuelos en Sky Scrapper / RapidAPI
│     ├─ busbud.js            Buses: pendiente (por ahora estimado)
│     └─ hotels.js            Hoteles: pendiente (por ahora estimado)
├─ public/                    La web (index.html, style.css, app.js)
├─ test.js                    Pruebas automáticas
├─ .env.example               Plantilla de configuración
└─ package.json
```

## 1. Probarlo en tu computadora (modo demo)

1. Instalá Node.js 18 o superior desde https://nodejs.org
2. En la carpeta del proyecto: `node server.js`
3. Abrí http://localhost:3000

Sin `FLIGHT_RAPIDAPI_KEY`, el servidor muestra un estado de error controlado en la búsqueda de vuelos; la PWA sigue funcionando con los costos estimados.

## 2. Conectar Sky Scrapper (vuelos en RapidAPI)

1. Suscribí el proyecto a **Sky Scrapper** en RapidAPI y comprobá en Code Snippets que el host sea `sky-scrapper.p.rapidapi.com`.
2. En Vercel, agregá `FLIGHT_RAPIDAPI_KEY` como variable secreta del servidor. Opcionalmente define `FLIGHT_RAPIDAPI_HOST`; por defecto usa `sky-scrapper.p.rapidapi.com`. También se aceptan `RAPIDAPI_KEY` / `RAPIDAPI_HOST` para proyectos que ya los tengan configurados.
3. Mantén `BOOKING_API_KEY` y `BOOKING_API_HOST` separadas para la integración de hoteles. Las credenciales nunca se exponen al navegador.
4. Redeployá la aplicación después de guardar las variables. La búsqueda usa `searchAirport` para resolver los identificadores requeridos antes de llamar a `searchFlights`; la resolución queda en memoria cuando el runtime conserva la instancia.

La tarifa se puede agregar al presupuesto cuando la API devuelve un precio en USD. Si la respuesta incluye un enlace de Skyscanner aprobado por el proveedor, se muestra “Ver opciones en Skyscanner”. La API de RapidAPI proporciona datos de búsqueda; no implica por sí sola que exista un enlace afiliado ni aprobación de Travelpayouts.

### Alojamientos reales de Booking.com / RapidAPI

La aplicación resuelve el destino con `/api/v1/hotels/searchDestination`, consulta `/api/v1/hotels/searchHotels` en `booking-com15.p.rapidapi.com` usando las fechas y pasajeros elegidos, y pide fotos de hoteles cuando la búsqueda no incluye una. Las claves solo se usan en el servidor. Solo se muestran alojamientos con precio e imagen reales de la respuesta; si RapidAPI no devuelve tres resultados completos, pueden aparecer menos de tres en vez de rellenarse con datos de muestra.

Configura en Vercel `BOOKING_API_KEY` y `BOOKING_API_HOST=booking-com15.p.rapidapi.com`. El endpoint de búsqueda se define por defecto en el código; `BOOKING_API_URL` es opcional.

### Tours y experiencias locales

La PWA incluye experiencias referenciales para Río de Janeiro, Florianópolis, Maragogi, Praia do Pipa y Gramado/Canela. Cada ficha abre WhatsApp con el mensaje y los datos del viaje ya preparados (`https://wa.me/?text=...`); al no tener un número comercial configurado, la persona elige el contacto al abrir WhatsApp. Los importes son referenciales y se confirman por asistencia.

### Qué es real y qué es estimado

| Componente | Origen |
|---|---|
| Pasajes de avión desde Montevideo | Sky Scrapper en RapidAPI cuando la clave y la suscripción están activas; el presupuesto suma tarifas en USD |
| Cruce a Buenos Aires, buses y ferry | Estimado (pendiente: Busbud u otra fuente) |
| Alojamiento, comidas, transporte local, traslados, valijas, seguro | Estimado (`lib/model.js`) |
| Comparador de fechas | Estimado a partir del precio de tu fecha (para no hacer 15 consultas por búsqueda) |

La compra se completa en el proveedor de reserva enlazado por la respuesta. La API de vuelos no garantiza enlaces de afiliado; Travelpayouts permanece como integración legacy sin usarse en la búsqueda activa.

### Costos y límites de las consultas

- Sky Scrapper aplica las cuotas del plan activo de RapidAPI. Cada búsqueda puede ejecutar consultas por cabina además de resolver los aeropuertos; verificá límites y precio del plan en RapidAPI antes de habilitar tráfico público.
- Cada persona puede hacer `RATE_LIMIT_PER_MIN` búsquedas por minuto (30 por defecto).

## 3. Publicarlo en internet

Sirve cualquier hosting que ejecute Node (Render, Railway, Fly.io, un VPS, etc.):

- Comando de inicio: `node server.js`
- Variables de entorno: `FLIGHT_RAPIDAPI_KEY` y opcionalmente `FLIGHT_RAPIDAPI_HOST`; para hoteles, `BOOKING_API_KEY` y `BOOKING_API_HOST`
- El puerto lo define el hosting con `PORT`; el servidor ya lo lee.

## 4. Pruebas

`node test.js` corre pruebas del modelo de costos y el servidor. Las búsquedas reales usan la suscripción de RapidAPI y consumen la cuota del plan; las pruebas locales no deben consumirla.

## 5. Qué falta para una versión completa

- **Buses y ferry reales:** Busbud da acceso a sus datos a socios; hay que pedirles un convenio. Completá `lib/providers/busbud.js`.
- **Textos legales:** términos y política de privacidad antes de abrirla al público.
- **Idea:** poné un botón de "Quiero que me avisen" con un formulario externo para medir interés.

## Cambiar destinos y estimaciones

Todo está en `lib/model.js`: la lista `DEST` (destinos, códigos de aeropuerto, precios base) y `TIERS` (categorías de alojamiento).
Para agregar un destino, sumá una entrada con su código IATA y sus tipos de transporte.
