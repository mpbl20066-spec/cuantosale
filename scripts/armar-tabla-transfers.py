# -*- coding: utf-8 -*-
"""Arma data/tabla-transfers.xlsx: una sola sheet con los 45 destinos.

Las columnas de costo salen de data/costos-transfers.json si existe — ese
archivo lo genera `npm run db:pull` desde la tabla transfer_destinos de
Supabase. Si no existe, quedan vacias y en amarillo para cargarlas a mano.

Lo que si viene del proyecto es lo que ya esta en data/transfer-precios.json,
que es la unica fuente de verdad del precio de transfer.
"""
import json, os, unicodedata
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data", "transfer-precios.json")
COSTOS = os.path.join(BASE, "data", "costos-transfers.json")
OUT = os.path.join(BASE, "data", "tabla-transfers.xlsx")

with open(DATA, encoding="utf-8") as f:
    tabla = json.load(f)["destinos"]


def norm(s):
    """Compara nombres sin que 'Búzios' y 'Buzios' sean dos filas distintas."""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())


# Costo del operador, por destino_key (que es la clave de DEST en lib/model.js).
# El pull de Supabase lo indexa por destino_key, no por nombre: el nombre se
# puede escribir distinto en la base y la clave no. Se acepta el nombre
# normalizado como respaldo para una carga a mano desde este mismo archivo.
cargados = {}
if os.path.exists(COSTOS):
    with open(COSTOS, encoding="utf-8") as f:
        datos = json.load(f)
    for clave, fila in datos.get("destinos", {}).items():
        if isinstance(fila, dict):
            cargados[clave] = fila
            cargados.setdefault(norm(clave), fila)

# Orden deverdad: el del archivo de datos, agrupado por aeropuerto.
ORD = ["GIG", "GRU", "CNF", "CWB", "REC", "MCZ", "NAT", "SSA", "FOR", "FEN",
       "FLN", "POA", "IGU", "JPA", "EZE"]
MODO = {"car": "Auto", "ferry": "Ferry", "vuelo": "Vuelo"}
HUB = {"rio", "sao", "fln", "poa", "nat", "ssa", "rec", "for", "mcz", "bho",
       "curitiba", "igu", "joaopessoa", "fernando"}

# Dentro de cada aeropuerto, primero la ciudad hub (la que da nombre al
# aeropuerto) y despues el resto en orden alfabetico. GIG->Rio primero, GRU->Sao
# primero, SSA->Salvador primero: es el orden que ya usa la app.
HUBCITY = {"rio", "sao", "fln", "poa", "nat", "ssa", "rec", "for", "mcz",
           "bho", "curitiba", "igu", "joaopessoa", "fernando", "bue"}

filas = list(tabla.items())
filas.sort(key=lambda kv: (
    ORD.index(kv[1]["iata"]) if kv[1]["iata"] in ORD else 99,
    0 if kv[0] in HUBCITY else 1,
    kv[1]["nombre"],
))
# Se guarda el destino_key adentro de la fila: es la clave de DEST y la que usa
# la tabla de costos en Supabase. El nombre se puede escribir de mas de una
# forma; la clave no.
rows = []
for clave, v in filas:
    v = dict(v)
    v["k"] = clave
    rows.append(v)


# --- estilos ---
F = "Arial"
BLANCO = Font(name=F, size=11)
NEGRITA = Font(name=F, size=11, bold=True)
AZUL = Font(name=F, size=11, color="0000FF")          # dato de entrada
FORMULA = Font(name=F, size=11, color="000000")        # formula
TITULO = Font(name=F, size=14, bold=True)
SUB = Font(name=F, size=9, color="666666")
CAB = PatternFill("solid", fgColor="1F3864")
AMBAR = PatternFill("solid", fgColor="FFF2CC")         # celdas de ejemplo
SUAVE = PatternFill("solid", fgColor="F2F2F2")
GRIS = PatternFill("solid", fgColor="D9D9D9")
BORDE = Border(*[Side(style="thin", color="BFBFBF")] * 4)
CENTRO = Alignment(horizontal="center", vertical="center")
IZQ = Alignment(horizontal="left", vertical="center")

wb = Workbook()
ws = wb.active
ws.title = "Transfers"

HEADERS = ["Aeropuerto", "Destino", "Km", "Tipo de Servicio", "Duracion",
           "Compartido", "Privado", "Capacidad Maxima",
           "Costo Base Compartido", "Costo Base Privado", "Comision",
           "Precio Final Compartido", "Precio Final Privado"]
L = {h: get_column_letter(i + 1) for i, h in enumerate(HEADERS)}
CC, CP, CO = L["Costo Base Compartido"], L["Costo Base Privado"], L["Comision"]
PC, PP = L["Precio Final Compartido"], L["Precio Final Privado"]
ULT = len(HEADERS)

# --- encabezado ---
for i, h in enumerate(HEADERS, start=1):
    c = ws.cell(row=1, column=i, value=h)
    c.font = Font(name=F, size=11, bold=True, color="FFFFFF")
    c.fill = CAB
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = BORDE
ws.row_dimensions[1].height = 32

# --- datos ---
r = 2
for v in rows:
    real = set(v.get("real", []))
    es_auto = v.get("modo") == "car"
    ws.cell(row=r, column=1, value=v["iata"])
    ws.cell(row=r, column=2, value=v["nombre"])
    ws.cell(row=r, column=3, value=v.get("km"))
    ws.cell(row=r, column=4, value=MODO.get(v.get("modo"), v.get("modo")))
    ws.cell(row=r, column=5, value=v.get("horas"))
    ws.cell(row=r, column=6, value=v.get("compartido") or None)
    ws.cell(row=r, column=7, value=v["privado"])
    ws.cell(row=r, column=8, value=4 if es_auto else None)
    # Costo del operador: de Supabase si esta cargado, si no vacio.
    # Se busca por destino_key, que es la clave de DEST y no se puede escribir
    # de dos formas; el nombre es solo el respaldo.
    mio = cargados.get(v.get("k") or "", {}) or cargados.get(norm(v["nombre"]), {})
    cco, cpr, com = mio.get("costoCompartido"), mio.get("costoPrivado"), mio.get("comision")
    ws.cell(row=r, column=9, value=cco)
    ws.cell(row=r, column=10, value=cpr)
    ws.cell(row=r, column=11, value=com)
    # Los dos precios finales se calculan acá y no se copian de la base: el
    # .xlsx tiene que salir bien aunque el trigger de Postgres no haya corrido.
    ws.cell(row=r, column=12, value=f'=IF(OR(${CC}{r}="",${CO}{r}=""),"",${CC}{r}*(1+${CO}{r}))')
    ws.cell(row=r, column=13, value=f'=IF(OR(${CP}{r}="",${CO}{r}=""),"",${CP}{r}*(1+${CO}{r}))')

    for col in range(1, ULT + 1):
        c = ws.cell(row=r, column=col)
        c.font = NEGRITA if col == 2 else (FORMULA if col in (12, 13) else AZUL)
        c.border = BORDE
        c.alignment = IZQ if col == 2 else CENTRO

    for col, fmt in ((3, "#,##0"), (5, "0.0"), (6, '$#,##0'), (7, '$#,##0'),
                     (8, "0"), (9, '$#,##0'), (10, '$#,##0'),
                     (12, '$#,##0.00'), (13, '$#,##0.00')):
        ws.cell(row=r, column=col).number_format = fmt
    ws.cell(row=r, column=11).number_format = "0.0%"

    # En amarillo SOLO lo que falta cargar. Una fila que ya tiene costo desde
    # Supabase deja de marcar: la tabla dice que falta, no lo que ya esta.
    if cco is None:
        ws.cell(row=r, column=9).fill = PatternFill("solid", fgColor="FFFF00")
    if cpr is None:
        ws.cell(row=r, column=10).fill = PatternFill("solid", fgColor="FFFF00")
    if com is None:
        ws.cell(row=r, column=11).fill = PatternFill("solid", fgColor="FFFF00")

    # Procedencia de los precios de la columna F/G, en comentario.
    if real:
        txt = "Precio publicado (fuente en data/transfer-precios.json): " + v["fuente"]
        for col in real:
            ws.cell(row=r, column=6 if col == "compartido" else 7).comment = \
                Comment(txt, "CuantoSale")
    else:
        ws.cell(row=r, column=6).comment = Comment(
            "Estimado. Sin precio publicado: sale del modelo de distancia "
            "(compartido = 18 + 0.06*km). " + v.get("derivacion", ""), "CuantoSale")
        ws.cell(row=r, column=7).comment = Comment(
            "Estimado. Sin precio publicado: sale del modelo de distancia "
            "(privado = 12 + 0.62*km). " + v.get("derivacion", ""), "CuantoSale")

    if v.get("nota"):
        ws.cell(row=r, column=4).comment = Comment(v["nota"], "CuantoSale")
    r += 1

FIN = r - 1
ws.auto_filter.ref = f"A1:{get_column_letter(len(HEADERS))}{FIN}"
ws.freeze_panes = "C2"

# --- anchos ---
for col, w in zip(range(1, ULT + 1),
                  [12, 24, 8, 15, 11, 12, 11, 16, 21, 20, 11, 24, 22]):
    ws.column_dimensions[get_column_letter(col)].width = w

# --- leyenda, en la misma sheet ---
r = FIN + 3
tit = ws.cell(row=r, column=1, value="Cómo se llena esta tabla")
tit.font = Font(name=F, size=12, bold=True)
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ULT)
r += 1

NOTAS = [
    ("Las celdas AMARILLAS son las que faltan cargar.",
     "Las dos de costo y la de comisión. Los Precio Final se calculan solos."),
    ("Costo Base es lo que le PAGÁS al operador, no el precio de venta.",
     "Las columnas Compartido y Privado son lo que hoy paga el cliente."),
    ("El costo va separado en dos columnas a propósito.",
     "El compartido se paga por persona y el privado por vehículo de hasta 4. "
     "Un solo costo los reduciría a la mitad de uno de los dos."),
    ("Comision va como porcentaje: escribí 30 para 30%.",
     "El formato ya lo muestra como 30,0%, no 3000%."),
    ("Compartido se cobra por PERSONA; Privado por VEHÍCULO de hasta 4.",
     "No son la misma unidad: no los sumes entre sí."),
    ("Los dos precios son de un solo trayecto (aeropuerto → hotel).",
     "La app cobra los dos tramos por decisión comercial, no por la tabla."),
    ("5 celdas tienen precio real de un operador publicado.",
     "Tienen un comentario con la fuente. El resto es estimación del modelo de "
     "distancia: usala para estimar y poné tu costo real encima para vender."),
    ("Esta hoja se genera desde Supabase.",
     "Cargá los costos en el Table Editor de transfer_destinos y corré "
     "`npm run db:pull`. Editar acá a mano se pierde en el próximo pull."),
]
for a, b in NOTAS:
    ws.cell(row=r, column=1, value="• " + a).font = NEGRITA
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    ws.cell(row=r, column=7, value=b).font = SUB
    ws.merge_cells(start_row=r, start_column=7, end_row=r, end_column=ULT)
    for col in (1, 7):
        ws.cell(row=r, column=col).alignment = IZQ
    r += 1

# --- fila de ejemplo ---
r += 2
ws.cell(row=r, column=1, value="EJEMPLO (borrar cuando hayas copiado el formato a "
        "tus filas)").font = Font(name=F, size=10, bold=True, color="C00000")
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ULT)
r += 1
# GIG / Búzios: la app cobra 29 por persona y 120 por vehiculo. Si al operador
# se le pagan 22 por persona y 88 por vehiculo, con 30% de comision los precios
# de venta dan 28,60 y 114,40.
ej = ["GIG", "Búzios (ejemplo)", 174, "Auto", 2.7, 29, 120, 4, 22, 88, 0.30, None, None]
for i, val in enumerate(ej, start=1):
    c = ws.cell(row=r, column=i, value=val)
    c.fill = AMBAR
    c.border = BORDE
    c.font = NEGRITA if i == 2 else AZUL
    c.alignment = IZQ if i == 2 else CENTRO
for col, fmt in ((3, "#,##0"), (5, "0.0"), (6, '$#,##0'), (7, '$#,##0'),
                 (8, "0"), (9, '$#,##0'), (10, '$#,##0'),
                 (12, '$#,##0.00'), (13, '$#,##0.00')):
    ws.cell(row=r, column=col).number_format = fmt
ws.cell(row=r, column=11).number_format = "0.0%"
ws.cell(row=r, column=12, value=f'=${CC}{r}*(1+${CO}{r})')
ws.cell(row=r, column=13, value=f'=${CP}{r}*(1+${CO}{r})')
ws.cell(row=r, column=12).font = FORMULA
ws.cell(row=r, column=13).font = FORMULA
ws.cell(row=r, column=12).fill = AMBAR
ws.cell(row=r, column=13).fill = AMBAR
ws.cell(row=r, column=14, value="← 22 x 1,30 = 28,60   |   88 x 1,30 = 114,40").font = SUB

r += 2
ws.cell(row=r, column=1, value="Fuente de Km, Duracion, Compartido y Privado: "
        "data/transfer-precios.json (45 destinos, 15 aeropuertos de llegada). "
        "Km de carretera por OSRM. Verificado 2026-09-27. "
        "Costo Base y Comision: tabla transfer_destinos en Supabase.").font = SUB
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ULT)

wb.save(OUT)
print("OK ->", OUT)
print("filas de datos:", FIN - 1, "| hoja unica:", ws.title)
