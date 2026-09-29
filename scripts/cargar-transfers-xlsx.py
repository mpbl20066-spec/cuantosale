# -*- coding: utf-8 -*-
"""Sube los TRANSFERS de la planilla de agencias, no los tours.

    python scripts/cargar-transfers-xlsx.py --dry-run
    python scripts/cargar-transfers-xlsx.py

Es el hermano de cargar-tours-xlsx.py, y hace lo contrario a propósito: ahi los
transfers se descartan, y acá los tours. No es una contradicción: cada tipo
tiene su tabla (public.tours y public.transfer_destinos) y su pagina.

QUE HACE ESTO Y POR QUE NO ES TRIVIAL
-------------------------------------

La planilla tiene una hoja por destino, pero las filas de esa hoja NO son todas
de ese destino. El scrape metio en 'Morro de Sao Paulo' los traslados que
encontro en la web de la agencia, y esa agencia vende rutas a cualquier parte:

    Morro de Sao Paulo | Aeroporto de Ilheus - Hotel em Itacare   | R$ 201
    Morro de Sao Paulo | Aeroporto de Salvador - Hotel em Costa...  | R$ 160
    Morro de Sao Paulo | City Tour Historico (saidas do Hotel...)  | R$ 189

Si esas filas se subieran con destino='morro', la web mostraría el precio de
"Salvador → Costa do Sauipe" como el transfer a Morro de São Paulo. Y ese
precio ya existe y anda bien: data/transfer-precios.json tiene los 45 destinos
con fuente citada y nivel de confianza. Copiarlo a Supabase no agrega nada y
introduce la duda de cuál de los dos manda.

ASI QUE SE PARSEA LA TRAYECTORIA
--------------------------------

El formato del titulo es bastante consistente, y se saca el destino real de ahi:

    "Aeroporto de Ilheus - Hotel em Itacare"    -> destino Itacare
    "Aeroporto de Salvador - Hotel em Costa do Sa..."  -> Costa do Sauipe
    "Blog - Biotur"                             -> Biotur (no es ruta, se descarta)
    "City Tour Historico (saidas do Hotel Mak...)"  -> no es ruta, se descarta

Se ignoran los prefijos que no son un aeropuerto ("Blog", "Roteiros", "City
Tour"): esos son servicios, no traslados. Y cuando el destino que se parsea NO
coincide con la hoja, la fila no se sube: es el caso que genera los precios
equivocados.

Lo que no se puede adivinar es si el transfer es de ida o de ida y vuelta, ni
cuántos pasajeros incluye. Por eso solo se sube lo que el nombre dice, y el
precio se guarda como referencia: la tabla transfer_destinos tiene su propio
modelo de costo base y comisión, que es lo que hay que cargar para que el
precio final se calcule solo.
"""
import os
import re
import sys
import json
import glob
import argparse
import unicodedata

from openpyxl import load_workbook

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CARPETA_EXPORT = os.path.join(
    os.environ.get("USERPROFILE", ""),
    "Documents", "Proyecto predeterminado", "output"
)

# Los tipos de servicio que son traslados. Los tours van por otro script.
ES_TRANSFER = {"transfer", "privado", "compartido", "van", "privada", "compartida"}

# Las hojas que no son un destino.
NO_ES_DESTINO = ("pataxo", "multi-destino", "multidestino")

# Nombres que en un titulo de traslado announce que NO es un traslado. El scrape
# se lleva "Blog", "Roteiros", "City Tour" y "<h1>", que son secciones de la
# pagina de la agencia, no productos.
NO_ES_RUTA = re.compile(
    r"\b(blog|roteiros?|city\s*tour|h[1-6]|home|contato|sobre|galeria|"
    r"passagens|promocoes?|institucional|trabalhe|contato)\b",
    re.IGNORECASE,
)

# Los conectores del titulo. Se buscan en orden: el que aparezca primero separa
# el origen del destino.
CONECTORES = [
    r"\s*[-–—>]*\s*\b(?:a|para|ate|até|hasta)\b\s*[-–—>]*\s*",
    r"\s*[-–—>]\s*",
    r"\s+\b(?:a|para|ate|até|hasta)\s+",
]

# Prefijos de origen que son legitimately un aeropuerto o ciudad de salida.
ORIGEN_AEROPUERTO = re.compile(r"aeroporto|aeropuerto|airport", re.IGNORECASE)

# Palabras que no son un nombre de destino: ruido de scrape o del template.
RUIDO_DESTINO = re.compile(
    r"^\s*(hotel|hospedagem|pousada|resort|apartamento|apt|suite|su[ií]te)\s+(em|no|na)\s+",
    re.IGNORECASE,
)


def norm(s):
    """'Búzios' y 'Buzios' tienen que ser la misma cosa."""
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())


def texto(v):
    return "" if v is None else " ".join(str(v).split())


def numero(v):
    """Acepta 1500, '1.500', 'R$ 1.500,00'. Devuelve float o None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    for ch in ("R$", "US$", "$", "%", "\u00a0", " "):
        s = s.replace(ch, "")
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    elif "." in s:
        partes = s.split(".")
        if len(partes[-1]) == 3 and len(partes) >= 2:
            s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def quitar_ruido_destino(s):
    """Saca el 'Hotel em ' y deja el nombre de la ciudad."""
    previo = s
    s = RUIDO_DESTINO.sub("", s)
    # Si el nombre era solo el ruido, se devuelve el original: mejor un nombre
    # raro que un destino vacio.
    return s if s.strip() else previo


def parsear_trayectoria(titulo):
    """Devuelve (origen, destino) del titulo, o (None, None) si no es una ruta.

    Se prueban los conectores de mas largo a mas corto, porque ' - ' gana sobre
    ' a ': en "Aeroporto de X - Hotel em Y" el nombre del hotel despues del
    guion es el que dice la ciudad, no la palabra 'a' de adentro del nombre.
    """
    t = " ".join(str(titulo or "").split())
    if not t or NO_ES_RUTA.search(t):
        return None, None
    for conn in CONECTORES:
        m = re.split(conn, t, maxsplit=1)
        if len(m) == 2 and m[0].strip() and m[1].strip():
            origen = m[0].strip()
            destino = quitar_ruido_destino(m[1].strip())
            if not destino or NO_ES_RUTA.search(destino):
                return None, None
            return origen, destino
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--archivo", help="Ruta al .xlsx. Por defecto, el mas reciente de la carpeta de export.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--revision", help="Escribir las filas descartadas a este .xlsx para revisarlas a mano.")
    args = ap.parse_args()

    ruta = args.archivo
    if not ruta:
        cands = sorted(glob.glob(os.path.join(CARPETA_EXPORT, "agencias_*.xlsx")),
                       key=os.path.getmtime, reverse=True)
        if not cands:
            sys.exit("No encontre ningun agencias_*.xlsx en:\n  " + CARPETA_EXPORT)
        ruta = cands[0]

    if not os.path.exists(ruta):
        sys.exit("No existe: " + ruta)

    # Los destinos que ya existen en el modelo, para saber si el destino que se
    # parseo es una ciudad que la web maneja.
    sys.path.insert(0, BASE)
    try:
        import json as _json
        with open(os.path.join(BASE, "data", "transfer-precios.json"), encoding="utf-8") as f:
            _destinos = _json.load(f)["destinos"]
    except Exception:
        _destinos = {}
    # nombre normalizado -> key
    POR_NOMBRE = {}
    for k, v in _destinos.items():
        POR_NOMBRE.setdefault(norm(v.get("nombre")), k)
        # Se agregan los alias que aparecen en los titulos ("Costa do Sauipe" ->
        # el destino que en la web se llama distinto).
        for alias in v.get("alias", []) or []:
            POR_NOMBRE.setdefault(norm(alias), k)

    print("archivo:", ruta)
    if not POR_NOMBRE:
        print("aviso: no pude leer data/transfer-precios.json, asi que no se puede chequear si el destino existe")

    wb = load_workbook(ruta, data_only=True, read_only=True)

    # destino de la hoja -> lista de filas que SI se pueden subir
    por_destino = {}
    # Filas que no se suben, con el motivo. Van al archivo de revision.
    rechazadas = []
    stats = {"total": 0, "transfers": 0, "no_es_ruta": 0, "destino_distinto": 0,
             "destino_conocido": 0, "sin_pvp": 0, "hoja_agencia": 0}

    for hoja in wb.sheetnames:
        if hoja.startswith("_"):
            continue
        ws = wb[hoja]
        it = ws.iter_rows(values_only=True)
        try:
            head = next(it)
        except StopIteration:
            continue
        idx = {}
        for i, h in enumerate(head):
            n = norm(h)
            if n:
                idx[n] = i
        if "destino" not in idx or "nombre del tour / transfer" not in idx:
            continue

        if any(m in norm(hoja) for m in NO_ES_DESTINO):
            stats["hoja_agencia"] += 0  # se cuentan abajo, en las filas

        col_pvp = None
        for k in idx:
            if k.startswith("valor") or k == "pvp":
                col_pvp = k
                break

        for num_fila, f in enumerate(it, start=2):
            if not any(v is not None and str(v).strip() for v in f):
                continue
            hoja_destino = texto(f[idx["destino"]])
            titulo = texto(f[idx["nombre del tour / transfer"]])
            if not titulo:
                continue
            tipo = texto(f[idx["tipo de servicio"]])
            if norm(tipo) not in ES_TRANSFER:
                continue
            stats["transfers"] += 1

            if any(m in norm(hoja_destino) for m in NO_ES_DESTINO):
                stats["hoja_agencia"] += 1
                continue

            pvp = numero(f[idx[col_pvp]]) if col_pvp else None
            agencia = texto(f[idx["agencia"]])
            link = texto(f[idx.get("link web", -1)]) if "link web" in idx else ""

            # La fila tiene que ser una ruta con origen y destino.
            origen, destino_txt = parsear_trayectoria(titulo)
            if not origen or not destino_txt:
                stats["no_es_ruta"] += 1
                rechazadas.append({
                    "hoja": hoja, "fila": num_fila, "titulo": titulo,
                    "pvp": pvp, "agencia": agencia,
                    "motivo": "el titulo no es una ruta (no tiene origen y destino separados)",
                })
                continue

            # Y el destino de la ruta tiene que ser el destino de la hoja. Este
            # es el filtro que evita que "Salvador -> Costa do Sauipe" termine
            # como el transfer de Morro de Sao Paulo.
            destino_hoja_key = POR_NOMBRE.get(norm(hoja_destino))
            destino_hoja_nombre = _destinos.get(destino_hoja_key, {}).get("nombre", hoja_destino) if destino_hoja_key else hoja_destino
            coincide = norm(destino_txt) == norm(hoja_destino) or norm(destino_txt) == norm(destino_hoja_nombre)
            if not coincide:
                # A veces el titulo trae el nombre de la ciudad con otra
                # grafia ("Sao Paulo" por "São Paulo"); se prueba sin tildes,
                # que ya es el caso de norm().
                stats["destino_distinto"] += 1
                rechazadas.append({
                    "hoja": hoja, "fila": num_fila, "titulo": titulo,
                    "origen": origen, "destino_real": destino_txt,
                    "pvp": pvp, "agencia": agencia,
                    "motivo": "la ruta va a '%s', no a '%s'" % (destino_txt, hoja_destino),
                })
                continue

            if destino_hoja_key:
                stats["destino_conocido"] += 1

            if pvp is None:
                stats["sin_pvp"] += 1
                rechazadas.append({
                    "hoja": hoja, "fila": num_fila, "titulo": titulo,
                    "origen": origen, "destino": destino_txt,
                    "pvp": None, "agencia": agencia,
                    "motivo": "sin PVP: no se puede cotizar",
                })
                continue

            por_destino.setdefault(destino_hoja_key or norm(hoja_destino), []).append({
                "titulo": titulo,
                "pvp_brl": pvp,
                "origen": origen,
                "agencia": agencia,
                "link": link,
            })

    # --- informe ---
    print("")
    print("de %d filas de transfer:" % stats["transfers"])
    print("  %d de hoja de agencia (Pataxo), no de destino" % stats["hoja_agencia"])
    print("  %d el titulo no es una ruta (Blog, City Tour, sin origen/destino)" % stats["no_es_ruta"])
    print("  %d la ruta va a OTRO destino, no al de la hoja" % stats["destino_distinto"])
    print("  %d sin PVP" % stats["sin_pvp"])
    print("")
    total_ok = sum(len(v) for v in por_destino.values())
    print("a subir: %d transfers en %d destinos" % (total_ok, len(por_destino)))
    for k in sorted(por_destino):
        print("    %-14s %d" % (k, len(por_destino[k])))

    if not por_destino:
        print("")
        print("No hay transfer que se pueda subir con este filtro. No se toco nada.")
        print("Se puede ver todo en el archivo de revision si lo pediste con --revision.")

    # Lo que se rechaza va a un archivo, que es la parte util: son 105 filas que
    # alguien tiene que revisar a mano con el dato del aeropuerto.
    if args.revision and rechazadas:
        try:
            from openpyxl import Workbook
            wbk = Workbook()
            ws = wbk.active
            ws.title = "Para revisar"
            cols = ["hoja", "fila", "titulo", "origen", "destino_real", "pvp", "agencia", "motivo"]
            ws.append(cols)
            for r in rechazadas:
                ws.append([r.get(c, "") for c in cols])
            wbk.save(args.revision)
            print("")
            print("escrito para revision:", args.revision, "(%d filas)" % len(rechazadas))
        except Exception as e:
            print("no pude escribir el archivo de revision: " + str(e))

    if args.dry_run or not por_destino:
        print("")
        print("--dry-run: no se escribio nada en Supabase.")
        if por_destino:
            primero = list(por_destino.values())[0][0]
            print("  ejemplo:", json.dumps(primero, ensure_ascii=False))
        return

    print("")
    print("QUE FALTA ANTES DE SUBIR")
    print("")
    print("Estos precios son PVP de agencia, en reales. La tabla transfer_destinos")
    print("NO los guarda como precio final: guarda COSTO BASE y COMISION, y el precio")
    print("final se calcula como costo * (1 + comision).")
    print("")
    print("O sea que con el PVP solo no hay nada que subir todavia. Se necesita el costo")
    print("base (lo que le pagan a la agencia) y la comision (cuanto se queda la agencia).")
    print("Eso esta en la columna 'Costo Base' / 'Comision' de data/tabla-transfers.xlsx,")
    print("que hoy esta vacia salvo una fila de ejemplo.")
    print("")
    print("Si lo que queres es que la web muestre el PVP como precio de referencia,")
    print("eso es OTRA cosa y hay que decirlo antes de tocar la tabla.")


if __name__ == "__main__":
    main()
