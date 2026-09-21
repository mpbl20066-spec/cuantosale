# CuántoSale

Compará vuelos, buses y alojamiento desde Uruguay y mirá cuánto cuesta REALMENTE el viaje completo.

Es una web con un servidor propio. **No tiene dependencias**: solo necesita Node 18 o superior.

## Qué hay adentro

```
cuantosale/
├─ server.js                  Servidor: API + sirve la web
├─ lib/
│  ├─ model.js                Cálculo de costos, propuestas, ahorros y comparador de fechas
│  └─ providers/
│     ├─ duffel.js            Precios reales de vuelos (Duffel)
│     ├─ index.js             Caché, límites y armado de consultas de vuelos
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

Sin token de Duffel funciona en **modo demo**: todos los precios son estimaciones y la web lo aclara.

## 2. Conectar Duffel (precios reales de vuelos)

1. Creá tu cuenta en https://duffel.com y generá un token de acceso en el panel de desarrolladores.
   Los tokens de prueba (`duffel_test_...`) usan datos simulados; para precios de aerolíneas reales
   hace falta un token de producción (`duffel_live_...`), y Duffel puede pedirte completar la
   habilitación de la cuenta antes.
2. Copiá `.env.example` como `.env` y pegá el token en `DUFFEL_TOKEN=`.
3. Reiniciá el servidor: `node server.js`. En la consola vas a ver "vuelos reales con Duffel".

Cómo se usa el token: **solo el servidor lo conoce**. La web le pide los datos al servidor
(`/api/cotizar`) y nunca ve la clave. No subas el archivo `.env` a GitHub (ya está en `.gitignore`).

### Qué es real y qué es estimado

| Componente | Origen |
|---|---|
| Pasajes de avión (Montevideo y saliendo por Buenos Aires) | **Real**, de Duffel: la oferta más barata en clase económica, ida y vuelta, por persona |
| Cruce a Buenos Aires, buses y ferry | Estimado (pendiente: Busbud u otra fuente) |
| Alojamiento, comidas, transporte local, traslados, valijas, seguro | Estimado (`lib/model.js`) |
| Comparador de fechas | Estimado a partir del precio de tu fecha (para no hacer 15 consultas por búsqueda) |

Cada propuesta indica en pantalla si el pasaje es real o estimado. Si Duffel falla o no encuentra
ofertas, la app **no se rompe**: cae a la estimación de ese pasaje.

Una limitación a tener en cuenta: la búsqueda pide precio para 1 pasajero y se multiplica por la
cantidad de viajeros. En grupos, la disponibilidad de asientos y el precio por persona pueden variar.

### Costos y límites de las consultas

- Cada búsqueda nueva (destino + fechas) hace hasta 2 consultas a Duffel (una desde Montevideo y otra desde Buenos Aires).
- Los precios se recuerdan `QUOTE_TTL_MIN` minutos (60 por defecto) para no repetir consultas.
- Si Duffel responde "demasiadas consultas" (429), el servidor deja de consultar 30 segundos y usa estimaciones.
- Cada persona puede hacer `RATE_LIMIT_PER_MIN` búsquedas por minuto (30 por defecto).
- **Antes de lanzar**, revisá en la página de precios de Duffel cómo cobran las búsquedas y las reservas, y sus límites de uso.

## 3. Publicarlo en internet

Sirve cualquier hosting que ejecute Node (Render, Railway, Fly.io, un VPS, etc.):

- Comando de inicio: `node server.js`
- Variable de entorno: `DUFFEL_TOKEN` (y las otras de `.env.example` si querés cambiarlas)
- El puerto lo define el hosting con `PORT`; el servidor ya lo lee.

## 4. Pruebas

`node test.js` corre 15 pruebas: parseo y pedido a Duffel, modelo de costos, validaciones, servidor
y el comportamiento cuando Duffel falla. No hacen llamadas reales (usan respuestas simuladas).

## 5. Qué falta para una versión completa

- **Buses y ferry reales:** Busbud da acceso a sus datos a socios; hay que pedirles un convenio. Completá `lib/providers/busbud.js`.
- **Hoteles reales:** conectá una API o programa de afiliados de alojamiento en `lib/providers/hotels.js`.
- **Botón "Reservar":** Duffel permite crear reservas, pero eso exige pedir datos de pasajeros, cobrar y cumplir sus requisitos. No está incluido.
- **Textos legales:** términos y política de privacidad antes de abrirla al público.
- **Idea:** poné un botón de "Quiero que me avisen" con un formulario externo para medir interés.

## Cambiar destinos y estimaciones

Todo está en `lib/model.js`: la lista `DEST` (destinos, códigos de aeropuerto, precios base) y `TIERS` (categorías de alojamiento).
Para agregar un destino, sumá una entrada con su código IATA y sus tipos de transporte.
