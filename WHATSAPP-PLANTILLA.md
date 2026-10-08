# Confirmación de reserva por WhatsApp

Cuando alguien pide reservar traslados o tours (pantalla "Vas a continuar por WhatsApp" → **Abrir WhatsApp**), el servidor le manda un WhatsApp desde el número de CuántoSale con lo que pidió. Endpoint: `POST /api/reserva-whatsapp`.

## 1. Variables de entorno

| Variable | Qué es |
|---|---|
| `WHATSAPP_TOKEN` | Token permanente del usuario del sistema (Meta Business → Usuarios del sistema), con permiso `whatsapp_business_messaging`. |
| `WHATSAPP_PHONE_ID` | ID del número (WhatsApp Manager → Configuración de la API → "Identificador del número de teléfono"). No es el número. |
| `WHATSAPP_TEMPLATE` | Nombre de la plantilla. Por defecto `reserva_recibida`. |
| `WHATSAPP_TEMPLATE_LANG` | Idioma de la plantilla. Por defecto `es`. |

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
