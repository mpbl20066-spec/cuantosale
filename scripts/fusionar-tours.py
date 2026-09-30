# -*- coding: utf-8 -*-
"""Suma o actualiza tours en data/tours.json desde un archivo JSON con la ficha completa.

    python scripts/fusionar-tours.py data/_trabajo/angra-tours.json --dry-run
    python scripts/fusionar-tours.py data/_trabajo/angra-tours.json
    python scripts/fusionar-tours.py ARCHIVO.json --apagar-viejos

Cada tour del archivo se identifica por (destinos[0], titulo): si ya existe se
actualiza, si no se agrega a continuacion del ultimo tour de ese destino.
"foto" es el nombre del archivo en el bucket publico `tours` de Supabase Storage,
dentro de la carpeta del destino (ver CARPETAS), y se convierte en el link publico.

--apagar-viejos: los tours de los destinos que trae el archivo y que NO estan en el
archivo quedan con activo: false (no se borran, se reactivan sacando esa linea).

Un tour con "sin_precio": true se guarda apagado y sin precio: no se puede
publicar sin precio (la base lo rechaza), y asi queda listo para completarlo.

El precio es SOLO precio_brl (el "precio a mostrar" en reales); el USD se calcula
con _meta.cotizacion_brl_usd y _meta.margen_usd, igual que build-tours.js. No se
guarda operador ni link de la agencia.
"""
import json, os, re, sys
from urllib.parse import quote

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
JSON_PATH = os.path.join(RAIZ, 'data', 'tours.json')
DRY = '--dry-run' in sys.argv
APAGAR = '--apagar-viejos' in sys.argv
ORIGEN = [a for a in sys.argv[1:] if not a.startswith('--')][0]

# destino (key) -> carpeta en el bucket
CARPETAS = {'angra': 'Angra', 'bombinhas': 'Bombinhas', 'ubatuba': 'Ubatuba', 'buz': 'Buzios', 'ilhabela': 'Ilhabela'}

def supabase_url():
    for l in open(os.path.join(RAIZ, '.env'), encoding='utf8'):
        m = re.match(r'\s*SUPABASE_URL\s*=\s*(.*?)\s*$', l)
        if m:
            return m.group(1).strip('\'"').rstrip('/')
    raise SystemExit('falta SUPABASE_URL en .env')

BASE = supabase_url() + '/storage/v1/object/public/tours/'
d = json.load(open(JSON_PATH, encoding='utf8'))
cot, margen = d['_meta']['cotizacion_brl_usd'], d['_meta']['margen_usd']
nuevos = json.load(open(os.path.join(RAIZ, ORIGEN), encoding='utf8'))

CAMPOS = ['destinos', 'destino', 'titulo', 'descripcion', 'detalle', 'precio', 'precio_brl', 'activo', 'image',
          'duracion', 'grupo', 'edad', 'cancelacion', 'incluye', 'no_incluye', 'llevar']
for n in nuevos:
    n['titulo'] = n['titulo'].strip()
    if n.pop('sin_precio', False):
        n['activo'] = False
    elif n.pop('consultar', False):
        # Precio a confirmar al reservar: precio 0 sin precio_brl; la app lo muestra como "Consultar".
        n['precio'] = 0
    else:
        n['precio'] = round(n['precio_brl'] / cot + margen, 2)
    if n.get('foto'):
        n['image'] = BASE + quote(CARPETAS[n['destinos'][0]] + '/' + n['foto'])
    n = {k: n[k] for k in CAMPOS if k in n and n[k] not in ('', [], None)}
    clave = (n['destinos'][0], n['titulo'])
    pos = next((i for i, t in enumerate(d['tours']) if (t['destinos'][0], t['titulo']) == clave), None)
    if pos is not None:
        viejo = d['tours'][pos]
        d['tours'][pos] = n
        print('ACTUALIZA', clave, '| precio USD', viejo.get('precio'), '->', n.get('precio', '-'))
    else:
        # Un destino sin tours todavia (ej. ilha) va al final del catalogo.
        ult = max((i for i, t in enumerate(d['tours']) if t['destinos'][0] == n['destinos'][0]), default=len(d['tours']) - 1)
        d['tours'].insert(ult + 1, n)
        print('AGREGA   ', clave, '| R$', n.get('precio_brl', '-'), '= US$', n.get('precio', '-'), '' if n.get('activo') is not False else '| APAGADO (sin precio)')

if APAGAR:
    en_archivo = {(n['destinos'][0], n['titulo'].strip()) for n in nuevos}
    destinos = {n['destinos'][0] for n in nuevos}
    for t in d['tours']:
        if t['destinos'][0] in destinos and (t['destinos'][0], t['titulo']) not in en_archivo and t.get('activo') is not False:
            t['activo'] = False
            print('APAGA    ', (t['destinos'][0], t['titulo']))

if not DRY:
    with open(JSON_PATH, 'w', encoding='utf8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write('\n')
print('(dry-run, no se escribio)' if DRY else 'escrito data/tours.json (%d tours)' % len(d['tours']))
