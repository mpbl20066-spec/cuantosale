# -*- coding: utf-8 -*-
"""
Compone la imagen social (og:image) de CuantoSale.

   python scripts/og-image.py

POR QUE UN SCRIPT Y NO UNA FOTO SUELTA
El preview de un link en WhatsApp, Instagram o Slack muestra 1200x630 (ratio
1.91:1). Las fotos que hay en el repo no sirven para eso: las historias de
Instagram son verticales 1080x1920 con el texto y el "1/4" horneados, y
recortarlas a 1.91:1 deja el texto cortado y un contador que no significa nada
fuera de una story.

Lo que sale de aca es una card propia: la foto de fondo con una banda para que
el texto tenga contraste, la marca y una frase. Sin depender de que el cropping
automático de cada plataforma acierte.

La foto de fondo sale de outputs/historias-50/IMG_20230505_171407.jpg: es
horizontal 4096x3072 y tiene el atardecer en el tercio de arriba, que es
justo donde se apoya la banda de texto.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'outputs', 'historias-50', 'IMG_20230505_171407.jpg')
SALIDA = os.path.join(RAIZ, 'public', 'og-cuantosale.jpg')

ANCHO, ALTO = 1200, 630

# Los mismos tonos que usa la app: fondo oscuro y ambar de marca.
AMBER = (247, 195, 37)
TINTA = (10, 16, 26)
PAPEL = (255, 255, 255)


def fuente(candidates, tamano):
    """Busca una fuente que exista en el sistema. Poppins no esta instalada en
    todos lados, asi que se cae a Arial/DejaVu y el archivo igual sale."""
    for nombre in candidates:
        try:
            return ImageFont.truetype(nombre, tamano)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def main():
    if not os.path.exists(ORIGEN):
        raise SystemExit('No se encuentra la foto de fondo: ' + ORIGEN)

    # 1. La foto, recortada a 1.91:1. Se recorta desde arriba del centro porque
    #    el atardecer esta en el tercio superior y es lo que hay que conservar.
    base = Image.open(ORIGEN).convert('RGB')
    ancho_fuente, alto_fuente = base.size
    objetivo = ANCHO / ALTO
    if ancho_fuente / alto_fuente > objetivo:
        # La foto es mas ancha que la card: recorta a los lados.
        nuevo_ancho = int(alto_fuente * objetivo)
        # Un poco a la derecha del centro: el sol queda ahi, no en el medio.
        izquierda = int((ancho_fuente - nuevo_ancho) * 0.62)
        base = base.crop((izquierda, 0, izquierda + nuevo_ancho, alto_fuente))
    else:
        nuevo_alto = int(ancho_fuente / objetivo)
        arriba = 0   # el cielo/atardecer esta arriba, no se toca
        base = base.crop((0, arriba, ancho_fuente, arriba + nuevo_alto))
    base = base.resize((ANCHO, ALTO), Image.LANCZOS)

    # 2. Velo oscuro general, para que el texto se lea en cualquier parte.
    velo = Image.new('RGB', (ANCHO, ALTO), TINTA)
    base = Image.blend(base, velo, 0.42)

    # 3. Banda inferior mas opaca: el texto va abajo y no compite con el sol.
    banda_alto = 250
    banda = Image.new('L', (1, banda_alto))
    for y in range(banda_alto):
        # De transparente arriba a opaca en los ultimos 60px.
        t = max(0.0, min(1.0, (y - (banda_alto - 150)) / 150.0))
        banda.putpixel((0, y), int(t * 235))
    banda = banda.resize((ANCHO, banda_alto))
    sombra = Image.new('RGB', (ANCHO, ALTO), TINTA)
    mascara = Image.new('L', (ANCHO, ALTO), 0)
    mascara.paste(banda, (0, ALTO - banda_alto))
    sombra.putalpha(mascara)
    base = Image.alpha_composite(base.convert('RGBA'), sombra).convert('RGB')

    d = ImageDraw.Draw(base)

    # 4. Marca. El pin se dibuja como una figura, no como emoji: Segoe UI no
    #    trae glifos de emoji y el pin salia como un cuadrado vacio. Un mapa de
    #    marca es un circulo con un punta, y eso se dibuja con primitivas.
    marca_f = fuente(['seguisb.ttf', 'segoeuib.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf'], 44)
    pin = AMBER
    d.ellipse([78, 60, 112, 94], fill=pin)                      # cabeza del pin
    d.polygon([(95, 116), (82, 90), (108, 90)], fill=pin)      # punta
    d.ellipse([89, 71, 101, 83], fill=TINTA)                   # agujero
    d.text((124, 52), 'cuántosale', fill=PAPEL, font=marca_f)

    # 5. Frase. Dos lineas cortas: en un preview chico una sola linea larga se
    #    corta y pierde el sentido.
    grande = fuente(['seguisb.ttf', 'segoeuib.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf'], 74)
    d.text((70, 384), 'Cuánto cuesta', fill=PAPEL, font=grande)
    d.text((70, 468), 'tu viaje de verdad', fill=AMBER, font=grande)

    # 6. Bajada chica, la misma promesa que el title del sitio. Va con una
    #    linea de aire sobre el titulo: pegada al "de verdad" se leian juntas.
    chica = fuente(['segoeui.ttf', 'arial.ttf', 'DejaVuSans.ttf'], 28)
    d.text((74, 566), 'Vuelos · buses · alojamiento · gastos del grupo',
           fill=(214, 222, 232), font=chica)

    base.save(SALIDA, 'JPEG', quality=88, optimize=True, progressive=True)
    print('og:image generada -> ' + os.path.relpath(SALIDA, RAIZ))
    print('  ' + str(ANCHO) + 'x' + str(ALTO) + '  ratio 1.91:1  ' +
          str(round(os.path.getsize(SALIDA) / 1024)) + ' KB')


if __name__ == '__main__':
    main()