'use strict';
/*
 * Carga las agencias de las que salen los tours (data/_trabajo/fuentes-tours-agencias.csv)
 * como proveedores del panel /admin, con los destinos que cubre cada una (de
 * data/_trabajo/tours-agencias.json).
 *
 *   node scripts/importar-proveedores.js            muestra lo que haria, sin escribir
 *   node scripts/importar-proveedores.js --aplicar  los guarda (Supabase si esta en .env)
 *
 * No duplica: una agencia que ya existe con el mismo nombre se saltea, asi no pisa
 * el telefono, el contacto o los datos de pago que se hayan cargado a mano en el panel.
 *
 * Los destinos van en `servicios` ("Tours · Angra dos Reis, Paraty"): el panel los usa
 * para mostrar primero, en cada pedido, los proveedores de ese destino.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
try {
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* sin .env: guarda en data/_trabajo/pedidos.json */ }
const pedidos = require('../lib/pedidos');

function leerCsv(archivo) {
  const lineas = fs.readFileSync(archivo, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const cab = lineas.shift().split(',');
  return lineas.map(function (l) {
    const v = l.split(',');   // el CSV de fuentes no trae comas dentro de los campos
    const o = {}; cab.forEach(function (c, i) { o[c] = (v[i] || '').trim(); }); return o;
  });
}

function armar() {
  const fuentes = leerCsv(path.join(RAIZ, 'data', '_trabajo', 'fuentes-tours-agencias.csv'));
  const tours = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', '_trabajo', 'tours-agencias.json'), 'utf8'));
  const destinos = {};
  (Array.isArray(tours) ? tours : []).forEach(function (t) {
    if (!t.agencia || !t.destino) return;
    (destinos[t.agencia] = destinos[t.agencia] || []).indexOf(t.destino) < 0 && destinos[t.agencia].push(t.destino);
  });
  return fuentes.map(function (f) {
    const d = destinos[f.agencia] || [];
    return {
      nombre: f.agencia,
      // omitidos_transfers: traslados que la agencia publica y el scraper dejo afuera de los tours
      servicios: (Number(f.omitidos_transfers) > 0 ? 'Tours y traslados' : 'Tours') + (d.length ? ' · ' + d.join(', ') : ''),
      notas: 'Web: ' + f.sitio + (d.length ? '' : '\nTodavía sin tours cargados en la app.'),
      activo: true
    };
  });
}

async function main() {
  const aplicar = process.argv.indexOf('--aplicar') >= 0;
  const nuevos = armar();
  const existentes = await pedidos.listarProveedores();
  const ya = {}; existentes.forEach(function (p) { ya[String(p.nombre).trim().toLowerCase()] = 1; });
  console.log('Almacenamiento: ' + pedidos.modo() + ' · ya hay ' + existentes.length + ' proveedor(es)');
  let creados = 0;
  for (const p of nuevos) {
    if (ya[p.nombre.toLowerCase()]) { console.log('  = ya existe   ' + p.nombre); continue; }
    console.log('  + ' + (aplicar ? 'cargado     ' : 'se cargaria ') + p.nombre + ' — ' + p.servicios);
    if (aplicar) { await pedidos.guardarProveedor(null, p); creados++; }
  }
  console.log(aplicar ? creados + ' proveedor(es) nuevos.' : 'Nada se guardo. Corre con --aplicar para cargarlos.');
}
main().catch(function (e) { console.error(e.message); process.exit(1); });
