# Fulltraining · Control de pagos

Aplicación para registrar los **pagos en metálico de tus alumnos** (tarifa plana 50 €/mes y
dos días a la semana 49 €/mes). Es una **PWA**: se instala en Android como una app normal,
funciona **sin conexión** y guarda los datos **en el propio móvil** (IndexedDB), sin servidores
ni cuentas.

Proyecto **independiente** de la calculadora de Omniterra: no comparte ningún archivo con ella.

> El icono es solo un cuadrado verde con las letras «FT» (lo mínimo que Android pide para
> instalar una app). No es un logotipo: la marca se muestra como texto «Fulltraining».

---

## 1. Cómo instalarla en Android

Necesitas una dirección **HTTPS** (obligatorio para que Chrome permita instalar y funcionar
sin conexión). **Todavía no la he publicado**; cuando quieras, dímelo y lo hacemos.

Una vez publicada, los pasos son:

1. Abre la dirección HTTPS en **Chrome** en el móvil (por ejemplo `https://tusitio.com/fulltraining/`).
2. Espera a que **cargue del todo** (la primera carga descarga la app a la caché).
3. Toca el menú **⋮** de Chrome → **«Instalar app»** o **«Añadir a pantalla de inicio»**
   (en algunos móviles está en **Compartir → Instalar app**).
4. Confirma con **«Instalar»**. Aparecerá el icono **Fulltraining** en el cajón de apps.
5. Ábrela desde el icono: se ve a pantalla completa, sin barra de navegador.

Desde ese momento:

- **No necesitas Termux abierto** ni ningún servidor: la interfaz está en la caché y los datos
  en el móvil.
- **Funciona sin conexión** (avió, calle, modo avión…).
- Si entras con conexión, la app **se actualiza sola** cuando se publique una versión nueva.

### ¿Dónde publicarla? (opciones gratuitas)

Todos los archivos están en una sola carpeta con **rutas relativas**, así que vale para
cualquier carpeta de cualquier servidor HTTPS:

- **GitHub Pages**: sube la carpeta a un repositorio → Settings → Pages → rama `main`.
  (Ya lleva el archivo `.nojekyll`.)
- **Netlify Drop**: arrastra la carpeta a `https://app.netlify.com/drop` y te da una URL HTTPS.
- **Cloudflare Pages / cualquier hosting propio**: sube la carpeta tal cual.

---

## 2. Uso básico

| Pantalla | Para qué |
|---|---|
| **Inicio** | Botón grande «Registrar pago», buscador de alumnos y resumen del mes. |
| **Registrar pago** | Eliges alumno → modalidad (el importe se rellena solo) → mes y año **que estás pagando** → «Guardar pago». La fecha y hora del cobro se asignan solas con la hora local del móvil. Método: metálico. Observaciones opcionales. |
| **Alumnos** | Crear, editar, buscar y **archivar** (archivar no borra pagos). |
| **Historial** | Todos los pagos con nombre, fecha del cobro, mes/año abonado, modalidad, importe y observaciones. Busca por alumno y filtra por mes, año y modalidad (elige si el filtro aplica al **mes abonado** o a la **fecha de cobro**). Botones «Editar» y «Eliminar» (con confirmación). |
| **Resumen** | Total cobrado en metálico **por fecha de cobro**, número de pagos, desglose por modalidad y lista de alumnos activos con el mes seleccionado **abonado o pendiente** (según el periodo pagado, no según la fecha). |
| **Copias** | Exportar/importar copia JSON completa y exportar pagos a CSV para Excel (separador `;`). |

Si ya existe un pago del mismo alumno para ese mes, la app **avisa** con los pagos existentes y
te deja **«Revisar pagos existentes»** antes de decidir; puedes guardar de todas formas si es
correcto (por ejemplo, dos cobros de la misma persona en un mes).

---

## 3. Copias de seguridad (importante)

- Los datos viven en **IndexedDB** del móvil: al **actualizar la app no se borran**.
- **Sí se pierden** si desinstalas la app, borras los datos del sitio web o limpias el
  almacenamiento de Chrome.
- Por eso: **«Copias → Exportar copia completa (JSON)» de vez en cuando** y guarda el archivo
  en el móvil u ordenador. Para volver: «Importar copia (JSON)» → *Fusionar* (no toca lo que ya
  tienes) o *Reemplazar todo* (solo si quieres copiar exactamente la copia).
- El **CSV** es solo para hoja de cálculo (no sirve para restaurar).

---

## 4. Estructura del proyecto

```
fulltraining-pagos/
├── index.html            # pantalla única con las 6 vistas
├── styles.css            # estilos adaptados al móvil
├── manifest.json         # manifiesto de instalación (PWA)
├── sw.js                 # service worker: caché para funcionar sin conexión
├── icon.svg / icon-*.png # iconos (generados con tools/generar_iconos.py)
├── .nojekyll             # para GitHub Pages
├── servir-local.sh       # servidor local de pruebas (http://localhost:8083)
├── js/
│   ├── logica.js         # reglas de negocio y formato (sin DOM ni BD)
│   ├── db.js             # almacén IndexedDB
│   └── app.js            # interfaz
├── tools/generar_iconos.py
└── tests/                # pruebas (se ejecutan sin navegador)
```

### Ejecutar las pruebas

```bash
qjs tests/logica.test.mjs     # fechas, euros, duplicados, resumen, filtros, CSV, JSON
qjs tests/db.test.mjs         # alumnos y pagos en IndexedDB: guardar, cerrar y reabrir, importar
qjs tests/ui.test.mjs         # el HTML de cada pantalla con datos de prueba
python3 tests/estaticas.py    # estructura de la PWA, manifest, caché, rutas, textos
```

### Probarla en local

```bash
./servir-local.sh             # → http://localhost:8083
./servir-local.sh parar
```

---

## 5. Qué he verificado y qué queda pendiente

### Verificado ✅

1. **Lógica** (`qjs tests/logica.test.mjs`): **94/94**.
   - Fecha y hora local del móvil en ISO sin zona horaria; formato `dd/mm/aaaa` y `HH:mm`.
   - Importes en euros (`50,00 €`, `1.234,50 €`).
   - Tarifa plana 50 € y dos días 49 €; importe automático.
   - Aviso de duplicado (mismo alumno + mismo mes/año) y que al editar no se avisa de uno mismo.
   - **Resumen**: total por fecha de cobro, nº de pagos, desglose por modalidad, y lista de
     abonados/pendientes **por periodo pagado** (incluido un pago hecho en octubre por un
     periodo de noviembre: cuenta en el total de octubre y marca «abonado» en noviembre).
   - Búsqueda de alumnos sin distinguir tildes; filtros del historial (mes, año, modalidad,
     criterio mes abonado o fecha de cobro) y orden del más reciente al más antiguo.
   - CSV con BOM y `;`, comillas escapadas; exportar/importar JSON válido y fusión por id.
2. **Almacenamiento** (`qjs tests/db.test.mjs`): **24/24** sobre un IndexedDB simulado —
   flujo completo: crear alumno → registrar pagos → consultar historial → **cerrar y reabrir**
   (los datos siguen) → exportar → importar fusionando y reemplazando → eliminar pago →
   archivar alumno sin borrar pagos → la base no se degrada.
3. **Pantallas** (`qjs tests/ui.test.mjs`): **103/103** — cada pantalla genera el HTML esperado
   con datos de prueba (botones, campos, avisos, confirmaciones, estados vacíos, escapado de
   texto).
4. **Estructura PWA** (`python3 tests/estaticas.py`): **78/78** — manifest válido con iconos
   PNG de 192/512 y maskable, service worker con los 11 archivos de la caché, rutas relativas
   (sin `/absolutas`), **sin recursos externos** (funciona sin red), textos en español,
   IndexedDB, sin datos de ejemplo, sintaxis de los 4 JS con QuickJS.
5. **Servido por HTTP y HTTPS**: los 12 archivos responden `200` con el tipo MIME correcto
   tanto en `http://localhost:8083` como en un servidor **HTTPS** de prueba con certificado
   autofirmado (y el manifest se lee correctamente por HTTPS).

### Pendiente ⏳ (no puedo hacerlo desde aquí, sin navegador ni móvil)

- **Probarla en un navegador real**: abrir la app, tocar los botones y verla renderizada.
- **Instalarla en Android** desde una dirección HTTPS y comprobar el icono, el modo pantalla
  completa y el aviso de «instalada».
- **Modo sin conexión real**: activar el avión y reabrir la app tras la primera carga.
- **Confirmar que Chrome actualiza la caché** al publicar una versión nueva.
- **Publicarla** en la dirección HTTPS que elijas (no la he publicado todavía).

Conviene hacer esa prueba final en el móvil: crear un alumno, registrar un pago, ver el
historial, cerrar la app, reabrirla, y exportar/importar una copia.

---

## 6. Cómo se actualiza sin perder datos

- Los archivos se pueden reemplazar libremente: **IndexedDB no se borra** al actualizar una PWA.
- En el código, la base de datos solo **añade** tablas nuevas (`version` 1 → 2 → …); nunca se
  borran ni se vacían en una actualización.
- La caché del service worker lleva versión (`fulltraining-cache-v1`); al aparecer `v2` se
  eliminan solo las cachés viejas.
- Recomendación: exporta una copia JSON antes de una actualización grande.
