# Historias de "Cómo funciona"

> **Las 4 placas ya están renderizadas** en `outputs/historias/out/`, en 1080x1920, listas para subir. Con `npm run historias` se rehacen. El detalle del build está en [`outputs/historias/README.md`](outputs/historias/README.md).

Es el mismo guion de las 4 placas del carrusel, adaptado a **historias**, que no es un carrusel puesto en vertical. Lo que cambia y por qué está abajo, porque casi todo lo que hay que revisar está en esa lista.

---

## Lo que cambia de un carrusel a una historia

1. **Una idea por pantalla, y corta.** En el feed la gente puede mirar dos veces. En la historia, 5 segundos y pasa sola. La placa 2 del carrusel tenía 35 palabras: en stories son dos bloques de 12.
2. **La zona segura es chica.** En 1080x1920, Instagram tapa arriba ~250 px (foto de perfil, hora, barras de progreso) y abajo ~430 px (caja de respuesta, fila de stickers, "deslizar para arriba"). El centro se ve; los bordes no. En un carrusel 1:1 no existe este problema.
3. **Se tapan entre sí.** Un sticker de encuesta encima del texto tapa el texto, no el sticker. Por eso el build mide las cajas y avisa: sin eso, el error se ve recién en el teléfono.
4. **El sticker va en la historia, no en la imagen.** El recuadro punteado de los PNG es una guía de ubicación: el sticker real lo ponés vos en la app, después de subir la imagen. Si subís el PNG "limpio", el hueco queda vacío y parece un error de diseño.
5. **La 4 no tiene barra de progreso.** Instagram muestra las barras de los primeros 3 segmentos. Por eso la última lleva contador propio y su gancho, en vez de ser la coletilla de la tercera.

---

## Las cuatro placas

| # | Idea | Fondo | Qué se ve en pantalla | Elemento |
|---|---|---|---|---|
| 1 | El gancho: el que organiza el viaje | Foto de viaje | `¿Viajás en grupo?` / `Organizarse nunca fue tan fácil.` | Flecha de "deslizá" |
| 2 | El modelo híbrido: quién reserva y quién coordina | Diseño, dos filas | `Vos reservás. Nosotros coordinamos.` + vuelo/hotel y traslados/tours | **Encuesta** |
| 3 | La diferencia: dividir gastos | Maqueta de la pantalla de reparto | `¡Dividí el total automático!` + saldos del grupo | **Emoji** |
| 4 | Asesoría y cierre | Fondo azul de marca | `Estamos con vos antes, durante y después.` + 3 pasos | **Link** |

Los textos exactos están en [`outputs/historias/_build/placas.html`](outputs/historias/_build/placas.html). Para cambiar una palabra, se edita ahí y se corre `npm run historias`; no hay que tocar el PNG a mano.

---

## Los stickers, en el orden

| Placa | Sticker | Texto exacto | Por qué ahí |
|---|---|---|---|
| 2 | Encuesta | **¿Sos el que organiza todo el viaje?**<br>`Sí, siempre 🙋‍♂️` / `¡Por suerte existe esto! 🙌` | Entre la nota y la franja de abajo, y con hueco de sobra: abajo de 1490 px el sticker queda partido. |
| 3 | Emoji | 🪙 o 🔥 | Es el único hueco libre de la placa. Un emoji grande al lado del total partido. |
| 4 | Link | `cuantosale.uy` | Debajo del botón, no dentro. El botón es diseño; el que abre el navegador es el sticker. |

**Si tu cuenta no tiene el sticker de link**, la placa 4 no pierde el CTA: el botón amarillo ya dice "Armá tu viaje en cuantosale.uy" y el Repartido lleva la URL. Publicala igual.

---

## Antes de subir (10 minutos)

- [ ] **Grabá un grupo real y probá la división antes de anunciar la placa 3.** Es la única placa que promete algo que la persona va a tocar en los 5 segundos siguientes. Creá un grupo, sumá dos gastos y mirá que los saldos cierren. Si `/grupo` no te carga, no publiques: es el que más se comparte y el que más se reclama después.
- [ ] **Cambiá la maqueta de la placa 3 por una foto real de tu celular** si podés. La que va ahora es una maqueta: los textos y los saldos son los de la app, pero el dibujo no es la pantalla. Va en `_build/fotos/` y se cambia el `div.mock` por un `<img>`.
- [ ] **La foto de la placa 1** es una de `outputs/historias-50/`. Si tenés una con amigos de verdad, va mejor: el gancho es "viajás en grupo" y la imagen tiene que mostrar el grupo.
- [ ] **Grabá las placas como video de 5 s cada una** si querés que la gente las vea dos veces. El PNG alcanza, pero la story en video retiene distinto. Sin audio: los 3 segundos los permiten.
- [ ] **Subí las 4 juntas y en ese orden.** Publicadas sueltas, la 2 pierde el "vos reservás / nosotros coordinamos" y la 4 pierde el contexto.

---

## Lo que hay que revisar antes de publicar el texto

Tres cosas del guion original. Dos son de la app y una es del formato. Ninguna es un detalle de redacción: son promesas.

### 1. "Reservás directo en las plataformas (Booking / Aerolínea) al mejor precio"

**El vuelo no va a la aerolínea: va a Google Flights.** En el presupuesto, el botón es "Reservar vuelo" y abre Google Flights con la búsqueda armada; el alojamiento abre Booking. Decir "aerolínea" hace pensar que hay una integración que no está.

**"Al mejor precio" no se puede sostener.** No hay forma de probarlo, y es el tipo de frase que un comentario termina desmontando.

Lo que sí es verdad y además juega a favor: lo pagás vos, directo, sin intermediarios. La placa 2 dice eso.

### 2. "Operadores locales de confianza en destino"

Esta es la que más importa. En la app, traslados y tours aparecen como canal **"Gestión directa"** y el botón dice **"Coordinar"** / **"Reservar tours"**: la reserva sale de un checkout y se termina por WhatsApp. El propio catálogo interno (`public/tours.html`) dice "el precio es referencial: no hay operador que reserve, el pedido se confirma por WhatsApp". Y el mensaje que arma la app para el asesor termina preguntando *"¿Los coordinan ustedes o necesito pedirlo por acá?"*, que es una pregunta abierta, no un compromiso.

O sea: **no hay una red de operadores que la app pueda hoy prometer**. Si la hay y funciona, la placa 2 dice la verdad, pero confirmala antes. Si todavía no está, la línea correcta es "los coordinás con nosotros por WhatsApp", que es exactamente lo que el producto hace hoy y no promete nada que después haya que sostener.

Es la diferencia entre una historia que retiene y una que genera un reclamo de alguien a quien le pidió un transfer y no llegó.

### 3. "Cada uno ve lo que puso, lo que le toca y lo que quedó a deber"

Esta está bien: es literalmente lo que muestra la pantalla de saldos. Pero en la maqueta de la placa 3 hay un detalle que no es real y conviene saber: la fila de "Vos" dice **+ $ 5.000** y las otras tres deben $ 11.667. Con 100.000 entre 6 personas, el reparto exacto da 16.666,67 y la app no muestra un "+5.000" porque el saldo depende de quién pagó qué y de los pagos ya saldados. Está para que se vea el contraste entre lo que uno puso y lo que le toca, que es el punto de la placa. Si preferís que los números cierren solos con un ejemplo de 6 filas, se cambia en `_build/placas.html` y se rehace.

---

## Piezas de publicación

**Caption:**

> Armed el viaje vos o se encargo alguien del grupo? En cuanto sale van los cuatro.
> 1. Cotizás el viaje completo: vuelo, hotel, traslados, comida y lo que vas a gastar en destino.
> 2. El vuelo y el hotel los reservás vos, directo en Google Flights y Booking. Los traslados y los tours los coordinamos nosotros por WhatsApp.
> 3. Armás un grupo, cada uno suma lo que pagó y la app calcula quién le debe qué a quién.
> 4. Y si te trabás, hay una persona contestando.
> contanos en comentarios 👇

**Hashtags:** `#viajesengrupo #presupuestodeviaje #dividircuentas #viajes #cuantosale`

**Comentario fijado:**

> El reparto es aritmética exacta y no cobra comisión: entre 6, cada uno paga su parte exacta y la app ignora los pagos ya saldados, así que no te vuelve a pedir plata. Vuelo y alojamiento son precios reales consultados para tus fechas; comidas, transporte local y traslados son referencia y estimación, marcados como tales dentro de la app. Armá tu viaje en cuantosale.uy

**Repartido:** la URL sola, `cuantosale.uy`. En stories el Repartido compite con el sticker de link de la última placa: si hay que elegir, el link.

---

## Después de publicar

- **Contá los votos de la encuesta de la placa 2.** "Sí, siempre" vs "¡Por suerte existe esto!" es la mejor encuesta posible acá: las dos respuestas suman para la marca, y la segunda es la que genera comentarios de gente que quiere probarlo.
- **Respondé el primer "¿de dónde sale ese número?"** con la fuente. El que pregunta por el número es el cliente ideal.
- **Si alguien comenta "yo no sé dividir",** respondé con el link del grupo. Es el momento de venta más barato que vas a tener.

---

## Si solo tenés tiempo para subir dos

**La 3 y la 2**, en ese orden. La 3 es lo que se comparte (es un producto, no un anuncio) y la 2 es lo que explica por qué la usan. La 1 y la 4 sostienen la marca, pero no se comparten igual.
