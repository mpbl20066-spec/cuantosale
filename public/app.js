(() => {
  'use strict';

  /* ================= utilidades ================= */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  const today = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const money = (n) => 'US$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dLong = (d) => d.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** Solo se abren enlaces http(s) o las rutas internas /go/ (que redirigen al sitio del socio). */
  const safeUrl = (u) => (typeof u === 'string' && /^(https?:\/\/|\/go\/)/i.test(u) ? u : null);
  const byId = (arr, id) => arr.find((x) => x.id === id) || null;

  /* ================= estado ================= */
  const VISITED_KEY = 'cs_visited';
  const loadVisited = () => {
    try { return new Set(JSON.parse(sessionStorage.getItem(VISITED_KEY) || '[]')); } catch (e) { return new Set(); }
  };
  const saveVisited = () => {
    try { sessionStorage.setItem(VISITED_KEY, JSON.stringify([...state.visited])); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  };

  const state = {
    form: { dest: 'fln', dep: '', ret: '', pax: 2, budget: 3000 },
    styleId: 'estandar',
    sel: { transport: null, lodging: null },
    manual: { transport: false, lodging: false },   // true cuando la persona eligió una tarjeta a mano
    data: null,                                     // última respuesta de /api/cotizar
    openRows: new Set(),
    visited: loadVisited(),                         // enlaces de reserva que ya se abrieron
    lastTotal: null
  };

  let timer = null, ctrl = null;

  /* ================= cálculo en tiempo real ================= */

  /**
   * Costo total agrupando lo elegido: transporte + alojamiento + comidas + transporte local/traslados + seguro.
   * Las comidas y el transporte local salen del estilo de viaje (por persona por día).
   */
  function breakdown(tId = state.sel.transport, lId = state.sel.lodging, sId = state.styleId) {
    const d = state.data;
    const t = byId(d.transport, tId), l = byId(d.lodging, lId), st = byId(d.styles, sId);
    const { pax, days, nights, rooms } = d.meta;
    const meals = st.meal * pax * days;
    const local = st.local * pax * days;
    const transfers = Math.round(t.transferBase * st.transfer);
    const rows = [
      { key: 'transport', color: '--c1', label: 'Transporte', sub: t.label, amount: t.price,
        detail: `${plural(pax, 'viajero', 'viajeros')} × ${money(t.pp)} por persona. Incluye pasajes, valijas y tasas (${t.source === 'real' ? 'precio real' : 'estimado'}).`,
        linkText: 'Cambiar transporte', link: '#sec-transport' },
      { key: 'lodging', color: '--c2', label: 'Alojamiento', sub: l.name, amount: l.total,
        detail: `${plural(nights, 'noche', 'noches')} × ${money(l.rate)} × ${plural(rooms, 'habitación', 'habitaciones')} (${l.source === 'real' ? 'precio de Booking.com para tus fechas' : 'estimado'}).`,
        linkText: 'Cambiar alojamiento', link: '#sec-lodging' },
      { key: 'meals', color: '--c3', label: 'Comidas', sub: `${st.label}: ${money(st.meal)} por persona por día`, amount: meals,
        detail: `${money(st.meal)} × ${plural(pax, 'persona', 'personas')} × ${plural(days, 'día', 'días')}. Cambia con el estilo de viaje.` },
      { key: 'local', color: '--c5', label: 'Transporte local y traslados', sub: `${st.label}: ${money(st.local)} por persona por día`, amount: local + transfers,
        detail: `${money(st.local)} × ${plural(pax, 'persona', 'personas')} × ${plural(days, 'día', 'días')} = ${money(local)}, más ${money(transfers)} de traslados desde el aeropuerto o la terminal.` },
      { key: 'insurance', color: '--c4', label: 'Seguro de viaje', sub: 'Cobertura básica estimada', amount: d.insurance.total,
        detail: `${money(d.insurance.perPersonDay)} × ${plural(pax, 'persona', 'personas')} × ${plural(days, 'día', 'días')} (estimado).` }
    ];
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return { rows, total, pp: Math.round(total / pax) };
  }
  const totalFor = (tId, lId, sId) => breakdown(tId, lId, sId).total;

  /** Elige el transporte por defecto según el estilo, priorizando lo que entra en el presupuesto. */
  function pickTransport() {
    const d = state.data, st = byId(d.styles, state.styleId);
    const lodId = state.sel.lodging;
    let pool = d.transport.filter((t) => totalFor(t.id, lodId) <= state.form.budget);   // ya viene ordenado por precio
    if (!pool.length) return d.transport[0].id;
    if (st.id === 'mochilero') return pool[0].id;
    if (st.id === 'confort') return pool.slice().sort((a, b) => b.comfort - a.comfort || a.price - b.price)[0].id;
    const lo = pool[0].price, hi = pool[pool.length - 1].price;
    let best = pool[0], bs = -1;
    pool.forEach((t) => {
      const sc = 0.55 * ((t.comfort - 1) / 2) + 0.45 * (1 - (t.price - lo) / ((hi - lo) || 1));
      if (sc > bs) { bs = sc; best = t; }
    });
    return best.id;
  }

  function applyDefaults(force = false) {
    const d = state.data, st = byId(d.styles, state.styleId);
    if (!byId(d.transport, state.sel.transport)) state.manual.transport = false;
    if (!byId(d.lodging, state.sel.lodging)) state.manual.lodging = false;
    if (force || !state.manual.lodging) state.sel.lodging = d.lodging.find((l) => l.tier === st.tier).id;
    if (force || !state.manual.transport) state.sel.transport = pickTransport();
  }

  /** Totales por fecha para la opción elegida (el resto de los gastos no cambia con la fecha). */
  function seriesTotals() {
    const d = state.data, t = byId(d.transport, state.sel.transport), l = byId(d.lodging, state.sel.lodging);
    const rest = breakdown().total - t.price - l.total;
    return d.series.map((x) => ({ shift: x.shift, dep: x.dep, total: x.transport[t.id] + l.total + (x.lodging[l.tierId] || 0) + rest }));
  }

  function computeTips() {
    const d = state.data, cur = breakdown().total, out = [];
    const series = seriesTotals();
    let bestS = null;
    series.forEach((x) => { if (!bestS || x.total < bestS.total) bestS = x; });
    if (bestS && bestS.shift !== 0 && cur - bestS.total >= 15) {
      const n = Math.abs(bestS.shift);
      out.push({ save: cur - bestS.total, title: `Salí el ${dLong(parse(bestS.dep))}`,
        text: `${plural(n, 'día', 'días')} ${bestS.shift < 0 ? 'antes' : 'después'}, con la misma cantidad de noches.`,
        action: { attr: 'data-shift', value: bestS.shift, label: 'Usar estas fechas' } });
    }
    let bt = null;
    d.transport.forEach((t) => {
      if (t.id === state.sel.transport) return;
      const save = cur - totalFor(t.id, state.sel.lodging);
      if (save >= 15 && (!bt || save > bt.save)) bt = { save, t };
    });
    if (bt) out.push({ save: bt.save, title: `Probá: ${bt.t.label.toLowerCase()}`, text: bt.t.tip,
      action: { attr: 'data-pick', value: `transport:${bt.t.id}`, label: 'Elegir esta opción' } });
    let bl = null;
    d.lodging.forEach((l) => {
      if (l.id === state.sel.lodging) return;
      const save = cur - totalFor(state.sel.transport, l.id);
      if (save >= 15 && (!bl || save > bl.save)) bl = { save, l };
    });
    if (bl) out.push({ save: bl.save, title: `Alojamiento: ${bl.l.name}`, text: `${bl.l.desc}. Cambia el total más de lo que parece.`,
      action: { attr: 'data-pick', value: `lodging:${bl.l.id}`, label: 'Elegir esta opción' } });
    return out.sort((a, b) => b.save - a.save).slice(0, 3);
  }

  /* ================= enlaces de reserva ================= */

  /** Botón/enlace de reserva: nueva pestaña y sin acceso a esta ventana. Cambia a "✓ Enlace visitado" tras el clic. */
  function linkBtn(url, label, cls) {
    const u = safeUrl(url);
    if (!u) return `<span class="${cls} off" aria-disabled="true">Enlace no disponible</span>`;
    const seen = state.visited.has(u);
    return `<a class="${cls}${seen ? ' visited' : ''}" href="${esc(u)}" target="_blank" rel="noopener noreferrer" data-track="${esc(u)}">${seen ? '✓ Enlace visitado' : esc(label)}</a>`;
  }

  function markVisited(url) {
    if (!url) return;
    state.visited.add(url);
    saveVisited();
    $$('a[data-track]').forEach((a) => {
      if (a.dataset.track !== url) return;
      a.classList.add('visited');
      a.textContent = '✓ Enlace visitado';
    });
    if ($('#checkout').open) renderCheckout();
  }

  /* ================= panel de presupuesto ================= */
  function flash(el) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function renderPanel() {
    const d = state.data, { meta } = d;
    const { rows, total, pp } = breakdown();
    const budget = state.form.budget;

    $('#budget').hidden = false;
    $('#bTotal').textContent = money(total);
    if (state.lastTotal !== null && state.lastTotal !== total) flash($('#bTotal'));
    state.lastTotal = total;
    $('#bPP').textContent = `${money(pp)} por persona, ${plural(meta.pax, 'viajero', 'viajeros')}, ${plural(meta.nights, 'noche', 'noches')}`;

    const st = $('#bStatus');
    if (budget <= 0) {
      st.className = 'b-status over';
      st.textContent = 'Poné tu presupuesto para ver cuánto te sobra.';
    } else {
      const over = total > budget, pct = Math.min(100, Math.round(total / budget * 100));
      st.className = 'b-status' + (over ? ' over' : '');
      st.innerHTML = `${over ? `Te pasás por ${money(total - budget)} de tu presupuesto (${money(budget)}). Probá el estilo Mochilero o mirá dónde ahorrar.`
        : `Entra en tu presupuesto. Te sobran ${money(budget - total)}.`}<div class="track"><div class="fill" style="width:${pct}%"></div></div>`;
    }

    $('#styleSeg').innerHTML = d.styles.map((s) =>
      `<button type="button" data-style="${s.id}" aria-pressed="${s.id === state.styleId}">${esc(s.label)}</button>`).join('');
    $('#styleNote').textContent = byId(d.styles, state.styleId).note;

    $('#bRows').innerHTML = rows.map((r) => {
      const open = state.openRows.has(r.key);
      return `<li class="b-row"><button type="button" class="b-rowbtn" data-row="${r.key}" aria-expanded="${open}">` +
        `<span class="b-dot" style="background:var(${r.color})"></span>` +
        `<span class="b-lab"><b>${esc(r.label)}</b><em>${esc(r.sub)}</em></span><span class="b-amt">${money(r.amount)}</span></button>` +
        `<div class="b-more"${open ? '' : ' hidden'}><p>${esc(r.detail)}</p>${r.link ? `<a href="${r.link}" data-jump>${esc(r.linkText)}</a>` : ''}</div></li>`;
    }).join('') + `<li class="b-sumrow"><b>Total del viaje</b><span>${money(total)}</span></li>`;
  }

  /* ================= tarjetas de resultados ================= */
  const deltaHtml = (diff) => diff === 0 ? '' :
    `<p class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} en tu total</p>`;

  function transportCard(t, ctx) {
    const sel = t.id === state.sel.transport;
    const tags = (sel ? '<span class="mini y">Elegido</span>' : '') +
      (t.id === ctx.cheapestId ? '<span class="mini">Más barato</span>' : '') +
      (t.id === ctx.cozyId ? '<span class="mini">Más cómodo</span>' : '') +
      (ctx.live ? (t.source === 'real' ? '<span class="mini g">Precio real</span>' : '<span class="mini">Estimado</span>') : '');
    let info = `Ida y vuelta. Trayecto ${t.dur}.`;
    if (t.quote) info += ` ${t.quote.airline ? esc(t.quote.airline) + ', ' : ''}${t.quote.transfers ? plural(t.quote.transfers, 'escala', 'escalas') : 'sin escalas'}.`;
    const diff = sel ? 0 : totalFor(t.id, state.sel.lodging) - ctx.total;
    return `<article class="card" role="radio" aria-checked="${sel}" tabindex="0" data-kind="transport" data-id="${t.id}">` +
      `<div class="c-left"><div class="tags">${tags}</div><h3>${esc(t.label)}</h3><p>${info}</p>${deltaHtml(diff)}</div>` +
      `<div class="c-right"><div><div class="c-price">${money(t.price)}</div><small>${money(t.pp)} por persona</small></div>` +
      `${linkBtn(t.bookingUrl, t.bookingKind === 'duffel-links' ? 'Reservar vuelo ↗' : 'Ver oferta ↗', 'btn-offer')}</div></article>`;
  }

  function lodgingCard(l, ctx) {
    const sel = l.id === state.sel.lodging;
    const stars = l.stars ? `<span class="stars" aria-label="${l.stars} estrellas">${'★'.repeat(l.stars)}</span>` : '';
    const tags = (sel ? '<span class="mini y">Elegido</span>' : '') +
      (l.source === 'real' ? '<span class="mini g">Precio real</span>' : '<span class="mini">Estimado</span>') +
      (l.reviewScore ? `<span class="mini">${String(l.reviewScore).replace('.', ',')} de puntaje</span>` : '');
    const diff = sel ? 0 : totalFor(state.sel.transport, l.id) - ctx.total;
    return `<article class="card" role="radio" aria-checked="${sel}" tabindex="0" data-kind="lodging" data-id="${esc(l.id)}">` +
      `<div class="c-left"><div class="tags">${tags}</div><h3>${esc(l.name)} ${stars}</h3>` +
      `<p>${esc(l.desc)}. ${plural(l.nights, 'noche', 'noches')}, ${plural(l.rooms, 'habitación', 'habitaciones')}.</p>` +
      `<p>${money(l.rate)} por noche por habitación.</p>${deltaHtml(diff)}</div>` +
      `<div class="c-right"><div><div class="c-price">${money(l.total)}</div><small>toda la estadía</small></div>` +
      `${linkBtn(l.bookingUrl, l.source === 'real' ? 'Reservar en Booking ↗' : 'Ver oferta ↗', 'btn-offer')}</div></article>`;
  }

  function renderResults() {
    const d = state.data, live = d.meta.mode === 'live', total = breakdown().total;
    const cozy = d.transport.slice().sort((a, b) => b.comfort - a.comfort || a.price - b.price)[0];
    const ctx = { live, total, cheapestId: d.transport[0].id, cozyId: cozy.id };
    const focusId = document.activeElement && document.activeElement.classList.contains('card')
      ? `${document.activeElement.dataset.kind}:${document.activeElement.dataset.id}` : null;

    let h = '';
    h += `<section class="sec" id="sec-transport"><h2>Elegí tu transporte</h2><p class="sub">Tocá una tarjeta para sumarla a tu presupuesto. El botón abre la oferta en una pestaña nueva.</p>` +
      `<div class="cards" role="radiogroup" aria-label="Transporte">${d.transport.map((t) => transportCard(t, ctx)).join('')}</div></section>`;
    h += `<section class="sec" id="sec-lodging"><h2>Elegí tu alojamiento</h2><p class="sub">${d.lodging.some((l) => l.source === 'real') ? 'Precios de Booking.com para' : 'Precios estimados para'} ${plural(d.meta.nights, 'noche', 'noches')} en ${esc(d.meta.dest.name)}. Tocá una tarjeta para sumarla a tu presupuesto.</p>` +
      `<div class="cards" role="radiogroup" aria-label="Alojamiento">${d.lodging.map((l) => lodgingCard(l, ctx)).join('')}</div></section>`;

    const tips = computeTips();
    h += '<section class="sec"><h2>Dónde podés ahorrar</h2><p class="sub">Comparamos fechas, transporte y alojamiento con lo que elegiste.</p><div class="panel">';
    h += tips.length ? tips.map((t) =>
      `<div class="tip"><div class="save">−${money(t.save)}</div><div><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p>` +
      `<button type="button" class="apply" ${t.action.attr}="${esc(t.action.value)}">${esc(t.action.label)}</button></div></div>`).join('')
      : '<p style="margin:0">Con estas fechas y esta combinación ya estás en una muy buena opción. Probá con otro destino o cambiá el estilo de viaje.</p>';
    h += '</div></section>';

    const series = seriesTotals();
    let mn = Infinity, mx = -Infinity, best = null;
    series.forEach((x) => { if (x.total < mn) { mn = x.total; best = x; } if (x.total > mx) mx = x.total; });
    const bars = series.map((x) => {
      const ht = 34 + 96 * ((x.total - mn) / ((mx - mn) || 1));
      const dd = parse(x.dep);
      return `<button type="button" class="bar${x.shift === 0 ? ' cur' : ''}${x === best ? ' best' : ''}" data-shift="${x.shift}" aria-label="Salir el ${dLong(dd)}: ${money(x.total)}">` +
        `<span class="v">${money(x.total).replace('US$ ', '')}</span><span class="b" style="height:${ht}px"></span>` +
        `<span class="d"><b>${dd.getDate()}</b>${dd.toLocaleDateString('es-UY', { month: 'short' })}</span></button>`;
    }).join('');
    h += `<section class="sec"><h2>Mismo viaje, otra fecha</h2><p class="sub">Costo total en US$ si salís antes o después, con las mismas noches. Es una estimación a partir del precio de tu fecha. Tocá una barra para usarla.</p>` +
      `<div class="panel"><div class="chart">${bars}</div><div class="legend"><span class="l1">Tu fecha</span><span class="l2">La más barata</span><span>Otras fechas</span></div></div></section>`;

    const el = $('#results');
    el.innerHTML = h;
    const ch = $('.chart', el), cu = $('.bar.cur', el);
    if (ch && cu) ch.scrollLeft = cu.offsetLeft - ch.clientWidth / 2 + cu.offsetWidth / 2;
    if (focusId) {
      const [k, id] = focusId.split(':');
      const c = $(`.card[data-kind="${k}"][data-id="${id}"]`, el);
      if (c) c.focus({ preventScroll: true });
    }
  }

  function renderFooter() {
    const { sources } = state.data.meta;
    const live = sources.flights || sources.hotels;
    const real = [sources.flights ? '<b>Vuelos:</b> precio real de aerolíneas al momento de la búsqueda, en clase económica; puede cambiar hasta que reserves.' : '',
      sources.hotels ? '<b>Alojamiento:</b> precios de Booking.com para tus fechas.' : ''].filter(Boolean).join(' ');
    $('#chip').textContent = live ? 'Precios de referencia' : 'Datos de ejemplo';
    $('#foot').innerHTML = `<p>${live ? real + ' ' : '<b>Datos de ejemplo.</b> Los precios de esta página son estimaciones para mostrar cómo funciona el cálculo. '}` +
      `<b>Comidas, transporte local, seguro${sources.hotels ? '' : ', alojamiento'}${sources.flights ? '' : ' y vuelos'}:</b> estimaciones. ` +
      'Las reservas se completan en sitios de terceros (Booking.com, Duffel u otros) y algunos pueden darnos una comisión sin costo extra para vos.</p>';
  }

  function renderAll() {
    renderPanel();
    renderResults();
    renderFooter();
    if ($('#checkout').open) renderCheckout();
  }

  /* ================= ventana "Organizar mi reserva" ================= */
  function checkoutSteps() {
    const d = state.data, { meta } = d;
    const t = byId(d.transport, state.sel.transport), l = byId(d.lodging, state.sel.lodging);
    const kind = t.kind === 'flight' ? 'vuelo' : (t.mode === 'ferry' ? 'ferry' : 'ómnibus');
    const from = t.mode === 'avion_ba' ? 'Buenos Aires' : 'Montevideo';
    const hint = t.bookingKind === 'duffel-links'
      ? ` Se abre el reservador seguro de Duffel: buscá ${from} a ${meta.dest.name} con estas fechas y viajeros.` : '';
    return [
      { title: `Transporte: ${t.label}`, btn: `Reservar ${kind} ↗`, url: safeUrl(t.bookingUrl),
        sub: `${dLong(parse(meta.dep))} a ${dLong(parse(meta.ret))}, ${plural(meta.pax, 'viajero', 'viajeros')}. Unos ${money(t.price)} en total.${hint}` },
      { title: `Alojamiento: ${l.name}`, btn: l.source === 'real' ? 'Reservar en Booking.com ↗' : 'Reservar alojamiento ↗', url: safeUrl(l.bookingUrl),
        sub: `${plural(meta.nights, 'noche', 'noches')}, ${plural(meta.rooms, 'habitación', 'habitaciones')}. ${l.source === 'real' ? 'Precio de Booking.com' : 'Unos'} ${money(l.total)} en total.` },
      { title: 'Seguro de viaje', btn: 'Contratar seguro de viaje ↗', url: safeUrl(d.insurance.bookingUrl),
        sub: `${plural(meta.pax, 'viajero', 'viajeros')}, ${plural(meta.days, 'día', 'días')}. Unos ${money(d.insurance.total)} (estimado).` }
    ];
  }

  function renderCheckout() {
    if (!state.data) return;
    const steps = checkoutSteps(), { meta } = state.data;
    const done = steps.filter((s) => s.url && state.visited.has(s.url)).length;
    $('#ckSub').textContent = `${meta.dest.name}, ${plural(meta.nights, 'noche', 'noches')}. Total estimado: ${money(breakdown().total)}.`;
    $('#ckFill').style.width = `${Math.round(done / steps.length * 100)}%`;
    $('#ckCount').textContent = done === steps.length
      ? '¡Listo! Ya abriste los 3 enlaces. Tu presupuesto queda acá por si necesitás ajustar algo.'
      : `${done} de ${steps.length} enlaces visitados`;
    $('#ckSteps').innerHTML = steps.map((s, i) => {
      const isDone = s.url && state.visited.has(s.url);
      return `<li class="ck-step${isDone ? ' done' : ''}"><div class="ck-n">${isDone ? '✓' : i + 1}</div>` +
        `<div class="ck-txt"><b>Paso ${i + 1}: ${esc(s.title)}</b><small>${esc(s.sub)}</small>${linkBtn(s.url, s.btn, 'ck-btn')}</div></li>`;
    }).join('');
  }

  function openCheckout() {
    if (!state.data) return;
    renderCheckout();
    const dlg = $('#checkout');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.body.classList.add('modal-open');
  }
  function closeCheckout() {
    const dlg = $('#checkout');
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
    document.body.classList.remove('modal-open');
  }

  /* ================= pedido al servidor ================= */
  const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 250); };

  function notice(msg) {
    state.data = null;
    $('#budget').hidden = true;
    $('#results').innerHTML = `<div class="notice">${esc(msg)}</div>`;
  }

  function run() {
    const f = state.form, el = $('#results');
    if (!f.dep || !f.ret) { notice('Elegí las fechas de ida y vuelta para ver el costo.'); return; }
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const mine = ctrl;
    el.classList.add('loading');
    const qs = new URLSearchParams({ dest: f.dest, dep: f.dep, ret: f.ret, pax: f.pax });
    fetch(`/api/cotizar?${qs}`, { signal: mine.signal })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) { notice(j.error || 'No pudimos calcular tu viaje.'); return; }
        state.data = j;
        applyDefaults();
        renderAll();
      })
      .catch((e) => { if (e.name !== 'AbortError') notice('No pudimos calcular ahora. Probá de nuevo en un momento.'); })
      .finally(() => { if (ctrl === mine) el.classList.remove('loading'); });
  }

  /* ================= eventos ================= */
  function init() {
    const f = state.form;
    const d0 = addDays(today, 80);
    f.dep = iso(d0); f.ret = iso(addDays(d0, 7));
    $('#dep').value = f.dep; $('#ret').value = f.ret;
    $('#dep').min = iso(addDays(today, 1)); $('#ret').min = iso(addDays(today, 2));
    $('#bud').value = f.budget;
    $('#pax').textContent = f.pax;

    const sel = $('#dest');
    sel.addEventListener('change', () => {
      f.dest = sel.value;
      state.manual.transport = false; state.manual.lodging = false;   // otro destino: se vuelve a elegir por defecto
      schedule();
    });
    $('#dep').addEventListener('change', (e) => {
      const old = f.dep && f.ret ? Math.round((parse(f.ret) - parse(f.dep)) / 864e5) : 7;
      f.dep = e.target.value;
      if (f.dep && (!f.ret || parse(f.ret) <= parse(f.dep))) { f.ret = iso(addDays(parse(f.dep), Math.max(old, 1))); $('#ret').value = f.ret; }
      schedule();
    });
    $('#ret').addEventListener('change', (e) => { f.ret = e.target.value; schedule(); });
    $('#pm').addEventListener('click', () => { f.pax = Math.max(1, f.pax - 1); $('#pax').textContent = f.pax; schedule(); });
    $('#pp').addEventListener('click', () => { f.pax = Math.min(10, f.pax + 1); $('#pax').textContent = f.pax; schedule(); });
    // el presupuesto y el estilo no necesitan pedirle nada al servidor: se recalcula acá
    $('#bud').addEventListener('input', (e) => {
      f.budget = Math.max(0, Number(e.target.value) || 0);
      if (state.data) { applyDefaults(); renderAll(); }
    });

    // panel de presupuesto
    $('#bToggle').addEventListener('click', () => setPanelOpen(!$('#budget').classList.contains('open')));
    $('#styleSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-style]');
      if (!b) return;
      state.styleId = b.dataset.style;
      applyDefaults();
      renderAll();
    });
    $('#bRows').addEventListener('click', (e) => {
      if (e.target.closest('a[data-jump]')) { setPanelOpen(false); return; }   // el enlace hace scroll a la sección
      const b = e.target.closest('button[data-row]');
      if (!b) return;
      const k = b.dataset.row;
      if (state.openRows.has(k)) state.openRows.delete(k); else state.openRows.add(k);
      renderPanel();
    });
    $('#openCheckout').addEventListener('click', openCheckout);

    // tarjetas, ahorros y comparador de fechas
    const results = $('#results');
    results.addEventListener('click', (e) => {
      if (e.target.closest('a[data-track]')) return;                       // el enlace de reserva no selecciona la tarjeta
      const shift = e.target.closest('[data-shift]');
      if (shift) {
        const s = Number(shift.dataset.shift);
        f.dep = iso(addDays(parse(f.dep), s)); f.ret = iso(addDays(parse(f.ret), s));
        $('#dep').value = f.dep; $('#ret').value = f.ret;
        schedule();
        return;
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) { const [k, id] = pick.dataset.pick.split(':'); choose(k, id); return; }
      const card = e.target.closest('.card');
      if (card) choose(card.dataset.kind, card.dataset.id);
    });
    results.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')) {
        e.preventDefault();
        choose(e.target.dataset.kind, e.target.dataset.id);
      }
    });

    // enlaces de reserva: marcar como visitados (clic normal o botón del medio)
    document.addEventListener('click', (e) => { const a = e.target.closest('a[data-track]'); if (a) markVisited(a.dataset.track); });
    document.addEventListener('auxclick', (e) => { if (e.button === 1) { const a = e.target.closest('a[data-track]'); if (a) markVisited(a.dataset.track); } });

    // ventana de reserva
    const dlg = $('#checkout');
    $('#ckClose').addEventListener('click', closeCheckout);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeCheckout(); });   // clic en el fondo oscuro
    dlg.addEventListener('close', () => document.body.classList.remove('modal-open'));

    fetch('/api/destinos').then((r) => r.json()).then((list) => {
      list.forEach((x) => { const o = document.createElement('option'); o.value = x.key; o.textContent = x.name; sel.appendChild(o); });
      sel.value = f.dest;
      run();
    }).catch(() => notice('No pudimos cargar los destinos. Recargá la página.'));
  }

  function setPanelOpen(open) {
    $('#budget').classList.toggle('open', open);
    $('#bToggle').setAttribute('aria-expanded', String(open));
    $('#bToggleText').textContent = open ? 'Ocultar desglose' : 'Ver desglose y estilo de viaje';
  }

  function choose(kind, id) {
    if (!state.data) return;
    if (kind === 'transport' && byId(state.data.transport, id)) { state.sel.transport = id; state.manual.transport = true; }
    else if (kind === 'lodging' && byId(state.data.lodging, id)) { state.sel.lodging = id; state.manual.lodging = true; }
    else return;
    renderAll();
  }

  init();
})();
