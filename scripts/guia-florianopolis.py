#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Guía PDF de Florianópolis para turistas uruguayos.

Los datos salen de los archivos reales del proyecto, no de memoria:
  - lib/guias.js               beaches, comer, atracciones, hacer, tips
  - data/costos-diarios.json   comida y traslado por día (con su fuente)
  - data/transfer-precios.json transfer del aeropuerto
  - lib/model.js               km, peajes, horas y lodging por estilo

Uso: python scripts/guia-florianopolis.py
"""
import json
import os
import re

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ------------------------------------------------------------------ fuentes
# Helvetica de ReportLab usa WinAnsi: trae tildes y ñ, pero no emojis ni
#symbols. Se registra Segoe UI para que el cuerpo de texto salga con la
# tipografía del sistema y las tildes se vean bien en el celular.
def registrar_fuentes():
    candidatas = [
        ('CsReg', 'segoeui.ttf'),
        ('CsNeg', 'seguisb.ttf'),
        ('CsBolf', 'segoeuib.ttf'),
    ]
    ok = {}
    for nombre, archivo in candidatas:
        ruta = os.path.join(r'C:\Windows\Fonts', archivo)
        if os.path.exists(ruta):
            try:
                pdfmetrics.registerFont(TTFont(nombre, ruta))
                ok[nombre] = nombre
            except Exception:
                pass
    if 'CsReg' in ok:
        pdfmetrics.registerFontFamily('CsReg', normal='CsReg', bold='CsBolf')
    return ok or {'CsReg': 'Helvetica', 'CsNeg': 'Helvetica-Bold',
                  'CsBolf': 'Helvetica-Bold'}


FUENTES = registrar_fuentes()
F_REG, F_BOLD = FUENTES.get('CsReg', 'Helvetica'), FUENTES.get('CsBolf', 'Helvetica-Bold')

# ------------------------------------------------------------------- paleta
VERDE = HexColor('#1B5E20')
NARANJA = HexColor('#E65100')
AMBAR = HexColor('#F57F17')
GRIS = HexColor('#37474F')
GRIS_CLARO = HexColor('#F4F6F7')
LINEA = HexColor('#CFD8DC')
AZUL = HexColor('#0D47A1')
BLANCO = HexColor('#FFFFFF')
VERDE_TENUE = HexColor('#E8F5E9')

# ------------------------------------------------------------------ estilos
s = getSampleStyleSheet()

st_portada = ParagraphStyle(
    'port', parent=s['Normal'], fontName=F_BOLD, fontSize=31, leading=35,
    textColor=VERDE, alignment=TA_CENTER, spaceAfter=6)

st_portada_sub = ParagraphStyle(
    'psub', parent=s['Normal'], fontName=F_REG, fontSize=12.5, leading=17,
    textColor=GRIS, alignment=TA_CENTER, spaceAfter=2)

st_portada_res = ParagraphStyle(
    'pres', parent=s['Normal'], fontName=F_REG, fontSize=10.5, leading=15,
    textColor=GRIS, alignment=TA_CENTER, leftIndent=20, rightIndent=20)

st_h1 = ParagraphStyle(
    'h1', parent=s['Heading1'], fontName=F_BOLD, fontSize=16.5, leading=20,
    textColor=VERDE, spaceBefore=0, spaceAfter=1)

st_kicker = ParagraphStyle(
    'kick', parent=s['Normal'], fontName=F_BOLD, fontSize=7.5, leading=9,
    textColor=NARANJA, spaceAfter=5)

st_h2 = ParagraphStyle(
    'h2', parent=s['Heading2'], fontName=F_BOLD, fontSize=12, leading=15,
    textColor=GRIS, spaceBefore=12, spaceAfter=4)

st_body = ParagraphStyle(
    'body', parent=s['Normal'], fontName=F_REG, fontSize=9.3, leading=13.2,
    textColor=GRIS, spaceAfter=4)

st_bullet = ParagraphStyle(
    'bul', parent=st_body, leftIndent=13, bulletIndent=2, spaceAfter=4)

st_tip = ParagraphStyle(
    'tip', parent=st_body, fontSize=8.9, leading=12.4, backColor=GRIS_CLARO,
    borderWidth=0, borderPadding=7, leftIndent=6, rightIndent=6,
    spaceBefore=0, spaceAfter=6)

# ReportLab dibuja el fondo de un Paragraph con backColor;borderPadding lo
# expande HACIA ARRIBA tambien. Con borderPadding=7 y un spaceAfter de 4, el
# rectangulo gris tapa la mitad de la linea de arriba: el texto no se pisa con
# el de al lado, sino con el fondo del que viene despues. Por eso todo tip
# pasa por tip(): el hueco va antes, explicito, y no en el estilo.
def tip(texto):
    return [Spacer(1, 7), P(texto, st_tip)]

st_tip_t = ParagraphStyle(
    'tipt', parent=st_tip, fontName=F_BOLD, textColor=VERDE)

st_cta = ParagraphStyle(
    'cta', parent=s['Normal'], fontName=F_BOLD, fontSize=12.5, leading=16,
    textColor=BLANCO, alignment=TA_CENTER, backColor=VERDE, borderWidth=0,
    borderPadding=12, spaceBefore=0, spaceAfter=6)

st_cta_s = ParagraphStyle(
    'ctas', parent=s['Normal'], fontName=F_REG, fontSize=9.3, leading=13,
    textColor=GRIS, alignment=TA_CENTER, spaceAfter=5)

st_ficha = ParagraphStyle(
    'fic', parent=s['Normal'], fontName=F_BOLD, fontSize=11.5, leading=14,
    textColor=VERDE, spaceAfter=1)

st_ficha_z = ParagraphStyle(
    'ficz', parent=s['Normal'], fontName=F_BOLD, fontSize=7.6, leading=10,
    textColor=NARANJA, spaceAfter=4)

st_foot = ParagraphStyle(
    'foot', parent=s['Normal'], fontName=F_REG, fontSize=7.4, leading=9.6,
    textColor=GRIS, alignment=TA_CENTER, spaceAfter=2)

st_celda = ParagraphStyle(
    'cel', parent=s['Normal'], fontName=F_REG, fontSize=8.4, leading=10.8,
    textColor=GRIS)

st_th = ParagraphStyle(
    'th', parent=s['Normal'], fontName=F_BOLD, fontSize=8.4, leading=10.8,
    textColor=BLANCO)


def P(txt, style):
    return Paragraph(txt, style)


def tabla(cabeceras, filas, anchos):
    datos = [[P(h, st_th) for h in cabeceras]]
    for fila in filas:
        datos.append([P(c, st_celda) for c in fila])
    t = Table(datos, colWidths=anchos, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), VERDE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.4, LINEA),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BLANCO, HexColor('#FAFBFB')]),
    ]))
    return t


def seccion(titulo, kicker):
    """Banda de sección: filete, antetítulo y título."""
    return [
        HRFlowable(width='100%', thickness=1.8, color=VERDE,
                   spaceBefore=2, spaceAfter=5),
        P(kicker.upper(), st_kicker),
        P(titulo, st_h1),
        Spacer(1, 6),
    ]


def bullets(items, style=st_bullet):
    return [P('&bull;&nbsp; ' + it, style) for it in items]


# --------------------------------------------------------------------- datos
def cargar():
    with open(os.path.join(RAIZ, 'lib', 'guias.js'), encoding='utf-8') as f:
        texto = f.read()
    bloque = texto[texto.index('  fln: {'):texto.index('  sao: {')]

    def cuerpo_js(nombre):
        m = re.search(r'\n    %s: \[(.*?)\n    \],' % nombre, bloque, re.S)
        return m.group(1) if m else ''

    def objetos(cuerpo):
        out, prof, ini = [], 0, None
        for i, ch in enumerate(cuerpo):
            if ch == '{':
                if prof == 0:
                    ini = i
                prof += 1
            elif ch == '}':
                prof -= 1
                if prof == 0 and ini is not None:
                    out.append(cuerpo[ini:i + 1])
                    ini = None
        return out

    def campo(o, clave):
        for q in ("'", '"'):
            m = re.search(r"\b%s:\s*%s((?:[^%s\\]|\\.)*)%s" % (clave, q, q, q), o)
            if m:
                return m.group(1).replace("\\'", "'").replace('\\"', '"')
        return ''

    def num(o, clave):
        m = re.search(r'\b%s:\s*([0-9.]+)' % clave, o)
        return m.group(1) if m else ''

    def parse(nombre):
        res = []
        for o in objetos(cuerpo_js(nombre)):
            res.append({
                'name': campo(o, 'name'), 'zona': campo(o, 'zona'),
                'vibe': campo(o, 'vibe'), 'cuando': campo(o, 'cuando'),
                'nota': campo(o, 'nota'), 'titulo': campo(o, 'titulo'),
                'texto': campo(o, 'texto'), 'tipo': campo(o, 'tipo'),
                'momento': campo(o, 'momento'), 'dur': campo(o, 'dur'),
                'usd': num(o, 'usd'),
            })
        return res

    m = re.search(r"resumen:\s*'([^']*)'", bloque)
    d = {
        'resumen': m.group(1) if m else '',
        'beaches': parse('beaches'),
        'atracciones': parse('atracciones'),
        'comer': parse('comer'),
        'hacer': parse('hacer'),
        'tips': parse('tips'),
    }

    with open(os.path.join(RAIZ, 'data', 'costos-diarios.json'), encoding='utf-8') as f:
        for valor in json.load(f).values():
            if isinstance(valor, dict) and 'fln' in valor:
                d['costos'] = valor['fln']
                break
    d.setdefault('costos', {})

    with open(os.path.join(RAIZ, 'data', 'transfer-precios.json'), encoding='utf-8') as f:
        tr = json.load(f)
    d['transfer'] = tr.get('destinos', tr).get('fln', {})

    with open(os.path.join(RAIZ, 'lib', 'model.js'), encoding='utf-8') as f:
        mj = f.read()
    m = re.search(r'fln:\s*\{([^}]*)\}', mj)
    d['ruta'] = dict(re.findall(r'(\w+):\s*([0-9.]+)', m.group(1))) if m else {}
    m = re.search(r"fln: \{ name: 'Florianópolis'.*?lodge: \[([0-9, ]+)\]", mj, re.S)
    d['lodge'] = [x.strip() for x in m.group(1).split(',')] if m else ['50', '90', '160']
    return d


# ------------------------------------------------- contenido escrito a mano
# Los Tips Pro y los datos de acceso NO estan en lib/guias.js: son redaccion
# de la guia, y van aparte para que el catalogo siga leyendose del proyecto.
ACCESO = {
    'Beira-Mar Norte': '<b>Acceso:</b> en el centro mismo, sobre la orla. No hay que '
                       'alquilar ni pagar estacionamiento. <b>Infraestructura:</b> alta, '
                       'con ciclovía, bancos y paseo marítimo.',
    'Praia Mole': '<b>Acceso:</b> 18 km del centro por la SC-402, con estacionamiento '
                  'amplio. <b>Infraestructura:</b> alta: paradores, sombrillas, baños y '
                  'restaurantes sobre la arena.',
    'Praia da Joaquina': '<b>Acceso:</b> 20 km del centro. El estacionamiento es en la '
                         'calle y se llena temprano. <b>Infraestructura:</b> media, más '
                         'rústica que Mole.',
    'Barra da Lagoa (canal y molhe)': '<b>Acceso:</b> 20 km del centro, con estacionamiento '
                                      'amplio. <b>Infraestructura:</b> alta: restaurantes '
                                      'de pescado, botes y puente sobre el canal.',
    'Naufragados': '<b>Acceso:</b> 25 km del centro y 40 minutos de caminata al final. '
                   '<b>Infraestructura:</b> nula. Es un plan de medio día entero.',
}

TIPS_PRO = {
    'Beira-Mar Norte': 'No es una playa de baño: es la orla del centro, y con marea alta el '
                       'agua se retira y quedan los bloques de cemento del muro. Bajá con la '
                       'marea baja y usala para caminar, no para bañarte. Es la que estás '
                       'viendo si estás en el centro, y es la mejor parada para un mate o un '
                       'café con vista al mar.',
    'Praia Mole': 'Llegá antes de las 12 para tomar sombra. Al atardecer los bares sobre la '
                  'arena se llenan: es el mejor movimiento de la costa este. Tiene torre de '
                  'guardavidas, y en una playa con gente y olas eso no es un detalle.',
    'Praia da Joaquina': 'Si no surfeas, la playa igual vale: lo suyo son las dunas, y se '
                         'alquilan tablas de sandboard por R$ 20 a 30. Con oleaje fuerte hay '
                         'corrientes que arrastran, así que para nadar quedate cerca de la torre.',
    'Barra da Lagoa (canal y molhe)': 'Almuerzá en los restaurantes del canal: es el pueblo de '
                                      'pescadores, con pescado del día y caipirinha sobre el '
                                      'agua. Llegá antes de las 13, que se llena. Después cruzá '
                                      'el puente: del otro lado está la playa de olas, que es '
                                      'la otra mitad del lugar y casi nadie la recorre.',
    'Naufragados': 'No hay nada: ni baños, ni comida, ni sombra. Llevá agua, comida, protector '
                   'y una reposera, y salí antes de que oscurezca. El camino de ida son 40 '
                   'minutos de curvas con vista al mar, y ese es el paseo. A la vuelta el auto '
                   'tiene que estar esperando en el parador: no hay nadie que te lleve.',
}


def ficha(b, bloqueada):
    """Una ficha de playa.

    La zona va dentro del mismo Paragraph que el nombre, con un salto de linea.
    Antes eran dos Paragraphs envueltos en KeepTogether: cuando el bloque no
    entraba entero en la pagina, KeepTogether los partia entre paginas y la
    linea de zona quedaba cortada por la mitad, con la mitad superior pegada al
    final de la pagina anterior. Un solo Paragraph no se parte.
    """
    # El <br/> con un <font size=...> chico no baja el leading: ReportLab
    # calcula el interlineado del Paragraph entero con el estilo del primer
    # run, y la linea chica queda pegada a la de arriba y medio tachada. La
    # zona va como Paragraph propio, con su propio leading.
    partes = [P(b['name'], st_ficha), P(b['zona'], st_ficha_z)]
    if bloqueada:
        partes += tip('<font color="#78909C">[ contenido exclusivo ]</font> '
                      'Se abre al entrar a Booking: vibe completa, cuándo ir, cómo llegar, '
                      'nivel de infraestructura y el Tip Pro de esta playa.')
    else:
        partes.append(P(b['vibe'], st_body))
        if b['cuando']:
            partes.append(P('<b>Cuándo ir:</b> ' + b['cuando'], st_body))
        if ACCESO.get(b['name']):
            partes.append(P(ACCESO[b['name']], st_body))
        if TIPS_PRO.get(b['name']):
            partes += tip('<b>Tip Pro:</b> ' + TIPS_PRO[b['name']])
    return partes


# ---------------------------------------------------------------------- PDF
def generar():
    d = cargar()
    doc = SimpleDocTemplate(
        'guia-florianopolis.pdf', pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=14 * mm, bottomMargin=14 * mm,
        title='Guía de Florianópolis para uruguayos',
        author='CuántoSale', subject='Guía práctica de viaje a Florianópolis')
    st = []
    rr = d['ruta']
    comida = d['costos'].get('comida', {})
    trasl = d['costos'].get('traslado', {})
    tr = d['transfer']
    lodge = (d['lodge'] + ['50', '90', '160'])[:3]
    # Cuantas fichas estan realmente completas. Se calcula aca porque el indice
    # lo necesita y esta antes del catalogo: una ficha sin Tip Pro no es
    # completa, y prometer "4 completas" cuando la primera no lo esta es
    # justamente el tipo de promesa que el README prohibe para los precios.
    completas = [b for b in d['beaches'] if b['name'] in TIPS_PRO and b['name'] in ACCESO]

    # ------------------------------------------------------------- portada
    st += [Spacer(1, 30 * mm),
           P('GUÍA DE FLORIANÓPOLIS', st_portada),
           P('Santa Catarina, Brasil &nbsp;·&nbsp; escrita para uruguayos', st_portada_sub),
           Spacer(1, 3 * mm),
           HRFlowable(width='52%', thickness=1.2, color=NARANJA, spaceAfter=6),
           P(d['resumen'], st_portada_res),
           Spacer(1, 5 * mm)]

    st.append(tabla(
        ['Cómo llegar', 'Ruta en auto', 'Del aeropuerto a la ciudad', 'Una noche'],
        [['<b>2,5 h</b> de vuelo directo MVD – FLN',
          '<b>%s km</b> · %s h con paradas<br/>Peajes: US$ %s'
          % (rr.get('km', '1245'), rr.get('hours', '17'), rr.get('tolls', '42')),
          '<b>%s km</b>, 25 min desde FLN<br/>Privado US$ %s'
          % (tr.get('km', '17'), tr.get('privado', '30')),
          'Económico <b>US$ %s</b><br/>Medio <b>US$ %s</b><br/>Confort <b>US$ %s</b>'
          % (lodge[0], lodge[1], lodge[2])]],
        [4.3 * cm] * 4))
    st += [Spacer(1, 4 * mm),
           P('Alojamiento y consumos salen de la base del proyecto, con la fuente '
             'verificada el 27/09/2026. El transfer es estimación: no hay tarifa '
             'publicada para esa ruta y la web lo rotula como tal.', st_foot),
           Spacer(1, 3 * mm),
           P('Muestra abierta &nbsp;·&nbsp; la guía se abre al entrar a Booking', st_foot),
           PageBreak()]

    # -------------------------------------------------------------- índice
    st += [P('QUÉ VAS A ENCONTRAR ACA', st_kicker), P('Cómo está armada esta guía', st_h1),
           Spacer(1, 5)]
    st.append(P('Lo que estás leyendo es la parte abierta. Las secciones marcadas con '
                'candado se completan cuando entrás a Booking desde el hotel: el '
                'catálogo completo de playas, los Tips Pro y los datos de acceso de cada '
                'una.', st_body))
    st += [Spacer(1, 4), tabla(
        ['Sección', 'Estado'],
        [['Logística y cruce de frontera', 'Abierta'],
         ['Dinero, tarjetas y propinas', 'Abierta'],
         ['Zonas clave y dónde parar', 'Abierta'],
         ['Comer, beber y supermercado', 'Abierta'],
         ['Playas: %d fichas' % len(d['beaches']),
          '<b><font color="#E65100">%d completas, %d bloqueadas</font></b>'
          % (len(completas), len(d['beaches']) - len(completas))],
         ['Conectividad, salud y seguridad', 'Abierta'],
         ['Cómo se abre el resto', 'Abierta']],
        [10.5 * cm, 6 * cm])]
    st += [Spacer(1, 5), P('Los números que aparecen en esta guía no son inventados: son '
                           'los que la web usa para cotizar el viaje. Cuando un precio es '
                           'estimación, lo decimos.', st_foot),
           PageBreak()]

    # ---------------------------------------------------------- 1 logística
    st += seccion('Logística y cruce de frontera', 'Sección 01')
    st.append(P('<b>En avión, salvo que el grupo sea grande.</b> MVD – FLN son 2,5 horas '
                'contra 17 de ruta. El auto solo se justifica a partir de cuatro personas '
                'o más, y con el peaje compartido el costo por persona baja bastante.', st_body))
    st += [Spacer(1, 4), tabla(
        ['Criterio', 'Avión (MVD – FLN)', 'Auto (Chuy – Florianópolis)'],
        [['Tiempo puerta a puerta', '<b>2,5 h</b>', '<b>17 h</b> con paradas'],
         ['Costo por persona', 'Vuelo real, cotizado por fecha',
          'Peajes US$ %s + nafta, dividido en el grupo' % rr.get('tolls', '42')],
         ['Molestia', 'Ninguna', 'Dos fronteras y 17 h debutiendo'],
         ['Cuándo conviene', 'Siempre, y en enero sin dudarlo',
          'Grupo de 4+ que quiere recorrer el litoral en el camino']],
        [4 * cm, 6.3 * cm, 6.3 * cm])]

    st += [Spacer(1, 6), P('Si cruzás manejando, sin excepción', st_h2)]
    st += bullets([
        '<b>Libreta de conducir</b> vigente. La uruguayo se acepta en todo el Mercosur, '
        'pero tiene que estar al día y con los datos iguales a los del documento.',
        '<b>Carta Verde</b>: seguro de responsabilidad civil entre países del Mercosur. No '
        'es opcional y la policía la pide en el primer control, no en la frontera. Sale en '
        'el seguro del auto o en la Aduana.',
        '<b>Kit reglamentario</b> completo: triángulo, gato, llave de cruz, chaleco '
        'reflectivo y matafuegos vigente. Los tres últimos no se alquilan en la frontera.',
        '<b>Telepeaje</b>: la ruta cruza la BR-101 con varias cabinas. Con <b>tag</b> '
        '(Dársena o similar, que ya tenés si cruzaste a Argentina) pasás sin parar. Sin tag '
        'se paga en efectivo en la cabina, guardando el recibo.',
        '<b>Seguro del auto vigente</b>: la Carta Verde cubre la responsabilidad civil '
        'entre países, no los daños de tu propio vehículo.',
    ])
    st += tip('El peaje de la BR-101 se cobra por eje y no por persona. Con el auto lleno '
              'el costo real de la ruta se divide entre quienes van: es la ventaja de '
              'cruzar cuatro en un vehículo y no dos.')

    # -------------------------------------------------------------- 2 dinero
    st += seccion('Dinero, tarjetas y propinas', 'Sección 02')
    st.append(P('La regla corta: <b>tarjeta prepaga internacional para todo, efectivo solo '
                'para lo chico</b>. El problema no es el cambio, son las comisiones y los '
                'recargos que se descubren al final.', st_body))
    st += [Spacer(1, 4), tabla(
        ['Dónde', 'Qué usar', 'Por qué'],
        [['Supermercados, restaurantes y hoteles',
          'Prepaga (OCA Blue, Prex, Mi Dinero)',
          'El tipo de cambio queda fijo y avisado. No hay sorpresa en el extracto'],
         ['Kiosco de playa, parador chico, propinas',
          'Efectivo en reales',
          'Muchos no aceptan tarjeta, y cuando aceptan cobran recargo. El cambio se paga mal'],
         ['Cajero en la calle',
          'No. Solo dentro de galería o de banco',
          'El de la calle cobra comisión y a veces da menos de lo que anuncia'],
         ['Alquiler de auto y combustible',
          'Crédito internacional con seguro',
          'Las prepagas suelen no cubrir el alquiler. Es el gasto grande: ahí no conviene ahorrar']],
        [4.4 * cm, 4.6 * cm, 7.5 * cm])]

    st += [Spacer(1, 6), P('Los precios de referencia', st_h2)]
    st.append(P('Estos son los valores reales de la base del proyecto para Florianópolis, '
                'verificados el 27/09/2026:', st_body))
    st += [Spacer(1, 3), tabla(
        ['Consumo', 'En reales', 'Nota'],
        [['Almuerzo en restaurante barato', 'R$ 35', 'la referencia más barata de la ciudad'],
         ['Cena media para dos', 'R$ 204', 'por persona, no por mesa'],
         ['Cappuccino', 'R$ 11,4', 'el número que más se repite en la guía'],
         ['Cerveza', 'R$ 12', 'una botella en la orla'],
         ['Prato Feito (PF)', 'R$ 30 a 40', 'plato, postre y café, todo junto'],
         ['Comida por peso', 'R$ 40 a 70', 'lo más barato si llegás con hambre'],
         ['Comida por día · económica', 'US$ %s' % comida.get('casual', '28'),
          'PF o comida por peso, sin bebidas'],
         ['Comida por día · media', 'US$ %s' % comida.get('moderado', '55'),
          'un almuerzo en restaurante de verdad'],
         ['Comida por día · gourmet', 'US$ %s' % comida.get('gourmet', '90'),
          'una cena con producto de la isla']],
        [5.4 * cm, 3.4 * cm, 7.7 * cm])]

    st += [Spacer(1, 6), P('La propina: el 10 % ya está en la cuenta', st_h2)]
    st.append(P('En Brasil la <b>taxa de servicio del 10 % viene impresa en la cuenta</b> y '
                'no se paga aparte. Es el mismo 10 % de cualquier lado, pero acá ya está '
                'dentro: si lo sumás otra vez al hacer cuentas, duplicás el gasto.', st_body))
    st += bullets([
        'No hay que pedirla, ya está. El mesero no te la cobra en la mesa.',
        'Se puede pedir que la saquen si el servicio fue malo. Se pide <b>una sola vez</b>, '
        'cuando te pasan la cuenta, no después de haber pagado.',
        'En barra y en kiosco la propina no existe: el 10 % va solo en restaurante con mesa.',
        'La costumbre de dejar el vuelto en la mesa no aplica acá: la cuenta siempre la lleva '
        'el mesero.',
    ])

    # -------------------------------------------------------------- 3 zonas
    st += seccion('Zonas clave y dónde parar', 'Sección 03')
    st.append(P('<b>Florianópolis no es una ciudad con playas: es una ciudad dentro de una '
                'isla llena de playas.</b> De la orla a Naufragados hay 40 minutos. La '
                'consecuencia práctica es una sola: <b>planificá por zona, no por día</b>, o '
                'vas a cruzar el mapa cuatro veces.', st_body))
    st += [Spacer(1, 4), tabla(
        ['Zona', 'Ambiente', 'Para quién', 'La clave'],
        [['<b>Norte</b><br/>Cachoeira, Canasvieiras, Brava',
          'Familia e infraestructura. Agua calma y poco profunda, todo a pie',
          'Grupos con chicos y parejas que quieren arrancar tranquilos',
          'La playa de los uruguayos. Si el viento cierra la costa este, es el plan B'],
         ['<b>Este</b><br/>Mole, Joaquina, Barra',
          'La más turística: olas, surf, bares sobre la arena, gente hasta la noche',
          'Grupos de amigos y parejas jóvenes',
          'Dónde está la movida y las playas con olas'],
         ['<b>Sur</b><br/>Naufragados, Campeche',
          'Naturaleza y silencio. Naufragados es una postal sin servicios',
          'Adventureros y quien quiera desconectar de verdad',
          'Carrete, o el mejor atardecer del estado'],
         ['<b>Centro</b><br/>Beira-Mar',
          'Ciudad: comercio, mercadito, ciclovia, movimiento',
          'Quien quiera ver el producto de la isla y comer PF barato',
          'El corazón. El Prato executivo y el bondinho salen de acá'],
         ['<b>Lagoa</b><br/>Lagoa da Conceição',
          'No es mar: laguna de agua dulce, tibia y protegida',
          'El plan cuando el tiempo está feo',
          'No depende del oleaje. Kayak, paddle y dunas al lado'],
         ['<b>Santo Antônio</b><br/>y São Francisco',
          'Sur de la isla, entre el centro y el sur',
          'El que recorre la Costa Verde a pie o en bondinho',
          'El tramo de 12 km de caminata con vista al mar']],
        [3.3 * cm, 4.3 * cm, 4.2 * cm, 4.7 * cm])]

    st += [Spacer(1, 6), P('Tres cosas de zonificación que se saben después de sufrir', st_h2)]
    claves = ('Toda la isla es un mismo lugar', 'La franja no se camina',
              'El centro viejo está donde no lo esperás', 'Auto solo si vas al sur')
    for t in d['tips']:
        if t['titulo'] in claves:
            st += tip('<b>%s.</b> %s' % (t['titulo'], t['texto']))

    # -------------------------------------------------------------- 4 comer
    st += seccion('Comer, beber y supermercado', 'Sección 04')
    st.append(P('La comida de Florianópolis es barata si sabés dónde. La diferencia entre un '
                'almuerzo de US$ 3 y uno de US$ 14 casi nunca es el plato: es el lugar. Estos '
                'son los que ya están en la base del proyecto, con su precio.', st_body))
    st += [Spacer(1, 4), P('Dónde comer, con el precio real', st_h2)]
    st.append(P('Ordenado por lo que sale. Los de US$ 3 a 7 son la zona donde vive el turismo '
                'que no quiere gastar una fortuna.', st_foot))
    for item in d['comer']:
        st.append(P('<b>%s</b> &nbsp;<font color="#E65100"><b>US$ %s</b></font> &nbsp;'
                    '<font color="#78909C">%s · %s</font><br/>%s'
                    % (item['name'], item['usd'] or '—', item['tipo'] or '',
                       item['momento'] or '', item['nota']), st_body))
        st.append(Spacer(1, 3))

    st += [Spacer(1, 5), P('El Prato Feito y la comida por peso', st_h2)]
    st.append(P('El <b>PF</b> es el almuerzo del brasileiro de a diario: arroz, frijoles, '
                'ensalada, carne o pollo y postre, por <b>R$ 30 a 40</b>. Es la comida con '
                'mejor relación precio-cantidad de la ciudad y está en todas partes: '
                '<b>buscá la pizarra del día</b>, no un restaurante de carta.', st_body))

    st += [Spacer(1, 4), P('Supermercado: la compra grande se hace una vez, al llegar', st_h2)]
    st += bullets([
        'Hacé la compra grande el primer día, en un <b>mayorista</b> (Atacadão, Makro, '
        'Hipermax). El precio por kilo es una fracción del de un supermercado de barrio.',
        'El <b>kiosco de playa</b> cobra dos o tres veces por la misma cerveza que en la '
        'ciudad. Es un peaje por la sombra: pagá solo la botellita de agua.',
        'La <b>feira do produtor</b> del sábado, en la Beira-Mar y en São Francisco, es la '
        'compra más barata del viaje: fruta, pan de queso, jugos naturales y comida hecha a '
        'precio de productor. Se compra, se cocina y se come en la playa.',
        'Para el agua y la cerveza de todos los días, el súper del barrio. Para la compra '
        'grande, el mayorista. Para lo fresco del fin de semana, la feira.',
    ])

    st += [Spacer(1, 5), P('Los traslados del día, con los tres niveles', st_h2)]
    st.append(tabla(
        ['Nivel', 'Comida por día', 'Traslado por día', 'Se traduce en'],
        [['Económico', 'US$ %s' % comida.get('casual', '28'),
          'US$ %s' % trasl.get('eco', '16'), 'PF, bondinho, beaches gratuitas'],
         ['Medio', 'US$ %s' % comida.get('moderado', '55'),
          'US$ %s' % trasl.get('medio', '24'), 'restaurante y algún taxi'],
         ['Confort', 'US$ %s' % comida.get('gourmet', '90'),
          'US$ %s' % trasl.get('confort', '35'), 'transfer privado y cena afuera']],
        [2.8 * cm, 3.2 * cm, 3.4 * cm, 7.1 * cm]))
    st.append(P('Son los mismos números, con la misma fuente, que usa la calculadora de '
                'cuantosale.uy para armar el presupuesto del viaje.', st_foot))

    # ------------------------------------------------------------- 5 playas
    st += seccion('Catálogo de playas: %d fichas' % len(d['beaches']),
                  'Sección 05 · el corazón de la guía')
    st.append(P('La base del proyecto tiene <b>%d playas</b> de la isla, cada una con su vibe, '
                'su ubicación y cuándo conviene. Abajo están las <b>%d completas</b>, con su '
                'acceso y su Tip Pro. Las %d restantes se abren al entrar a Booking.'
                % (len(d['beaches']), len(completas),
                   max(0, len(d['beaches']) - len(completas))), st_body))
    st += [Spacer(1, 3), HRFlowable(width='100%', thickness=0.6, color=LINEA, spaceAfter=7)]

    for b in d['beaches']:
        st += ficha(b, bloqueada=b['name'] not in TIPS_PRO)
        st.append(Spacer(1, 5))

    st += [Spacer(1, 3),
           P('Las %d playas que quedan' % (len(d['beaches']) - len(completas)), st_h2)]
    st += tip('Canasvieiras, Praia Brava, Praia do Campeche, Lagoa da Conceição y las '
              'demás quedan con su ficha completa: vibe, cuándo ir, cómo llegar, nivel de '
              'infraestructura y el Tip Pro de cada una. Se abren cuando tu pedido pasa a '
              'entrando a Booking.')

    # -------------------------------------------------------------- 6 salud
    st += seccion('Conectividad, salud y seguridad', 'Sección 06')
    st += [P('Conectividad', st_h2), Spacer(1, 3), tabla(
        ['Opción', 'Costo', 'Para qué'],
        [['<b>eSIM</b>, comprada antes de salir', 'US$ 8 a 15 por 10 a 20 GB',
          'La mejor si el celular la soporta: llegás con internet y no dependés de nada'],
         ['<b>Chip local</b> en el aeropuerto', 'R$ 20 a 40',
          'Respaldo, o la única opción si el celular es viejo'],
         ['<b>Roaming</b> del operador uruguayo', 'US$ 5 a 15 por día',
          'La más cara. Para una semana, ya paga un eSIM'],
         ['<b>WiFi</b> del alojamiento', 'Gratis o R$ 15 por día',
          'Alcanza para lo urgente. El problema es la calle y la playa']],
        [4.3 * cm, 4 * cm, 8.2 * cm])]

    st += [Spacer(1, 6), P('Salud', st_h2)]
    st += bullets([
        '<b>Seguro de viaje con cobertura médica</b>: no es opcional. Una consulta en '
        'Florianópolis puede salir US$ 100 a 200 sin cobertura, y hay hospital privado de '
        'calidad cerca del centro.',
        'Una <b>asistencia médica de viaje</b> por teléfono también sirve: se llama antes de '
        'ir al hospital y se decide la derivación con el costo controlado.',
        'Para golpes o consumos de venta libre, cualquiera farmacia de la Beira-Mar. Para '
        'lo demás, hospital: hay un privado en el centro y el público para emergencias.',
    ])

    st += [Spacer(1, 5), P('Seguridad', st_h2)]
    st += bullets([
        'Florianópolis es tranquila. El problema real es el robo en la playa y en el centro '
        'turístico, no la agresividad.',
        '<b>No dejés nada en la playa.</b> Maleta, cámara, celular y documentos van en la '
        'mochila que va con vos, o en el locker del parador si lo preferís.',
        'A la <b>noche</b> no camines por caminos sin luz ni por el centro viejo vacío. La '
        'movida está iluminada y llena: ahí estás bien.',
        'Las playas concurridas tienen <b>torre de guardavidas</b>. Donde hay bandera roja no '
        'se entra, y no es una sugerencia.',
    ])

    # ---------------------------------------------------------------- 7 CTA
    st.append(PageBreak())
    st += seccion('Cómo se abre el resto de la guía', 'El paso que falta')
    st.append(P('Esta muestra tiene la parte abierta. Para tener las <b>%d fichas de playas</b> '
                'completas, los Tips Pro de cada una y los datos de acceso, entrá a Booking '
                'desde el hotel que elegiste.' % len(d['beaches']), st_body))
    st += [Spacer(1, 13), P('ABRILA TOCANDO "VER OPCIONES" DEL HOTEL', st_cta), Spacer(1, 13),
           P('Es el mismo clic con el que consultarías las habitaciones: no hay un paso '
             'aparte, ni que completar un formulario, ni que esperar confirmación.',
             st_cta_s)]

    st += [Spacer(1, 6), P('Qué se abre con eso', st_h2)]
    st += bullets([
        'El <b>catálogo completo</b> de las %d playas, con la ficha de cada una.' % len(d['beaches']),
        'Los <b>Tips Pro</b>: lo que te cuenta un local y no aparece en ningún foro.',
        'Los <b>datos de acceso y parqueo</b> de cada playa, con su nivel de infraestructura.',
        'La <b>recomendación de zona</b> para tu tipo de grupo: familia, pareja o amigos.',
        'El <b>respaldo de un operador</b> que te confirma disponibilidad y horario del transfer.',
    ])

    st += [Spacer(1, 7), HRFlowable(width='100%', thickness=0.6, color=LINEA, spaceAfter=7)]
    st += [P('Y acá se termina de ordenar el viaje', st_h2), Spacer(1, 3)]
    st.append(P('Los grupos no se organizan por chat. En <b>cuantosale.uy</b> el grupo de '
                'amigos se crea al instante, cada uno carga lo que pagó, y la plataforma '
                'calcula automáticamente <b>quién le debe a quién</b>: sin sumas a mano y sin '
                'la conversación de "esperá que me da un poco más".', st_body))

    st += [Spacer(1, 5), P('Primero el presupuesto, después el reparto', st_h2)]
    st += bullets([
        'Comparación de vuelos, alojamiento y traslado con el <b>costo real</b> del viaje, '
        'no solo el pasaje.',
        'Cuando el grupo ya sabe cuánto le sale, se arma el grupo y se cargan los gastos.',
        'Al final, el balance de quién le debe a quién sale solo, y el presupuesto se puede compartir.',
    ])

    st += [Spacer(1, 13), P('cuantosale.uy', st_cta), Spacer(1, 13),
           P('Compará vuelos, buses y alojamiento. Mirá cuánto cuesta REALMENTE el viaje '
             'completo, y armá el grupo de tus amigos al mismo tiempo.', st_cta_s),
           Spacer(1, 6 * mm),
           P('CuántoSale &nbsp;·&nbsp; Guía de Florianópolis para uruguayos', st_foot),
           P('Precios verificados el 27/09/2026. El transfer y los consumos derivados están '
             'marcados como estimación en la web.', st_foot)]

    doc.build(st)
    print('PDF generado: guia-florianopolis.pdf')
    print('Playas en el catalogo: %d (%d completas, %d bloqueadas)'
          % (len(d['beaches']), len(completas), len(d['beaches']) - len(completas)))


if __name__ == '__main__':
    generar()
