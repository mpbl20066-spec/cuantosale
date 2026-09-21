(() => {
  'use strict';
  const out = document.getElementById('out');
  const p = new URLSearchParams(location.search);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n, cur) => `${cur === 'USD' ? 'US$' : esc(cur || '')} ${Number(n).toLocaleString('es-UY', { maximumFractionDigits: 2 })}`;
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
  const back = '<p><a class="cta" style="display:inline-block;text-decoration:none" href="/">Volver a CuántoSale</a></p>';

  if (p.get('estado') === 'fallo') {
    out.innerHTML = '<h1>No pudimos completar la reserva</h1><p class="lead">No se hizo ningún cobro por este intento. Podés volver y probar de nuevo.</p>' + back;
    return;
  }
  const orderId = p.get('order_id'), reference = p.get('reference');
  if (!orderId || !reference) {
    out.innerHTML = '<h1>Tu reserva</h1><p class="lead">No encontramos los datos de la reserva en este enlace.</p>' + back;
    return;
  }
  fetch('/api/reservas/vuelo?' + new URLSearchParams({ order_id: orderId, reference }))
    .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      if (!ok) throw new Error(j.error || 'error');
      const legs = (j.slices || []).map((s) => `<li><b>${esc(s.origin || '')} → ${esc(s.destination || '')}</b> ${s.departingAt ? '· ' + esc(when(s.departingAt)) : ''}</li>`).join('');
      out.innerHTML = `<h1>¡Vuelo reservado!</h1>
        <div class="panel" style="margin:18px 0">
          <p class="lbl">Código de reserva</p>
          <p style="font-family:var(--fh);font-weight:800;font-size:56px;line-height:1;margin:0">${esc(j.bookingReference || 'en proceso')}</p>
          <ul style="padding-left:18px">${legs}</ul>
          <p class="b-note">${j.airline ? esc(j.airline) + '. ' : ''}${j.passengers ? j.passengers + (j.passengers === 1 ? ' pasajero. ' : ' pasajeros. ') : ''}${j.total ? 'Total: ' + money(j.total, j.currency) + '.' : ''}</p>
        </div>
        <p class="lead">Te llega la confirmación por email. Ahora podés volver para reservar el alojamiento y contratar el seguro.</p>${back}`;
    })
    .catch(() => {
      out.innerHTML = '<h1>Recibimos tu reserva</h1><p class="lead">No pudimos mostrar los detalles ahora, pero la confirmación te llega por email desde Duffel.</p>' + back;
    });
})();
