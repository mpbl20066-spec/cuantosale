# -*- coding: utf-8 -*-
"""Scrape de tours de agencias locales -> CSV / JSON.

    python scripts/scrape-tours-agencias.py                 # todas las agencias configuradas
    python scripts/scrape-tours-agencias.py --solo angra    # una sola (subcadena del nombre)

Salida (data/_trabajo/):  tours-agencias.csv (UTF-8 con BOM, abre bien en Excel) y tours-agencias.json.

Columnas: destino_key, destino, agencia, nombre, detalle, detalle_ampliado, precio,
moneda, duracion, duracion_min, categoria, imagenes (maximo 3, separadas por " | "),
url, fuente (sitio + como se leyo), precio_origen (de donde sale el precio: catalogo/JSON-LD =
fiable; 'texto ... (verificar)' = sacado del texto de la pagina), completo (si/no), fecha.

Tambien escribe fuentes-tours-agencias.csv: una fila por agencia con el sitio, la
URL exacta del catalogo que se leyo, el metodo, cuantos tours salieron y la fecha.
No incluye transfers ni alquileres (usar --incluir-transfers para traerlos).

Solo lee catalogos publicos que el propio sitio expone como JSON (Shopify
/products.json y WooCommerce /wp-json/wc/store/v1/products), con pausa entre
pedidos. No entra a checkout ni a nada con sesion. Los precios son los publicados
al momento del scrape (moneda de origen, normalmente BRL): no se convierten.

Las fotos son de cada agencia: se guardan las URLs, pero usarlas en la app requiere
permiso de la agencia (o reemplazarlas por fotos con licencia libre).

Descarga con curl y no con urllib: el Python de esta maquina no valida algunos
certificados. Agregar una agencia = agregar una entrada en SITES.
"""
import re
import sys
import csv
import json
import html
import time
import argparse
import subprocess
from datetime import date
from pathlib import Path

UA = 'Mozilla/5.0 (compatible; CuantoSaleBot/1.0)'
PAUSA = 0.8
MAX_FOTOS = 3
NO_TOUR = re.compile(r'(?i)^\s*(transfer|transfers|traslado|translado|transporte|seguro)\b')
RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'data' / '_trabajo'

# key del modelo -> nombre del destino
DESTINOS = {
    'angra': 'Angra dos Reis', 'ilha': 'Ilha Grande', 'paraty': 'Paraty', 'buz': 'Búzios',
    'arraial': 'Arraial do Cabo', 'cabo': 'Cabo Frio', 'rio': 'Río de Janeiro',
    'fln': 'Florianópolis', 'bcm': 'Balneário Camboriú', 'camboriu': 'Camboriú',
    'bombinhas': 'Bombinhas', 'ssa': 'Salvador de Bahía', 'forte': 'Praia do Forte',
    'mcz': 'Maceió', 'maragogi': 'Maragogi', 'fernando': 'Fernando de Noronha',
    'igu': 'Foz de Iguazú', 'gram': 'Gramado', 'canela': 'Canela',
}

# (subcadena en minusculas del titulo/categoria, key). La primera que coincide gana.
SITES = [
    {'agencia': 'Angra dos Reis Turismo', 'tipo': 'shopify', 'base': 'https://angradosreisturismo.com.br',
     'default': 'angra', 'reglas': [('ilha grande', 'ilha'), ('paraty', 'paraty')]},
    {'agencia': 'Costa do Sol Tour', 'tipo': 'woo', 'base': 'https://costadosol.tur.br',
     'default': 'buz', 'reglas': [('arraial', 'arraial'), ('cabo frio', 'cabo'), ('rio de janeiro', 'rio')]},
    {'agencia': 'Aventura na Ilha', 'tipo': 'woo', 'base': 'https://aventuranailha.com.br',
     'default': 'fln', 'reglas': [('balneário camboriú', 'bcm'), ('balneario camboriu', 'bcm'), ('beto carrero', 'camboriu'), ('bombinhas', 'bombinhas')]},
    {'agencia': 'Adval Turismo', 'tipo': 'woo', 'base': 'https://advalturismo.com.br',
     'default': 'ssa', 'reglas': [('praia do forte', 'forte')]},
    {'agencia': 'AVB Agência de Turismo', 'tipo': 'woo', 'base': 'https://avbtur.com.br',
     'default': 'mcz', 'reglas': [('maragogi', 'maragogi')]},
    {'agencia': 'Noronha Total', 'tipo': 'woo', 'base': 'https://noronhatotal.com.br',
     'default': 'fernando', 'reglas': []},
    # Sitios sin catalogo estructurado: se lee cada pagina de tour (tipo 'html').
    # 'sitemaps' lista los sitemaps a recorrer; 'incluir' filtra las URLs que son un tour;
    # una regla con key None descarta el tour (no es de un destino de la app).
    {'agencia': 'Smart Rio Tour', 'tipo': 'html', 'base': 'https://www.smartriotour.com.br',
     'sitemaps': ['https://www.smartriotour.com.br/passeio-sitemap.xml'],
     'incluir': r'/passeios/[^/]+/?$', 'default': 'rio',
     'reglas': [('búzios', 'buz'), ('buzios', 'buz'), ('arraial', 'arraial'), ('paraty', 'paraty'), ('ilha grande', 'ilha'), ('angra', 'angra')]},
    {'agencia': 'Vans do Corcovado', 'tipo': 'html', 'base': 'https://vansdocorcovado.com.br',
     'sitemaps': ['https://vansdocorcovado.com.br/sitemap.xml'],
     'incluir': r'^https://vansdocorcovado\.com\.br/(?!$|faq|home|blog/|transfer|translado|quem-somos|contato|travelbot|politica|black-friday|seu-roteiro|bate-e-volta|passeios-|passeiosaquario|.*-lp$)[^/]+$',
     'default': 'rio',
     'reglas': [('búzios', 'buz'), ('buzios', 'buz'), ('arraial', 'arraial'), ('ilha grande', 'ilha'), ('petr', None)]},
    {'agencia': 'Foz Atrativa', 'tipo': 'html', 'base': 'https://fozatrativa.com.br',
     'sitemaps': ['https://fozatrativa.com.br/sitemap.xml'],
     'incluir': r'/passeio/[^/]+$', 'default': 'igu',
     'reglas': [('ilha do mel', None), ('beto carrero', None), ('concurso', None), ('iron maiden', None)]},
    {'agencia': 'Loumar Turismo', 'tipo': 'html', 'base': 'https://www.loumarturismo.com.br',
     'sitemaps': ['https://www.loumarturismo.com.br/sitemap.xml'],
     'incluir': r'/passeios-em-foz-do-iguacu/\d+/', 'default': 'igu', 'reglas': []},
    # Fragatur no se incluye: no publica precios en su HTML (los carga por JavaScript).
    {'agencia': 'GNB Turismo', 'tipo': 'html', 'base': 'https://gnbturismo.com.br',
     'sitemaps': ['https://gnbturismo.com.br/sitemap.xml'],
     'incluir': r'/passeio/[^/]+$', 'default': 'gram', 'reglas': [('canela', 'canela')]},
    {'agencia': 'Sergatur', 'tipo': 'html', 'base': 'https://sergatur.com.br',
     'sitemaps': ['https://sergatur.com.br/sitemap.xml'],
     'incluir': r'/passeio/[^/]+$', 'default': 'gram', 'reglas': [('canela', 'canela'), ('itaimbezinho', 'canela')]},
]


METODOS = {'shopify': 'catalogo Shopify /products.json', 'woo': 'catalogo WooCommerce /wp-json/wc/store/v1/products',
           'html': 'lectura de cada pagina de tour (sitemap.xml + datos estructurados/texto)'}


def bajar(url):
    r = subprocess.run(['curl', '-sL', '-m', '40', '-A', UA, url], capture_output=True)
    time.sleep(PAUSA)
    if r.returncode != 0:
        raise RuntimeError('curl fallo (%s) en %s' % (r.returncode, url))
    return r.stdout.decode('utf-8', errors='replace')


def texto(h):
    """HTML -> texto con saltos de linea y viñetas legibles."""
    if not h:
        return ''
    h = html.unescape(h)
    h = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', h)
    h = re.sub(r'(?i)<\s*br\s*/?>', '\n', h)
    h = re.sub(r'(?i)</\s*(p|div|tr|h[1-6]|table|ul|ol)\s*>', '\n', h)
    h = re.sub(r'(?i)<\s*li[^>]*>', '\n• ', h)
    h = re.sub(r'(?i)</\s*t[dh]\s*>', ' ', h)
    h = re.sub(r'<[^>]+>', ' ', h)
    h = h.replace('\xa0', ' ')
    h = re.sub(r'[ \t]+', ' ', h)
    h = re.sub(r' *\n *', '\n', h)
    h = re.sub(r'\n{3,}', '\n\n', h)
    return h.strip()


def resumen(t, largo=220):
    """Primeras frases del texto, hasta `largo` caracteres."""
    plano = re.sub(r'\s+', ' ', t).strip()
    if len(plano) <= largo:
        return plano
    corte = plano[:largo]
    fin = max(corte.rfind('. '), corte.rfind('! '), corte.rfind('? '))
    return (corte[:fin + 1] if fin > 80 else corte.rsplit(' ', 1)[0] + '…').strip()


def duracion(t):
    """(texto, minutos) o ('', None). Prioriza 'Duração: ...', si no busca 'X horas'."""
    plano = re.sub(r'\s+', ' ', t)
    m = re.search(r'(?i)dura[cç][aã]o(?: aproximada| estimada)?\s*(?:do passeio|do tour)?\s*[:\-–]?\s*(?:de |cerca de |aprox\.? |em torno de )?'
                  r'((?:\d+[,.]?\d*\s*(?:h|hs|horas?|min|minutos?|dias?)(?:\s*(?:e|a|às|-|–)?\s*\d*[,.]?\d*\s*(?:min|minutos?|h|horas?)?)?))', plano)
    if not m:
        m = re.search(r'(?i)\b(?:(?:tempo|passeio|roteiro|dura[cç][aã]o)[^.]{0,25}?)?(\d+[,.]?\d*\s*(?:h|horas?)(?:\s*(?:e\s*)?\d+\s*min(?:utos)?)?|\d+\s*min(?:utos)?)\b', plano)
    if not m:
        return '', None
    bruto = m.group(1).strip(' .,-')
    minutos = 0
    for n, u in re.findall(r'(\d+[,.]?\d*)\s*(h|hs|horas?|min|minutos?|dias?)', bruto, re.I):
        n = float(n.replace(',', '.'))
        u = u.lower()
        minutos += n * (1440 if u.startswith('d') else 60 if u.startswith('h') else 1)
    minutos = int(round(minutos))
    # '24h' suele ser 'atencion 24h', no la duracion del tour: se descarta
    if not minutos or (minutos >= 1440 and not re.search(r'(?i)dias?', bruto)) or minutos > 14 * 1440:
        return '', None
    return bruto, minutos


def destino_de(site, titulo, categorias):
    base = (titulo + ' ' + ' '.join(categorias)).lower()
    for sub, key in site['reglas']:
        if sub in base:
            return key
    return site['default']


def fila(site, titulo, desc_html, corto_html, precio, moneda, imgs, url, categorias):
    ampliado = texto(desc_html)
    corto = texto(corto_html) or resumen(ampliado)
    dur, dur_min = duracion(ampliado or corto)
    key = destino_de(site, titulo, categorias)
    return {
        'destino_key': key, 'destino': DESTINOS.get(key, key), 'agencia': site['agencia'],
        'nombre': html.unescape(titulo).strip(), 'detalle': corto, 'detalle_ampliado': ampliado,
        'completo': 'si' if (ampliado and imgs) else 'no',
        'precio': precio, 'moneda': moneda, 'duracion': dur, 'duracion_min': dur_min,
        'categoria': ' / '.join(categorias), 'imagenes': imgs[:MAX_FOTOS], 'url': url,
        'fuente': '%s (%s)' % (site['base'].split('//')[1], METODOS[site['tipo']]),
        'precio_origen': 'catalogo del sitio (API)', 'fecha': date.today().isoformat(),
    }


def shopify(site):
    filas, pagina = [], 1
    while True:
        datos = json.loads(bajar('%s/products.json?limit=250&page=%d' % (site['base'], pagina)))
        prods = datos.get('products', [])
        for p in prods:
            precios = [float(v['price']) for v in p.get('variants', []) if v.get('price') and float(v['price']) > 0]
            if not precios:
                continue
            cats = [c for c in [p.get('product_type')] if c] + list(p.get('tags') or [])
            filas.append(fila(site, p['title'], p.get('body_html'), '', min(precios), 'BRL',
                              [i['src'] for i in p.get('images', [])], '%s/products/%s' % (site['base'], p['handle']), cats))
        if len(prods) < 250:
            return filas
        pagina += 1


def woo(site):
    filas, pagina = [], 1
    while True:
        prods = json.loads(bajar('%s/wp-json/wc/store/v1/products?per_page=100&page=%d' % (site['base'], pagina)))
        for p in prods:
            pr = p.get('prices') or {}
            try:
                precio = int(pr.get('price') or 0) / (10 ** int(pr.get('currency_minor_unit', 2)))
            except (TypeError, ValueError):
                precio = 0
            if precio <= 0:
                continue
            cats = [html.unescape(c.get('name', '')) for c in p.get('categories', [])]
            filas.append(fila(site, p.get('name', ''), p.get('description'), p.get('short_description'), precio,
                              pr.get('currency_code') or 'BRL', [i['src'] for i in p.get('images', [])], p.get('permalink'), cats))
        if len(prods) < 100:
            return filas
        pagina += 1


def meta(h, prop):
    for pat in (r'(?is)<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']*)["\']' % re.escape(prop),
                r'(?is)<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(prop)):
        m = re.search(pat, h)
        if m:
            return html.unescape(m.group(1)).strip()
    return ''


def nodos_jsonld(h):
    out = []
    for m in re.finditer(r'(?is)<script[^>]+application/ld\+json[^>]*>(.*?)</script>', h):
        try:
            j = json.loads(m.group(1))
        except ValueError:
            continue
        pila = [j]
        while pila:
            x = pila.pop()
            if isinstance(x, list):
                pila += x
            elif isinstance(x, dict):
                out.append(x)
                pila += [v for v in x.values() if isinstance(v, (dict, list))]
    return out


def precio_pagina(h, nodos, cuerpo):
    """(precio, moneda, origen). JSON-LD primero; si no, texto de la pagina."""
    precios = []
    for n in nodos:
        ofertas = n.get('offers')
        for o in (ofertas if isinstance(ofertas, list) else [ofertas]):
            if isinstance(o, dict):
                for k in ('price', 'lowPrice'):
                    try:
                        v = float(str(o.get(k)).replace(',', '.'))
                        if v > 0:
                            precios.append((v, o.get('priceCurrency') or 'BRL'))
                    except (TypeError, ValueError):
                        pass
    if precios:
        v, mon = min(precios)
        return v, mon, 'datos estructurados (JSON-LD)'

    def num(s):
        return float(s.replace('.', '').replace(',', '.'))
    m = re.search(r'(?i)a partir de\s*(?:r\$|brl)?\s*R?\$?\s*([\d.]+,\d{2})', cuerpo)
    if m:
        return num(m.group(1)), 'BRL', 'texto "a partir de" (verificar)'
    m = re.search(r'R\$\s*([\d.]+,\d{2})', cuerpo)
    if m:
        return num(m.group(1)), 'BRL', 'primer precio del texto (verificar)'
    return 0, 'BRL', ''


def fotos_pagina(h, base, nodos):
    urls = []
    og = meta(h, 'og:image')
    if og:
        urls.append(og)
    for n in nodos:
        im = n.get('image')
        for i in (im if isinstance(im, list) else [im]):
            if isinstance(i, str):
                urls.append(i)
            elif isinstance(i, dict) and i.get('url'):
                urls.append(i['url'])
    for m in re.finditer(r'(?is)<img[^>]+(?:data-src|data-lazy-src|src)=["\']([^"\']+\.(?:jpe?g|png|webp)[^"\']*)["\']', h):
        urls.append(m.group(1))
    vistas, res = set(), []
    for u in urls:
        u = html.unescape(u.strip())
        if u.startswith('//'):
            u = 'https:' + u
        elif u.startswith('/'):
            u = base + u
        if not u.startswith('http') or re.search(r'(?i)logo|icon|favicon|sprite|avatar|whatsapp|banner-|placeholder|\.svg', u):
            continue
        clave = re.sub(r'[?#].*$', '', u).lower()
        if clave in vistas:
            continue
        vistas.add(clave)
        res.append(u)
        if len(res) >= MAX_FOTOS:
            break
    return res


def cuerpo_pagina(h):
    h = re.sub(r'(?is)<(script|style|nav|header|footer|form|svg|noscript|iframe)[^>]*>.*?</\1>', ' ', h)
    m = re.search(r'(?is)<main[^>]*>(.*?)</main>', h) or re.search(r'(?is)<article[^>]*>(.*?)</article>', h) or re.search(r'(?is)<body[^>]*>(.*?)</body>', h)
    t = texto(m.group(1) if m else h)
    vistas, lineas = set(), []
    for ln in t.split('\n'):
        ln = ln.strip()
        if ln and ln not in vistas:
            vistas.add(ln)
            lineas.append(ln)
    return '\n'.join(lineas)[:4000]


def urls_sitemap(url, profundidad=0):
    xml = bajar(url)
    locs = [html.unescape(x) for x in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', xml)]
    if profundidad < 1 and any(l.endswith('.xml') for l in locs):
        res = []
        for l in locs:
            res += urls_sitemap(l, profundidad + 1) if l.endswith('.xml') else [l]
        return res
    return locs


def htmlsite(site):
    urls, vistas = [], set()
    for sm in site['sitemaps']:
        for u in urls_sitemap(sm):
            if re.search(site['incluir'], u) and u not in vistas:
                vistas.add(u)
                urls.append(u)
    filas = []
    for u in urls:
        try:
            h = bajar(u)
        except RuntimeError:
            continue
        nodos = nodos_jsonld(h)
        titulo = meta(h, 'og:title') or (re.findall(r'(?is)<h1[^>]*>(.*?)</h1>', h) or [''])[0]
        titulo = re.sub(r'<[^>]+>', '', html.unescape(titulo))
        titulo = re.split(r'\s+[|–—-]\s+(?=[^|]*$)', titulo)[0].strip() if re.search(r'\s[|]\s', titulo) else titulo.strip()
        cuerpo = cuerpo_pagina(h)
        precio, moneda, origen = precio_pagina(h, nodos, cuerpo)
        if not titulo or precio <= 0:
            continue
        descr = meta(h, 'og:description') or meta(h, 'description')
        r = fila(site, titulo, cuerpo.replace('\n', '<br>'), descr, precio, moneda, fotos_pagina(h, site['base'], nodos), u, [])
        if r['destino_key'] is None:
            continue
        r['precio_origen'] = origen
        filas.append(r)
    return filas


TIPOS = {'shopify': shopify, 'woo': woo, 'html': htmlsite}


def catalogo_url(s):
    if s['tipo'] == 'html':
        return ' ; '.join(s['sitemaps'])
    return s['base'] + ('/products.json' if s['tipo'] == 'shopify' else '/wp-json/wc/store/v1/products')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--solo', help='subcadena del nombre de la agencia')
    ap.add_argument('--incluir-transfers', action='store_true', help='no filtrar transfers ni alquileres')
    a = ap.parse_args()
    todo, fuentes = [], []
    for s in SITES:
        if a.solo and a.solo.lower() not in s['agencia'].lower():
            continue
        try:
            f = TIPOS[s['tipo']](s)
            omitidos = 0
            if not a.incluir_transfers:
                antes = len(f)
                f = [r for r in f if not NO_TOUR.match(r['nombre'])]
                omitidos = antes - len(f)
            print('%-28s %3d tours (%d transfers/alquileres omitidos)' % (s['agencia'], len(f), omitidos))
            todo += f
            fuentes.append({'agencia': s['agencia'], 'sitio': s['base'], 'catalogo_leido': catalogo_url(s), 'metodo': METODOS[s['tipo']],
                            'tours': len(f), 'omitidos_transfers': omitidos, 'fecha': date.today().isoformat()})
        except Exception as e:  # una agencia caida no frena a las demas
            print('%-28s ERROR %s' % (s['agencia'], e))
            fuentes.append({'agencia': s['agencia'], 'sitio': s['base'], 'catalogo_leido': catalogo_url(s), 'metodo': METODOS[s['tipo']],
                            'tours': 0, 'omitidos_transfers': 0, 'fecha': date.today().isoformat(), 'error': str(e)})
    SALIDA.mkdir(parents=True, exist_ok=True)
    suf = '-parcial' if a.solo else ''
    with open(SALIDA / ('tours-agencias%s.json' % suf), 'w', encoding='utf-8') as fh:
        json.dump(todo, fh, ensure_ascii=False, indent=1)
    cols = ['destino_key', 'destino', 'agencia', 'nombre', 'detalle', 'detalle_ampliado', 'precio', 'moneda',
            'duracion', 'duracion_min', 'categoria', 'imagenes', 'url', 'fuente', 'precio_origen', 'completo', 'fecha']
    with open(SALIDA / ('tours-agencias%s.csv' % suf), 'w', encoding='utf-8-sig', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in todo:
            w.writerow(dict(r, imagenes=' | '.join(r['imagenes'])))
    with open(SALIDA / ('fuentes-tours-agencias%s.csv' % suf), 'w', encoding='utf-8-sig', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=['agencia', 'sitio', 'catalogo_leido', 'metodo', 'tours', 'omitidos_transfers', 'fecha', 'error'])
        w.writeheader()
        for r in fuentes:
            w.writerow(dict(r, error=r.get('error', '')))
    print('Total: %d filas -> %s' % (len(todo), SALIDA))


if __name__ == '__main__':
    main()
