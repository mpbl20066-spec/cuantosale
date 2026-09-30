# -*- coding: utf-8 -*-
"""Aplica data/tours-editar.xlsx sobre data/tours.json.

    python scripts/importar-tours-xlsx.py --dry-run
    python scripts/importar-tours-xlsx.py

Identifica cada tour por (código destino, título). Solo actualiza descripción,
detalle, precio_brl y precio. Una fila que no matchea se avisa y se ignora: no
crea ni borra tours. Si hay precio_brl, el USD se recalcula con _meta
(cotizacion_brl_usd y margen_usd), igual que scripts/build-tours.js.
"""
import json, os, sys
from openpyxl import load_workbook

RAIZ = os.path.join(os.path.dirname(__file__), '..')
JSON_PATH = os.path.join(RAIZ, 'data', 'tours.json')
XLSX = os.path.join(RAIZ, 'data', 'tours-editar.xlsx')
DRY = '--dry-run' in sys.argv

d = json.load(open(JSON_PATH, encoding='utf8'))
cot, margen = d['_meta']['cotizacion_brl_usd'], d['_meta']['margen_usd']
idx = {(t['destinos'][0], t['titulo']): t for t in d['tours']}

def num(v):
    if v is None or str(v).strip() == '':
        return None
    return round(float(v), 2)

cambios, sin_match, vistos = [], [], set()
ws = load_workbook(XLSX, data_only=True)['Tours']
for row in ws.iter_rows(min_row=2, values_only=True):
    cod, _dest, tit, desc, det, brl, usd, foto, dur, grupo, salida, edad, activo = (list(row[:13]) + [None] * 13)[:13]
    if not tit:
        continue
    t = idx.get((cod, tit))
    if not t:
        sin_match.append((cod, tit)); continue
    vistos.add((cod, tit))
    brl, usd = num(brl), num(usd)
    if brl is not None and brl != t.get('precio_brl'):
        usd = round(brl / cot + margen, 2)
    elif brl is not None:
        usd = t['precio']  # R$ sin tocar: no se reescribe el USD guardado
    if usd is None:
        print('SIN PRECIO, se ignora la fila:', cod, tit); continue
    txt = lambda v: '' if v is None else str(v).strip()
    foto = txt(foto)
    if foto and not foto.lower().startswith(('http://', 'https://')):
        print('FOTO IGNORADA (no es un link http/https):', cod, tit); foto = t.get('image', '')
    nuevo = {'descripcion': desc or '', 'detalle': det or '', 'precio': usd,
             'image': foto, 'duracion': txt(dur), 'grupo': txt(grupo), 'salida': txt(salida), 'edad': txt(edad)}
    nuevo['activo'] = False if txt(activo).lower() == 'no' else None
    # Vacio y ausente son lo mismo: no se escribe '' en el JSON.
    antes = {k: (t.get(k) or None) if k in ('image', 'duracion', 'grupo', 'salida', 'edad') else t.get(k) for k in nuevo}
    antes['activo'] = False if t.get('activo') is False else None
    for k in ('image', 'duracion', 'grupo', 'salida', 'edad'):
        nuevo[k] = nuevo[k] or None
    if brl is not None:
        nuevo['precio_brl'] = brl; antes['precio_brl'] = t.get('precio_brl')
    elif 'precio_brl' in t:
        nuevo['precio_brl'] = None; antes['precio_brl'] = t['precio_brl']
    dif = {k: (antes[k], v) for k, v in nuevo.items() if antes[k] != v}
    if dif:
        cambios.append((cod, tit, dif))
        if not DRY:
            for k, v in nuevo.items():
                if v is None or v == '' and k in ('image', 'duracion', 'grupo', 'salida', 'edad'): t.pop(k, None)
                else: t[k] = v

for cod, tit, dif in cambios:
    print(f'[{cod}] {tit}')
    for k, (a, b) in dif.items():
        a, b = (str(a)[:50], str(b)[:50])
        print(f'    {k}: {a!r} -> {b!r}')
for k in sin_match: print('NO MATCHEA (¿cambiaste código o título?):', k)
falt = set(idx) - vistos
if falt: print(f'{len(falt)} tours del JSON no estaban en la planilla (quedan igual)')
print(f'{len(cambios)} tours con cambios', '(dry-run, no se escribió)' if DRY else '')
if not DRY and cambios:
    json.dump(d, open(JSON_PATH, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    open(JSON_PATH, 'a', encoding='utf8').write('\n')
