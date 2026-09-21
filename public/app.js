(function () {
  'use strict';

  var CATS = [
    ['pasajes', 'Pasajes', '--c1'],
    ['alojamiento', 'Alojamiento', '--c2'],
    ['comidas', 'Comidas', '--c3'],
    ['local', 'Transporte local', '--c5'],
    ['traslados', 'Traslados', '--c4'],
    ['extras', 'Valijas, tasas y seguro', '--c6']
  ];

  var S = { dest: 'fln', dep: '', ret: '', pax: 2, budget: 3000, style: 'eq', proposalId: '' };
  // Códigos IATA usados por el buscador de vuelos. Se mantienen en el cliente
  // porque /api/cotizar devuelve el nombre del destino para la interfaz.
  var IATA_BY_DEST = { buz: 'GIG', rio: 'GIG', fln: 'FLN', sao: 'GRU', ssa: 'SSA', igu: 'IGU', rec: 'REC', for: 'FOR', mcz: 'MCZ', nat: 'NAT', pip: 'NAT', poa: 'POA' };
  var FOOD_TIPS = {
    rio: ['Probá un <b>prato feito</b> al mediodía en los restaurantes por kilo de Copacabana o Botafogo: suele incluir arroz, feijão, proteína y ensalada.', 'Para playa, comprá agua, fruta y snacks en un supermercado antes de bajar a la arena: los kioscos de la orla cuestan bastante más.', 'En Feira de São Cristóvão encontrás porciones abundantes de comida nordestina y opciones para compartir.'],
    fln: ['Buscá <b>prato executivo</b> en el centro de Florianópolis al mediodía: generalmente es la comida con mejor relación precio-cantidad.', 'En los mercados públicos y ferias barriales, armá un picnic con frutas, pan de queso y jugos para llevar a la playa.', 'Alejate una o dos cuadras de la playa para encontrar <b>buffet por kilo</b> y platos del día más accesibles.'],
    sao: ['En los restaurantes por kilo del centro y Vila Madalena, cargá un plato equilibrado y pagá solo por lo que comés.', 'La <b>feira livre</b> es ideal para frutas, pasteles y jugos a precios locales.', 'Compartí una pizza paulista grande: suele rendir para dos personas y es una cena clásica de buen valor.'],
    ssa: ['Probá un <b>prato feito</b> de comida baiana en el centro histórico, lejos de los locales con vista turística.', 'Las bahianas de acarajé son una merienda abundante y típica; consultá el precio antes de pedir extras.', 'Comprá agua y frutas en mercados locales antes de recorrer Pelourinho o las playas.'],
    igu: ['Para un almuerzo económico, buscá buffet por kilo o <b>prato feito</b> fuera de la zona hotelera.', 'En supermercados de Foz podés conseguir fruta, agua y meriendas para llevar a las cataratas.', 'Probá churrasquerías con menú de mediodía: muchas tienen opciones más convenientes que la cena.'],
    rec: ['Buscá menú ejecutivo en Boa Viagem o en el centro, a unas cuadras de la rambla.', 'Las tapiocas y jugos de los mercados son una opción local, rápida y económica para merendar.', 'En el Mercado de São José encontrás ingredientes y comidas populares a precio local.'],
    for: ['En Mercado dos Peixes podés elegir pescado y pedir que lo preparen; compará puestos antes de decidir.', 'Para el almuerzo, el <b>prato comercial</b> suele ser más barato y abundante que cenar en la costa.', 'Comprá agua de coco y fruta en mercados de barrio, no en los puestos de la playa.'],
    mcz: ['Buscá menú ejecutivo en Pajuçara o Jatiúca a una cuadra de la costa para evitar el recargo frente al mar.', 'Las tapiocas y cuscuz nordestinos son desayunos o meriendas baratos y rendidores.', 'Para excursiones, llevá agua y snacks del supermercado: en las paradas turísticas los precios suben.'],
    nat: ['Probá <b>prato feito</b> y buffet por kilo fuera de la primera línea de Ponta Negra.', 'En los mercados locales encontrás castañas, frutas y jugos para una merienda económica.', 'Compartí porciones de camarones o pescado en restaurantes de barrio: suelen ser generosas.'],
    poa: ['En el Mercado Público encontrás almuerzos, empanadas y productos locales a precios variados.', 'Los restaurantes por kilo del centro son una opción práctica para comer bien al mediodía.', 'Probá una cafetería de barrio para merendar: café con salgado suele costar menos que en zonas turísticas.']
  };
  var $ = function (s) { return document.querySelector(s); };
  var today = new Date(); today.setHours(12, 0, 0, 0);
  var timer = null, ctrl = null;
  var lastData = null;

  /* ---------- utilidades ---------- */
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function money(n) { return 'US$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dLong(d) { return d.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function bookingUrl(meta, extra) {
    var query = new URLSearchParams({
      ss: meta.dest.name + ', Brasil',
      checkin: meta.dep,
      checkout: meta.ret,
      group_adults: String(meta.pax),
      no_rooms: '1',
      group_children: '0'
    });
    if (extra && extra.order) query.set('order', extra.order);
    return 'https://www.booking.com/searchresults.es.html?' + query.toString();
  }
  function flightUrl(meta) {
    var iata = IATA_BY_DEST[meta.dest.key] || meta.dest.key.toUpperCase();
    // Formato de búsqueda de Aviasales: origen + DDMM + destino + DDMM + adultos.
    // Es un enlace saliente estándar que Money Script puede atribuir al hacer clic.
    var dep = meta.dep.slice(8, 10) + meta.dep.slice(5, 7);
    var ret = meta.ret.slice(8, 10) + meta.ret.slice(5, 7);
    return 'https://www.aviasales.com/search/MVD' + dep + iata + ret + meta.pax;
  }
  function ctas(meta) {
    var city = esc(meta.dest.name);
    return '<section class="cta-section" aria-label="Reservá tu viaje">' +
      '<p class="cta-title">¿Listo para avanzar con tu viaje?</p>' +
      '<div class="cta-actions">' +
      '<a class="cta-link cta-flights" href="' + esc(flightUrl(meta)) + '" target="_blank" rel="noopener noreferrer">' +
      '<span aria-hidden="true">✈️</span> Buscar y comparar vuelos a ' + city + '</a>' +
      '</div></section>';
  }
  function hotelOptions(meta, accommodationTotal) {
    var nights = Math.max(1, Number(meta.nights) || 1);
    var pax = Math.max(1, Number(meta.pax) || 1);
    var average = Math.max(1, Number(accommodationTotal) || 1) / nights / pax;
    var options = [
      { badge: 'MÁS ECONÓMICO', type: 'Pousada o Hostel privado', multiplier: 0.70, order: 'price' },
      { badge: 'RECOMENDADO', type: 'Hotel 3★ con desayuno', multiplier: 1, recommended: true },
      { badge: 'MAYOR COMODIDAD', type: 'Hotel frente al mar / 4★', multiplier: 1.30 }
    ];
    return '<section class="hotel-options" aria-labelledby="hotel-options-title"><div class="hotel-options-head"><div><h2 id="hotel-options-title">Tres opciones de alojamiento</h2><p>Elegí el nivel que mejor se ajusta a tu presupuesto para ' + esc(meta.dest.name) + '.</p></div></div><div class="hotel-grid">' +
      options.map(function (option) {
        var nightly = Math.max(1, Math.round(average * option.multiplier));
        var total = nightly * nights * pax;
        var url = bookingUrl(meta, option.order ? { order: option.order } : null);
        return '<article class="hotel-option' + (option.recommended ? ' recommended' : '') + '"><span class="hotel-badge">' + option.badge + '</span><h3>' + option.type + '</h3><p class="hotel-detail">Estimación para ' + nights + (nights === 1 ? ' noche' : ' noches') + ' y ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + '.</p><div class="hotel-price"><small>Desde</small><b>' + money(nightly) + '</b><span>por noche</span></div><strong class="hotel-total">' + money(total) + ' total estimado</strong><a class="hotel-booking" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Ver en Booking.com ↗</a></article>';
      }).join('') + '</div></section>';
  }
  function guideUnlocked() {
    try { return localStorage.getItem('cuantosale_guia_desbloqueada') === 'true'; } catch (e) { return false; }
  }
  function unlockGuide() {
    try { localStorage.setItem('cuantosale_guia_desbloqueada', 'true'); } catch (e) { /* la guía se desbloquea igualmente en esta vista */ }
    Array.prototype.forEach.call(document.querySelectorAll('.food-guide'), function (guide) {
      guide.querySelector('.food-tips').classList.remove('bloqueado');
      var lock = guide.querySelector('.guide-lock');
      if (lock) lock.hidden = true;
    });
  }
  function foodGuide(meta) {
    var tips = FOOD_TIPS[meta.dest.key] || FOOD_TIPS.fln;
    var locked = !guideUnlocked();
    var items = tips.map(function (tip) { return '<li>📍 🔒 ' + tip + '</li>'; }).join('');
    return '<section class="food-guide" aria-labelledby="food-guide-title">' +
      '<div class="food-guide-head"><span aria-hidden="true">🍽️</span><div><h2 id="food-guide-title">Guía Secreta: Dónde comer bien y barato en ' + esc(meta.dest.name) + '</h2>' +
      '<p>Ideas locales para cuidar tu presupuesto sin resignar sabor.</p></div></div>' +
      '<ul class="food-tips' + (locked ? ' bloqueado' : '') + '">' + items + '</ul>' +
      '<div class="guide-lock"' + (locked ? '' : ' hidden') + '>' +
      '<div class="guide-lock-icon" aria-hidden="true">🔒</div>' +
      '<p>🔒 <b>Contenido exclusivo desbloqueable:</b> Ayúdanos a mantener CuántoSale gratuito abriendo las opciones de alojamiento en Booking.com (no requiere compra, solo abrir el enlace).</p>' +
      '<a class="guide-unlock" data-unlock-guide href="' + esc(bookingUrl(meta)) + '" target="_blank" rel="noopener noreferrer">🏨 Ver Hoteles en Booking y Desbloquear Guía 🔓</a>' +
      '</div></section>';
  }
  function flightSearch(meta, budget) {
    return '<section class="duffel-search" aria-labelledby="duffel-title" data-flight-budget="' + esc(budget) + '"><div><h2 id="duffel-title">Vuelos reales disponibles</h2><p>Ofertas de Duffel filtradas hasta ' + money(budget) + ' para pasajes.</p></div>' +
      '<div class="duffel-results" aria-live="polite"><p class="duffel-loading">Consultando aerolíneas…</p></div></section>';
  }
  function flightTime(value) {
    if (!value) return 'Horario no disponible';
    return new Date(value).toLocaleString('es-UY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function renderFlightOffers(el, data, budget) {
    var priced = data.offers.filter(function (offer) { return offer.price_usd !== null; });
    var affordable = priced.filter(function (offer) { return offer.price_usd <= budget; });
    var fallback = affordable.length === 0;
    var visible = fallback ? priced.slice(0, 2) : affordable;
    if (!visible.length) { el.innerHTML = '<p class="duffel-empty">No encontramos vuelos para esta fecha. Probá cambiando el día de ida.</p>'; return; }
    var warning = fallback ? '<p class="duffel-warning">⚠️ No encontramos vuelos disponibles por debajo de ' + money(budget) + ', pero estos son los más cercanos a tu presupuesto:</p>' : '';
    el.innerHTML = warning + '<div class="flight-cards">' + visible.map(function (offer) {
      var logo = offer.logo ? '<img src="' + esc(offer.logo) + '" alt="" class="flight-logo">' : '<span class="flight-logo-fallback" aria-hidden="true">✈️</span>';
      var price = offer.price_usd === null ? esc(offer.original_price + ' ' + (offer.original_currency || '')) : money(offer.price_usd);
      return '<article class="flight-card' + (!fallback ? ' within-budget' : '') + '"><div class="flight-airline">' + logo + '<b>' + esc(offer.airline) + '</b></div>' +
        '<div class="flight-route"><div><small>Salida</small><b>' + esc(flightTime(offer.departure)) + '</b></div><span aria-hidden="true">→</span><div><small>Llegada</small><b>' + esc(flightTime(offer.arrival)) + '</b></div></div>' +
        '<div class="flight-footer"><span class="flight-badge' + (offer.stops === 0 ? ' direct' : '') + '">' + (offer.stops === 0 ? 'Directo' : offer.stops + (offer.stops === 1 ? ' escala' : ' escalas')) + '</span><span class="flight-duration">' + esc(offer.duration || '') + '</span>' +
        '<div class="flight-price"><small>Precio final</small><b>' + price + '</b></div><button type="button" class="select-flight" data-select-flight="' + esc(offer.id) + '" data-passenger-ids="' + esc(JSON.stringify(offer.passenger_ids || [])) + '" data-offer-price="' + esc(offer.price_usd === null ? '' : offer.price_usd) + '" data-offer-currency="' + esc(offer.original_currency || 'USD') + '" data-offer-airline="' + esc(offer.airline) + '">Seleccionar vuelo</button></div></article>';
    }).join('') + '</div>';
  }
  function searchFlights(meta, section) {
    var box = section.querySelector('.duffel-results');
    var budget = Number(section.getAttribute('data-flight-budget')) || 0;
    box.innerHTML = '<p class="duffel-loading">Consultando aerolíneas…</p>';
    fetch('/api/vuelos/buscar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origen: 'MVD', destino: meta.dest.key, fecha_ida: meta.dep, pasajeros: meta.pax }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { if (!res.ok) throw new Error(res.j.error || 'No pudimos buscar vuelos.'); renderFlightOffers(box, res.j, budget); })
      .catch(function (e) { box.innerHTML = '<p class="duffel-empty">' + esc(e.message || 'No pudimos buscar vuelos.') + '</p>'; })
      ;
  }
  function passengerFields(count, passengerIds) {
    var fields = '';
    for (var i = 0; i < count; i++) {
      fields += '<fieldset class="passenger-fields" data-passenger-id="' + esc(passengerIds[i] || '') + '"><legend>Pasajero ' + (i + 1) + '</legend>' +
        '<div class="passenger-grid"><div><label>Nombre</label><input required name="given_name" autocomplete="given-name"></div><div><label>Apellido</label><input required name="family_name" autocomplete="family-name"></div>' +
        '<div><label>Fecha de nacimiento</label><input required type="date" name="born_on" autocomplete="bday"></div><div><label>Género</label><select required name="gender"><option value="">Elegir</option><option value="m">Masculino</option><option value="f">Femenino</option></select></div>' +
        '<div><label>Email</label><input required type="email" name="email" autocomplete="email"></div><div><label>Teléfono</label><input required type="tel" name="phone_number" autocomplete="tel"></div>' +
        '<div><label>Tipo de documento</label><select required name="document_type"><option value="">Elegir</option><option value="passport">Pasaporte</option><option value="identity_card">Cédula / documento</option></select></div><div><label>Número de documento</label><input required name="document_number" autocomplete="off"></div></div></fieldset>';
    }
    return fields;
  }
  function openBookingForm(button) {
    var modal = $('#booking-modal'), offerId = button.getAttribute('data-select-flight'), passengerIds = [];
    try { passengerIds = JSON.parse(button.getAttribute('data-passenger-ids') || '[]'); } catch (e) { passengerIds = []; }
    modal.innerHTML = '<div class="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button>' +
      '<h2 id="booking-title">Datos de los pasajeros</h2><p class="booking-summary">' + esc(button.getAttribute('data-offer-airline') || 'Vuelo seleccionado') + ' · ' + money(Number(button.getAttribute('data-offer-price') || 0)) + '</p>' +
      '<form id="booking-form" data-offer-id="' + esc(offerId) + '" data-total-amount="' + esc(button.getAttribute('data-offer-price') || '') + '" data-total-currency="' + esc(button.getAttribute('data-offer-currency') || 'USD') + '"><div class="passenger-list">' + passengerFields(S.pax, passengerIds) + '</div><p class="booking-note">Revisá los datos exactamente como aparecen en el documento de viaje. El teléfono debe incluir código de país, por ejemplo +59899123456.</p><button class="confirm-booking" type="submit">Confirmar y Emitir Reserva</button></form></div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('input').focus();
  }
  function closeBookingForm() {
    var modal = $('#booking-modal'); modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); modal.innerHTML = '';
  }
  function showBookingSuccess(data) {
    var modal = $('#booking-modal');
    var passengers = (data.passengers || []).map(function (p) { return '<li>' + esc(p.given_name + ' ' + p.family_name) + '</li>'; }).join('');
    var first = data.slices && data.slices[0] || {}, segs = first.segments || [];
    var route = segs.length ? esc((segs[0].origin && (segs[0].origin.name || segs[0].origin.iata_code) || '') + ' → ' + (segs[segs.length - 1].destination && (segs[segs.length - 1].destination.name || segs[segs.length - 1].destination.iata_code) || '')) : 'Itinerario confirmado';
    modal.innerHTML = '<div class="booking-dialog booking-success" role="dialog" aria-modal="true"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button><div class="success-icon">🎉</div><h2>¡Reserva confirmada con éxito!</h2><p class="pnr-label">Código localizador</p><strong class="pnr">' + esc(data.booking_reference || 'Pendiente') + '</strong><p class="success-route">' + route + '</p><h3>Pasajeros</h3><ul>' + passengers + '</ul><p class="booking-note">Los detalles de tu reserva fueron enviados al e-mail indicado.</p></div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
  }
  async function submitBooking(form) {
    var passengerGroups = form.querySelectorAll('.passenger-fields'), passengers = [];
    Array.prototype.forEach.call(passengerGroups, function (group) {
      var phone = group.querySelector('[name="phone_number"]').value.trim().replace(/[\s().-]/g, '');
      passengers.push({ id: group.getAttribute('data-passenger-id') || undefined, title: group.querySelector('[name="gender"]').value === 'm' ? 'mr' : 'ms', given_name: group.querySelector('[name="given_name"]').value.trim(), family_name: group.querySelector('[name="family_name"]').value.trim(), born_on: group.querySelector('[name="born_on"]').value, gender: group.querySelector('[name="gender"]').value, email: group.querySelector('[name="email"]').value.trim(), phone_number: phone, identity_documents: [{ type: group.querySelector('[name="document_type"]').value, unique_identifier: group.querySelector('[name="document_number"]').value.trim() }] });
    });
    var button = form.querySelector('.confirm-booking'), errorBox = form.querySelector('.booking-error');
    if (!errorBox) { errorBox = document.createElement('p'); errorBox.className = 'booking-error'; form.insertBefore(errorBox, button); }
    errorBox.hidden = true; button.disabled = true; button.textContent = 'Procesando reserva con la aerolínea...';
    try {
      if (passengers.some(function (p) { return !/^\+[1-9]\d{7,14}$/.test(p.phone_number); })) throw new Error('El teléfono debe estar en formato internacional E.164, por ejemplo +59899123456.');
      var response = await fetch('/api/vuelos/reservar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer_id: form.getAttribute('data-offer-id'), passengers: passengers, total_amount: form.getAttribute('data-total-amount'), total_currency: form.getAttribute('data-total-currency') }) });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al emitir la reserva');
      showBookingSuccess(data);
    } catch (error) {
      errorBox.textContent = error.message || 'Error al emitir la reserva'; errorBox.hidden = false;
      button.disabled = false; button.textContent = 'Confirmar y Emitir Reserva';
    }
  }
  function renderDestinationResults(data) {
    var el = $('#destination-results');
    var cards = data.options.map(function (option) {
      var rows = CATS.map(function (c) {
        return '<div><span>' + c[1] + '</span><b>' + money(option.parts[c[0]]) + '</b></div>';
      }).join('');
      var meta = { dest: option.dest, dep: data.meta.dep, ret: data.meta.ret, pax: data.meta.pax };
      return '<article class="destination-card' + (option.fits ? ' fits' : '') + '">' +
        '<div class="destination-card-top"><div><h3>' + esc(option.dest.name) + '</h3><p>' + esc(option.title) + '. ' + esc(option.tierDesc) + '.</p></div>' +
        '<div class="destination-total"><small>Gran total</small><b>' + money(option.total) + '</b><span>' + money(option.pp) + ' por persona</span></div></div>' +
        '<span class="mini ' + (option.fits ? 'g' : 'r') + '">' + (option.fits ? 'Entra en tu presupuesto' : 'Se pasa por ' + money(option.total - data.meta.budget)) + '</span>' +
        '<details><summary>Ver desglose</summary><div class="destination-breakdown">' + rows + '</div></details>' +
        '<button type="button" class="btn-ver-propuesta" data-propuesta-dest="' + esc(option.dest.key) + '">Ver propuesta completa ➔</button>' +
        '</article>';
    }).join('');
    var count = data.options.filter(function (option) { return option.fits; }).length;
    el.innerHTML = '<section class="destination-results-section"><h2>Destinos para tu presupuesto</h2>' +
      '<p class="sub">Estimaciones para ' + data.meta.pax + (data.meta.pax === 1 ? ' viajero' : ' viajeros') + ', ordenadas de menor a mayor costo. ' + count + (count === 1 ? ' destino entra' : ' destinos entran') + ' en tu presupuesto.</p>' +
      '<div class="destination-cards">' + cards + '</div></section>';
  }
  function findDestinations() {
    var budget = S.budget;
    var el = $('#destination-results');
    if (!budget || budget < 1) { el.innerHTML = '<div class="notice">Ingresá un presupuesto máximo para buscar destinos.</div>'; return; }
    if (!S.dep || !S.ret) { el.innerHTML = '<div class="notice">Elegí las fechas de ida y vuelta antes de buscar destinos.</div>'; return; }
    el.innerHTML = '<div class="notice">Buscando destinos para tu presupuesto…</div>';
    var qs = new URLSearchParams({ dep: S.dep, ret: S.ret, pax: S.pax, budget: budget, style: S.style });
    fetch('/api/cotizar-todos?' + qs.toString())
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'No pudimos buscar destinos.');
        renderDestinationResults(res.j);
      })
      .catch(function (e) { el.innerHTML = '<div class="notice">' + esc(e.message || 'No pudimos buscar destinos ahora.') + '</div>'; });
  }
  function notice(msg) { $('#results').innerHTML = '<div class="notice">' + esc(msg) + '</div>'; }

  /* ---------- pedido al servidor ---------- */
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 250); }

  function run() {
    var el = $('#results');
    if (!S.dep || !S.ret) { notice('Elegí las fechas de ida y vuelta para ver el costo.'); return; }
    if (S.dest === 'todos') { findDestinations(); return; }
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    var mine = ctrl;
    el.classList.add('loading');
    var qs = new URLSearchParams({ dest: S.dest, dep: S.dep, ret: S.ret, pax: S.pax, budget: S.budget, style: S.style });
    fetch('/api/cotizar?' + qs.toString(), { signal: mine.signal })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { notice(res.j.error || 'No pudimos calcular tu viaje.'); return; }
        render(res.j);
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return;
        notice('No pudimos calcular ahora. Probá de nuevo en un momento.');
      })
      .then(function () { if (ctrl === mine) el.classList.remove('loading'); });
  }

  /* ---------- pantalla ---------- */
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function titleOf(p) { return p.modeShort + ' + hotel ' + p.tierLabel; }
  function srcTag(p, cat, live) {
    if (!live) return '';
    return p.sources[cat] === 'real' ? '<span class="src real">real</span>' : '<span class="src">estimado</span>';
  }

  function render(data) {
    lastData = data;
    var live = data.meta.mode === 'live';
    var list = data.list, rec = byId(list, S.proposalId) || byId(list, data.recId);
    var dep = parse(data.meta.dep), ret = parse(data.meta.ret), pax = data.meta.pax, budget = data.meta.budget;
    var cheapest = byId(list, data.cheapestId), cozy = byId(list, data.cozyId);

    $('#chip').textContent = live ? 'Precios de referencia' : 'Datos de ejemplo';
    $('#foot').innerHTML = live
      ? '<p><b>Vuelos:</b> precio real de aerolíneas al momento de la búsqueda, en clase económica, por persona. Puede cambiar hasta que reserves. <b>Alojamiento, comidas, traslados y buses:</b> estimaciones.</p>'
      : '<p><b>Datos de ejemplo.</b> Los precios de esta página son estimaciones para mostrar cómo funciona el cálculo. Conectá tu cuenta de Duffel para ver precios reales de vuelos.</p>';

    var pct = Math.min(100, Math.round(rec.total / Math.max(budget, 1) * 100));
    var status = data.fits
      ? 'Entra en tu presupuesto. Te sobran ' + money(budget - rec.total) + '.'
      : 'Ninguna opción entra en ' + money(budget) + '. La más barata te deja ' + money(rec.total - budget) + ' por encima.';

    var note = '';
    if (live) {
      if (rec.sources.pasajes === 'real') {
        note = '<p class="note">Pasaje: precio real de ' + (rec.quote && rec.quote.airline ? esc(rec.quote.airline) : 'una aerolínea') +
          (rec.quote && rec.quote.transfers ? ', con ' + rec.quote.transfers + (rec.quote.transfers === 1 ? ' escala' : ' escalas') : ', sin escalas') + '.</p>';
      } else if (rec.mode === 'avion_mvd' || rec.mode === 'avion_ba') {
        note = '<p class="note">Pasaje: estimado. No encontramos precios reales para estas fechas.</p>';
      } else {
        note = '<p class="note">Pasaje: estimado.</p>';
      }
    }

    var h = '';
    h += '<section class="sec"><div class="hero">' +
      '<div class="tags"><span class="tag">' + (data.fits ? 'La más conveniente para vos' : 'La más barata que encontramos') + '</span>' +
      '<span class="tag ghost">' + esc(data.meta.dest.name) + '</span>' +
      '<span class="tag ghost">' + data.meta.nights + ' noches</span></div>' +
      '<h3>' + esc(titleOf(rec)) + '</h3>' +
      '<p class="meta">' + dLong(dep) + ' a ' + dLong(ret) + ', ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + '. Trayecto ' + esc(rec.dur) + '.</p>' +
      '<div class="perf"><i></i><i></i></div>' +
      '<div class="nums"><div><small>Costo total del viaje</small><span class="big">' + money(rec.total) + '</span></div>' +
      '<div><small>Por persona</small><span class="pp">' + money(rec.pp) + '</span></div></div>' +
      '<div class="budget"><div class="track"><div class="fill' + (data.fits ? '' : ' over') + '" style="width:' + pct + '%"></div></div><p>' + status + '</p></div>' +
      note + '</div></section>';

    h += ctas(data.meta);

    var stack = CATS.map(function (c) { return '<span style="width:' + (rec.parts[c[0]] / rec.total * 100) + '%;background:var(' + c[2] + ')"></span>'; }).join('');
    var leg = CATS.map(function (c) {
      var v = rec.parts[c[0]];
      return '<div><i style="background:var(' + c[2] + ')"></i><span>' + c[1] + '<em>' + Math.round(v / rec.total * 100) + '%</em>' + srcTag(rec, c[0], live) + '</span><b>' + money(v) + '</b></div>';
    }).join('');
    var breakdownSection = '<section class="sec"><h2>A dónde se va la plata</h2><p class="sub">El costo real incluye mucho más que el pasaje.</p>' +
      '<div class="panel"><div class="stack" role="img" aria-label="Distribución del costo">' + stack + '</div><div class="leg">' + leg + '</div></div></section>';

    h += '<section class="sec"><h2>Dónde podés ahorrar</h2><p class="sub">Comparamos fechas, rutas y alojamiento con la propuesta principal.</p><div class="panel">';
    if (data.tips.length) {
      h += data.tips.map(function (t) {
        var title = t.title, text = t.text, btn = '';
        if (t.kind === 'fecha') {
          var n = Math.abs(t.shift);
          title = 'Salí el ' + dLong(parse(t.dep));
          text = n + (n === 1 ? ' día ' : ' días ') + (t.shift < 0 ? 'antes' : 'después') + ', con la misma cantidad de noches.';
          btn = '<button type="button" class="apply" data-shift="' + t.shift + '">Usar estas fechas</button>';
        }
        return '<div class="tip"><div class="save">−' + money(t.save) + '</div><div><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p>' + btn + '</div></div>';
      }).join('');
    } else {
      h += '<p style="margin:0">Con estas fechas y esta ruta ya estás en una muy buena combinación. Probá con otro destino o cambiá el presupuesto.</p>';
    }
    h += '</div></section>';

    var mn = Infinity, mx = -Infinity, bestS = null;
    data.series.forEach(function (x) { if (x.total < mn) { mn = x.total; bestS = x; } if (x.total > mx) mx = x.total; });
    var bars = data.series.map(function (x) {
      var ht = 34 + 96 * ((x.total - mn) / ((mx - mn) || 1));
      var d = parse(x.dep);
      var cls = 'bar' + (x.shift === 0 ? ' cur' : '') + (x === bestS ? ' best' : '');
      return '<button type="button" class="' + cls + '" data-shift="' + x.shift + '" aria-label="Salir el ' + dLong(d) + ': ' + money(x.total) + '">' +
        '<span class="v">' + money(x.total).replace('US$ ', '') + '</span><span class="b" style="height:' + ht + 'px"></span>' +
        '<span class="d"><b>' + d.getDate() + '</b>' + d.toLocaleDateString('es-UY', { month: 'short' }) + '</span></button>';
    }).join('');
    h += '<section class="sec"><h2>Mismo viaje, otra fecha</h2><p class="sub">Costo total en US$ si salís antes o después, con las mismas noches. Es una estimación a partir del precio de tu fecha. Tocá una barra para usarla.</p>' +
      '<div class="panel"><div class="chart">' + bars + '</div>' +
      '<div class="legend"><span class="l1">Tu fecha</span><span class="l2">La más barata</span><span>Otras fechas</span></div></div></section>';

    var opts = list.map(function (p) {
      var tags = '';
      if (p.id === rec.id) tags += '<span class="mini y">Recomendada</span>';
      if (cheapest && p.id === cheapest.id) tags += '<span class="mini">Más barata</span>';
      if (cozy && p.id === cozy.id) tags += '<span class="mini">Más cómoda</span>';
      if (live && p.sources.pasajes === 'real') tags += '<span class="mini g">Pasaje real</span>';
      tags += p.total <= budget ? '<span class="mini g">Entra en tu presupuesto</span>' : '<span class="mini r">Se pasa por ' + money(p.total - budget) + '</span>';
      var rows = CATS.map(function (c) { return '<div><span>' + c[1] + '</span><b>' + money(p.parts[c[0]]) + '</b></div>'; }).join('');
      return '<details class="opt' + (p.id === rec.id ? ' propuesta-seleccionada' : '') + '"><summary><div><div class="t">' + esc(titleOf(p)) + '</div><div class="s">' + esc(p.tierDesc) + '. Trayecto ' + esc(p.dur) + '.</div><div class="tg">' + tags + '</div></div>' +
        '<div class="r"><b>' + money(p.total) + '</b><span>' + money(p.pp) + ' por persona</span></div></summary><div class="body"><div class="proposal-actions"><button type="button" class="btn-ver-propuesta" data-propuesta-id="' + esc(p.id) + '">Ver propuesta ➔</button></div>' + rows + '</div></details>';
    }).join('');
    h += '<section class="sec"><h2>Todas las propuestas</h2><p class="sub">Ordenadas de la más barata a la más cara. Tocá una para ver el desglose.</p><div class="opts">' + opts + '</div></section>';

    var el = $('#results');
    el.innerHTML = h;
    var ch = el.querySelector('.chart'), cu = el.querySelector('.bar.cur');
    if (ch && cu) ch.scrollLeft = cu.offsetLeft - ch.clientWidth / 2 + cu.offsetWidth / 2;
  }

  function showProposalView(proposal, data) {
    var view = $('#vista-detalle'), content = $('#detalle-contenido');
    var breakdown = CATS.map(function (c) { return '<div><span>' + c[1] + '</span><b>' + money(proposal.parts[c[0]]) + '</b></div>'; }).join('');
    content.innerHTML = '<section class="detail-summary"><span class="tag">Propuesta seleccionada</span><h2>' + esc(titleOf(proposal)) + '</h2><p>' + esc(data.meta.dest.name) + ' · Salís desde Montevideo · ' + data.meta.nights + (data.meta.nights === 1 ? ' noche' : ' noches') + '</p><strong>' + money(proposal.total) + '</strong></section>' +
      '<section class="detail-section"><h2>Hoteles Recomendados</h2>' + hotelOptions(data.meta, proposal.parts.alojamiento) + '</section>' +
      '<section class="detail-section"><h2>Reserva tus Vuelos en Vivo</h2>' + flightSearch(data.meta, proposal.parts.pasajes) + '</section>' +
      '<section class="detail-section"><h2>Desglose del viaje</h2><div class="panel detail-breakdown">' + breakdown + '</div></section>' +
      '<section class="detail-section"><h2>Guía Secreta del Destino</h2>' + foodGuide(data.meta) + '</section>';
    $('#vista-principal').classList.add('oculto');
    view.classList.remove('oculto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var liveFlights = view.querySelector('.duffel-search');
    if (liveFlights) searchFlights(data.meta, liveFlights);
  }

  function openDestinationProposal(key) {
    var qs = new URLSearchParams({ dest: key, dep: S.dep, ret: S.ret, pax: S.pax, budget: S.budget, style: S.style });
    fetch('/api/cotizar?' + qs.toString()).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
      if (!res.ok) throw new Error(res.j.error || 'No pudimos cargar la propuesta.');
      showProposalView(byId(res.j.list, res.j.recId), res.j);
    }).catch(function (e) { notice(e.message); });
  }

  // Captura los botones dinámicos antes de que <details> u otro listener los procese.
  function handleProposalNavigation(e) {
    var button = e.target.closest && e.target.closest('.btn-ver-propuesta,[data-propuesta-id],[data-propuesta-dest]');
    if (!button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var destination = button.getAttribute('data-propuesta-dest');
    if (destination) {
      S.dest = destination;
      $('#dest').value = destination;
      $('#destination-results').innerHTML = '';
      openDestinationProposal(destination);
      return;
    }
    var proposal = lastData && byId(lastData.list, button.getAttribute('data-propuesta-id'));
    if (proposal) showProposalView(proposal, lastData);
  }

  /* ---------- formulario ---------- */
  function init() {
    var d0 = addDays(today, 80);
    S.dep = iso(d0); S.ret = iso(addDays(d0, 7));
    $('#dep').value = S.dep; $('#ret').value = S.ret;
    $('#dep').min = iso(addDays(today, 1)); $('#ret').min = iso(addDays(today, 2));
    $('#bud').value = S.budget;
    $('#pax').textContent = S.pax;

    var sel = $('#dest');
    sel.addEventListener('change', function () { S.dest = sel.value; S.proposalId = ''; schedule(); });
    document.addEventListener('click', handleProposalNavigation, true);
    $('#dep').addEventListener('change', function (e) {
      var old = S.dep && S.ret ? Math.round((parse(S.ret) - parse(S.dep)) / 864e5) : 7;
      S.dep = e.target.value;
      if (S.dep && (!S.ret || parse(S.ret) <= parse(S.dep))) { S.ret = iso(addDays(parse(S.dep), Math.max(old, 1))); $('#ret').value = S.ret; }
      schedule();
    });
    $('#ret').addEventListener('change', function (e) { S.ret = e.target.value; schedule(); });
    $('#bud').addEventListener('input', function (e) { S.budget = Math.max(0, Number(e.target.value) || 0); schedule(); });
    $('#pm').addEventListener('click', function () { S.pax = Math.max(1, S.pax - 1); $('#pax').textContent = S.pax; schedule(); });
    $('#pp').addEventListener('click', function () { S.pax = Math.min(10, S.pax + 1); $('#pax').textContent = S.pax; schedule(); });
    $('#seg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.style = b.getAttribute('data-v');
      Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      schedule();
    });
    $('#results').addEventListener('click', function (e) {
      var destinationProposal = e.target.closest('[data-propuesta-dest]');
      if (destinationProposal) { e.preventDefault(); e.stopPropagation(); S.dest = destinationProposal.getAttribute('data-propuesta-dest'); sel.value = S.dest; $('#destination-results').innerHTML = ''; openDestinationProposal(S.dest); return; }
      var proposal = e.target.closest('[data-propuesta-id]');
      if (proposal) { e.preventDefault(); e.stopPropagation(); var selected = lastData && byId(lastData.list, proposal.getAttribute('data-propuesta-id')); if (selected) showProposalView(selected, lastData); return; }
      var selectedFlight = e.target.closest('[data-select-flight]');
      if (selectedFlight) { openBookingForm(selectedFlight); return; }
      var unlock = e.target.closest('[data-unlock-guide]');
      if (unlock) { unlockGuide(); return; }
      var b = e.target.closest('[data-shift]'); if (!b) return;
      var s = Number(b.getAttribute('data-shift'));
      S.dep = iso(addDays(parse(S.dep), s)); S.ret = iso(addDays(parse(S.ret), s));
      $('#dep').value = S.dep; $('#ret').value = S.ret;
      schedule();
    });
    $('#destination-results').addEventListener('click', function (e) {
      var destinationProposal = e.target.closest('[data-propuesta-dest]');
      if (!destinationProposal) return;
      e.preventDefault(); e.stopPropagation(); S.dest = destinationProposal.getAttribute('data-propuesta-dest'); sel.value = S.dest; openDestinationProposal(S.dest);
    });
    $('#vista-detalle').addEventListener('click', function (e) {
      if (e.target.closest('#btn-volver')) { e.preventDefault(); e.stopPropagation(); $('#vista-detalle').classList.add('oculto'); $('#vista-principal').classList.remove('oculto'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      var selectedFlight = e.target.closest('[data-select-flight]');
      if (selectedFlight) { e.preventDefault(); e.stopPropagation(); openBookingForm(selectedFlight); return; }
      var unlock = e.target.closest('[data-unlock-guide]');
      if (unlock) { unlockGuide(); return; }
    });
    $('#booking-modal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-booking]') || e.target === $('#booking-modal')) closeBookingForm();
    });
    $('#booking-modal').addEventListener('submit', function (e) { e.preventDefault(); if (e.target.id !== 'booking-form') return; if (!e.target.checkValidity()) { e.target.reportValidity(); return; } submitBooking(e.target); });

    fetch('/api/destinos').then(function (r) { return r.json(); }).then(function (list) {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); }).forEach(function (d) { var o = document.createElement('option'); o.value = d.key; o.textContent = d.name; sel.appendChild(o); });
      sel.value = S.dest;
      run();
    }).catch(function () { notice('No pudimos cargar los destinos. Recargá la página.'); });
  }

  init();
})();
