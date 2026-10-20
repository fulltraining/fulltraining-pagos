# Fulltraining · Control de pagos

Aplicación para registrar los **pagos de tus alumnos** (por **transferencia** o en **metálico**)
con tres modalidades: **tarifa plana 50 €/mes**, **dos días a la semana 40 €/mes** y
**medio mes, dos días a la semana 30 €**. Es una **PWA**: se instala en Android como una app
normal, funciona **sin conexión** y guarda los datos **en el propio móvil** (IndexedDB), sin
servidores ni cuentas.

Proyecto **independiente** de la calculadora de Omniterra: no comparte ningún archivo con ella.

> El icono es solo un cuadrado verde con las letras «FT» (lo mínimo que Android pide para
> instalar una app). No es un logotipo: la marca se muestra como texto «Fulltraining».

---

## 1. Cómo instalarla en Android

Necesitas una dirección **HTTPS** (obligatorio para que Chrome permita instalar y funcionar
sin conexión). **Ya está publicada** en GitHub Pages:

👉 **https://fulltraining.github.io/fulltraining-pagos/**

Los pasos son:

1. Abre esa dirección en **Chrome** en el móvil.
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
| **Registrar pago** | Eliges alumno → modalidad (el importe se rellena solo) → mes y año **que estás pagando** → **forma de pago** (transferencia o metálico, obligatoria) → «Guardar pago». La fecha y hora del cobro se asignan solas con la hora local del móvil. Observaciones opcionales. |
| **Alumnos** | Crear, editar, buscar y **archivar** (archivar no borra pagos). Crear o editar se hace en un **diálogo** con nombre, apellidos y modalidad (50 €, 40 € o 30 €/mes) y botones «Guardar» y «Cancelar». |
| **Historial** | Todos los pagos con nombre, **fecha del cobro**, **periodo abonado**, modalidad, **importe** y **forma de pago**. Busca por alumno y filtra por mes, año, modalidad y forma de pago (elige si el filtro aplica al **mes abonado** o a la **fecha de cobro**). Botones «Editar» y «Eliminar» (con confirmación). |
| **Resumen** | Con el selector de **mes y año**: total cobrado, **total por transferencia** y **total en metálico** (calculados por la **fecha del cobro**), número de pagos, desglose por modalidad y lista de alumnos activos con el mes seleccionado **abonado o pendiente** (según el periodo pagado, no según la fecha). |
| **Copias** | Exportar/importar copia JSON completa y exportar pagos a CSV para Excel (separador `;`). |

Si ya existe un pago del mismo alumno para ese mes, la app **avisa** con los pagos existentes y
te deja **«Revisar pagos existentes»** antes de decidir; puedes guardar de todas formas si es
correcto (por ejemplo, dos cobros de la misma persona en un mes).

---

## 3. Copias de seguridad (importante)

- Los datos viven en **IndexedDB** del móvil: al **actualizar la app no se borran**.
- **Excepción única (versión 1.2.0)**: al estrenar esta versión se **borraron una sola vez** los
  alumnos y pagos antiguos (incluidos los de la tarifa de 49 €) para empezar de cero. Queda una
  marca guardada en la base de datos, así que **no volverá a borrarse nada** al abrir, recargar
  o actualizar la app. Los registros nuevos se conservan.
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

1. **Lógica** (`qjs tests/logica.test.mjs`): **143/143**.
   - Fecha y hora local del móvil en ISO sin zona horaria; formato `dd/mm/aaaa` y `HH:mm`.
   - Importes en euros (`50,00 €`, `1.234,50 €`).
   - **Tres modalidades**: tarifa plana 50 €, dos días a la semana 40 € y medio mes 30 €;
     importe automático. **Ninguna cuesta 49 €** (se comprueba expresamente).
   - **Forma de pago obligatoria** (transferencia o metálico): el pago la guarda, el CSV y el
     JSON la incluyen, y un pago antiguo sin ella se lee como metálico sin romper nada.
   - **Verificación de totales**: 50 € por transferencia + 40 € y 30 € en metálico dan
     **total 120 €, transferencia 50 € y metálico 70 €**.
   - **Modalidad del alumno**: nace en «tarifa plana», se guarda la elegida (también viaja en la
     copia JSON) y los alumnos guardados antes de tener modalidad siguen valiendo («plana»).
   - Aviso de duplicado (mismo alumno + mismo mes/año) y que al editar no se avisa de uno mismo.
   - **Resumen**: total por fecha de cobro, nº de pagos, desglose por modalidad, **totales por
     transferencia y en metálico**, y lista de abonados/pendientes **por periodo pagado**
     (incluido un pago hecho en octubre por un periodo de noviembre: cuenta en el total de
     octubre y marca «abonado» en noviembre).
   - Búsqueda de alumnos sin distinguir tildes; filtros del historial (mes, año, modalidad,
     forma de pago, criterio mes abonado o fecha de cobro) y orden del más reciente al más antiguo.
   - CSV con BOM y `;`, comillas escapadas; exportar/importar JSON válido y fusión por id.
2. **Almacenamiento** (`qjs tests/db.test.mjs`): **36/36** sobre un IndexedDB simulado —
   - **Borrado único**: un dispositivo con datos antiguos (alumno y pago de 49 € sin forma) se
     vacía la primera vez, se guarda la marca `borrado-1.2.0` y, al **cerrar y reabrir** (o
     actualizar), el borrado **no se repite**: los registros nuevos siguen ahí.
   - Flujo completo: crear alumno → registrar pagos con su forma → consultar historial →
     **cerrar y reabrir** (los datos siguen) → exportar → importar fusionando y reemplazando →
     eliminar pago → archivar alumno sin borrar pagos → la base no se degrada.
3. **Pantallas** (`qjs tests/ui.test.mjs`): **171/171** — cada pantalla genera el HTML esperado
   con datos de prueba (botones, campos, avisos, confirmaciones, estados vacíos, escapado de
   texto). Incluye el **diálogo de alumno** (se abre desde los dos botones de Inicio, muestra las
   tres modalidades, los errores se ven dentro sin cerrarlo, al guardar escribe en el almacén y
   al cerrarlo **desaparece la capa oscura**), el **registro de un pago completo** por acciones
   (sin forma de pago no guarda; con metálico guarda y el pago sigue tras «recargar») y el
   **resumen verificado**: 120 € de total, 50 € por transferencia y 70 € en metálico.
4. **Estructura PWA** (`python3 tests/estaticas.py`): **115/115** — manifest válido con iconos
   PNG de 192/512 y maskable, service worker con los 11 archivos de la caché, rutas relativas
   (sin `/absolutas`), **sin recursos externos** (funciona sin red), textos en español,
   IndexedDB, sin datos de ejemplo, sintaxis de los 4 JS con QuickJS. Incluye comprobaciones de
   la 1.2.0: la tarifa de 49 € desaparece de la app, las tres modalidades y las dos formas de
   pago están definidas, el resumen calcula los totales por forma, el CSV lleva la columna
   «Forma de pago» y el borrado único tiene marca de versión. Y contra el fallo del diálogo:
   `.modal-fondo` oculto por defecto, sin `display: flex` en la regla base, `[hidden]` con
   `!important` y versión del manifest igual a la de la app.
5. **Servido por HTTP y HTTPS**: los 12 archivos responden `200` con el tipo MIME correcto
   tanto en `http://localhost:8083` como en un servidor **HTTPS** de prueba con certificado
   autofirmado (y el manifest se lee correctamente por HTTPS).
6. **Publicada en GitHub Pages**: la portada y los 11 archivos de la caché responden `200`
   con el MIME correcto en `https://fulltraining.github.io/fulltraining-pagos/`
   (manifest válido con `start_url` y `scope` relativos, que resuelven a esa carpeta).
7. **Corregido (versión 1.1.0)**: la capa oscura del diálogo se veía siempre con la caja blanca
   vacía y tapaba la app. Causa: `.modal-fondo { display: flex }` en `styles.css` se imponía al
   atributo `hidden` del HTML (las reglas del autor ganan a las del navegador). Ahora la capa
   está `display: none` por defecto, solo se muestra con la clase `.abierto` que pone el JS al
   abrir el formulario, y `[hidden]` lleva `display: none !important` como seguro. El formulario
   de alumno (nombre, apellidos, modalidad, Guardar/Cancelar) se muestra dentro del diálogo.
   La caché del service worker pasa a `fulltraining-cache-v2` para que el arreglo llegue también
   a quien ya había abierto la app. La versión se puede comprobar en **Copias → Versión de la app**.
8. **Versión 1.2.0 (modalidades nuevas, forma de pago y borrado inicial)**:
   - **Se empieza de cero**: al estrenar esta versión se borran **una sola vez** los alumnos y
     pagos anteriores (incluidos los de 49 €). Queda la marca `borrado-1.2.0` en IndexedDB, así
     que **no se vuelve a borrar** al abrir, recargar o actualizar la app.
   - **Modalidades**: tarifa plana 50 €, dos días a la semana 40 € y medio mes, dos días a la
     semana 30 €. La opción de 49 € desaparece de formularios y valores por defecto. Al elegir
     modalidad, el importe se rellena solo.
   - **Forma de pago obligatoria**: transferencia o metálico, en el formulario y en el historial.
   - **Resumen** con selector de mes y año: total cobrado, **total por transferencia** y **total
     en metálico**, calculados por la **fecha del cobro**. El **CSV** y el **JSON** incluyen la
     forma de pago.
   - La caché del service worker pasa a `fulltraining-cache-v3`.

### Pendiente ⏳ (no puedo hacerlo desde aquí, sin navegador ni móvil)

- **Probarla en un navegador real**: abrir la app, tocar los botones y verla renderizada.
- **Instalarla en Android** desde una dirección HTTPS y comprobar el icono, el modo pantalla
  completa y el aviso de «instalada».
- **Modo sin conexión real**: activar el avión y reabrir la app tras la primera carga.
- **Confirmar que Chrome actualiza la caché** al publicar una versión nueva.

Conviene hacer esa prueba final en el móvil: comprobar en **Copias** que pone «Versión de la
app: 1.2.0» (hacen falta **dos recargas**, o cerrar y abrir, para que salga la versión nueva),
crear un alumno, registrar un pago eligiendo modalidad y forma de pago, ver el resumen del mes,
cerrar la app, reabrirla (los registros nuevos deben seguir ahí) y exportar/importar una copia.

---

## 6. Cómo se actualiza sin perder datos

- Los archivos se pueden reemplazar libremente: **IndexedDB no se borra** al actualizar una PWA.
- En el código, la base de datos solo **añade** tablas nuevas (`version` 1 → 2 → …); nunca se
  borran ni se vacían en una actualización.
- **Única excepción**: el borrado inicial de la versión 1.2.0 (marca `borrado-1.2.0`), que se
  aplica una sola vez y no se repite en aperturas, recargas ni actualizaciones posteriores.
- La caché del service worker lleva versión (`fulltraining-cache-v3`); al aparecer otra se
  eliminan solo las cachés viejas.
- Recomendación: exporta una copia JSON antes de una actualización grande.
