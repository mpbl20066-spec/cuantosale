"""Prueba de scripts/build-costos-desde-xlsx.py: llena costos con formatos
que la app tiene que tolerar y verifica el SQL que sale."""
import os, shutil, subprocess, sys
from openpyxl import load_workbook

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(BASE, "data", "tabla-transfers.xlsx")
BAK = XLSX + ".prueba"

shutil.copy2(XLSX, BAK)
try:
    wb = load_workbook(XLSX)
    ws = wb["Transfers"]
    h = [c.value for c in ws[1]]
    C = {n: h.index(n) + 1 for n in
         ("Destino", "Costo Base Compartido", "Costo Base Privado", "Comision")}

    # (nombre, costo_compartido, costo_privado, comision) con formatos distintos
    casos = [
        ("Río de Janeiro",    18,        "40",    0.25),
        ("Búzios",            "22",      88,     "30%"),   # 30 escrito con % -> 0.30
        ("Porto Seguro",      None,      300,    35),      # 35 en vez de 0.35 -> 0.35
        ("Salvador de Bahía", "$ 11",    "US$ 60", 0.3),
        ("Buenos Aires",      "1.200",   None,    0.2),     # miles con punto
        ("São Paulo",         12,        44,      0.30),    # tilde en la celda
        ("Jericoacoara",      "35",      "195",   None),    # sin comision
        ("Gramado",           20,        70,      0.3),     # fila real, control
        # Formatos que el parser tiene que tolerar. numero() es la parte que mas
        # se rompe: el separador de miles y el de decimal se parecen, y un costo
        # de transfer privado puede pasar de mil.
        ("Angra dos Reis",    "1.234,50", "2.500", 0.22),   # miles+decimal es/en
        ("Torres",            " 35 ",     "126",   0.18),
        ("Ilhabela",          25.5,       "1.100", 0.30),    # decimal real + miles
    ]
    aplicados = []
    for nombre, cc, cp, com in casos:
        for r in range(2, 47):
            real = str(ws.cell(row=r, column=C["Destino"]).value).strip()
            if real == nombre:
                ws.cell(row=r, column=C["Costo Base Compartido"]).value = cc
                ws.cell(row=r, column=C["Costo Base Privado"]).value = cp
                ws.cell(row=r, column=C["Comision"]).value = com
                aplicados.append(real)
                break
        else:
            print("  (no encontre la fila '%s' entre las 45; se saltea)" % nombre)

    # Una fila cuyo nombre no existe en DEST tiene que dar aviso, no crash.
    print("  filas aplicadas:", len(aplicados))

    wb.save(XLSX)

    r = subprocess.run([sys.executable, os.path.join(BASE, "scripts", "build-costos-desde-xlsx.py")],
                       capture_output=True, text=True, encoding="utf-8")
    print(r.stdout)
    if r.stderr:
        print("STDERR:", r.stderr[:500])

    out = os.path.join(BASE, "supabase_costos_cargados.sql")
    sql = open(out, encoding="utf-8").read()
    print("--- filas generadas ---")
    for linea in sql.splitlines():
        if linea.startswith("  ('"):
            print(linea)
    print()
    print("--- comprobaciones ---")
    checks = [
        ("Búzios: '30%' -> 0.3",        "('buz', 22.0, 88.0, 0.3)" in sql),
        ("Porto Seguro: 35 -> 0.35",    "('portoseguro', null, 300.0, 0.35)" in sql),
        ("Rio: comision 0.25",          "('rio', 18.0, 40.0, 0.25)" in sql),
        ("'$ 11' y 'US$ 60' parsean",   "('ssa', 11.0, 60.0, 0.3)" in sql),
        ("'1.200' es 1200, no 1.2",     "('bue', 1200.0, null, 0.2)" in sql),
        ("Jericoacoara sin comision",   "('jericoacoara', 35.0, 195.0, null)" in sql),
        ("'Sao Paulo' matchea 'São Paulo'", "('sao', 12.0, 44.0, 0.3)" in sql),
        ("null se escribe literal",     "null," in sql or ", null)" in sql or "null)" in sql),
        ("'1.234,50' es 1234.5",        "('angra', 1234.5, 2500.0, 0.22)" in sql),
        ("' 35 ' con espacios",         "('torres', 35.0, 126.0, 0.18)" in sql),
        ("25.5 decimal + 1.100 miles",  "('ilhabela', 25.5, 1100.0, 0.3)" in sql),
        ("tiene el select de chequeo",  "where costo_compartido is not null" in sql),
        ("on conflict actualiza",       "do update set" in sql),
    ]
    for nombre, ok in checks:
        print(("  OK   " if ok else "  FALLA") + "  " + nombre)
    fallas = [n for n, ok in checks if not ok]
    print()
    print("RESULTADO:", "todo bien" if not fallas else "fallaron: " + ", ".join(fallas))
finally:
    shutil.move(BAK, XLSX)
    print("(xlsx restaurado)")
