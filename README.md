# CuántoSale

Compará vuelos, ómnibus y alojamiento desde Uruguay, armá el presupuesto completo y reservá.
Web con servidor propio, **sin dependencias**: solo Node 18 o superior.

## Cómo reserva la gente

| Qué | Cómo se reserva | Quién cobra |
|---|---|---|
| **Vuelos** | Botón "Reservar vuelo": el servidor crea una sesión de **Duffel Links** y manda a la persona al checkout de Duffel (búsqueda, tarifa, pasajeros y pago). Al terminar vuelve a `/gracias.html` con su código de reserva. | Duffel. Vos podés sumar una comisión (`DUFFEL_MARKUP_*`). |
| **Hoteles** | Botón "Reservar en Booking": lleva a la página de esa propiedad en Booking.com, con tus fechas, viajeros y **tu ID de afiliado**. | Booking.com. Vos cobrás comisión de afiliado. |
| **Seguro** | Enlace configurable (`INSURANCE_URL_TEMPLATE`). | Tu socio o aseguradora. |

Todos los botones abren en una pestaña nueva (`target="_blank" rel="noopener noreferrer"`) y CuántoSale
queda abierto como centro de control. Tras el clic, el botón pasa a "✓ Enlace visitado".

### Por qué así (y qué no incluye)
- **No manejamos datos de pasajeros ni de tarjetas.** El pago y los datos personales se cargan en Duffel o en Booking.com.
  Eso evita los requisitos de seguridad de pagos (PCI) y la responsabilidad legal de vender pasajes vos mismo.
- **Reservar dentro de esta app** (crear órdenes con la API de Duffel o `/orders/create` de Booking) es posible, pero exige:
  formularios de pasajeros, cobro (Duffel Payments u otro), cumplir las condiciones de cada aerolínea, cambios y cancelaciones,
  y, en Booking, una habilitación aparte ("buscar, mirar y reservar"). No está incluido.
- **Duffel Links no se puede prellenar** con la búsqueda que hizo la persona (según su documentación): la modal le indica qué
  buscar (ruta, fechas, viajeros). El precio final lo define Duffel y puede diferir del que mostramos.
- **Duffel Links requiere** que tu organización de Duffel esté en un país compatible con Duffel Payments. Confirmalo con
  Duffel antes de lanzar. Si la sesión falla, el servidor redirige al enlace de `FLIGHT_URL_TEMPLATE` (o a Google Flights).

## Qué hay adentro

```
cuantosale/
├─ server.js                  API, redirecciones de reserva y archivos de la web
├─ lib/
│  ├─ model.js                Costos, estilos de viaje, hoteles y fechas
│  └─ providers/
│     ├─ duffel.js            Precios de vuelos, Duffel Links, órdenes, referencias firmadas
│     ├─ hotels.js            Booking.com Demand API: búsqueda, detalles y enlaces de reserva
│     ├─ busbud.js            Ómnibus y ferry (precio estimado; enlaces configurables)
│     ├─ insurance.js         Seguro (precio estimado; enlace configurable)
│     ├─ booking.js           Armado de enlaces con plantillas y ID de afiliado
│     └─ index.js             Caché, límites y armado de consultas
├─ public/                    index.html, style.css, app.js, gracias.html/.js, logo.svg
├─ scripts/booking-cities.js  Busca el ID de ciudad de Booking.com
├─ test.js                    30 pruebas automáticas
├─ .env.example               Todas las variables
└─ package.json
```

## Puesta en marcha

1. `node server.js` y abrí http://localhost:3000. Sin claves funciona en **modo demo** (precios estimados).
2. Copiá `.env.example` como `.env` y completá lo que tengas.

### Duffel (vuelos)
- `DUFFEL_TOKEN`: precios reales en la búsqueda. Sirve un token de prueba, pero usa datos simulados.
- Para reservar con Duffel Links: `PUBLIC_BASE_URL` (tu URL pública) y `SESSION_SECRET` (texto largo al azar).
- Tu comisión: `DUFFEL_MARKUP_AMOUNT` y/o `DUFFEL_MARKUP_RATE` (mirá cómo los aplica Duffel en su guía de Links).

### Booking.com (hoteles)
- `BOOKING_API_KEY` y `BOOKING_AFFILIATE_ID`.
- Por defecto busca por aeropuerto cercano. Para buscar por ciudad (más preciso):
  `node scripts/booking-cities.js br florian` te muestra el ID y lo cargás en `BOOKING_CITY_IDS={"fln": <id>}`.
- Cada búsqueda muestra hasta 2 propiedades por categoría (económico, intermedio y confort, según estrellas),
  con el precio total de la estadía en US$. Si Booking falla o no devuelve una categoría, se muestran estimaciones.
- El `url` de cada propiedad viene de Booking con tu ID de afiliado; no lo modifiques.

### Antes de lanzar
- Duffel: probá el flujo completo en su modo de prueba y confirmá país, comisiones y cómo cobran las búsquedas.
- Booking: confirmá en tu panel que tu cuenta permite "buscar, mirar y redirigir a reservar" y las condiciones de uso de precios.
- Sumá términos y condiciones y política de privacidad. Avisá en pantalla que los precios pueden cambiar y que la reserva se hace en sitios de terceros.
- Confirmaciones: hoy se muestran en `/gracias.html`. Para producción conviene sumar los webhooks de Duffel y una base de datos.

## Cálculo en pantalla
El servidor devuelve componentes (transportes, hoteles, seguro, estilos y fechas) y el navegador arma el total en tiempo real:
transporte + alojamiento + comidas (según estilo) + transporte local y traslados + seguro.
Estilos: Mochilero, Estándar y Confort. Qué es real y qué es estimado se marca en cada tarjeta.

## Publicarlo
Cualquier hosting de Node (Render, Railway, Fly.io o un VPS): comando `node server.js` y las variables del `.env`.
Usá HTTPS (`PUBLIC_BASE_URL` con `https://`).

## Pruebas
`node test.js` (30 pruebas con respuestas simuladas; no hacen llamadas reales).
