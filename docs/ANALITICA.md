# Plan de analítica — CuántoSale (app nueva, `/nuevo`)

Estado auditado en el código el 2026-10-10. Una sola herramienta de producto (GA4, `G-JJSG6WSTYZ`); Clarity se usa solo para
grabaciones y mapas de calor (no duplica eventos) y el script de afiliados es de atribución de ventas, no de uso.

## 1. Cómo se envía hoy

| Pieza | Dónde | Qué hace |
|---|---|---|
| Snippet de medición | `server.js` → `analyticsSnippet()` / `injectAnalytics()` | Se inyecta en todo HTML. Define `gtag`, `track()` y **no carga nada de terceros hasta que la persona acepta** (Consent Mode v2, `cs_consent` en `localStorage`). |
| `mockTrack(nombre, params)` | `public/test/home-track.js` | Agrega `viaje_id` y llama a `track()`. Con `?debug=1` muestra los eventos en pantalla. |
| `data-evento="x"` | atributos HTML | Cada clic en ese elemento manda el evento `x` con el resto de sus `data-*` como parámetros. |
| `vista_pagina` | `home-track.js` | Una vez por carga, con `pagina` (atributo `data-pagina`) y `fuente` (`?fuente=`). |

`viaje_id` (`CS-XXXX-XXXX`, en `sessionStorage`) une todos los eventos de un mismo viaje: es lo que permite medir el embudo
sin identificar a la persona.

## 2. Convención de nombres

`<area>_<accion>` en minúsculas con guion bajo. Áreas existentes: `home_`, `destino_`, `presupuesto_`, `inicio_` (calcular),
`flujo_`, `reserva_`, `guia(s)_`, `detalle_`. Parámetros: `snake_case`, sin espacios, valores cortos (ids, no textos).

Parámetros comunes: `viaje_id`, `fuente`, `destino` (clave, ej. `rio`), `medio` (`avion|auto|bus`), `pax`, `paso`, `total` (USD, entero).

## 3. Embudo principal (conversiones sugeridas en GA4)

| Paso | Evento | Marcar como conversión |
|---|---|---|
| 1. Entra | `vista_pagina` (`pagina=home`) | no |
| 2. Elige camino | `home_camino` | no |
| 3. Elige destino | `destino_elegido` / `inicio_elegir_destino` | no |
| 4. Fechas y personas | `destino_continuar` | no |
| 5. Arma el viaje | `flujo_paso` (`paso=1..4`) | no |
| 6. Ve el presupuesto | `flujo_paso` con `paso=4` | **sí** |
| 7. Guarda el viaje | `flujo_guardar_ok` | **sí** |
| 8. Pide reservar | `reserva_confirmada` / `reserva_cs_solicitud` | **sí** |

Abandono = último `flujo_paso` visto por `viaje_id`. Errores funcionales: usar `flujo_guardar_*` sin `flujo_guardar_ok`
posterior y revisar los `pageerror` de Clarity.

## 4. Reglas para no duplicar ni contaminar

1. **Un evento por acción**: si un botón ya lleva `data-evento`, no llamar además a `track()` en su handler.
2. **Vistas**: `vista_pagina` la manda solo `home-track.js`; las pantallas no deben mandar otro "view" propio (hoy hay `page_view` virtual en `flujo` y `calcular`, que es por paso: se mantiene pero con `page_path`).
3. **Sin datos personales**: nunca nombre, correo, teléfono ni tokens. `flujo_guardar_email` ya no envía el dominio del correo.
4. **Consentimiento**: sin `cs_consent=granted` no sale nada. Los eventos previos al consentimiento quedan en `dataLayer` sin enviarse.
5. **UTM**: GA4 los lee solos (`utm_source`, `utm_medium`, `utm_campaign`); las rutas limpias no los tocan y la redirección 301 los conserva.

## 5. Variantes A/B de la home (diseño, aún sin implementar)

No hay experimento activo. Cuando se necesite:

- **Asignación fuera de la URL**: cookie/`localStorage` `cs_variante` = `A|B`, asignada una vez (50/50) y nunca reasignada.
- **Sin cambiar la ruta pública**: el servidor sirve la misma URL `/` y elige el archivo por la variante; el buscador siempre ve la canónica.
- **Registro**: enviar `variante` como parámetro de usuario en GA4 (`gtag('set','user_properties',{variante})`) para que todas las conversiones queden atribuidas sin duplicar eventos.
- **SEO**: la variante B lleva `rel=canonical` a la misma URL y `noindex` si tuviera URL propia; no se hace cloaking por user-agent.
- **Solo con consentimiento**: sin `granted` se muestra la A y no se registra nada.

## 6. Pendiente

- Crear en GA4 las conversiones de la sección 3 y las dimensiones personalizadas (`destino`, `medio`, `variante`).
- Decidir si `Clarity` se mantiene (mide lo mismo que GA4 para el embudo; aporta grabaciones).
- Agregar un enlace "Preferencias de cookies" en el pie (hay `window.csConsentimiento.abrir()` listo).
