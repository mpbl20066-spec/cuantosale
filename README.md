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
│     ├─ duffel.js            Búsqueda y normalización de vuelos de Duffel
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

Sin `DUFFEL_API_KEY` o `DUFFEL_ACCESS_TOKEN`, el servidor muestra un estado de error controlado en la búsqueda de vuelos; la PWA sigue funcionando con los costos estimados.

## 2. Conectar Duffel (vuelos)

1. Creá un access token en el dashboard de Duffel y guardalo en Vercel como `DUFFEL_API_KEY` (también se acepta `DUFFEL_ACCESS_TOKEN`). Es un secreto de servidor: no uses prefijos `NEXT_PUBLIC_`.
2. Redeployá después de guardar o cambiar el token. Las llamadas usan [Create an Offer Request](https://duffel.com/docs/api/offer-requests), autenticación Bearer y `Duffel-Version: v2`.
3. La aplicación resuelve los códigos IATA de origen y destino con [Places Suggestions](https://duffel.com/docs/api/places/schema) antes de crear la búsqueda. El token no llega al navegador.
4. Conservá `BOOKING_API_KEY` y `BOOKING_API_HOST` por separado: esas variables siguen correspondiendo únicamente a alojamientos.

Las tarjetas conservan la forma de respuesta que usa la interfaz: aerolínea operadora, trayectos, escalas, duración, cabina y tarifa. Solo las ofertas en USD se pueden sumar directamente al presupuesto, cuya moneda base es USD. La búsqueda muestra tarifas; no crea órdenes ni procesa pagos.

### Alojamientos reales de Booking.com / RapidAPI

La aplicación resuelve el destino con `/api/v1/hotels/searchDestination`, consulta `/api/v1/hotels/searchHotels` en `booking-com15.p.rapidapi.com` usando las fechas y pasajeros elegidos, y pide fotos de hoteles cuando la búsqueda no incluye una. Las claves solo se usan en el servidor. Solo se muestran alojamientos con precio e imagen reales de la respuesta; si RapidAPI no devuelve tres resultados completos, pueden aparecer menos de tres en vez de rellenarse con datos de muestra.

Configura en Vercel `BOOKING_API_KEY` y `BOOKING_API_HOST=booking-com15.p.rapidapi.com`. El endpoint de búsqueda se define por defecto en el código; `BOOKING_API_URL` es opcional.

### Tours y experiencias locales

La PWA incluye experiencias referenciales para Río de Janeiro, Florianópolis, Maragogi, Praia do Pipa y Gramado/Canela. Cada ficha abre WhatsApp con el mensaje y los datos del viaje ya preparados (`https://wa.me/?text=...`); al no tener un número comercial configurado, la persona elige el contacto al abrir WhatsApp. Los importes son referenciales y se confirman por asistencia.

### Qué es real y qué es estimado

| Componente | Origen |
|---|---|
| Pasajes de avión desde Montevideo | Duffel cuando el access token está configurado; el presupuesto suma tarifas en USD |
| Cruce a Buenos Aires, buses y ferry | Estimado (pendiente: Busbud u otra fuente) |
| Alojamiento, comidas, transporte local, traslados, valijas, seguro | Estimado (`lib/model.js`) |
| Comparador de fechas | Estimado a partir del precio de tu fecha (para no hacer 15 consultas por búsqueda) |

La API de Duffel permite crear órdenes a partir de una oferta, pero esta integración de CuántoSale se limita a buscar y mostrar tarifas; no reserva ni cobra vuelos.

### Costos y límites de las consultas

- Cada búsqueda puede ejecutar una solicitud por cabina preferida además de resolver origen y destino. Revisá las cuotas y condiciones vigentes de tu organización de Duffel antes de habilitar tráfico público.
- Cada persona puede hacer `RATE_LIMIT_PER_MIN` búsquedas por minuto (30 por defecto).

## 3. Publicarlo en internet

Sirve cualquier hosting que ejecute Node (Render, Railway, Fly.io, un VPS, etc.):

- Comando de inicio: `node server.js`
- Variables de entorno: `DUFFEL_API_KEY` (o `DUFFEL_ACCESS_TOKEN`); para hoteles, `BOOKING_API_KEY` y `BOOKING_API_HOST`
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
