# Confirmación de reserva por WhatsApp

Cuando alguien pide reservar traslados o tours (pantalla "Vas a continuar por WhatsApp" → **Abrir WhatsApp**), el servidor le manda un WhatsApp desde el número de CuántoSale con lo que pidió. Endpoint: `POST /api/reserva-whatsapp`.

## 1. Variables de entorno

| Variable | Qué es |
|---|---|
| `WHATSAPP_TOKEN` | Token permanente del usuario del sistema (Meta Business → Usuarios del sistema), con permiso `whatsapp_business_messaging`. |
| `WHATSAPP_PHONE_ID` | ID del número (WhatsApp Manager → Configuración de la API → "Identificador del número de teléfono"). No es el número. |
| `WHATSAPP_TEMPLATE` | Nombre de la plantilla. Por defecto `reserva_recibida`. |
| `WHATSAPP_WABA_ID` | Opcional. ID de la cuenta de WhatsApp Business. Solo lo usa la prueba del panel para listar las plantillas cuando Meta no encuentra la plantilla; sin esta variable se busca con los permisos del token (necesita `whatsapp_business_management`). |
| `WHATSAPP_TEMPLATE_LANG` | Idioma de la plantilla. Por defecto `es`. Tiene que ser el código exacto con el que se creó: Español = `es`, Español (ARG) = `es_AR`, (ESP) = `es_ES`, (MEX) = `es_MX`. Si no coincide, Meta da el error 132001 y el servidor prueba solo los otros españoles; la prueba del panel dice cuál anduvo. |

Sin `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` el endpoint responde 503 y el flujo sigue funcionando igual (solo se abre el WhatsApp del cliente).

## 2. Plantilla a crear en Meta

WhatsApp Manager → Plantillas de mensajes → Crear. Categoría **Utilidad**, nombre `reserva_recibida`, idioma Español.

**Cuerpo** (las variables son 5, en este orden):

```
Hola {{1}} 👋
¡Gracias por elegirnos!

Confirmamos que recibimos tu solicitud de reserva para los siguientes servicios:

📍 {{2}}
🗓 {{3}}

{{4}}

Total estimado: {{5}}

Te vamos a confirmar disponibilidad y, una vez confirmado, te enviaremos el link de pago para que puedas abonar.

¡Cualquier duda, estamos para ayudarte!
```

Ejemplos que pide Meta para aprobar:

1. `Juan`
2. `Florianópolis`
3. `26 dic. → 2 ene. · 2 personas`
4. `Traslado aeropuerto (Aeropuerto ⇄ alojamiento) + Tour por las playas (Excursión de día completo)`
5. `US$ 125`

Meta no deja saltos de línea dentro de una variable, por eso los servicios van juntos en `{{4}}`, separados por " + ". La tarjeta con la foto de la captura se puede lograr agregando un **encabezado de imagen** a la plantilla (hay que mandar también el componente `header` en el envío).

## 3. Probar

```
curl -X POST http://localhost:3000/api/reserva-whatsapp -H "Content-Type: application/json" -d "{\"nombre\":\"Juan\",\"telefono\":\"+59899123456\",\"destino\":\"Florianópolis\",\"fechas\":\"26 dic. → 2 ene.\",\"personas\":\"2 personas\",\"servicios\":[{\"nombre\":\"Traslado aeropuerto\",\"detalle\":\"Aeropuerto → Canasvieiras\"}],\"total\":\"US$ 125\"}"
```

Mientras la cuenta esté en modo desarrollo, Meta solo permite escribirle a números agregados como destinatarios de prueba.

## Límites

- Por IP: el mismo límite general del servidor.
- Por número: 3 envíos por día.

## Plantilla `pedido_tarifa` (pedir tarifa neta a proveedores)

El link "Pedir tarifa neta (WhatsApp)" del panel la manda por la API: al proveedor nunca le escribimos, así que WhatsApp exige plantilla. Lo que conteste llega a la bandeja de WhatsApp del panel.

WhatsApp Manager → Plantillas de mensajes → Crear. Categoría **Marketing**, nombre `pedido_tarifa`, idioma **Portugués (BR)**. Cuerpo:

```
Olá, {{1}}! Tudo bem?

Somos a CuántoSale (cuantosale.uy), uma plataforma do Uruguai que ajuda viajantes uruguaios e argentinos a planejar e calcular quanto custa uma viagem ao Brasil.

Gostaríamos de oferecer aos nossos clientes estes passeios de vocês: {{2}}.

Vocês trabalham com tarifas para agências (tarifa neta ou comissão)? Poderiam nos enviar a tabela de preços netos, as formas de pagamento e a política de cancelamento?

Muito obrigado!
Equipe CuántoSale
```

Ejemplos para la revisión: `{{1}}` = `5 Amigos Tour`, `{{2}}` = `Bate e volta a Maragogi (Porto de Galinhas); Buggy ponta a ponta (Porto de Galinhas)`.

Variables opcionales en Vercel: `WHATSAPP_TEMPLATE_TARIFA` (por defecto `pedido_tarifa`) y `WHATSAPP_TEMPLATE_TARIFA_LANG` (por defecto `pt_BR`).

## Plantillas de la ficha del pedido (confirmación, seña, saludo y reserva al proveedor)

Los botones de WhatsApp de la ficha del pedido salen por la API (lib/wa-panel.js). Si la persona escribió en las últimas 24 h va el mensaje de siempre como texto; si no, WhatsApp exige plantilla. Todas en categoría **Utilidad**. Los textos tienen que ser exactamente estos (están en `PLANTILLAS` de lib/wa-panel.js).

**`pedido_confirmado`**, Español:

```
Hola {{1}}, recibimos tu solicitud de reserva en CuántoSale.

Viaje: {{2}}
Servicios: {{3}}
Total estimado: {{4}}
Referencia: {{5}}

Te confirmamos la disponibilidad con el proveedor y ahí te pedimos una seña para reservar. Gracias por elegirnos.
```
Ejemplos: `Juan` · `Praia do Rosa · 26 nov. al 3 dic. · 2 personas` · `Paddle en Lagoa de Ibiraquera (2 horas); Avistaje de ballenas (4 horas)` · `US$ 179` · `CS-MV7HTN3-B05A2C`

**`pedir_sena`**, Español:

```
Hola {{1}}, el proveedor confirmó tu reserva en {{2}}.

Para dejarla reservada te pedimos una seña de {{3}}.

Cómo pagar: {{4}}
Referencia: {{5}}

Cuando pagues, respondé este mensaje con el comprobante. El resto se abona antes del viaje.
```
Ejemplos: `Juan` · `Praia do Rosa` · `US$ 45` · `Prex cuenta 361333, a nombre de Maria Batista; Mercado Pago con tarjeta por US$ 47,25 (solo este medio tiene 5 % de recargo)` · `CS-MV7HTN3-B05A2C`

**`retomar_pedido`**, Español:

```
Hola {{1}}, te escribimos de CuántoSale por tu pedido {{2}}. Respondé este mensaje y seguimos con tu reserva por acá.
```
Ejemplos: `Juan` · `CS-MV7HTN3-B05A2C`

**`reserva_proveedor`**, Portugués (BR):

```
Olá, {{1}}! Somos a CuántoSale (cuantosale.uy) e gostaríamos de reservar: {{2}}.

Data: {{3}}
Pessoas: {{4}}
Em nome de: {{5}}
Referência: {{6}}

Poderiam confirmar a disponibilidade? Obrigado!
```
Ejemplos: `Carlos` · `Paddle en Lagoa de Ibiraquera (2 horas)` · `26 nov. al 3 dic.` · `2` · `Juan Pérez` · `CS-MV7HTN3-B05A2C`

Nombres distintos se configuran con `WHATSAPP_TEMPLATE_CONFIRMACION`, `WHATSAPP_TEMPLATE_SENA`, `WHATSAPP_TEMPLATE_RETOMAR` y `WHATSAPP_TEMPLATE_RESERVA_PROV`.

**`sena_recibida`**, Español (Utilidad). Sale al tocar "Registrar seña cobrada" y aceptar el aviso:

```
Hola {{1}}, recibimos tu seña de {{2}} y tu reserva en {{3}} quedó confirmada.

Saldo pendiente: {{4}}, que se abona antes del viaje.
Referencia: {{5}}

Gracias por viajar con CuántoSale.
```
Ejemplos: `Juan` · `US$ 41,18` · `São Paulo` · `US$ 123,52` · `CS-MV7HTN3-B05A2C`

**`pedir_saldo`**, Español (Utilidad). Botón "Pedir saldo por WhatsApp" (aparece con la seña cobrada):

```
Hola {{1}}, te escribimos por el saldo de tu reserva en {{2}}, que se abona antes del viaje: {{3}}.

Cómo pagar: {{4}}
Referencia: {{5}}

Cuando pagues, respondé este mensaje con el comprobante.
```
Ejemplos: `Juan` · `São Paulo` · `US$ 123,52` · `Prex cuenta 361333, a nombre de Maria Batista; Mercado Pago con tarjeta por US$ 129,70 (solo este medio tiene 5 % de recargo)` · `CS-MV7HTN3-B05A2C`

**`saldo_recibido`**, Español (Utilidad). "Registrar saldo cobrado" y aceptar el aviso:

```
Hola {{1}}, recibimos tu pago de {{2}} y tu reserva en {{3}} quedó paga en su totalidad.
Referencia: {{4}}

Buen viaje y gracias por elegir CuántoSale.
```
Ejemplos: `Juan` · `US$ 123,52` · `São Paulo` · `CS-MV7HTN3-B05A2C`

**`pedido_cancelado`**, Español (Utilidad). Al guardar el pedido en estado Cancelado y aceptar el aviso:

```
Hola {{1}}, te confirmamos que tu reserva en {{2}} fue cancelada.
Referencia: {{3}}

Si tenés alguna consulta, respondé este mensaje.
```
Ejemplos: `Juan` · `São Paulo` · `CS-MV7HTN3-B05A2C`

**`servicio_cancelado`**, Español (Utilidad). Al guardar un servicio del pedido en estado Cancelado (con el pedido en pie) y aceptar el aviso:

```
Hola {{1}}, te confirmamos que se canceló de tu reserva en {{2}}: {{3}}.
Nuevo total: {{4}}
Referencia: {{5}}

Si tenés alguna consulta, respondé este mensaje.
```
Ejemplos: `Juan` · `São Paulo` · `City Tour Histórico, Paulista y Liberdade` · `US$ 82,35` · `CS-MV7HTN3-B05A2C`
