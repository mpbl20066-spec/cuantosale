(function () {
  'use strict';

  var CATS = [
    ['pasajes', 'Pasajes', '--c1'],
    ['alojamiento', 'Alojamiento', '--c2'],
    ['comidas', 'Comidas', '--c3'],
    ['local', 'Transporte local', '--c5'],
    ['traslados', 'Traslados', '--c4'],
    ['auto', 'Auto / Roadtrip', '--c4'],
    ['extras', 'Valijas, tasas y seguro', '--c6']
  ];

  var S = { dest: 'todos', dep: '', ret: '', pax: 2, budget: 3000, style: 'eq', transport: 'flight', proposalId: '' };
  var massSearch = false;
  var detailState = null;
  var ROADTRIP_VEHICLES = { onix: 13, gol: 12, argo: 12.5, hilux: 9, kwid: 15 };
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
    if (extra && extra.hotel) query.set('ss', extra.hotel + ', ' + meta.dest.name + ', Brasil');
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
  function hotelTotalForRate(meta, accommodationTotal, multiplier) {
    var nights = Math.max(1, Number(meta.nights) || 1);
    var pax = Math.max(1, Number(meta.pax) || 1);
    var average = Math.max(1, Number(accommodationTotal) || 1) / nights / pax;
    return Math.max(1, Math.round(average * multiplier)) * nights * pax;
  }
  function hotelStyle(meta) {
    var styles = {
      ahorro: { tier: 'eco', title: 'Ahorrar al máximo', badge: 'SÚPER ECONÓMICO', description: 'Posadas, hosteles boutique y opciones de bajo costo.' },
      eq: { tier: 'moderado', title: 'Equilibrado', badge: 'MEJOR RELACIÓN PRECIO-CALIDAD', description: 'Hoteles de gama media con buena ubicación y servicios.' },
      comodo: { tier: 'alto', title: 'Con comodidad', badge: 'COMODIDAD PREMIUM', description: 'Hoteles exclusivos, resorts y posadas de alta gama.' }
    };
    return styles[meta.style] || styles.eq;
  }
  function hotelImageFallback(index, fallback) {
    return fallback || '';
  }
  function sanitizeHotelImageUrl(value, fallback) {
    if (typeof value !== 'string') return fallback || '';
    var text = value.trim();
    var markdown = text.match(/^\[.*?\]\((https?:\/\/[^)]+)\)$/i);
    if (markdown && markdown[1]) return markdown[1].trim();
    var direct = text.match(/https?:\/\/[^\s)>"]+/i);
    return direct ? direct[0].trim() : (fallback || '');
  }
  function normalizeHotelCatalog(catalog, defaultHotel) {
    var unique = [];
    var seen = new Set();
    (catalog || []).forEach(function (item, index) {
      if (!item || !item.name) return;
      var name = String(item.name);
      var image = sanitizeHotelImageUrl(item.image, defaultHotel.image);
      if (!image || seen.has(image)) {
        image = '';
      }
      if (image) seen.add(image);
      unique.push(Object.assign({}, item, { name: name, image: image }));
    });
    return unique.length ? unique : [{ name: defaultHotel.name, image: '', similar: defaultHotel.similar, tier: defaultHotel.tier }];
  }

  function hotelOptions(meta, accommodationTotal) {
    var nights = Math.max(1, Number(meta.nights) || 1);
    var pax = Math.max(1, Number(meta.pax) || 1);
    var average = Math.max(1, Number(accommodationTotal) || 1) / nights / pax;
    var profile = hotelStyle(meta);
    var defaultHotel = { tier: profile.tier, name: profile.tier === 'eco' ? 'Pousada céntrica' : profile.tier === 'alto' ? 'Hotel premium frente al mar' : 'Hotel con desayuno', similar: profile.tier === 'eco' ? ['Hostel boutique', 'Posada familiar'] : profile.tier === 'alto' ? ['Resort boutique', 'Hotel 4 estrellas'] : ['Hotel boutique', 'Hotel 3 estrellas'], image: '' };
    var hotelCatalog = normalizeHotelCatalog(Array.isArray(meta.hotels) && meta.hotels.length ? meta.hotels : [defaultHotel], defaultHotel);
    var hotel = hotelCatalog[0] || defaultHotel;
    var imageMap = {};
    hotelCatalog.forEach(function (item) {
      if (item && item.name) imageMap[String(item.name).toLowerCase()] = sanitizeHotelImageUrl(item.image, defaultHotel.image);
    });
    var options = [{ name: hotel.name, multiplier: 1, recommended: true, similar: Array.isArray(hotel.similar) ? hotel.similar : [], image: sanitizeHotelImageUrl(hotel.image, defaultHotel.image), total: Number(hotel.total) || null, perNight: Number(hotel.perNight) || null, bookingUrl: hotel.bookingUrl || null }].concat((hotel.similar || []).map(function (name, index) {
      var candidate = hotelCatalog.find(function (item) { return item && item.name && String(item.name).toLowerCase() === String(name).toLowerCase(); });
      return { name: name, multiplier: index === 0 ? 0.92 : 1.08, recommended: false, similar: (hotel.similar || []).filter(function (other) { return other !== name; }), image: sanitizeHotelImageUrl((candidate && candidate.image) || imageMap[String(name).toLowerCase()] || defaultHotel.image, defaultHotel.image), total: candidate && Number(candidate.total) ? Number(candidate.total) : null, perNight: candidate && Number(candidate.perNight) ? Number(candidate.perNight) : null, bookingUrl: (candidate && candidate.bookingUrl) || null };
    }));
    return '<section class="hotel-options" aria-labelledby="hotel-options-title"><div class="hotel-options-head"><div><h2 id="hotel-options-title">Hoteles para viajar ' + esc(profile.title.toLowerCase()) + '</h2><p>' + esc(profile.description) + ' Seleccioná una alternativa de ' + money(average) + ' por noche en ' + esc(meta.dest.name) + '.</p></div></div><div class="hotel-grid">' +
      options.map(function (option, index) {
        var nightlyValue = Number(option.perNight) || Math.max(1, Math.round(average * option.multiplier));
        var totalValue = Number(option.total) || hotelTotalForRate(meta, accommodationTotal, option.multiplier);
        var url = option.bookingUrl || bookingUrl(meta, { hotel: option.name });
        var imageUrl = sanitizeHotelImageUrl(option && option.image && typeof option.image === 'string' ? option.image : '', hotelImageFallback(index, defaultHotel.image));
        var imageMarkup = imageUrl ? '<div class="hotel-image-wrap"><img class="hotel-image" src="' + esc(imageUrl) + '" alt="' + esc(option.name) + '" loading="lazy" onerror="this.onerror=null;this.removeAttribute(\'src\');"></div>' : '<div class="hotel-image-wrap hotel-image-empty"><span>Sin foto disponible</span></div>';
        var similar = option.similar.map(function (name) { return '<li><a href="' + esc(bookingUrl(meta, { hotel: name })) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + ' ↗</a></li>'; }).join('');
        return '<article class="hotel-option' + (option.recommended ? ' recommended' : '') + '" data-hotel-option>' + imageMarkup + '<label class="hotel-choice"><input type="radio" name="hotel-choice" value="' + totalValue + '" data-hotel-total="' + totalValue + '"' + (option.recommended ? ' checked' : '') + '> <span class="hotel-badge">' + esc(profile.badge) + '</span></label><h3>' + esc(option.name) + '</h3><p class="hotel-detail">Estimación para ' + nights + (nights === 1 ? ' noche' : ' noches') + ' y ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + '.</p><div class="hotel-price"><small>Desde</small><b>' + money(nightlyValue) + '</b><span>por noche</span></div><strong class="hotel-total">' + money(totalValue) + ' total estimado</strong><a class="hotel-booking" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Ver disponibilidad ↗</a><details class="hotel-similar"><summary>Ver hoteles similares</summary><ul>' + similar + '</ul></details></article>';
      }).join('') + '</div></section>';
  }
  function proposalBreakdownContent(state) {
    if (!state) return '';
    var roadtrip = state.transportMode === 'auto';
    var categories = roadtrip ? ['auto', 'alojamiento', 'comidas'] : ['pasajes', 'alojamiento', 'comidas', 'local', 'traslados', 'extras'];
    var total = roadtrip
      ? Math.round((Number(state.auto) || 0) + (Number(state.hotel) || 0) + (Number(state.parts.comidas) || 0))
      : Math.round((Number(state.flight) || 0) + (Number(state.hotel) || 0) +
        (Number(state.parts.comidas) || 0) + (Number(state.parts.local) || 0) +
        (Number(state.parts.traslados) || 0) + (Number(state.transfer) || 0) + (Number(state.parts.extras) || 0));
    var entries = categories.map(function (category) {
      if (category === 'auto' && !roadtrip) return null;
      var info = CATS.filter(function (c) { return c[0] === category; })[0] || ['', category, '--c1'];
      var value = category === 'pasajes' ? state.flight : category === 'alojamiento' ? state.hotel : category === 'traslados' ? (Number(state.parts.traslados) || 0) + (Number(state.transfer) || 0) : category === 'auto' ? (state.auto || 0) : (state.parts[category] || 0);
      if (Number(value) <= 0) return null;
      return { category: category, label: info[1], color: info[2], value: Number(value) || 0 };
    }).filter(Boolean);
    var segments = entries.map(function (entry) {
      var width = total ? (entry.value / total * 100) : 0;
      return '<span class="proposal-breakdown__segment" style="width:' + width + '%;background:var(' + entry.color + ')"></span>';
    }).join('');
    var rows = entries.map(function (entry) {
      return '<div class="proposal-breakdown__row" data-breakdown-category="' + entry.category + '"><div class="proposal-breakdown__label"><i style="background:var(' + entry.color + ')"></i><span>' + esc(entry.label) + '</span></div><b data-breakdown-value>' + money(entry.value) + '</b></div>';
    }).join('');
    return '<div class="proposal-breakdown__stack" role="img" aria-label="Distribución del costo">' + segments + '</div>' +
      '<div class="proposal-breakdown__list">' + rows + '</div>';
  }
  function proposalBreakdownMarkup(state) {
    return '<section class="proposal-breakdown" data-proposal-breakdown>' +
      '<h2>A dónde va tu plata</h2>' +
      proposalBreakdownContent(state) +
      '</section>';
  }
  function recalcularTotalViaje() {
    if (!detailState) return;
    var parts = detailState.parts;
    var roadtrip = detailState.transportMode === 'auto';
    var transferCost = Number(detailState.transfer) || 0;
    var transport = roadtrip ? detailState.auto : (Number(parts.traslados) || 0) + transferCost;
    var total = roadtrip
      ? Math.round((Number(detailState.auto) || 0) + (Number(detailState.hotel) || 0) + (Number(parts.comidas) || 0))
      : Math.round((Number(detailState.flight) || 0) + (Number(detailState.hotel) || 0) +
        (Number(parts.comidas) || 0) + (Number(parts.local) || 0) + transport + (Number(parts.extras) || 0));
    var totalEl = document.querySelector('[data-detail-total]');
    if (totalEl) totalEl.textContent = money(total);
    var rows = document.querySelectorAll('[data-cost-category]');
    Array.prototype.forEach.call(rows, function (row) {
      var category = row.getAttribute('data-cost-category');
      var value = category === 'pasajes' ? detailState.flight : category === 'alojamiento' ? detailState.hotel : category === 'traslados' ? transport : category === 'auto' ? (roadtrip ? detailState.auto : 0) : category === 'local' && roadtrip ? 0 : (parts[category] || 0);
      var valueEl = row.querySelector('[data-cost-value]');
      if (valueEl) valueEl.textContent = money(Number(value) || 0);
    });
    var breakdown = document.querySelector('[data-proposal-breakdown]');
    if (breakdown) breakdown.innerHTML = '<h2>A dónde va tu plata</h2>' + proposalBreakdownContent(detailState);
  }
  function getSelectedFlightOffer() {
    if (!detailState) return null;
    var offers = Array.isArray(detailState.flightOffers) ? detailState.flightOffers : [];
    var selectedId = detailState.selectedFlightId || (detailState.selectedOffer && detailState.selectedOffer.id);
    if (selectedId) {
      var match = offers.find(function (offer) { return String(offer.id) === String(selectedId); });
      if (match) return match;
    }
    if (detailState.selectedOffer && detailState.selectedOffer.airline) {
      var fallback = offers.find(function (offer) { return String(offer.airline) === String(detailState.selectedOffer.airline); });
      if (fallback) return fallback;
    }
    return offers.length ? offers[0] : null;
  }
  function formatFlightDateTime(value) {
    if (!value) return 'sin fecha';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-UY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function getSelectedFlightSummary() {
    if (!detailState) return { airline: 'Vuelo seleccionado', summary: 'Todavía no elegiste un vuelo.' };
    var offer = getSelectedFlightOffer();
    var airline = (offer && offer.airline) || detailState.selectedFlight || 'Vuelo seleccionado';
    var outbound = offer && (offer.outbound || offer);
    var departureValue = outbound && outbound.departure ? outbound.departure : (offer && offer.departure);
    var arrivalValue = outbound && outbound.arrival ? outbound.arrival : (offer && offer.arrival);
    var departureText = formatFlightDateTime(departureValue);
    var arrivalText = formatFlightDateTime(arrivalValue);
    var route = '';
    if (offer) {
      var origin = airportCode(offer.departure_airport || (offer.outbound && offer.outbound.origin));
      var destination = airportCode(offer.arrival_airport || (offer.outbound && offer.outbound.destination));
      route = ' · ' + origin + ' → ' + destination;
    }
    return {
      airline: airline,
      summary: 'Transfer sincronizado para ' + airline + route + ' · Vuelo seleccionado el ' + departureText + (arrivalText && arrivalText !== 'sin fecha' ? ' · llegada ' + arrivalText : ''),
      departureText: departureText,
      arrivalText: arrivalText,
      route: route
    };
  }
  function sincronizarTrasladoOficial() {
    if (!detailState) return;
    var enabled = detailState.transportMode === 'flight' && !!detailState.selectedFlight && !!detailState.selectedHotel;
    detailState.transfer = enabled ? Number(detailState.meta.officialTransfer.amount) : 0;
    var status = document.querySelector('[data-transfer-status]');
    var button = document.querySelector('[data-buy-transfer]');
    var flightData = getSelectedFlightSummary();
    if (status) status.textContent = enabled
      ? flightData.summary
      : 'Seleccioná una tarifa aérea y una posada para incluir este traslado automáticamente.';
    if (button) { button.disabled = !enabled; button.textContent = 'Seleccioná traslado / transfer'; }
    recalcularTotalViaje();
  }
  function actualizarPasajes(section, price, airline) {
    if (!detailState || !Number.isFinite(price) || price <= 0) return;
    detailState.flight = Math.round(price); detailState.baseFlight = detailState.flight;
    if (airline) detailState.selectedFlight = airline;
    if (section) section.setAttribute('data-selected-flight-price', String(detailState.flight));
    sincronizarTrasladoOficial();
  }
  function actualizarAlojamiento(price, selectedByUser) {
    if (!detailState || !Number.isFinite(price) || price <= 0) return;
    detailState.hotel = Math.round(price);
    if (selectedByUser) detailState.selectedHotel = true;
    sincronizarTrasladoOficial();
  }
  function actualizarTransporte(autoEnabled) {
    if (!detailState) return;
    detailState.transportMode = autoEnabled ? 'auto' : 'flight';
    detailState.auto = autoEnabled ? Number(detailState.roadtrip.totalUsd) : 0;
    detailState.flight = autoEnabled ? 0 : detailState.baseFlight;
    detailState.parts.traslados = autoEnabled ? 0 : detailState.baseTraslados;
    var flow = document.querySelector('[data-transport-flow]');
    if (flow) {
      // Reemplazar, en vez de ocultar, evita que controles de vuelos o transfers
      // queden disponibles en el DOM cuando el usuario eligió auto (y viceversa).
      flow.innerHTML = transportFlow(detailState.meta, detailState.flight, autoEnabled);
      wireTransportFlow(flow);
      var liveFlights = !autoEnabled && flow.querySelector('.flight-search');
      if (liveFlights) searchFlights(detailState.meta, liveFlights);
    }
    sincronizarTrasladoOficial();
  }
  function actualizarRoadtrip(kmPerLiter) {
    if (!detailState || !detailState.roadtrip) return;
    var r = detailState.roadtrip;
    var consumption = Number(kmPerLiter);
    if (!Number.isFinite(consumption) || consumption < 3 || consumption > 40) return;
    r.kmPerLiter = consumption;
    r.liters = Math.round((Number(r.roundTripKm) / consumption) * 10) / 10;
    r.fuelUsd = Math.round(r.liters * Number(r.fuelPriceUsd));
    r.totalUsd = r.fuelUsd + Number(r.tollsUsd);
    var litersEl = document.querySelector('[data-roadtrip-liters]');
    var fuelEl = document.querySelector('[data-roadtrip-fuel]');
    var totalEl = document.querySelector('[data-roadtrip-total]');
    if (litersEl) litersEl.textContent = r.liters + ' litros';
    if (fuelEl) fuelEl.textContent = money(r.fuelUsd);
    if (totalEl) totalEl.textContent = money(r.totalUsd);
    if (detailState.transportMode === 'auto') detailState.auto = r.totalUsd;
    recalcularTotalViaje();
  }
  function actualizarModeloRoadtrip(model) {
    var manual = document.querySelector('[data-roadtrip-consumption]');
    if (!manual) return;
    var custom = model === 'custom';
    manual.hidden = !custom;
    manual.disabled = !custom;
    if (!custom) {
      manual.value = ROADTRIP_VEHICLES[model];
      actualizarRoadtrip(ROADTRIP_VEHICLES[model]);
    } else {
      manual.focus();
    }
  }
  function roadtripCard(meta, autoSelected) {
    return '';
  }
  function roadtripCalculator(meta) {
    var r = meta.roadtrip;
    if (!r) return '';
    return '<section class="transport-options"><div class="transport-card transport-detail" data-roadtrip-calculator><label for="roadtrip-model">Modelo o consumo del auto<select id="roadtrip-model" data-roadtrip-model><option value="onix">Chevrolet Onix · 13 km/l</option><option value="gol" selected>VW Gol · 12 km/l</option><option value="argo">Fiat Argo · 12,5 km/l</option><option value="hilux">Toyota Hilux · 9 km/l</option><option value="kwid">Renault Kwid · 15 km/l</option><option value="custom">Personalizado (Ingresar manual)</option></select></label><label for="roadtrip-consumption">Consumo personalizado (km por litro)<input id="roadtrip-consumption" type="number" inputmode="decimal" min="3" max="40" step="0.1" value="' + esc(r.kmPerLiter || 12) + '" data-roadtrip-consumption hidden disabled></label><p>⛽ Combustible: <span data-roadtrip-liters>' + r.liters + ' litros</span> × ' + money(r.fuelPriceUsd) + '/l = <b data-roadtrip-fuel>' + money(r.fuelUsd) + '</b></p><p>🚧 Peajes estimados: <b>' + money(r.tollsUsd) + '</b></p><p>🚗 Total Auto / Roadtrip: <b data-roadtrip-total>' + money(r.totalUsd) + '</b></p><p>⏱️ Manejo estimado: <b>' + r.hours + ' horas</b></p><p class="cost-note">* Ruta ida y vuelta de ' + r.roundTripKm + ' km. Combustible estimado para ruta/Brasil y peajes incluidos.</p></div></section>';
  }
  function transportFlow(meta, budget, autoSelected) {
    if (autoSelected) return roadtripCalculator(meta);
    return '<section class="detail-section"><h2>Reserva tus Vuelos en Vivo</h2>' + flightSearch(meta, budget) + '</section>' + transferCard(meta);
  }
  function wireTransportFlow(flow) {
    var transferButton = flow.querySelector('[data-buy-transfer]');
    if (!transferButton) return;
    // El bloque se vuelve a crear al alternar el medio de transporte, por eso
    // el botón recibe un listener propio cada vez que se renderiza.
    transferButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      sincronizarTrasladoOficial();
      if (!transferButton.disabled) openTransferModal(detailState.meta);
    });
  }
  function localTransportDescription(meta) {
    var key = String((meta && meta.dest && meta.dest.key) || '').toLowerCase();
    var map = {
      buz: 'Movilidad en vans, taxis locales y caminatas.',
      rio: 'Movilidad en Uber, metro y caminatas.',
      fln: 'Movilidad en vans, taxis y caminatas.',
      sao: 'Movilidad en metro, Uber y caminatas.',
      ssa: 'Movilidad en vans, taxis y caminatas.',
      igu: 'Movilidad en taxis, vans y caminatas.',
      poa: 'Movilidad en colectivos, taxis y caminatas.',
      rec: 'Movilidad en taxis, vans y caminatas.',
      for: 'Movilidad en taxis, vans y caminatas.',
      mcz: 'Movilidad en taxis, vans y caminatas.',
      nat: 'Movilidad en taxis, vans y caminatas.',
      pip: 'Movilidad en taxis, vans y caminatas.',
      default: 'Movilidad local con transporte público y caminatas.'
    };
    return map[key] || map.default;
  }
  function breakdownRows() {
    if (!detailState) return '';
    var roadtrip = detailState.transportMode === 'auto';
    var categories = roadtrip ? ['auto', 'alojamiento', 'comidas'] : ['pasajes', 'alojamiento', 'comidas', 'local', 'traslados', 'extras'];
    return categories.map(function (category) {
      if (category === 'auto' && !roadtrip) return '';
      var label = CATS.filter(function (c) { return c[0] === category; })[0][1];
      var value = category === 'pasajes' ? detailState.flight : category === 'alojamiento' ? detailState.hotel : category === 'traslados' ? (Number(detailState.parts.traslados) || 0) + (Number(detailState.transfer) || 0) : category === 'auto' ? detailState.auto : detailState.parts[category];
      return '<div data-cost-category="' + category + '"><span>' + label + '</span><b data-cost-value>' + money(Number(value) || 0) + '</b></div>';
    }).join('');
  }
  function transferCard(meta) {
    var t = meta.officialTransfer;
    if (!t) return '';
    return '<section class="transport-options official-transfer" data-official-transfer><h2>Transfer desde el aeropuerto</h2><div class="transport-card"><p>Transfer desde el aeropuerto ➔ pousada para ' + esc(meta.dest.name) + ' · tarifa fija de ' + money(t.pricePerPassenger) + ' por pasajero.</p><p data-transfer-status>Seleccioná una tarifa aérea y una posada para incluir este traslado automáticamente.</p><button type="button" class="btn-transfer" data-buy-transfer disabled>Seleccioná transfer / transfer</button></div></section>';
  }
  function openTransferModal(meta) {
    if (!detailState || !detailState.transfer) return;
    var modal = $('#booking-modal'), t = meta.officialTransfer;
    var flightData = getSelectedFlightSummary();
    var flightInfo = '<div class="transfer-flight-sync"><p><b>Vuelo activo:</b> ' + esc(flightData.airline) + '</p><p>' + esc(flightData.summary) + '</p></div>';
    modal.innerHTML = '<div class="booking-dialog" role="dialog" aria-modal="true"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button><h2>Transfer desde el aeropuerto</h2>' + flightInfo + '<p class="booking-summary">Monto exacto: <b>' + money(t.amount) + '</b> · tarifa fija confirmada</p><div class="bank-details"><p><b>Banco:</b> ' + esc(t.bank.bank) + '</p><p><b>Cuenta:</b> ' + esc(t.bank.account) + '</p><p><b>Titular:</b> ' + esc(t.bank.holder) + '</p></div><form id="transfer-form"><input type="hidden" name="amount" value="' + t.amount + '"><label>Comprobante de pago<input required type="file" name="receipt" accept="image/*,.pdf"></label><button class="confirm-booking" type="submit">Cargar comprobante</button></form></div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
  }
  async function submitTransfer(form) {
    var button = form.querySelector('button[type="submit"]'), file = form.querySelector('[name="receipt"]').files[0];
    if (!file) return;
    button.disabled = true; button.textContent = 'Registrando transferencia…';
    try {
      var dataUrl = await new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = reject; reader.readAsDataURL(file); });
      var response = await fetch('/api/traslados/transferencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: form.querySelector('[name="amount"]').value, destination: S.dest, receipt: { name: file.name, type: file.type, data: dataUrl } }) });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.error || 'No pudimos registrar la transferencia.');
      $('#booking-modal').innerHTML = '<div class="booking-dialog booking-success"><div class="success-icon">✅</div><h2>¡Reserva de traslado registrada con éxito!</h2><p class="booking-note">' + esc(result.message) + '</p><button type="button" class="confirm-booking" data-close-booking>Entendido</button></div>';
    } catch (e) { button.disabled = false; button.textContent = 'Confirmar transferencia'; alert(e.message || 'No pudimos registrar la transferencia.'); }
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
    return '<section class="flight-search" aria-labelledby="flight-title"><div><h2 id="flight-title">Vuelos</h2><p>Tarifas aéreas en tiempo real para tu viaje.</p></div>' +
      '<div class="flight-filters" aria-label="Filtros de vuelos"><div><b>Escalas</b><button type="button" data-flight-stop="all" aria-pressed="true">Todos</button><button type="button" data-flight-stop="0">Directos</button><button type="button" data-flight-stop="1">1 escala</button><button type="button" data-flight-stop="2">2+ escalas</button></div><div><b>Horario de salida</b><button type="button" data-flight-time="all" aria-pressed="true">Todo el día</button><button type="button" data-flight-time="morning">Mañana</button><button type="button" data-flight-time="afternoon">Tarde</button><button type="button" data-flight-time="night">Noche</button></div></div>' +
      '<div class="flight-results" aria-live="polite"><p class="flight-loading">Buscando vuelos disponibles…</p></div></section>';
  }
  function flightTime(value) {
    if (!value) return 'Horario no disponible';
    return new Date(value).toLocaleString('es-UY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function airportLabel(airport) {
    airport = airport || {};
    return (airport.code ? airport.code + ' · ' : '') + (airport.name || 'Aeropuerto no informado');
  }
  function airportCode(airport) { return airport && airport.code ? airport.code : '—'; }
  function isCarrascoOffer(offer) {
    // Defensa adicional en el navegador: esta SPA cotiza únicamente desde MVD.
    // Nunca se muestra una alternativa originada en otro aeropuerto.
    return airportCode(offer && offer.departure_airport) === 'MVD';
  }
  function flightHour(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? -1 : date.getHours();
  }
  function filteredFlightOffers(section, offers) {
    var stop = section.getAttribute('data-flight-stop') || 'all';
    var time = section.getAttribute('data-flight-time') || 'all';
    return offers.filter(function (offer) {
      if (!isCarrascoOffer(offer)) return false;
      var stops = Number(offer.stops) || 0;
      var stopOk = stop === 'all' || (stop === '2' ? stops >= 2 : stops === Number(stop));
      var hour = flightHour(offer.departure);
      var timeOk = time === 'all' || (time === 'morning' && hour >= 5 && hour < 12) || (time === 'afternoon' && hour >= 12 && hour < 18) || (time === 'night' && (hour >= 18 || (hour >= 0 && hour < 5)));
      return stopOk && timeOk;
    }).sort(function (a, b) { return (a.price_usd == null ? Infinity : a.price_usd) - (b.price_usd == null ? Infinity : b.price_usd); }).slice(0, 3);
  }
  function getFlightSelectionState() {
    if (!detailState) return null;
    if (!detailState.flightSelection) {
      detailState.flightSelection = { stage: 'outbound', outboundId: null, inboundId: null };
    }
    return detailState.flightSelection;
  }
  function renderFlightOffers(el, data, budget) {
    data = data && typeof data === 'object' ? data : {};
    var offers = (Array.isArray(data.offers) ? data.offers : []).filter(isCarrascoOffer).slice(0, 6);
    if (!offers.length) {
      el.innerHTML = '<p class="flight-empty">No hay vuelos disponibles para esta búsqueda. Probá con otras fechas.</p>';
      return;
    }
    var section = el.closest('.flight-search');
    if (detailState) detailState.flightOffers = offers;
    var flightStep = section.getAttribute('data-flight-step') || 'outbound';
    var state = getFlightSelectionState();
    var stepLabel = flightStep === 'inbound' ? 'Vuelta' : 'Ida';
    var titleEl = section.querySelector('h2');
    var subtitleEl = section.querySelector('p');
    if (titleEl) titleEl.textContent = flightStep === 'inbound' ? 'Vuelos de vuelta' : 'Vuelos de ida';
    if (subtitleEl) subtitleEl.textContent = flightStep === 'inbound' ? 'Elegí la opción de regreso para completar el itinerario.' : 'Elegí la opción de ida para continuar.';
    var visible = filteredFlightOffers(section, offers);
    if (!visible.length) { el.innerHTML = '<p class="flight-empty">No hay vuelos que coincidan con estos filtros.</p>'; return; }
    el.innerHTML = '<div class="flight-cards">' + visible.map(function (offer) {
      var logo = offer.logo ? '<img src="' + esc(offer.logo) + '" alt="" class="flight-logo">' : '<span class="flight-logo-fallback" aria-hidden="true">✈️</span>';
      var price = offer.price_usd === null ? esc(offer.original_price + ' ' + (offer.original_currency || '')) : money(offer.price_usd);
      var routeLabel = offer.trip_type === 'round_trip'
        ? esc(airportCode(offer.outbound && offer.outbound.origin) || airportCode(offer.departure_airport)) + ' → ' + esc(airportCode(offer.outbound && offer.outbound.destination) || airportCode(offer.arrival_airport))
        : esc(airportCode(offer.departure_airport)) + ' → ' + esc(airportCode(offer.arrival_airport));
      var departText = offer.trip_type === 'round_trip' ? (offer.outbound && offer.outbound.departure ? flightTime(offer.outbound.departure) : flightTime(offer.departure)) : flightTime(offer.departure);
      var arrivalText = offer.trip_type === 'round_trip' ? (offer.inbound && offer.inbound.arrival ? flightTime(offer.inbound.arrival) : flightTime(offer.arrival)) : flightTime(offer.arrival);
      var primaryButtonText = flightStep === 'inbound' ? 'Usar en mi paquete' : 'Elegir este vuelo';
      var secondaryButtonText = 'Comprar vuelo ahora';
      var stageBadge = offer.trip_type === 'round_trip' ? '<span class="flight-badge">' + esc(stepLabel) + '</span>' : '<span class="flight-badge">' + esc(offer.recommendation || 'Opción estratégica') + '</span>';
      return '<article class="flight-card within-budget"><div class="flight-airline">' + logo + '<b>' + esc(offer.airline) + '</b>' + stageBadge + '</div>' +
        '<div class="flight-route"><div><small>' + routeLabel + '</small><small>Salida · ' + esc(airportLabel(offer.departure_airport)) + '</small><b>' + esc(departText) + '</b></div><span aria-hidden="true">→</span><div><small>Llegada · ' + esc(airportLabel(offer.arrival_airport)) + '</small><b>' + esc(arrivalText) + '</b></div></div>' +
        '<div class="flight-footer"><span class="flight-badge' + (offer.stops === 0 ? ' direct' : '') + '">' + (offer.stops === 0 ? 'Directo' : offer.stops + (offer.stops === 1 ? ' escala' : ' escalas')) + '</span><span class="flight-duration">' + esc(offer.duration || '') + '</span>' +
        '<div class="flight-price"><small>Precio final</small><b>' + price + '</b></div></div>' +
        '<div class="flight-card__actions"><button type="button" class="select-flight btn btn-primary" data-select-flight="' + esc(offer.id) + '" data-passenger-ids="' + esc(JSON.stringify(offer.passenger_ids || [])) + '" data-offer-price="' + esc(offer.price_usd === null ? '' : offer.price_usd) + '" data-offer-currency="' + esc(offer.original_currency || 'USD') + '" data-offer-airline="' + esc(offer.airline) + '">' + primaryButtonText + '</button>' +
        '<button type="button" class="btn btn-secondary" data-buy-flight-now data-offer-id="' + esc(offer.id) + '" data-passenger-ids="' + esc(JSON.stringify(offer.passenger_ids || [])) + '" data-offer-price="' + esc(offer.price_usd === null ? '' : offer.price_usd) + '" data-offer-currency="' + esc(offer.original_currency || 'USD') + '" data-offer-airline="' + esc(offer.airline) + '">' + secondaryButtonText + '</button></div></article>';
    }).join('') + '</div>';
    if (state && state.outboundId && state.inboundId) {
      var selectedOffer = offers.find(function (offer) { return offer.id === state.inboundId || offer.id === state.outboundId; });
      if (selectedOffer && selectedOffer.price_usd !== null) actualizarPasajes(el.closest('.flight-search'), Number(selectedOffer.price_usd), selectedOffer.airline);
    }
  }
  function searchFlights(meta, section) {
    var box = section.querySelector('.flight-results');
    var budget = 0;
    box.innerHTML = '<p class="flight-loading">Buscando vuelos disponibles…</p>';
    fetch('/api/vuelos/buscar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origen: 'MVD', destino: meta.dest.key, fecha_ida: meta.dep, fecha_vuelta: meta.ret, pasajeros: meta.pax, style: meta.style || S.style || 'eq' }) })
      .then(async function (response) {
        var text = await response.text();
        var data = { offers: [] };
        if (text.trim()) {
          try { data = JSON.parse(text); } catch (e) { data = { offers: [], error: 'La API devolvió una respuesta inválida.' }; }
        }
        if (!response.ok || !Array.isArray(data.offers) || data.offers.length === 0) {
          renderFlightOffers(box, data, budget);
          return;
        }
        renderFlightOffers(box, data, budget);
      })
      .catch(function (e) { box.innerHTML = '<p class="flight-empty">' + esc(e.message || 'No pudimos buscar vuelos.') + '</p>'; })
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
  function persistSelectedOffer(button) {
    if (!button || !detailState) return null;
    var offerId = button.getAttribute('data-select-flight') || button.getAttribute('data-offer-id') || '';
    var offerPrice = Number(button.getAttribute('data-offer-price') || 0) || 0;
    var offerAirline = button.getAttribute('data-offer-airline') || 'Vuelo seleccionado';
    var currency = button.getAttribute('data-offer-currency') || 'USD';
    var passengerIds = [];
    try { passengerIds = JSON.parse(button.getAttribute('data-passenger-ids') || '[]'); } catch (e) { passengerIds = []; }
    detailState.selectedFlightId = offerId;
    detailState.selectedFlight = offerAirline;
    detailState.flight = Math.round(offerPrice);
    detailState.baseFlight = detailState.flight;
    detailState.selectedOffer = { id: offerId, airline: offerAirline, price: offerPrice, currency: currency, passengerIds: passengerIds };
    return { id: offerId, airline: offerAirline, price: offerPrice, currency: currency, passengerIds: passengerIds };
  }
  function openBookingForm(button) {
    var selectedOffer = persistSelectedOffer(button) || { id: button.getAttribute('data-select-flight') || button.getAttribute('data-offer-id') || '', airline: button.getAttribute('data-offer-airline') || 'Vuelo seleccionado', price: Number(button.getAttribute('data-offer-price') || 0) || 0, currency: button.getAttribute('data-offer-currency') || 'USD', passengerIds: [] };
    var modal = $('#booking-modal');
    var passengerIds = Array.isArray(selectedOffer.passengerIds) ? selectedOffer.passengerIds : [];
    modal.innerHTML = '<div class="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button>' +
      '<h2 id="booking-title">Datos de los pasajeros</h2><p class="booking-summary">' + esc(selectedOffer.airline) + ' · ' + money(Number(selectedOffer.price || 0)) + '</p>' +
      '<form id="booking-form" data-offer-id="' + esc(selectedOffer.id) + '" data-total-amount="' + esc(selectedOffer.price || '') + '" data-total-currency="' + esc(selectedOffer.currency || 'USD') + '"><div class="passenger-list">' + passengerFields(S.pax, passengerIds) + '</div><p class="booking-note">Revisá los datos exactamente como aparecen en el documento de viaje. El teléfono debe incluir código de país, por ejemplo +59899123456.</p><button class="confirm-booking" type="submit">Confirmar y Emitir Reserva</button></form></div>';
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
    var fits = data.options.filter(function (option) { return option.fits; });
    var cards = fits.map(function (option) {
      var rows = CATS.map(function (c) {
        return '<div><span>' + c[1] + '</span><b>' + money(option.parts[c[0]]) + '</b></div>';
      }).join('');
      return '<article class="destination-card' + (option.fits ? ' fits' : '') + '">' +
        '<div class="destination-banner destination-banner-' + esc(option.dest.key) + '" aria-hidden="true"><span>' + (option.dest.key === 'rio' ? '🌴' : option.dest.key === 'sao' ? '🏙️' : option.dest.key === 'igu' ? '🌊' : '☀️') + '</span></div>' +
        '<div class="destination-card-top"><div><h3>' + esc(option.dest.name) + '</h3><p>' + esc(option.title) + '. ' + esc(option.tierDesc) + '.</p></div>' +
        '<div class="destination-total"><small>Gran total</small><b>' + money(option.total) + '</b><span>' + money(option.pp) + ' por persona</span></div></div>' +
        '<span class="mini g">¡Entra en tu presupuesto!</span>' +
        '<details><summary>Ver desglose</summary><div class="destination-breakdown">' + rows + '</div></details>' +
        '<button type="button" class="btn-ver-propuesta-destino" data-propuesta-dest="' + esc(option.dest.key) + '">Ver propuesta ➔</button>' +
        '</article>';
    }).join('');
    var titleBudget = Number(data.meta.budget).toLocaleString('es-UY');
    el.innerHTML = '<section class="destination-results-section"><h2>🌍 Destinos disponibles para tu presupuesto de USD $' + titleBudget + '</h2>' +
      '<p class="sub">Estimaciones para ' + data.meta.pax + (data.meta.pax === 1 ? ' viajero' : ' viajeros') + ', ordenadas de menor a mayor costo.</p>' +
      (fits.length ? '<div class="destination-cards">' + cards + '</div>' : '<div class="notice">No encontramos destinos dentro de ese presupuesto. Probá aumentando el monto o ajustando las fechas.</div>') + '</section>';
  }
  function findDestinations() {
    var budget = S.budget;
    var el = $('#destination-results');
    if (!budget || budget < 1) { el.innerHTML = '<div class="notice">Ingresá un presupuesto máximo para buscar destinos.</div>'; return; }
    if (!S.dep || !S.ret) { el.innerHTML = '<div class="notice">Elegí las fechas de ida y vuelta antes de buscar destinos.</div>'; return; }
    massSearch = true;
    $('#results').innerHTML = '';
    el.innerHTML = renderLoadingState('Buscando destinos para tu presupuesto…');
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
  function renderLoadingState(label) {
    var text = label || 'Buscando la mejor propuesta…';
    return '<section class="sec"><div class="loading-shell" aria-live="polite"><div class="loading-status">' + esc(text) + '</div><div class="skeleton skeleton-hero"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div><div class="skeleton-grid"><div class="skeleton-box"></div><div class="skeleton-box"></div></div><div class="skeleton-grid multi"><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div></div></div></section>';
  }

  /* ---------- pedido al servidor ---------- */
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 250); }

  function run() {
    var el = $('#results');
    if (!S.dep || !S.ret) { notice('Elegí las fechas de ida y vuelta para ver el costo.'); return; }
    if (S.dest === 'todos') { return; }
    renderTransportSelector();
    if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    var mine = ctrl;
    el.classList.add('loading');
    el.innerHTML = renderLoadingState('Buscando ofertas para tu viaje…');
    var transportParam = S.transport === 'auto' ? 'auto' : 'flight';
    var qs = new URLSearchParams({ dest: S.dest, dep: S.dep, ret: S.ret, pax: S.pax, budget: S.budget, style: S.style, transport: transportParam });
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
  function costNote(cat, meta, p) {
    var city = esc(meta.dest.name);
    var localNotes = {
      buz: 'Movilidad en vans, taxis locales y caminatas.',
      rio: 'Movilidad en Uber, metro y caminatas.',
      fln: 'Movilidad en vans, taxis y caminatas.',
      sao: 'Movilidad en metro, Uber y caminatas.',
      ssa: 'Movilidad en vans, taxis y caminatas.',
      igu: 'Movilidad en taxis, vans y caminatas.',
      poa: 'Movilidad en colectivos, taxis y caminatas.',
      rec: 'Movilidad en taxis, vans y caminatas.',
      for: 'Movilidad en taxis, vans y caminatas.',
      mcz: 'Movilidad en taxis, vans y caminatas.',
      nat: 'Movilidad en taxis, vans y caminatas.',
      pip: 'Movilidad en taxis, vans y caminatas.',
      default: 'Movilidad local con transporte público y caminatas.'
    };
    var text = {
      pasajes: 'Tarifa aérea en tiempo real.',
      alojamiento: 'Estimación oficial para estadía en ' + city + '.',
      comidas: 'Basado en precios reales de mercado y gastronomía local.',
      local: localNotes[String(meta && meta.dest && meta.dest.key ? meta.dest.key.toLowerCase() : '')] || localNotes.default,
      traslados: 'Servicio oficial Aeropuerto ⇄ Hotel.',
      auto: 'Combustible y peajes de la ruta ida y vuelta.',
      extras: 'Tasas aeroportuarias, equipaje y asistencia al viajero.'
    };
    return '<small class="cost-note">' + (text[cat] || 'Detalle del viaje.') + '</small>';
  }

  function getLocalTransportFromData(data) {
    if (!data) return null;
    var local = data.meta && (data.meta.localTransport || data.meta.transporteLocal) ? (data.meta.localTransport || data.meta.transporteLocal) : data.localTransport;
    if (!local || !Number(local.totalUsd) && !Number(local.total_usd)) return null;
    var total = Number(local.totalUsd || local.total_usd || 0);
    return { totalUsd: total, dailyUsd: Number(local.dailyUsd || local.daily_usd || 0), multiplier: Number(local.multiplier || 1), totalDays: Number(local.totalDays || local.total_days || 0) };
  }
  function normalizeLocalTransportInProposal(data, proposal) {
    if (!proposal || !proposal.parts) return proposal;
    var local = getLocalTransportFromData(data);
    if (!local) return proposal;
    var nextLocal = Math.round(Number(local.totalUsd) || 0);
    var previousLocal = Number(proposal.parts.local) || 0;
    var delta = nextLocal - previousLocal;
    var nextParts = Object.assign({}, proposal.parts, { local: nextLocal });
    var baselineTotal = Number(proposal.total) || 0;
    var nextTotal = Math.max(0, Math.round(baselineTotal + delta));
    var pax = Number(data && data.meta && data.meta.pax) || Number(proposal.pax) || 1;
    return Object.assign({}, proposal, { parts: nextParts, total: nextTotal, pp: Math.round(nextTotal / Math.max(1, pax)) });
  }
  function normalizeLocalTransportInList(data) {
    if (!data || !Array.isArray(data.list)) return data && data.list ? data.list : [];
    var local = getLocalTransportFromData(data);
    if (!local) return data.list;
    return data.list.map(function (proposal) { return normalizeLocalTransportInProposal(data, proposal); });
  }
  function isRoadtripDestinationAllowed(destKey) {
    var key = String(destKey || S.dest || '').toLowerCase();
    return ['rio', 'buz', 'fln', 'sao', 'igu', 'poa'].indexOf(key) >= 0;
  }
  function getAvailableTransportModes(destKey) {
    var key = String(destKey || S.dest || 'todos').toLowerCase();
    var modes = [{ value: 'flight', label: 'Vuelo' }, { value: 'bus', label: 'Bus' }];
    if (isRoadtripDestinationAllowed(key)) modes.push({ value: 'auto', label: 'Auto / Roadtrip' });
    return modes;
  }
  function renderTransportSelector() {
    var wrap = document.getElementById('transport-selector');
    if (!wrap) return;
    var key = String(S.dest || 'todos').toLowerCase();
    var modes = getAvailableTransportModes(key);
    var current = String(S.transport || 'flight').toLowerCase();
    if (current === 'roadtrip') current = 'auto';
    if (current === 'auto' && !isRoadtripDestinationAllowed(key)) current = 'flight';
    if (!modes.some(function (mode) { return mode.value === current; })) current = modes[0].value;
    S.transport = current;
    wrap.innerHTML = modes.map(function (mode) {
      return '<button type="button" data-transport-mode="' + mode.value + '" aria-pressed="' + (mode.value === current ? 'true' : 'false') + '">' + esc(mode.label) + '</button>';
    }).join('');
  }
  function transportModeFilter(list, selectedMode) {
    if (!Array.isArray(list)) return list;
    var mode = String(selectedMode || S.transport || 'flight').toLowerCase();
    if (mode === 'auto' || mode === 'roadtrip') return list.filter(function (proposal) { return proposal && proposal.mode === 'auto'; });
    return list.filter(function (proposal) { return proposal && proposal.mode !== 'auto'; });
  }
  function render(data) {
    lastData = data;
    var live = data.meta.mode === 'live';
    if (!isRoadtripDestinationAllowed(data.meta.dest.key) && S.transport === 'auto') S.transport = 'flight';
    var list = transportModeFilter(normalizeLocalTransportInList(data), S.transport);
    if (!list.length) list = transportModeFilter(normalizeLocalTransportInList(data), 'flight');
    var rec = byId(list, S.proposalId) || byId(list, data.recId);
    if (!rec && list.length) rec = list[0];
    var dep = parse(data.meta.dep), ret = parse(data.meta.ret), pax = data.meta.pax, budget = data.meta.budget;
    var cheapest = byId(list, data.cheapestId), cozy = byId(list, data.cozyId);

    $('#chip').textContent = live ? 'Precios de referencia' : 'Datos de ejemplo';
    $('#foot').innerHTML = live
      ? '<p><b>Vuelos:</b> tarifa aérea real al momento de la búsqueda, por persona. Puede cambiar hasta que reserves. <b>Alojamiento, comidas, traslados y buses:</b> valores de referencia.</p>'
      : '<p><b>Datos de ejemplo.</b> Los precios de esta página son referencias para mostrar cómo funciona el cálculo. Activá la búsqueda de tarifas aéreas en tiempo real para consultar disponibilidad.</p>';

    var pct = Math.min(100, Math.round(rec.total / Math.max(budget, 1) * 100));
    var status = data.fits
      ? 'Entra en tu presupuesto. Te sobran ' + money(budget - rec.total) + '.'
      : 'Ninguna opción entra en ' + money(budget) + '. La más barata te deja ' + money(rec.total - budget) + ' por encima.';
    var sourceBadge = live ? 'Precios reales' : 'Precios estimados';
    var sourcePill = '<span class="tag ghost source-pill">' + esc(sourceBadge) + '</span>';

    var h = '';
    h += '<section class="sec"><div class="hero">' +
      '<div class="tags"><span class="tag">' + (data.fits ? 'La más conveniente para vos' : 'La más barata que encontramos') + '</span>' +
      '<span class="tag ghost">' + esc(data.meta.dest.name) + '</span>' +
      '<span class="tag ghost">' + data.meta.nights + ' noches</span>' + sourcePill + '</div>' +
      '<h3>' + esc(titleOf(rec)) + '</h3>' +
      '<p class="meta">' + dLong(dep) + ' a ' + dLong(ret) + ', ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + '. Trayecto ' + esc(rec.dur) + '.</p>' +
      '<div class="perf"><i></i><i></i></div>' +
      '<div class="nums"><div><small>Costo total del viaje</small><span class="big">' + money(rec.total) + '</span></div>' +
      '<div><small>Por persona</small><span class="pp">' + money(rec.pp) + '</span></div></div>' +
      '<div class="budget"><div class="track"><div class="fill' + (data.fits ? '' : ' over') + '" style="width:' + pct + '%"></div></div><p>' + status + '</p></div>' +
      '</div></section>';

    var activeCats = CATS.filter(function (c) { return Number(rec.parts[c[0]]) > 0; });
    var stack = activeCats.map(function (c) { return '<span style="width:' + (rec.parts[c[0]] / rec.total * 100) + '%;background:var(' + c[2] + ')"></span>'; }).join('');
    var leg = activeCats.map(function (c) {
      var v = rec.parts[c[0]];
      return '<div><i style="background:var(' + c[2] + ')"></i><span>' + c[1] + '<em>' + Math.round(v / rec.total * 100) + '%</em>' + srcTag(rec, c[0], live) + costNote(c[0], data.meta, rec) + '</span><b>' + money(v) + '</b></div>';
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
      var rows = CATS.filter(function (c) { return Number(p.parts[c[0]]) > 0; }).map(function (c) { return '<div><span>' + c[1] + '</span><b>' + money(p.parts[c[0]]) + '</b></div>'; }).join('');
      return '<details class="opt' + (p.id === rec.id ? ' propuesta-seleccionada' : '') + '"><summary><div><div class="t">' + esc(titleOf(p)) + '</div><div class="s">' + esc(p.tierDesc) + '. Trayecto ' + esc(p.dur) + '.</div><div class="tg">' + tags + '</div></div>' +
        '<div class="r"><b>' + money(p.total) + '</b><span>' + money(p.pp) + ' por persona</span></div></summary><div class="body">' + rows + '<div class="proposal-actions"><button type="button" class="btn-ver-propuesta" data-propuesta-id="' + esc(p.id) + '">Ver propuesta ➔</button></div></div></details>';
    }).join('');
    h += '<section class="sec"><h2>Todas las propuestas</h2><p class="sub">Ordenadas de la más barata a la más cara. Tocá una para ver el desglose.</p><div class="opts">' + opts + '</div></section>';

    var el = $('#results');
    el.innerHTML = h;
    var ch = el.querySelector('.chart'), cu = el.querySelector('.bar.cur');
    if (ch && cu) ch.scrollLeft = cu.offsetLeft - ch.clientWidth / 2 + cu.offsetWidth / 2;
  }

  function showProposalView(proposal, data) {
    var view = $('#vista-detalle'), content = $('#detalle-contenido');
    var isRoadtrip = proposal.mode === 'auto';
    proposal = normalizeLocalTransportInProposal(data, proposal);
    var selectedHotelTotal = hotelTotalForRate(data.meta, proposal.parts.alojamiento, 1);
    detailState = { parts: Object.assign({}, proposal.parts), flight: proposal.parts.pasajes, baseFlight: proposal.parts.pasajes, baseTraslados: proposal.parts.traslados, hotel: selectedHotelTotal, auto: isRoadtrip ? Number(proposal.parts.auto) : 0, transfer: 0, transportMode: isRoadtrip ? 'auto' : 'flight', roadtrip: proposal.roadtrip || data.meta.roadtrip, meta: data.meta, selectedFlightId: '', selectedFlight: '', selectedOffer: null, selectedHotel: true };
    content.innerHTML = '<div class="detail-layout"><div class="detail-main">' +
      '<section class="detail-summary"><span class="tag">Propuesta seleccionada</span><h2>' + esc(titleOf(proposal)) + '</h2><p>' + esc(data.meta.dest.name) + ' · Salís desde Montevideo · ' + data.meta.nights + (data.meta.nights === 1 ? ' noche' : ' noches') + '</p><strong data-detail-total>' + money(proposal.total) + '</strong></section>' +
      proposalBreakdownMarkup(detailState) +
      '<div data-transport-flow>' + transportFlow(detailState.meta, detailState.flight, isRoadtrip) + '</div>' +
      '<section class="detail-section"><h2>Hoteles Recomendados</h2>' + hotelOptions(data.meta, proposal.parts.alojamiento) + '</section>' +
      '<section class="detail-section"><h2>Recomendaciones</h2>' + foodGuide(data.meta) + '</section>' +
      '</div></div>';
    $('#btn-volver').textContent = massSearch ? '⬅ Volver a todos los destinos' : '⬅ Volver a las propuestas';
    actualizarTransporte(isRoadtrip);
    $('#vista-principal').classList.add('oculto');
    view.classList.remove('oculto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    renderTransportSelector();

    var sel = $('#dest');
    function updateDestinationMode() {
      var all = S.dest === 'todos';
      $('#btn-buscar-todos').hidden = !all;
      if (all) { $('#results').innerHTML = ''; $('#destination-results').innerHTML = ''; }
    }
    function syncTransportSelection() {
      if (S.dest === 'todos') { S.transport = 'flight'; }
      if (S.transport === 'roadtrip') S.transport = 'auto';
      if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
      if (['flight', 'bus', 'auto'].indexOf(S.transport) < 0) S.transport = 'flight';
      renderTransportSelector();
    }
    sel.addEventListener('change', function () {
      S.dest = sel.value; S.proposalId = '';
      if (S.dest === 'todos') { S.transport = 'flight'; }
      else if (!isRoadtripDestinationAllowed(S.dest) && S.transport === 'auto') { S.transport = 'flight'; }
      massSearch = false; updateDestinationMode(); syncTransportSelection(); if (S.dest !== 'todos') schedule();
    });
    $('#transport-selector').addEventListener('click', function (e) {
      var button = e.target.closest('[data-transport-mode]');
      if (!button) return;
      S.transport = button.getAttribute('data-transport-mode');
      if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
      renderTransportSelector();
      if (S.dest !== 'todos') schedule();
    });
    $('#btn-buscar-todos').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); findDestinations(); });
    $('.form').addEventListener('keydown', function (e) { if (e.key === 'Enter' && S.dest === 'todos') { e.preventDefault(); $('#btn-buscar-todos').click(); } });
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
      if (selectedFlight) {
        e.preventDefault(); e.stopPropagation();
        persistSelectedOffer(selectedFlight);
        openBookingForm(selectedFlight);
        return;
      }
      var buyFlightNow = e.target.closest('[data-buy-flight-now]');
      if (buyFlightNow) {
        e.preventDefault(); e.stopPropagation();
        persistSelectedOffer(buyFlightNow);
        openBookingForm(buyFlightNow);
        return;
      }
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
      if (e.target.closest('#btn-volver')) {
        e.preventDefault(); e.stopPropagation();
        $('#vista-detalle').classList.add('oculto'); $('#vista-principal').classList.remove('oculto');
        if (massSearch) { S.dest = 'todos'; sel.value = 'todos'; $('#btn-buscar-todos').hidden = false; }
        window.scrollTo({ top: 0, behavior: 'smooth' }); return;
      }
      var hotelChoice = e.target.closest('[data-hotel-total]');
      if (hotelChoice && hotelChoice.checked) { actualizarAlojamiento(Number(hotelChoice.getAttribute('data-hotel-total')), true); return; }
      var hotelCard = e.target.closest('[data-hotel-option]');
      if (hotelCard && !e.target.closest('.hotel-booking,.hotel-similar')) {
        var hotelInput = hotelCard.querySelector('[data-hotel-total]');
        if (hotelInput) { hotelInput.checked = true; actualizarAlojamiento(Number(hotelInput.getAttribute('data-hotel-total')), true); }
        return;
      }
      var transportChoice = e.target.closest('[name="transport-choice"]');
      if (transportChoice) {
        var chosenMode = transportChoice.value === 'auto' ? 'auto' : 'flight';
        if (chosenMode === 'auto' && !isRoadtripDestinationAllowed(detailState.meta.dest.key)) {
          return;
        }
        S.transport = chosenMode;
        actualizarTransporte(chosenMode === 'auto');
        return;
      }
      var flightFilter = e.target.closest('[data-flight-stop],[data-flight-time]');
      if (flightFilter) {
        var flightSection = flightFilter.closest('.flight-search');
        if (flightFilter.hasAttribute('data-flight-stop')) flightSection.setAttribute('data-flight-stop', flightFilter.getAttribute('data-flight-stop'));
        if (flightFilter.hasAttribute('data-flight-time')) flightSection.setAttribute('data-flight-time', flightFilter.getAttribute('data-flight-time'));
        Array.prototype.forEach.call(flightSection.querySelectorAll('[data-flight-stop]'), function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-flight-stop') === (flightSection.getAttribute('data-flight-stop') || 'all'))); });
        Array.prototype.forEach.call(flightSection.querySelectorAll('[data-flight-time]'), function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-flight-time') === (flightSection.getAttribute('data-flight-time') || 'all'))); });
        if (detailState && detailState.flightOffers) renderFlightOffers(flightSection.querySelector('.flight-results'), { offers: detailState.flightOffers });
        return;
      }
      var buyTransfer = e.target.closest('[data-buy-transfer]');
      if (buyTransfer) { e.preventDefault(); e.stopPropagation(); openTransferModal(detailState.meta); return; }
      var selectedFlight = e.target.closest('[data-select-flight]');
      if (selectedFlight) {
        e.preventDefault(); e.stopPropagation();
        var offerId = selectedFlight.getAttribute('data-select-flight');
        var state = getFlightSelectionState();
        if (state && detailState && detailState.flightOffers) {
          var offer = detailState.flightOffers.find(function (item) { return String(item.id) === String(offerId); });
          var roundTrip = offer && offer.trip_type === 'round_trip';
          if (roundTrip) {
            var section = selectedFlight.closest('.flight-search');
            if (!state.outboundId) {
              state.outboundId = offerId;
              section.setAttribute('data-flight-step', 'inbound');
              renderFlightOffers(section.querySelector('.flight-results'), { offers: detailState.flightOffers });
              return;
            }
            if (state.outboundId && !state.inboundId) {
              state.inboundId = offerId;
              section.setAttribute('data-flight-step', 'done');
              persistSelectedOffer(selectedFlight);
              actualizarPasajes(section, Number(selectedFlight.getAttribute('data-offer-price')), selectedFlight.getAttribute('data-offer-airline'));
              openBookingForm(selectedFlight); return;
            }
          }
        }
        persistSelectedOffer(selectedFlight);
        actualizarPasajes(selectedFlight.closest('.flight-search'), Number(selectedFlight.getAttribute('data-offer-price')), selectedFlight.getAttribute('data-offer-airline'));
        openBookingForm(selectedFlight); return;
      }
      var buyFlightNow = e.target.closest('[data-buy-flight-now]');
      if (buyFlightNow) {
        e.preventDefault(); e.stopPropagation();
        persistSelectedOffer(buyFlightNow);
        openBookingForm(buyFlightNow);
        return;
      }
      var unlock = e.target.closest('[data-unlock-guide]');
      if (unlock) { unlockGuide(); return; }
    });
    $('#vista-detalle').addEventListener('change', function (e) {
      var hotelChoice = e.target.closest && e.target.closest('[data-hotel-total]');
      if (hotelChoice && hotelChoice.checked) actualizarAlojamiento(Number(hotelChoice.getAttribute('data-hotel-total')), true);
      var consumption = e.target.closest && e.target.closest('[data-roadtrip-consumption]');
      if (consumption) actualizarRoadtrip(consumption.value);
      var roadtripModel = e.target.closest && e.target.closest('[data-roadtrip-model]');
      if (roadtripModel) actualizarModeloRoadtrip(roadtripModel.value);
    });
    $('#vista-detalle').addEventListener('input', function (e) {
      var consumption = e.target.closest && e.target.closest('[data-roadtrip-consumption]');
      if (consumption) actualizarRoadtrip(consumption.value);
    });
    $('#booking-modal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-booking]') || e.target === $('#booking-modal')) closeBookingForm();
    });
    $('#booking-modal').addEventListener('submit', function (e) { e.preventDefault(); if (e.target.id !== 'booking-form' && e.target.id !== 'transfer-form') return; if (!e.target.checkValidity()) { e.target.reportValidity(); return; } if (e.target.id === 'transfer-form') submitTransfer(e.target); else submitBooking(e.target); });

    fetch('/api/destinos').then(function (r) { return r.json(); }).then(function (list) {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); }).forEach(function (d) { var o = document.createElement('option'); o.value = d.key; o.textContent = d.name; sel.appendChild(o); });
      sel.value = S.dest;
      updateDestinationMode();
      run();
    }).catch(function () { notice('No pudimos cargar los destinos. Recargá la página.'); });
  }

  init();
})();
