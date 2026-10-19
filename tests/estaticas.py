#!/usr/bin/env python3
"""Comprobaciones estáticas de «Fulltraining · Control de pagos».

Se ejecuta desde la raíz del proyecto:

    python3 tests/estaticas.py

Revisa que la PWA esté completa y sea instalable: archivos de la
app, manifest con iconos válidos, service worker con la caché
correcta, rutas relativas (para cualquier carpeta HTTPS), textos en
español y ausencia de dependencias externas (funcionar sin conexión).
"""
import json
import os
import re
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)

fallos = 0
pruebas = 0


def ok(condicion, mensaje):
    global fallos, pruebas
    pruebas += 1
    if condicion:
        print("  ✓ " + mensaje)
    else:
        fallos += 1
        print("  ✗ FALLO: " + mensaje)


def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return f.read()


def tamano_png(ruta):
    with open(ruta, "rb") as f:
        cabecera = f.read(26)
    if cabecera[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    ancho, alto = struct.unpack(">II", cabecera[16:24])
    return ancho, alto


ARCHIVOS = [
    "index.html", "styles.css", "manifest.json", "sw.js", "icon.svg",
    "icon-192.png", "icon-512.png", "icon-512-maskable.png",
    "js/logica.js", "js/db.js", "js/app.js",
]

print("\n== Archivos de la app ==")
for ruta in ARCHIVOS:
    ok(os.path.isfile(ruta), f"existe {ruta}")

print("\n== manifest.json (instalable) ==")
try:
    man = json.load(open("manifest.json", encoding="utf-8"))
    ok(True, "el manifest es JSON válido")
except Exception as e:  # noqa: BLE001
    man = {}
    ok(False, f"el manifest es JSON válido ({e})")

ok(man.get("name", "").startswith("Fulltraining"), f"nombre «{man.get('name')}»")
ok(man.get("short_name") == "Fulltraining", "nombre corto «Fulltraining»")
ok(man.get("lang") == "es", "el manifest está en español")
ok(man.get("start_url") == "." and man.get("scope") == ".", "start_url y scope relativos (vale para cualquier carpeta)")
ok(man.get("display") == "standalone", "se abre como app (standalone)")
ok(man.get("theme_color", "").lower() == "#0f5132", "color de tema")
ok(re.fullmatch(r"\d+\.\d+\.\d+", man.get("version", "")) is not None, f"el manifest lleva versión «{man.get('version')}»")
ok(man.get("version_name") == man.get("version"), "version_name coincide con version (para Android)")

iconos = man.get("icons", [])
ok(len(iconos) >= 3, f"{len(iconos)} iconos declarados")
for icono in iconos:
    src = icono.get("src", "")
    existe = os.path.isfile(src)
    ok(existe, f"existe el icono {src}")
    if existe and src.endswith(".png"):
        real = tamano_png(src)
        esperado = tuple(int(v) for v in icono["sizes"].split("x"))
        ok(real == esperado, f"{src} mide {icono['sizes']} (real: {real})")
ok(any(i.get("purpose") == "maskable" for i in iconos), "hay icono maskable (para el cajón de Android)")

print("\n== index.html ==")
html = leer("index.html")
ok('<html lang="es">' in html, "idioma español")
ok('charset="UTF-8"' in html or 'charset="utf-8"' in html, "codificación UTF-8")
ok('name="viewport"' in html, "viewport para móvil")
ok('rel="manifest" href="manifest.json"' in html, "enlace al manifest")
ok('name="theme-color"' in html, "meta theme-color")
ok("Fulltraining" in html, "título con «Fulltraining»")
ok('serviceWorker' not in html, "el registro del service worker está en JS, no en el HTML")

refs = re.findall(r'(?:href|src)="([^"]+)"', html)
locales = [r for r in refs if not re.match(r"^(https?:)?//|^#|^mailto:", r)]
faltan = [r for r in locales if not os.path.isfile(r.split("?")[0])]
ok(not faltan, f"todas las referencias locales existen ({len(locales)}): {faltan or 'ninguna falta'}")
absolutas = [r for r in locales if r.startswith("/")]
ok(not absolutas, f"no hay rutas absolutas (para servirse en cualquier carpeta): {absolutas or 'ninguna'}")

print("\n== service worker (sin conexión) ==")
sw = leer("sw.js")
m = re.search(r"const APP_SHELL\s*=\s*\[(.*?)\];", sw, re.S)
ok(bool(m), "hay lista de archivos a cachear")
shell = re.findall(r'"([^"]+)"', m.group(1)) if m else []
faltan_sw = [f for f in shell if f != "./" and not os.path.isfile(f)]
ok(not faltan_sw, f"los {len(shell)} archivos de la caché existen: {faltan_sw or 'ninguno falta'}")
criticos = ["index.html", "styles.css", "manifest.json", "js/logica.js", "js/db.js", "js/app.js"]
ok(all(c in shell for c in criticos), "la caché incluye todos los archivos críticos")
ok('const CACHE = "' in sw, "la caché tiene nombre versionado")
cache_n = re.search(r'const CACHE = "fulltraining-cache-v(\d+)"', sw)
ok(bool(cache_n) and int(cache_n.group(1)) >= 2,
   f"la caché supera la v1 con el fallo del modal (v{cache_n.group(1) if cache_n else '?'})")
appjs = leer("js/app.js")
ok('serviceWorker' in appjs and 'register("sw.js")' in appjs, "app.js registra el service worker")
ok("navigate" in sw, "las navegaciones tienen respaldo en caché (abrir la app sin red)")

print("\n== Funcionamiento sin conexión ==")
runtime = ["index.html", "styles.css", "manifest.json", "sw.js", "js/logica.js", "js/db.js", "js/app.js"]
externos = []
for ruta in runtime:
    for enlace in re.findall(r"https?://[^\s\"')]+", leer(ruta)):
        if "www.w3.org" not in enlace:  # el xmlns del SVG es obligatorio
            externos.append((ruta, enlace))
ok(not externos, f"ningún archivo de la app carga recursos externos: {externos or 'sin recursos externos'}")

print("\n== Textos en español ==")
todo = "\n".join(leer(r) for r in ["index.html", "js/app.js", "js/logica.js"])
textos = [
    "Registrar pago", "Guardar pago", "Buscar alumno", "Nuevo alumno",
    "Tarifa plana", "Dos días a la semana", "Observaciones", "Metálico",
    "Fecha del cobro", "Mes y año abonados", "Modalidad", "Historial",
    "Resumen mensual", "Copias de seguridad", "Archivar", "Pendiente",
    "Abonado", "Exportar copia completa (JSON)", "CSV para Excel",
]
for texto in textos:
    ok(texto in todo, f"aparece «{texto}»")

print("\n== Datos ==")
dbjs = leer("js/db.js")
ok("indexedDB.open" in dbjs, "los datos se guardan en IndexedDB")
ok('NOMBRE = "fulltraining-pagos"' in dbjs, "nombre de la base de datos")
inventados = []
for ruta in ["js/logica.js", "js/db.js", "js/app.js"]:
    codigo = leer(ruta)
    if re.search(r"fictici|datosDemo|semilla\(|sampleStudents|localStorage", codigo):
        inventados.append(ruta)
ok(not inventados, f"sin datos de ejemplo ni almacenamiento alternativo: {inventados or 'limpio'}")

print("\n== Copias ==")
logica = leer("js/logica.js")
ok('"\\ufeff"' in logica, "el CSV lleva BOM para Excel")
ok('join(";")' in logica, "el CSV usa «;» como separador (Excel en español)")
ok("leerImportacion" in logica and "exportarDatos" in logica, "hay exportar e importar en JSON")

print("\n== Diálogo (nunca debe tapar la app) ==")
ok('id="modal" class="modal-fondo" hidden' in html, "la capa del diálogo nace con hidden en index.html")
css = leer("styles.css")
base_modal = re.search(r"\.modal-fondo\s*\{(.*?)\}", css, re.S)
ok(bool(base_modal), "existe la regla .modal-fondo")
if base_modal:
    ok("display: none" in base_modal.group(1), ".modal-fondo está oculto por defecto")
    ok("display: flex" not in base_modal.group(1),
       ".modal-fondo no fuerza flex (eso anulaba hidden y dejaba la caja vacía a la vista)")
abierto = re.search(r"\.modal-fondo\.abierto\s*\{(.*?)\}", css, re.S)
ok(bool(abierto) and "display: flex" in abierto.group(1), "solo la clase .abierto muestra la capa")
con_hidden = re.search(r"\.modal-fondo\[hidden\]\s*\{(.*?)\}", css, re.S)
ok(bool(con_hidden) and "!important" in con_hidden.group(1), "el atributo hidden manda siempre (display:none !important)")
ok(bool(base_modal) and "overflow-y: auto" in base_modal.group(1),
   "la capa del diálogo se puede desplazar (teclado del móvil, pantallas bajas)")
caja_modal = re.search(r"\.modal-caja\s*\{(.*?)\}", css, re.S)
ok(bool(caja_modal) and "margin: auto" in caja_modal.group(1),
   "la caja del diálogo se centra y no se corta por arriba")
ok("mostrarModal" in appjs and "ocultarModal" in appjs, "el JS abre y cierra la capa con funciones propias")
ok('data-accion="alumno-guardar"' in appjs and 'data-accion="alumno-cancelar"' in appjs,
   "el diálogo de alumno tiene «Guardar» y «Cancelar»")
ok("abrirFormularioAlumno" in appjs and "formularioAlumnoHTML" in appjs,
   "hay formulario de alumno con nombre, apellidos y modalidad")
ok('data-accion="alumno-modalidad"' in appjs, "el formulario de alumno ofrece elegir modalidad")
version_js = re.search(r'const VERSION = "([^"]+)"', appjs)
ok(bool(version_js) and version_js.group(1) == man.get("version"),
   f"manifest y app.js coinciden en la versión {man.get('version')}")

print("\n== Iconos y SVG ==")
for nombre, esperado in [("icon-192.png", (192, 192)), ("icon-512.png", (512, 512)),
                         ("icon-512-maskable.png", (512, 512))]:
    ok(tamano_png(nombre) == esperado, f"{nombre} es un PNG de {esperado[0]}x{esperado[1]}")
try:
    ET.parse("icon.svg")
    ok(True, "icon.svg es XML válido")
except Exception as e:  # noqa: BLE001
    ok(False, f"icon.svg es XML válido ({e})")

print("\n== Sintaxis JavaScript (QuickJS) ==")
for ruta in ["js/logica.js", "js/db.js", "js/app.js", "sw.js"]:
    if not os.path.isfile("/usr/bin/qjs"):
        ok(True, f"{ruta}: QuickJS no está disponible, se omite")
        continue
    proc = subprocess.run(["qjs", ruta], capture_output=True, text=True)
    salida = proc.stdout + proc.stderr
    ok("SyntaxError" not in salida, f"{ruta} compila sin errores de sintaxis")

print("\n== Comprobaciones de despliegue ==")
ok(os.path.isfile(".nojekyll"), "hay .nojekyll (para GitHub Pages)")
ok(not os.path.exists("_config.yml"), "no hay configuración de Jekyll que procese los archivos")

print(f"\n{pruebas - fallos}/{pruebas} comprobaciones correctas.")
if fallos:
    print("HAY FALLOS.")
    sys.exit(1)
