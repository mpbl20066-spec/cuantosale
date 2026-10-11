'use strict';
/* Envio de la plantilla de WhatsApp (reserva_recibida) por la Cloud API de Meta.
   Meta exige el codigo de idioma exacto con el que se creo la plantilla: "Español" es "es", pero "Español (ARG)" es
   "es_AR", "(ESP)" es "es_ES" y "(MEX)" es "es_MX". Con el codigo equivocado responde el error 132001 ("Template name
   does not exist in the translation"). Por eso se prueba primero WHATSAPP_TEMPLATE_LANG y, solo ante ese error, los
   otros españoles; el que funciona se recuerda para los envios siguientes. */
const WA_GRAPH = 'https://graph.facebook.com/v21.0';
const ESPANOLES = ['es', 'es_AR', 'es_ES', 'es_MX'];
let idiomaQueAnda = '';

function idiomas(primero) {
  const env = String(process.env.WHATSAPP_TEMPLATE_LANG || 'es').trim();
  return [primero, idiomaQueAnda, env].concat(ESPANOLES).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
}

/* fetchFn(url, opciones) devuelve una Response (fetch o fetchWithTimeout). Resultado:
   { ok: true, idioma, json } o { ok: false, status, texto, error: { code, message, ... }, probados } */
async function enviarPlantilla(fetchFn, o) {
  const nombre = String(process.env.WHATSAPP_TEMPLATE || 'reserva_recibida').trim(), probados = [];
  let ultimo = null;
  for (const code of idiomas(o.idioma)) {
    probados.push(code);
    const r = await fetchFn(WA_GRAPH + '/' + encodeURIComponent(o.phoneId) + '/messages', {
      method: 'POST', headers: { Authorization: 'Bearer ' + o.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: o.to, type: 'template',
        template: { name: nombre, language: { code: code }, components: [{ type: 'body', parameters: o.params.map(function (t) { return { type: 'text', text: String(t) }; }) }] }
      })
    });
    if (r.ok) { idiomaQueAnda = code; return { ok: true, idioma: code, json: await r.json().catch(function () { return {}; }) }; }
    const texto = await r.text().catch(function () { return ''; });
    let error = {};
    try { error = JSON.parse(texto).error || {}; } catch (e) { /* respuesta sin JSON */ }
    ultimo = { ok: false, status: r.status, texto: texto, error: error, probados: probados.slice() };
    if (error.code !== 132001) break;
  }
  return ultimo;
}

module.exports = { enviarPlantilla: enviarPlantilla, WA_GRAPH: WA_GRAPH };
