# -*- coding: utf-8 -*-
"""Sube los precios de transfer a la tabla public.transfer_precios.

    python scripts/cargar-transfer-precios.py
    python scripts/cargar-transfer-precios.py --dry-run

Lee data/tabla-transfers.xlsx y sube las columnas Compartido y Privado, por
destino y por modalidad, a public.transfer_precios.

SIN NOMBRE DE AGENCIA, A PROPOSITO
----------------------------------

El precio es del destino, no de quien lo vendo. Si manana hay dos agencias para
el mismo destino, lo que importa es cuanto sale, no quien lo dijo. Meter la
agencia en la fila daria la sensacion de que el precio depende de ella, y eso no
se sabe.


NO CAMBIA EL PRECIO QUE MUESTRA LA WEB
---------------------------------------

La web saca sus precios de data/transfer-precios.json, que esta en dolares y
tiene su fuente citada. Esta tabla es el dato crudo, en la moneda en que se
paga, para comparar y decidir despues.

Correr este script NO cambia una sola card: no escribe en transfer-precios.json
ni en ningun otro archivo del sitio. Son dos cosas separadas a proposito.


LA MONEDA
---------

La columna moneda va por fila. El default es BRL, que es lo que declara la
planilla, y se cambia con TRANSFER_MONEDA=... si algum dia no es esa. El nombre
de la columna (precio) es neutro justamente por eso: cambiar de moneda es cambiar
un default, no editar 90 filas.
"""
import os
import re
import sys
import json
import argparse
import unicodedata

from openpyxl import load_workbook

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(BASE, "data", "tabla-transfers.xlsx")
PRECIOS_JSON = os.path.join(BASE, "data", "transfer-precios.json")


def cargar_env():
    """Lee .env como lo hace server.js (ver loadEnv()).

    Sin esto el script no encuentra SUPABASE_URL ni SUPABASE_SERVICE_ROLE_KEY
    aunque esten escritos en el archivo, y dice que faltan. Pasa siempre: este
    script corre en una terminal nueva donde no arranco ningun proceso antes que
    cargara el archivo. El error confunde porque la linea esta ahi a la vista.

    Lo que ya este en el entorno gana: si se paso por variable de sesion, no se
    pisa con el archivo."""
    ruta = os.path.join(BASE, ".env")
    try:
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", linea.rstrip("\n"))
                if m and m.group(1) not in os.environ:
                    os.environ[m.group(1)] = m.group(2).strip("'\"")
    except (IOError, OSError):
        pass  # no hay .env: se usan las variables de la sesion


cargar_env()

MONEDA = os.environ.get("TRANSFER_MONEDA", "BRL")

# Las filas que no son un destino. "Búzios (ejemplo)" es la fila de muestra que
# trae la plantilla, y si se sube se cuela como si fuera el precio real.
ES_EJEMPLO = ("ejemplo", "sample", "test")


def norm(s):
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())


def a_numero(v):
    """Acepta 22, '22', '1.500', '1.500,00', 'R$ 22'. Devuelve float o None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v) if isinstance(v, (int, float)) and v == v else None
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
        if len(partes) >= 2 and len(partes[-1]) == 3:
            s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="No escribe en Supabase.")
    ap.add_argument("--moneda", help="Codigo ISO de la moneda. Por defecto, BRL o $TRANSFER_MONEDA.")
    args = ap.parse_args()
    moneda = args.moneda or MONEDA

    if not os.path.exists(XLSX):
        sys.exit("No existe data/tabla-transfers.xlsx.\n"
                 "Generalo con: npm run db:pull")

    with open(PRECIOS_JSON, encoding="utf-8") as f:
        precios = json.load(f)["destinos"]

    # nombre normalizado -> key. La traduccion sale del propio JSON, asi que no
    # hay una lista de destinos en este script que se pueda desincronizar de
    # lib/model.js.
    por_nombre = {norm(v.get("nombre")): k for k, v in precios.items()}

    wb = load_workbook(XLSX, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    try:
        head = next(it)
    except StopIteration:
        sys.exit("La planilla esta vacia.")

    idx = {}
    for i, h in enumerate(head):
        n = norm(h)
        if n:
            idx[n] = i
    col_destino = idx.get("destino")
    col_comp = idx.get("compartido")
    col_priv = idx.get("privado")
    if col_destino is None or (col_comp is None and col_priv is None):
        sys.exit("La planilla no tiene las columnas esperadas. Tiene:\n  " +
                 " | ".join(str(h) for h in head if h) +
                 "\nSe buscan: Destino, Compartido, Privado")

    filas = []
    sin_key = []
    incompletos = []
    ejemplo = []

    for f in it:
        if not any(v is not None and str(v).strip() for v in f):
            continue
        nombre = str(f[col_destino] or "").strip()
        if not nombre:
            continue
        if any(m in norm(nombre) for m in ES_EJEMPLO):
            ejemplo.append(nombre)
            continue

        key = por_nombre.get(norm(nombre))
        if not key:
            sin_key.append(nombre)
            continue

        comp = a_numero(f[col_comp]) if col_comp is not None else None
        priv = a_numero(f[col_priv]) if col_priv is not None else None
        if comp is None and priv is None:
            incompletos.append(nombre)
            continue
        if comp is not None:
            filas.append({"destino_key": key, "tipo": "compartido", "precio": comp, "moneda": moneda})
        if priv is not None:
            filas.append({"destino_key": key, "tipo": "privado", "precio": priv, "moneda": moneda})

    destinos = sorted({r["destino_key"] for r in filas})
    completos = [k for k in destinos
                 if sum(1 for r in filas if r["destino_key"] == k) == 2]

    print("data/tabla-transfers.xlsx")
    print("  %d filas para %d destinos" % (len(filas), len(destinos)))
    print("  %d con las dos modalidades, %d con una sola" % (len(completos), len(destinos) - len(completos)))
    print("  moneda: %s" % moneda)

    if ejemplo:
        print("  %d fila(s) de ejemplo, se saltean: %s" % (len(ejemplo), ", ".join(ejemplo[:3])))
    if incompletos:
        print("  %d sin ningun precio, se saltean: %s" % (len(incompletos), ", ".join(incompletos[:6]) + ("..." if len(incompletos) > 6 else "")))
    if sin_key:
        print("")
        print("  %d destinos que no matchean con transfer-precios.json, se saltean:" % len(sin_key))
        for n in sin_key[:8]:
            print("    - " + n)
        if len(sin_key) > 8:
            print("    ... y %d mas" % (len(sin_key) - 8))

    if not filas:
        sys.exit("\nNo hay precios para subir. No se toco nada.")

    if args.dry_run:
        print("")
        print("--dry-run: no se escribio nada.")
        print("  ejemplo:", json.dumps(filas[0], ensure_ascii=False))
        print("")
        print("  Ojo: esto NO cambia el precio que muestra la web. Ese sigue saliendo")
        print("  de data/transfer-precios.json, que esta en dolares.")
        return

    import urllib.request
    import urllib.error

    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        sys.exit("\nFaltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n"
                 "La anon key NO sirve: la tabla esta cerrada a proposito\n"
                 "(ver supabase_transfer_precios.sql) y solo la service role pasa\n"
                 "por encima de RLS.")

    # on_confident para que se pueda correr de nuevo: la clave primaria es
    # (destino_key, tipo), y sin esto la segunda corrida daria duplicados.
    req = urllib.request.Request(
        url + "/rest/v1/transfer_precios?on_conflict=destino_key,tipo",
        data=json.dumps(filas).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            r.read()
    except urllib.error.HTTPError as e:
        cuerpo = e.read().decode("utf-8", "replace")[:300]
        sys.exit("Supabase respondio %d: %s\n%s" % (e.code, cuerpo,
                 "\nSi dice 'relation transfer_precios does not exist', corré primero\n"
                 "supabase_transfer_precios.sql en el SQL Editor."))

    print("")
    print("cargados %d precios en %d destinos" % (len(filas), len(destinos)))
    print("")
    print("Para verlos:")
    print("  select tp.*, d.nombre from public.transfer_precios tp")
    print("    join transfer_destinos d using (destino_key) order by destino_key, tipo;")


if __name__ == "__main__":
    main()
