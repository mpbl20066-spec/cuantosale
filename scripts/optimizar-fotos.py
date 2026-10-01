"""Baja las fotos de DEST_PHOTOS (public/app.js) desde Wikimedia, las achica y
las guarda en public/fotos/<clave>.jpg.

Por que existe: las tarjetas cargaban la foto ORIGINAL de Wikimedia (300 KB a
1,6 MB cada una, hasta 40 por pantalla) y Wikimedia limita con 429 cuando se le
piden muchas juntas. Servirlas desde el propio dominio, a 960 px y ~80 KB, es
lo que mas acelera la primera carga.

Los creditos (CC BY / CC BY-SA) siguen colgados de la URL original: el <img>
lleva data-foto-origen con esa URL y creditos-fotos.generated.js no cambia.

Uso:  python scripts/optimizar-fotos.py [clave ...]   (sin claves: todas las que falten)
      python scripts/optimizar-fotos.py --forzar      (rehace todas)
"""
import io
import re
import sys
import time
import subprocess
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
APP = RAIZ / 'public' / 'app.js'
SALIDA = RAIZ / 'public' / 'fotos'
ANCHO = 960
CALIDAD = 78
UA = 'CuantoSaleBot/1.0 (https://cuantosale.uy) python-urllib'


def fotos_del_app():
    texto = APP.read_text(encoding='utf-8')
    ini = texto.index('var DEST_PHOTOS = {')
    fin = texto.index('\n  };', ini)
    bloque = texto[ini:fin]
    return dict(re.findall(r"^\s*(\w+):\s*'([^']+)'", bloque, re.M))


def bajar(url):
    # curl y no urllib: el almacen de certificados de Python en Windows falla
    # con Wikimedia (CERTIFICATE_VERIFY_FAILED) y no se desactiva la verificacion.
    espera = 6
    for intento in range(6):
        r = subprocess.run(['curl', '-sS', '-L', '-m', '90', '-A', UA, '-w', '%{http_code}', '-o', '-', url],
                           capture_output=True)
        codigo = r.stdout[-3:].decode('ascii', 'ignore')
        if r.returncode == 0 and codigo == '200':
            return r.stdout[:-3]
        if (codigo in ('429', '503') or r.returncode != 0) and intento < 5:
            time.sleep(espera)
            espera *= 2
            continue
        raise RuntimeError('HTTP ' + codigo + ' ' + r.stderr.decode('utf-8', 'ignore')[:120])
    raise RuntimeError('sin respuesta: ' + url)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    forzar = '--forzar' in sys.argv
    fotos = fotos_del_app()
    SALIDA.mkdir(exist_ok=True)
    claves = args or list(fotos)
    fallos = []
    for k in claves:
        destino = SALIDA / (k + '.jpg')
        if destino.exists() and not forzar and not args:
            continue
        try:
            datos = bajar(fotos[k])
            img = ImageOps.exif_transpose(Image.open(io.BytesIO(datos))).convert('RGB')
            if img.width > ANCHO:
                img = img.resize((ANCHO, round(img.height * ANCHO / img.width)), Image.LANCZOS)
            img.save(destino, 'JPEG', quality=CALIDAD, optimize=True, progressive=True)
            print('%-14s %4dx%-4d %6d KB  (original %d KB)' % (k, img.width, img.height, destino.stat().st_size // 1024, len(datos) // 1024), flush=True)
        except Exception as e:  # noqa: BLE001
            fallos.append(k)
            print('FALLO', k, e, flush=True)
        time.sleep(1.5)
    print('listo:', len(claves) - len(fallos), 'ok,', len(fallos), 'fallos', fallos)
    sys.exit(1 if fallos else 0)


main()
