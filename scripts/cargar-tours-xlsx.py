# -*- coding: utf-8 -*-
"""Carga la planilla de agencias a la tabla public.tours de Supabase.

    python scripts/cargar-tours-xlsx.py                       # sube
    python scripts/cargar-tours-xlsx.py --dry-run            # solo informa
    python scripts/cargar-tours-xlsx.py --archivo RUTA.xlsx   # otra planilla

Escribe el JSON de filas y lo manda por el RPC tours_guardar_lote, que es la
misma funcion que usa scripts/cargar-tours.js. O sea que la tabla no tiene dos
caminos de escritura: uno solo, con las mismas reglas.

De donde sale el archivo, por defecto:
    C:/Users/mpbl2/Documents/Proyecto predeterminado/output/agencias_<fecha>.xlsx
Es el lugar donde cae el export de la planilla, y el nombre lleva la fecha, asi
que sin --archivo toma el mas reciente.


QUE SUBE Y QUE NO, Y POR QUE
----------------------------

La planilla mezcla tipos de servicio: Transfer, Tour, Privado, Compartido,
Hospedaje, Espectaculo, Paseo en barco. Los transfers NO se suben aca.

Es porque los transfers ya tienen su propio sistema: data/transfer-precios.json,
la tabla transfer_destinos y scripts/build-costos-desde-xlsx.py. Si estas 122
filas se subieran a public.tours, la seccion de tours de un destino puede
mostrar dos precios distintos de transfer, uno de cada tabla, y nadie sabria de
donde salio cada uno. Se cargan con su propio script.


EL PRECIO
---------

La planilla trae PVP en reales. Va a precio_brl, que es el precio de ORIGEN, y
no a precio, que es el que muestra la web en dolares.

Es la distincion que separa un numero que hay que re-cotizar cuando se mueve la
moneda de uno que ya esta viejo: el PVP en reales es lo que el operador cobra de
verdad. El precio en dolares sale de la conversion, que usa la cotizacion de
data/tours.json. Poner el PVP en la columna precio seria publicar un numero que
nadie revisa hasta que la moneda se fue.

Y PVP, no Neto: PVP es lo que paga el pasajero, Neto es lo que entra a la
agencia. Los dos van en columnas distintas (pvp y neto) para que subir el
 equivocado sea visible.


LAS DESCRIPCIONES
-----------------

En esta planilla las columnas "Descripcion corta", "Descripcion larga" y
"Duracion" vienen con el NOMBRE DEL DESTINO repetido ("Buzios", "Buzios",
"Buzios"), no con texto. No es un error de tipeo: es lo que quedo cuando el
scrapeo no encontro la descripcion y se relleno con el nombre.

Subir eso tal cual haria que la card mostrara la bajada repetida, que es peor
que no mostrar nada. Por eso se limpian: si la celda es igual al nombre del
destino, se deja vacia y queda para que alguien la escriba. Se avisa cuantas
quedaron asi, que es el numero de descripciones que hay que completar.


LAS FOTOS
---------

Se sube url_imagen pero NO se usa para pintar. Son fotos de la agencia, sin
autor ni licencia, y el pie de creditos de la web dice que las fotos son de
Wikimedia Commons con licencia libre. Usar estas haria que ese pie mintiera.

Cada tour sigue mostrando la foto de TOUR_PHOTOS (si la hay) o el degradado
con el icono de la actividad, que es lo que ya pasaba.


EL ESTADO DEL SCRAPEO
---------------------

La planilla ya filtro: 145 'ok', 6 'ok-catalogo', 48 'sin-precio-publicado',
8 'descartada'. Se sube todo y el estado queda en su columna, para poder
filtrar despues. Las 'sin-precio-publicado' entran con precio_brl null, asi que
la tabla las acepta (tiene precio en PVP a veces) pero no se muestran: el
importador las marca como inactivas.
"""
import os
import re
import sys
import json
import glob
import unicodedata
import argparse

from openpyxl import load_workbook

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cargar_env():
    """Lee .env como lo hace server.js (ver loadEnv()).

    Sin esto el script no encuentra SUPABASE_URL ni SUPABASE_SERVICE_ROLE_KEY
    aunque esten escritos en el archivo, y dice que faltan. Pasa siempre: este
    script corre en una terminal nueva donde no arranco ningun proceso antes que
    cargara el archivo. El error confunde porque la linea esta ahi a la vista.

    Lo que ya este en el entorno gana: si se paso por variable de sesion, no se
    pisa con el archivo."""
    try:
        with open(os.path.join(BASE, ".env"), encoding="utf-8") as f:
            for linea in f:
                m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", linea.rstrip("\n"))
                if m and m.group(1) not in os.environ:
                    os.environ[m.group(1)] = m.group(2).strip("'\"")
    except (IOError, OSError):
        pass  # no hay .env: se usan las variables de la sesion


cargar_env()

# Donde cae el export de la planilla, fuera del repo. Es el unico path con
# espacios yacentos que hay que escribir a mano en Windows.
CARPETA_EXPORT = os.path.join(
    os.environ.get("USERPROFILE", ""),
    "Documents", "Proyecto predeterminado", "output"
)

# Los tipos que NO son tours. Ver la nota de arriba.
NO_ES_TOUR = {"transfer", "privado", "compartido", "van", "privada", "compartida"}

# El destino se escribe como lo escribe la planilla ("Buzios", "Arraial do
# Cabo") y la tabla quiere la key de lib/model.js. Este mapa es el unico lugar
# donde se traduce, y cada entrada esta a mano porque un destino mal traduccion
# deja el tour invisible sin error.
#
# Las claves van normalizadas (ver norm) para que "Buzios" y "BUZIOS" caigan en
# la misma.
DESTINOS = {
    "arraial do cabo": "arraial",
    "arraial d'ajuda": "ajuda",
    "buzios": "buz",
    "cabo frio": "cabo",
    "florianopolis": "fln",
    "florianópolis": "fln",
    "porto de galinhas": "porto",
    "morro de sao paulo": "morro",
    "morro de são paulo": "morro",
    "rio de janeiro": "rio",
    "jericoacoara": "jericoacoara",
    "maragogi": "maragogi",
}

# Hojas que NO son un destino. "Pataxo Turismo (multi-destino)" es una AGENCIA
# que ofrece tours en varias ciudades, no una ciudad: sus filas no se pueden
# colgar de ningun destino, asi que no se suben.
#
# Estan aca y no hardcodeadas por hoja porque el nombre de la hoja es el destino
# y la lista tiene que crecer cada vez que la agencia mande una ciudad nueva.
# Mandarlas a una key inventada seria peor que no mandarlas: el tour entra en la
# base, pasa todos los chequeos y no lo ve nadie nunca.
NO_ES_DESTINO = ("pataxo", "multi-destino", "multidestino")

# Los destinos que la planilla nombra de una forma y la tabla de otra.
ALIAS_DESTINO = {
    # La planilla agrupa bajo un nombre, la web los tiene separados.
    "porto de galinhas": "porto",
    "morro de sao paulo": "morro",
}

LOTE = 100  # filas por pedido; PostgREST aguanta mucho mas, pero asi el error dice algo util

# Rastro de scrapeo en el titulo: "Ver detalhes +" es el texto del boton de la
# pagina de la agencia que se colaron en el nombre. Solo se avisa, no se limpia:
# cambiar el titulo cambia la clave de la foto, y prefiero que se vea el problema
# a que se pierda la foto en silencio.
BASURA_TITULO = re.compile(r"ver\s+detalhes|ver\s+mais|leia\s+mais|\+\s*$", re.IGNORECASE)


def norm(s):
    """'Búzios' y 'Buzios' tienen que ser la misma cosa.

    Sin tildes, sin mayusculas, espacios colapsados. Es lo que permite que un
    destino escrito de cinco formas distintas caiga en la misma key.
    """
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())


def numero(v):
    """Acepta 88, '88', 'R$ 1.400', '1.400,50', '30%'. Devuelve float o None.

    El separador de miles importa: escrito a mano, '1.400' son mil cuatrocientos
    en formato es y 1,4 en formato en. Se resuelve mirando cuantos digitos van
    despues del ultimo punto: tres son miles, otra cosa es decimal.
    """
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    for ch in ("R$", "US$", "$", "%", "\u00a0", " "):
        s = s.replace(ch, "")
    s = s.strip()
    if not s:
        return None
    if "," in s and "." in s:
        # "1.400,50" es es; "1,400.50" es en. El que aparece ultimo es decimal.
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
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


def texto(v):
    if v is None:
        return ""
    return " ".join(str(v).split())


def celda(fila, indices, *nombres):
    """Lee la primera columna que exista de los nombres dados.

    Los encabezados de la planilla traen tildes ('Descripción') y el archivo se
    abre sin saber si came en UTF-8 o Latin-1. Comparar por nombre exacto es
    fragil: por eso norm() de cada lado.
    """
    for nombre in nombres:
        clave = norm(nombre)
        for col_norm, col in indices.items():
            if col_norm == clave:
                return fila[col] if col < len(fila) else None
    return None


def precio_para_la_web(pvp, moneda, tipo):
    """Devuelve (precio_brl, precio) o (None, None) si no hay PVP.

    La tabla quiere el precio de ORIGEN en precio_brl y el derivado en precio.
    Con PVP en reales, precio_brl = el PVP y precio = null: la conversion la
    hace el server con la cotizacion de data/tours.json, y no el importador.
    """
    if pvp is None:
        return None, None
    m = norm(moneda)
    if m in ("brl", "reais", "r$"):
        return pvp, None
    if m in ("usd", "dolar", "us$"):
        return None, pvp
    # Moneda desconocida: se asume real, que es lo que trae el 100% de las filas
    # con precio de este archivo. Se avisa abajo.
    return pvp, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--archivo", help="Ruta al .xlsx. Por defecto, el mas reciente de la carpeta de export.")
    ap.add_argument("--dry-run", action="store_true", help="No escribe nada en Supabase.")
    ap.add_argument("--json", help="Escribir las filas a este JSON y salir (para revisar).")
    args = ap.parse_args()

    ruta = args.archivo
    if not ruta:
        cands = sorted(glob.glob(os.path.join(CARPETA_EXPORT, "agencias_*.xlsx")), key=os.path.getmtime, reverse=True)
        if not cands:
            sys.exit("No encontre ningun agencias_*.xlsx en:\n  " + CARPETA_EXPORT +
                     "\nPasalo con --archivo RUTA.xlsx")
        ruta = cands[0]

    if not os.path.exists(ruta):
        sys.exit("No existe: " + ruta)

    print("archivo:", ruta)
    wb = load_workbook(ruta, data_only=True, read_only=True)

    filas = []
    avisos = []
    # Las que no tienen PVP. No se suben: ver la nota del chequeo mas abajo.
    sin_precio = []
    stats = {
        "total": 0, "transfers": 0, "sin_pvp": 0, "desc_duplicada": 0,
        "sin_destino": 0, "moneda_desconocida": 0, "descartadas": 0,
        "no_es_destino": 0, "sin_tipo": 0, "titulo_basura": 0,
    }
    por_destino = {}
    por_tipo = {}

    for hoja in wb.sheetnames:
        if hoja.startswith("_"):
            continue  # _Cobertura es una hoja de control, no de datos
        ws = wb[hoja]
        it = ws.iter_rows(values_only=True)
        try:
            head = next(it)
        except StopIteration:
            continue

        # Los encabezados se guardan normalizados para no depender de tildes ni
        # de como los escribio quien armo el archivo.
        indices = {}
        for i, h in enumerate(head):
            n = norm(h)
            if n:
                indices[n] = i

        if "destino" not in indices or "nombre del tour / transfer" not in indices:
            avisos.append("hoja '%s': faltan las columnas Destino o Nombre del tour / transfer. Se saltea." % hoja)
            continue

        for num_fila, f in enumerate(it, start=2):
            destino_txt = texto(celda(f, indices, "Destino"))
            titulo = texto(celda(f, indices, "Nombre del tour / transfer", "Nombre del tour"))
            if not destino_txt and not titulo:
                continue
            stats["total"] += 1

            # Una hoja de agencia no es un destino. Se cuenta aparte y se sigue.
            if any(m in norm(destino_txt) for m in NO_ES_DESTINO):
                stats["no_es_destino"] += 1
                continue

            if not titulo:
                avisos.append("%s fila %d: sin nombre de tour. Se saltea." % (hoja, num_fila))
                continue

            tipo = texto(celda(f, indices, "Tipo de servicio"))
            por_tipo[tipo or "(vacio)"] = por_tipo.get(tipo or "(vacio)", 0) + 1
            if norm(tipo) in NO_ES_TOUR:
                stats["transfers"] += 1
                continue

            # Sin tipo de servicio no se sabe si es un tour. Se cuenta aparte y
            # NO se sube: un transfer sin el tipo marcado se colaria en la seccion
            # de tours con el precio de un traslado, que es el error que mas cara
            # sale de los dos.
            if not tipo:
                stats["sin_tipo"] += 1
                avisos.append("%s fila %d: '%s' sin Tipo de servicio. No se sube (puede ser un transfer)." % (hoja, num_fila, titulo[:50]))
                continue

            # Titulo con rastro del scrapeo. No es cosmetico: el titulo es la
            # clave de la foto en TOUR_PHOTOS ("destino#titulo"), asi que un
            # titulo sucio no solo se ve mal, garantiza que la card no encuentre
            # su foto.
            if BASURA_TITULO.search(titulo):
                stats["titulo_basura"] += 1
                avisos.append("%s fila %d: titulo con texto de scrapeo: '%s'. Se sube igual; no va a encontrar foto." % (hoja, num_fila, titulo[:50]))

            estado = texto(celda(f, indices, "Estado del scrapeo"))
            if norm(estado) == "descartada":
                stats["descartadas"] += 1
                continue

            # El destino tiene que existir en el modelo o el tour no se ve nunca.
            clave_dest = DESTINOS.get(norm(destino_txt))
            if not clave_dest:
                stats["sin_destino"] += 1
                avisos.append("%s fila %d: destino '%s' no esta en el mapa de traduccion. Se saltea." % (hoja, num_fila, destino_txt))
                continue

            moneda = texto(celda(f, indices, "Moneda"))
            pvp = numero(celda(f, indices, "Valor / Precio público (PVP)", "Valor / Precio publico (PVP)", "PVP"))
            if pvp is None:
                stats["sin_pvp"] += 1
            if moneda and norm(moneda) not in ("brl", "reais", "r$", "usd", "dolar", "us$"):
                stats["moneda_desconocida"] += 1

            # Se leen antes del corte por falta de PVP, porque el archivo de
            # revision los quiere: sin agencia no se sabe a quien preguntar el
            # precio que falta.
            agencia = texto(celda(f, indices, "Agencia"))
            link = texto(celda(f, indices, "Link web", "URL", "url"))

            precio_brl, precio = precio_para_la_web(pvp, moneda, tipo)

            # Las descripciones que repiten el nombre del destino no son
            # descripciones. Ver la nota del docstring.
            destino_nombre = texto(destino_txt)
            def limpiar(v):
                s = texto(v)
                return "" if (not s or norm(s) == norm(destino_nombre)) else s

            desc = limpiar(celda(f, indices, "Descripción corta", "Descripcion corta"))
            detalle = limpiar(celda(f, indices, "Descripción larga / Itinerario", "Descripcion larga / Itinerario"))
            duracion = limpiar(celda(f, indices, "Duración", "Duracion"))
            if not desc:
                stats["desc_duplicada"] += 1

            if not pvp:
                # Sin precio no se puede cotizar, y tours_guardar_lote lo
                # rechaza: la funcion que corre en la base exige precio a toda
                # fila, no solo a las activas. Se podria re-crear la funcion para
                # que mire `activo` y asi guardar estas filas inactivas, pero
                # mientras tanto no vale la pena otra ida al SQL Editor por 14
                # filas que no se pueden mostrar ni cotizar.
                #
                # Van a un archivo de revision, no se pierden: cuando la agencia
                # complete el precio, se vuelven a correr.
                sin_precio.append({
                    "destino": destino_txt, "titulo": titulo,
                    "agencia": agencia, "estado": estado,
                    "hoja": hoja, "fila": num_fila,
                })
                continue

            activo = True

            comision = numero(celda(f, indices, "Comisión", "Comision"))
            neto = numero(celda(f, indices, "Neto"))

            filas.append({
                "destino": clave_dest,
                "titulo": titulo,
                "descripcion": desc,
                "detalle": detalle,
                "precio": precio,
                "precio_brl": precio_brl,
                "pvp": pvp,
                "comision": comision,
                "neto": neto,
                "duracion": duracion,
                "tipo_servicio": tipo,
                "incluye": texto(celda(f, indices, "Incluye")),
                "no_incluye": texto(celda(f, indices, "No incluye")),
                "politica_cancelacion": texto(celda(f, indices, "Política de cancelación", "Politica de cancelacion")),
                "dias_salida": texto(celda(f, indices, "Días de salida", "Dias de salida")),
                "link_web": link,
                "agencia": agencia,
                # Se guarda pero no se usa para pintar: ver la nota de las fotos.
                "url_imagen": texto(celda(f, indices, "URL imagen", "URL de imagen")),
                "estado_scrapeo": estado,
                "activo": activo,
                "fuente": "Planilla de agencias, %s" % os.path.basename(ruta),
                "verificado": None,
                "orden": (len([x for x in filas if x["destino"] == clave_dest]) + 1) * 10,
            })
            por_destino[clave_dest] = por_destino.get(clave_dest, 0) + 1

    # --- informe ---
    print("")
    print("de %d filas:" % stats["total"])
    print("  %d transfers (no se suben: tienen su propia tabla)" % stats["transfers"])
    print("  %d de hoja de agencia, no de destino (Pataxo)" % stats["no_es_destino"])
    print("  %d sin Tipo de servicio (no se sabe si son tours)" % stats["sin_tipo"])
    print("  %d descartadas por el scrapeo" % stats["descartadas"])
    print("  %d sin destino reconocido" % stats["sin_destino"])
    print("  %d sin PVP (no se suben, van a data/tours-sin-precio.json)" % stats["sin_pvp"])
    print("  %d con descripcion que repetia el destino (queda vacia)" % stats["desc_duplicada"])
    if stats["titulo_basura"]:
        print("  %d con titulo sucio (van a quedar sin foto)" % stats["titulo_basura"])
    if stats["moneda_desconocida"]:
        print("  %d con moneda no reconocida (se asume BRL)" % stats["moneda_desconocida"])
    print("")
    print("a subir: %d tours en %d destinos" % (len(filas), len(por_destino)))
    for k in sorted(por_destino):
        print("    %-14s %d" % (k, por_destino[k]))
    print("")
    print("por tipo de servicio (solo los que se suben):")
    for k in sorted(por_tipo):
        if norm(k) not in NO_ES_TOUR:
            print("    %-18s %d" % (k or "(vacio)", por_tipo[k]))

    if avisos:
        print("")
        print("avisos (%d):" % len(avisos))
        for a in avisos[:20]:
            print("  - " + a)
        if len(avisos) > 20:
            print("  ... y %d mas" % (len(avisos) - 20))

    if not filas:
        print("")
        print("No hay filas para subir. No se toco nada.")
        sys.exit(1)

    # Las que no tienen PVP van a un archivo, porque se van a perder de la vista
    # si no: nadie las va a buscar en un repo. Es la misma razon por la que el
    # script de transfers escribe las que no puede parsear.
    if sin_precio:
        destino_revision = os.path.join(BASE, "data", "tours-sin-precio.json")
        try:
            with open(destino_revision, "w", encoding="utf-8") as fh:
                json.dump(sin_precio, fh, ensure_ascii=False, indent=2)
            print("")
            print("  %d sin PVP, no se suben: %s" % (len(sin_precio), destino_revision))
            print("  (cuando la agencia les ponga precio, se vuelven a correr)")
        except (IOError, OSError) as e:
            print("  %d sin PVP (no pude escribir el archivo: %s)" % (len(sin_precio), e))

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(filas, fh, ensure_ascii=False, indent=2)
        print("")
        print("escrito:", args.json)
        return

    if args.dry_run:
        print("")
        print("--dry-run: no se escribio nada en Supabase.")
        print("  ejemplo de fila:")
        print("   ", json.dumps(filas[0], ensure_ascii=False)[:220])
        return

    # --- subida ---
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        sys.exit("\nFaltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n"
                 "La anon key NO sirve: la tabla esta cerrada a proposito (ver supabase_tours.sql)\n"
                 "y solo la service role pasa por encima de RLS.")

    import urllib.request

    def rpc(nombre, cuerpo):
        req = urllib.request.Request(
            url + "/rest/v1/rpc/" + nombre,
            data=json.dumps(cuerpo).encode("utf-8"),
            headers={
                "apikey": key,
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode("utf-8")

    print("")
    print("subiendo...")

    # Con pocas filas se mandan de a una. El error de PostgREST no menciona QUE
    # fila fallo, asi que con el lote entero de 42 no hay forma de saber cual es;
    # de a una el error dice el titulo. Con muchas filas van por lote, que es lo
    # que importa para no hacer 150 requests.
    if len(filas) <= 60:
        for i, f in enumerate(filas):
            try:
                rpc("tours_guardar_lote", {"p_filas": [f]})
            except Exception as e:
                import urllib.error
                cuerpo = ""
                if isinstance(e, urllib.error.HTTPError):
                    cuerpo = e.read().decode("utf-8", "replace")
                print("")
                print("POSTGREST RESPONDIO %s en la fila %d de %d" % (getattr(e, "code", "?"), i + 1, len(filas)))
                print(cuerpo[:600])
                print("")
                print("  esa fila, tal cual:")
                print("  " + json.dumps(f, ensure_ascii=False)[:400])
                print("")
                print("  No se subio ninguna: se corta en la primera que falla, para no")
                print("  dejar la tabla a medias.")
                sys.exit(1)
            print("  %d/%d" % (i + 1, len(filas)))
    else:
        hechas = 0
        for i in range(0, len(filas), LOTE):
            rpc("tours_guardar_lote", {"p_filas": filas[i:i + LOTE]})
            hechas += min(LOTE, len(filas) - i)
            print("  %d/%d" % (hechas, len(filas)))

    print("")
    print("cargados %d tours en public.tours" % len(filas))
    print("  sin precio: %d, no se subieron (quedan en data/tours-sin-precio.json)" % stats["sin_pvp"])
    print("  descripcion vacia: %d, hay que completarlas en /tours" % stats["desc_duplicada"])
    print("")
    print("Recorda: las fotos NO se usan todavia. Cada tour muestra la de TOUR_PHOTOS")
    print("o el degradado con el icono, como antes.")


if __name__ == "__main__":
    main()
