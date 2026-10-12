'use strict';
/*
 * Completa la ficha de un tour con Claude, a partir de lo que trajo el archivo y
 * de la pagina del operador (tours.link_web).
 *
 *   completar({ servicio, proveedor, destino }) -> { titulo, descripcion, detalle,
 *     duracion, grupo, punto_salida, edad_minima, politica_cancelacion, incluye[],
 *     no_incluye[], que_llevar[], dudas }
 *
 * No guarda nada: el panel pone lo que devuelve en el editor, y la persona revisa
 * y guarda o publica como siempre (lib/operaciones.js).
 *
 * EL ESTILO
 * Las instrucciones y tres tours ya publicados como ejemplo van en el system
 * prompt, que es igual en todos los pedidos (los ejemplos se eligen siempre igual):
 * asi queda en la cache de prompts y cada ficha paga solo lo suyo.
 *
 * NO INVENTA
 * Lo que la pagina y el archivo no dicen queda vacio, y lo dudoso (precios que no
 * coinciden, datos contradictorios) va en `dudas` para que la persona lo mire.
 *
 * Requiere ANTHROPIC_API_KEY en el entorno (Vercel -> Settings -> Environment Variables).
 */
const Anthropic = require('@anthropic-ai/sdk');
const fotosProveedor = require('./fotos-proveedor');

const MODELO = 'claude-opus-5-5';

function falla(status, msg) { const e = new Error(msg); e.status = status; return e; }

let _cliente = null;
function cliente() {
  if (!String(process.env.ANTHROPIC_API_KEY || '').trim()) {
    throw falla(503, 'Falta configurar ANTHROPIC_API_KEY en el servidor (Vercel → Settings → Environment Variables) para completar fichas.');
  }
  // Un reintento y 45 s: la funcion de Vercel corta a los 60 s.
  if (!_cliente) { const C = Anthropic.default || Anthropic; _cliente = new C({ maxRetries: 1, timeout: 45 * 1000 }); }
  return _cliente;
}

const LISTA = { type: 'array', items: { type: 'string' } };
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    titulo: { type: 'string' },
    descripcion: { type: 'string' },
    detalle: { type: 'string' },
    duracion: { type: 'string' },
    grupo: { type: 'string' },
    punto_salida: { type: 'string' },
    edad_minima: { type: 'string' },
    politica_cancelacion: { type: 'string' },
    incluye: LISTA,
    no_incluye: LISTA,
    que_llevar: LISTA,
    dudas: { type: 'string' }
  },
  required: ['titulo', 'descripcion', 'detalle', 'duracion', 'grupo', 'punto_salida', 'edad_minima', 'politica_cancelacion', 'incluye', 'no_incluye', 'que_llevar', 'dudas']
};

function ejemploTexto(t) {
  const l = function (v) { return String(v || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); };
  return JSON.stringify({
    titulo: t.titulo, descripcion: t.descripcion || '', detalle: t.detalle || '', duracion: t.duracion || '', grupo: t.grupo || '',
    punto_salida: t.punto_salida || '', edad_minima: t.edad_minima || '', politica_cancelacion: t.politica_cancelacion || '',
    incluye: l(t.incluye), no_incluye: l(t.no_incluye), que_llevar: l(t.que_llevar)
  }, null, 1);
}

/* El system prompt. Los ejemplos se pasan ya elegidos (siempre los mismos, en el mismo orden) para no romper la cache. */
function sistema(ejemplos) {
  return [
    'Escribís las fichas de los tours y paseos de CuántoSale, una web del Uruguay que ayuda a viajeros uruguayos y argentinos a calcular cuánto sale un viaje a Brasil.',
    '',
    'Te paso los datos que mandó un operador turístico brasilero (de un archivo y de su página web, que suele estar en portugués) y devolvés la ficha del paseo en español rioplatense, con voseo ("Recorré", "Llevá"), como en los ejemplos.',
    '',
    'Reglas:',
    '- Usá solo lo que dicen los datos y la página. No inventes horarios, edades, lo que incluye, precios ni políticas: si algo no está, dejá ese campo vacío ("" o lista vacía).',
    '- titulo: corto y en español, manteniendo los nombres propios de lugares en su forma original (Praia do Gunga, Rua das Pedras). Sin el nombre del operador ni precios.',
    '- descripcion: una o dos oraciones que vendan el paseo, de hasta unos 200 caracteres.',
    '- detalle: dos a cuatro párrafos con cómo es la experiencia y su recorrido, en el tono de los ejemplos. Sin precios: los precios los calcula la web.',
    '- duracion, grupo, punto_salida, edad_minima: frases cortas como en los ejemplos ("6 horas", "Hasta 4 personas", "Desde tu hotel", "Desde 5 años").',
    '- incluye, no_incluye, que_llevar: una cosa por elemento, corta, sin punto final.',
    '- politica_cancelacion: lo que diga el operador, resumido.',
    '- dudas: lo que el equipo debería revisar antes de publicar (datos que se contradicen, la página habla de otro paseo, el precio del archivo no coincide con el de la página, falta un dato importante). Vacío si no hay nada.',
    '- Si la página no corresponde a este paseo, basate solo en los datos del archivo y decilo en dudas.',
    '',
    'Ejemplos de fichas ya publicadas en la web:',
    ejemplos.map(function (t, i) { return '<ejemplo ' + (i + 1) + '>\n' + ejemploTexto(t) + '\n</ejemplo ' + (i + 1) + '>'; }).join('\n\n')
  ].join('\n');
}

async function completar(o) {
  const s = o.servicio || {}, pr = o.proveedor || {};
  let pagina = null, errorPagina = '';
  if (s.link_web) {
    try { pagina = await fotosProveedor.texto(s.link_web); } catch (e) { errorPagina = e.message; }
  }
  const lineas = function (v) { return String(v || '').split(/\r?\n/).filter(Boolean).join(' | '); };
  const datos = [
    'Destino: ' + (o.destino || s.destino),
    'Tipo: ' + (s.tipo || 'tour'),
    'Operador: ' + (pr.nombre || '(sin proveedor)'),
    'Título que trae el archivo: ' + (s.titulo || ''),
    s.descripcion ? 'Descripción del archivo: ' + s.descripcion : '',
    s.detalle ? 'Detalle actual: ' + s.detalle : '',
    s.duracion ? 'Duración: ' + s.duracion : '',
    s.grupo ? 'Grupo: ' + s.grupo : '',
    s.incluye ? 'Incluye: ' + lineas(s.incluye) : '',
    s.no_incluye ? 'No incluye: ' + lineas(s.no_incluye) : '',
    s.que_llevar ? 'Qué llevar: ' + lineas(s.que_llevar) : '',
    s.politica_cancelacion ? 'Cancelación / restricciones: ' + s.politica_cancelacion : '',
    s.precio_brl != null ? 'Precio del operador: R$ ' + s.precio_brl + ' ' + (s.unidad && s.unidad !== 'persona' ? 'por ' + s.unidad : 'por persona') : ''
  ].filter(Boolean).join('\n');
  const contenido = '<datos_del_archivo>\n' + datos + '\n</datos_del_archivo>\n\n' +
    (pagina
      ? '<pagina_del_operador url="' + pagina.url + '">\nTítulo: ' + pagina.titulo + '\nDescripción: ' + pagina.descripcion + '\n\n' + pagina.texto + '\n</pagina_del_operador>'
      : '<pagina_del_operador>No se pudo leer' + (errorPagina ? ' (' + errorPagina + ')' : '') + '. Usá solo los datos del archivo.</pagina_del_operador>') +
    '\n\nEscribí la ficha de este paseo.';

  let r;
  try {
    r = await cliente().beta.messages.create({
      model: MODELO,
      max_tokens: 8000,
      // Si el modelo declina, el pedido se reintenta en otro modelo del lado de Anthropic.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: sistema(o.ejemplos || []), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contenido }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } }
    });
  } catch (e) {
    const A = Anthropic.default || Anthropic;
    if (e instanceof A.AuthenticationError) throw falla(503, 'La clave ANTHROPIC_API_KEY no es válida.');
    if (e instanceof A.RateLimitError) throw falla(429, 'Demasiados pedidos a Claude: probá en un minuto.');
    if (e instanceof A.APIError) throw falla(502, 'Claude respondió ' + (e.status || 'con error') + ': ' + String(e.message || '').slice(0, 200));
    throw falla(502, 'No se pudo hablar con Claude: ' + String(e.message || e).slice(0, 200));
  }
  if (r.stop_reason === 'refusal') throw falla(422, 'Claude no quiso escribir esta ficha. Completala a mano.');
  if (r.stop_reason === 'max_tokens') throw falla(502, 'La ficha salió demasiado larga. Probá de nuevo.');
  const bloque = (r.content || []).filter(function (b) { return b.type === 'text'; }).pop();
  let ficha;
  try { ficha = JSON.parse(bloque ? bloque.text : ''); } catch (e) { throw falla(502, 'Claude devolvió una ficha que no se pudo leer. Probá de nuevo.'); }
  ficha.pagina_leida = !!pagina;
  ficha.uso = r.usage ? { entrada: r.usage.input_tokens, cache: r.usage.cache_read_input_tokens || 0, salida: r.usage.output_tokens } : null;
  return ficha;
}

module.exports = { completar: completar, sistema: sistema, ESQUEMA: ESQUEMA, MODELO: MODELO };
