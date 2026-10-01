# -*- coding: utf-8 -*-
"""Verifica el balance de etiquetas de bloque en las paginas HTML reales.

Un cierre sobrante no tira error: el parser HTML lo descarta en silencio y el
DOM queda "bien" igual. El problema aparece despues, cuando alguien edita esa
parte y el navegador reacomoda los nodos de una forma que nadie espera. Este
script es el que lo atrapa.
"""
import re
import sys

PAGINAS = [
    'public/index.html',
    'public/grupo.html',
    'public/tours.html',
    'public/transfers.html',
    'public/waitlist.html',
    'public/privacidad.html',
    'public/terminos.html',
]

# Tags que se autocierran o que no dependen de un cierre explicito.
VACIOS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
          'link', 'meta', 'param', 'source', 'track', 'wbr'}


def _vaciar(m):
    """Saca el bloque pero deja los saltos de linea, para que los numeros de
    linea que se reportan sean los del archivo y no los del texto recortado.
    Sin esto el error se reporta treinta lineas mas arriba y uno termina
    mirando el lugar equivocado."""
    return re.sub(r'[^\n]', ' ', m.group(0))


def balance(ruta):
    h = open(ruta, encoding='utf-8').read()
    h = re.sub(r'<script\b.*?</script>', _vaciar, h, flags=re.S | re.I)
    h = re.sub(r'<style\b.*?</style>', _vaciar, h, flags=re.S | re.I)
    h = re.sub(r'<!--.*?-->', _vaciar, h, flags=re.S)

    pila, problemas = [], []
    for m in re.finditer(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(/?)>', h):
        cierre, tag, auto = m.group(1), m.group(2).lower(), m.group(3)
        linea = h[:m.start()].count('\n') + 1
        if tag in VACIOS or auto == '/':
            continue
        if not cierre:
            pila.append((tag, linea))
        else:
            if not pila:
                problemas.append('linea %d: </%s> sin apertura' % (linea, tag))
            elif pila[-1][0] != tag:
                # Busca un match mas abajo antes de acusar: HTML real anida
                # a veces omite el cierre de un hijo, que es un error distinto.
                match = [i for i, (t, _) in enumerate(pila) if t == tag]
                if match:
                    abierto, llinea = pila[match[-1]]
                    problemas.append(
                        'linea %d: se cierra </%s> pero el abierto esta en linea %d; '
                        'el <%s> de la linea %d quedo sin cerrar'
                        % (linea, tag, llinea, abierto, pila[-1][1]))
                    del pila[match[-1]:]
                else:
                    problemas.append('linea %d: </%s> sin apertura' % (linea, tag))
            else:
                pila.pop()
    for tag, linea in pila:
        problemas.append('linea %d: <%s> nunca se cierra' % (linea, tag))
    return problemas


mal = 0
for p in PAGINAS:
    probs = balance(p)
    if probs:
        mal += 1
        print('%s' % p)
        for x in probs:
            print('   %s' % x)
    else:
        print('%s  ok' % p)

print()
print('%d de %d paginas con desbalance' % (mal, len(PAGINAS)))
sys.exit(1 if mal else 0)
