/* ============================================================
   Fulltraining · Control de pagos — pruebas de pantallas
   Se ejecutan con QuickJS:  qjs tests/ui.test.mjs

   Generan el HTML de cada pantalla con datos de prueba y
   comprueban que aparece lo que debe (sin abrir navegador).
   ============================================================ */
"use strict";

import * as std from "std";

let fallos = 0;
let pruebas = 0;

function ok(condicion, mensaje) {
  pruebas += 1;
  if (condicion) {
    console.log("  ✓ " + mensaje);
  } else {
    fallos += 1;
    console.log("  ✗ FALLO: " + mensaje);
  }
}

function contiene(html, texto, mensaje) {
  ok(html.indexOf(texto) !== -1, mensaje);
}

function noContiene(html, texto, mensaje) {
  ok(html.indexOf(texto) === -1, mensaje);
}

// Mínimo documento para que app.js arranque sin navegador:
// arranca diferido (DOMContentLoaded) y no toca el DOM todavía.
// Se simula también el diálogo (#modal) para probar abrir, escribir,
// guardar y cerrar sin un navegador real.
function elementoFalso() {
  const clases = new Set();
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    className: "",
    dataset: {},
    hijos: [],
    classList: {
      add: function (c) { clases.add(c); },
      remove: function (c) { clases.delete(c); },
      contains: function (c) { return clases.has(c); },
      toggle: function (c, forzar) {
        if (forzar === undefined) { if (clases.has(c)) clases.delete(c); else clases.add(c); }
        else if (forzar) clases.add(c); else clases.delete(c);
      },
    },
    addEventListener: function () {},
    appendChild: function (hijo) { this.hijos.push(hijo); },
    querySelector: function () { return null; },
    focus: function () {},
  };
}

const ELEMENTOS = {};
["modal", "modal-titulo", "modal-texto", "modal-botones", "toast", "vista", "archivo-copia"]
  .forEach((id) => { ELEMENTOS[id] = elementoFalso(); });
ELEMENTOS["modal"].hidden = true; // como en index.html: nace oculto

globalThis.document = {
  readyState: "loading",
  addEventListener: function () {},
  getElementById: function (id) { return ELEMENTOS[id] || null; },
  createElement: function () { return elementoFalso(); },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
};
globalThis.navigator = {};
globalThis.window = { scrollTo: function () {} };
// Timers: QuickJS no trae setTimeout y avisar() los usa.
globalThis.setTimeout = function () { return 0; };
globalThis.clearTimeout = function () {};

eval(std.loadFile("js/logica.js"));
// Ojo: eval comparte el ámbito, así que FT debe existir antes de cargar app.js.
const FT = globalThis.FT;
eval(std.loadFile("js/app.js"));

const UI = globalThis.FTUI;
const S = UI.S;

/* ---------------- datos de prueba ---------------- */

const maria = FT.crearAlumno({ id: "a1", nombre: "María", apellidos: "García López" });
const ana = FT.crearAlumno({ id: "a2", nombre: "Ana", apellidos: "Ruiz" });
const luis = FT.crearAlumno({ id: "a3", nombre: "Luis", apellidos: "Vega", archivado: true });

const pagoOk = FT.crearPago({
  id: "p1", alumnoId: "a1", fecha: "2026-10-03T10:15:00", mes: 10, anio: 2026,
  modalidad: "plana", importe: 50, observaciones: "Entrega en mano",
});
const pagoAna = FT.crearPago({
  id: "p2", alumnoId: "a2", fecha: "2026-10-05T18:00:00", mes: 10, anio: 2026,
  modalidad: "dosdias", importe: 49,
});

S.alumnos = [maria, ana, luis];
S.pagos = [pagoOk, pagoAna];

/* Almacén falso: guarda en memoria para probar «Guardar alumno»
   (y que el alumno sigue tras "recargar") sin navegador. */
const STORE = { alumnos: [], pagos: [], meta: {} };
function guardarEnStore(tabla, registro) {
  const i = STORE[tabla].findIndex((x) => x.id === registro.id);
  if (i >= 0) STORE[tabla][i] = registro;
  else STORE[tabla].push(registro);
}
globalThis.FTDB = {
  abrir: function () { return Promise.resolve(); },
  listarAlumnos: function () { return Promise.resolve(STORE.alumnos.slice()); },
  listarPagos: function () { return Promise.resolve(STORE.pagos.slice()); },
  leerMeta: function (clave) { return Promise.resolve(STORE.meta[clave] || null); },
  guardarMeta: function (clave, valor) { STORE.meta[clave] = valor; return Promise.resolve(); },
  guardarAlumno: function (a) { guardarEnStore("alumnos", a); return Promise.resolve(); },
  guardarPago: function (p) { guardarEnStore("pagos", p); return Promise.resolve(); },
  eliminarPago: function (id) { STORE.pagos = STORE.pagos.filter((p) => p.id !== id); return Promise.resolve(); },
  guardarTodo: function (alumnos, pagos) { STORE.alumnos = alumnos.slice(); STORE.pagos = pagos.slice(); return Promise.resolve(); },
};
STORE.alumnos = [maria, ana, luis];
STORE.pagos = [pagoOk, pagoAna];

/* ---------------- inicio ---------------- */

console.log("\n== Pantalla inicial ==");
const inicio = UI.htmlInicio();
contiene(inicio, "Registrar pago", "el botón «Registrar pago» está en la pantalla inicial");
contiene(inicio, "Buscar alumno", "está el buscador de alumnos");
contiene(inicio, "Resumen del mes", "está el resumen del mes");
contiene(inicio, "Nuevo alumno", "está el botón de nuevo alumno");
contiene(inicio, "María García López", "el alumno aparece en la lista de inicio");
noContiene(inicio, 'data-accion="alumno-pago" data-valor="a3"', "el alumno archivado no se ofrece para cobrar en la búsqueda vacía");

S.busqueda.inicio = "maria";
const buscado = UI.htmlResultadosBusqueda();
contiene(buscado, "María García López", "la búsqueda encuentra a María");
noContiene(buscado, "Ana Ruiz", "la búsqueda descarta a quien no coincide");

S.busqueda.inicio = "luis";
const archivado = UI.htmlResultadosBusqueda();
contiene(archivado, "Luis Vega", "al escribir también se encuentran los archivados");
contiene(archivado, "archivado", "…y aparecen etiquetados como archivados");

S.busqueda.inicio = "";
const vacio = UI.htmlResultadosBusqueda();
contiene(vacio, "María García López", "con la búsqueda vacía se listan los alumnos activos");
noContiene(vacio, "Luis Vega", "los archivados no ensucian la lista inicial");

/* ---------------- resumen mensual ---------------- */

console.log("\n== Resumen mensual ==");
S.resumen = { mes: 10, anio: 2026 };
const resumen = UI.htmlResumen();
contiene(resumen, "Cobrado en octubre de 2026", "cabecera del total cobrado");
contiene(resumen, "99,00 €", "total de octubre = 50 + 49 = 99 €");
contiene(resumen, "2 pago(s)", "número de pagos del mes");
contiene(resumen, "Desglose por modalidad", "hay desglose por modalidad");
contiene(resumen, "Tarifa plana", "…de tarifa plana");
contiene(resumen, "Dos días a la semana", "…de dos días a la semana");
contiene(resumen, "Abonado ✓", "los abonados según el periodo llevan insignia");
contiene(resumen, "fecha del cobro", "avisa de que el total va por fecha de cobro");
contiene(resumen, "mes y año abonados", "avisa de que la lista va por periodo pagado");
noContiene(resumen, "Luis Vega", "los alumnos archivados no aparecen en la lista de activos");

S.resumen = { mes: 11, anio: 2026 };
const resumenNov = UI.htmlResumenContenido();
contiene(resumenNov, "0,00 €", "noviembre no tiene cobros");
contiene(resumenNov, "Pendiente", "en noviembre los activos están pendientes de periodo");

S.resumen = { mes: 10, anio: 2026 };

/* ---------------- registrar pago ---------------- */

console.log("\n== Registrar pago ==");
S.pago = UI.nuevoBorradorPago();
igualDefault(S.pago.modalidad, "plana", "la modalidad por defecto es tarifa plana");
igualDefault(S.pago.importe, "50", "el importe se rellena con 50");
const picker = UI.htmlPago();
contiene(picker, "Selecciona al alumno", "sin alumno, pide elegir primero");
contiene(picker, "María García López", "ofrece a los alumnos");

S.pago.alumnoId = "a1";
const form = UI.htmlPago();
contiene(form, "Guardar pago", "hay botón «Guardar pago»");
contiene(form, "Tarifa plana", "ofrece la modalidad tarifa plana");
contiene(form, "50 € al mes", "…con su precio");
contiene(form, "Dos días a la semana", "ofrece la modalidad de dos días");
contiene(form, "49 € al mes", "…con su precio");
contiene(form, 'id="pago-importe"', "hay campo de importe");
contiene(form, 'value="50"', "el importe viene relleno a 50");
contiene(form, "Periodo que se está pagando", "está el selector de mes y año abonados");
contiene(form, `<option value="${new Date().getMonth() + 1}" selected>`, "el mes por defecto es el actual");
contiene(form, `<option value="${new Date().getFullYear()}" selected>`, "el año por defecto es el actual");
contiene(form, "Método de pago", "se muestra el método de pago");
contiene(form, "Metálico", "el método es metálico");
contiene(form, "Observaciones", "hay campo de observaciones");
contiene(form, "Se asigna al guardar (hora local)", "la fecha del cobro se pone al guardar");

// Aviso de duplicado
S.pago.mes = 10;
S.pago.anio = 2026;
S.pago.avisos = FT.pagosDuplicados(S.pagos, S.pago, null);
const duplicado = UI.htmlPago();
contiene(duplicado, "Ya hay 1 pago(s) de María García López", "avisa del pago duplicado");
contiene(duplicado, "Revisar pagos existentes", "permite revisar antes de registrar otro");
contiene(duplicado, "Guardar de todas formas", "permite continuar si está seguro");
S.pago.avisos = [];

// Errores de validación
S.pago.errores = ["Selecciona al alumno."];
const conErrores = UI.htmlPago();
contiene(conErrores, "Revisa esto", "muestra los errores de validación");
S.pago.errores = [];

// Edición
S.pago.editandoId = "p1";
S.pago.fechaOriginal = "2026-10-03T10:15:00";
const editando = UI.htmlPago();
contiene(editando, "Editar pago", "en edición el título cambia");
contiene(editando, "03/10/2026 10:15", "muestra la fecha original del cobro");
contiene(editando, "Guardar cambios", "el botón pasa a «Guardar cambios»");
noContiene(editando, 'data-accion="cambiar-alumno"', "al editar no se puede cambiar el alumno desde aquí");

// Confirmación tras guardar
S.pago.editandoId = null;
S.pago.guardado = pagoOk;
const guardado = UI.htmlPago();
contiene(guardado, "Pago guardado", "confirma que el pago se guardó");
contiene(guardado, "50,00 €", "muestra el importe");
contiene(guardado, "octubre de 2026", "muestra el periodo abonado");
contiene(guardado, "03/10/2026 10:15", "muestra la fecha del cobro");
contiene(guardado, "Registrar otro pago", "ofrece registrar otro pago");
S.pago = UI.nuevoBorradorPago();

/* ---------------- alumnos y diálogo ---------------- */

console.log("\n== Alumnos ==");
S.borradorAlumno = UI.nuevoBorradorAlumno();
const alumnosHtml = UI.htmlAlumnos();
contiene(alumnosHtml, 'data-accion="nuevo-alumno"', "la pantalla de alumnos ofrece «＋ Nuevo alumno»");
noContiene(alumnosHtml, 'id="alumno-nombre"', "el formulario vive en el diálogo, no dentro de la pantalla");
contiene(alumnosHtml, "Mostrar alumnos archivados", "casilla para ver archivados");
contiene(alumnosHtml, "María García López", "aparece en la lista");
noContiene(alumnosHtml, "Luis Vega", "el archivado no aparece sin marcar la casilla");

S.mostrarArchivados = true;
const conArchivados = UI.htmlAlumnos();
contiene(conArchivados, "Luis Vega", "con la casilla aparece el archivado");
contiene(conArchivados, "Reactivar", "el archivado se puede reactivar");
S.mostrarArchivados = false;

S.busqueda.alumnos = "zzz";
noContiene(UI.htmlListaAlumnos(), "María García López", "una búsqueda sin resultados no muestra alumnos");
S.busqueda.alumnos = "";

const listaVacia = (function () {
  const guardados = S.alumnos;
  S.alumnos = [];
  const html = UI.htmlListaAlumnos();
  S.alumnos = guardados;
  return html;
})();
contiene(listaVacia, "Todavía no hay alumnos", "sin alumnos se ofrece crear el primero");

console.log("\n== Diálogo de nuevo alumno ==");
const inicioVacio = (function () {
  const guardados = S.alumnos;
  S.alumnos = [];
  const html = UI.htmlInicio();
  S.alumnos = guardados;
  return html;
})();
ok((inicioVacio.match(/data-accion="nuevo-alumno"/g) || []).length === 2,
  "con la app vacía hay dos botones «Nuevo alumno» en el inicio");
contiene(UI.htmlInicio(), 'data-accion="nuevo-alumno"',
  "con alumnos en la lista, el inicio también ofrece crear uno");

ok(ELEMENTOS["modal"].hidden, "la capa oscura nace oculta");
await UI.manejarAccion("nuevo-alumno");
const capa = ELEMENTOS["modal"];
ok(!capa.hidden, "al pulsar «Nuevo alumno» se muestra la capa");
ok(capa.classList.contains("abierto"), "…con la clase que la hace visible");
igualDefault(ELEMENTOS["modal-titulo"].textContent, "Nuevo alumno", "el diálogo se titula «Nuevo alumno»");
const campos = ELEMENTOS["modal-texto"].innerHTML;
contiene(campos, 'id="alumno-nombre"', "el formulario pide el nombre");
contiene(campos, 'id="alumno-apellidos"', "el formulario pide los apellidos");
contiene(campos, "Tarifa plana", "ofrece la modalidad tarifa plana");
contiene(campos, "50 € al mes", "…con su precio de 50 €/mes");
contiene(campos, "Dos días a la semana", "ofrece la modalidad de dos días por semana");
contiene(campos, "49 € al mes", "…con su precio de 49 €/mes");
contiene(ELEMENTOS["modal-botones"].innerHTML, ">Guardar</button>", "hay botón «Guardar»");
contiene(ELEMENTOS["modal-botones"].innerHTML, ">Cancelar</button>", "hay botón «Cancelar»");

// Falta información: los errores se ven dentro y el diálogo sigue abierto
S.borradorAlumno = UI.nuevoBorradorAlumno();
await UI.manejarAccion("alumno-guardar");
contiene(ELEMENTOS["modal-texto"].innerHTML, "Escribe el nombre del alumno.",
  "los errores de validación se ven dentro del diálogo");
ok(!capa.hidden, "el diálogo sigue abierto si falta información");

// Se puede escribir y elegir modalidad
await UI.manejarAccion("alumno-modalidad", "dosdias");
S.borradorAlumno.nombre = "Paula";
S.borradorAlumno.apellidos = "Sanz Ortiz";
UI.pintarFormularioEnModal();
const rellenado = ELEMENTOS["modal-texto"].innerHTML;
contiene(rellenado, 'value="Paula"', "el nombre escrito se queda en el campo");
contiene(rellenado, 'value="Sanz Ortiz"', "los apellidos escritos se quedan en su campo");
contiene(rellenado, 'data-valor="dosdias" aria-pressed="true"', "la modalidad elegida aparece marcada");

// Guardar: escribe en el almacén, se puede «recargar» y el diálogo se cierra
await UI.manejarAccion("alumno-guardar");
const paula = STORE.alumnos.filter((a) => a.nombre === "Paula")[0];
ok(!!paula, "el alumno guardado queda en el almacén");
ok(paula && paula.modalidad === "dosdias", "se guarda la modalidad elegida");
ok(S.alumnos.some((a) => a.nombre === "Paula"), "alumno visible en la lista tras guardar");
ok(capa.hidden, "al guardar, el diálogo queda cerrado");
ok(!capa.classList.contains("abierto"), "…y la capa oscura desaparece");
S.alumnos = S.alumnos.filter((a) => a.nombre !== "Paula"); // no molesta a las pruebas siguientes

// Editar un alumno desde la lista
await UI.manejarAccion("alumno-editar", "a1");
igualDefault(ELEMENTOS["modal-titulo"].textContent, "Editar alumno", "el diálogo de edición se titula «Editar alumno»");
contiene(ELEMENTOS["modal-texto"].innerHTML, 'value="María"', "el nombre viene relleno");
contiene(ELEMENTOS["modal-botones"].innerHTML, "Guardar cambios", "el botón pasa a «Guardar cambios»");
ok(!capa.hidden, "el diálogo de edición está abierto");
await UI.manejarAccion("alumno-cancelar");
ok(capa.hidden, "«Cancelar» cierra el diálogo");
ok(!capa.classList.contains("abierto"), "…y la capa oscura desaparece");
S.alumnoEditando = null;
S.borradorAlumno = UI.nuevoBorradorAlumno();

// Tocar la parte oscura cierra el diálogo (mismo camino: cerrarModal)
await UI.manejarAccion("nuevo-alumno");
UI.cerrarModal(null);
ok(capa.hidden && !capa.classList.contains("abierto"),
  "tocar la capa oscura cierra el diálogo y desaparece la capa");

/* ---------------- historial ---------------- */

console.log("\n== Historial ==");
S.filtros = { texto: "", mes: "", anio: "", modalidad: "", criterio: "periodo" };
S.busqueda.historial = "";
const historial = UI.htmlHistorial();
contiene(historial, "Fecha del cobro", "muestra la fecha del cobro");
contiene(historial, "Mes y año abonados", "muestra el mes y año abonados");
contiene(historial, "Modalidad", "muestra la modalidad");
contiene(historial, "Método de pago", "muestra el método de pago");
contiene(historial, "Observaciones", "muestra las observaciones");
contiene(historial, "María García López", "muestra el nombre del alumno");
contiene(historial, "50,00 €", "muestra el importe en euros");
contiene(historial, "03/10/2026 10:15", "muestra la fecha en formato día/mes/año");
contiene(historial, "octubre de 2026", "muestra el periodo abonado");
contiene(historial, "Tarifa plana", "muestra la modalidad");
contiene(historial, "Entrega en mano", "muestra las observaciones");
contiene(historial, ">Editar<", "permite editar un pago");
contiene(historial, ">Eliminar<", "permite eliminar un pago");
contiene(historial, "Todos los meses", "filtro de meses con «todos»");
contiene(historial, "Todas las modalidades", "filtro de modalidades con «todas»");
contiene(historial, "Limpiar filtros", "hay botón para limpiar filtros");
contiene(historial, "2 pago(s)", "cuenta los pagos que se muestran");

S.busqueda.historial = "ana";
const historialAna = UI.htmlListaHistorial();
contiene(historialAna, "Ana Ruiz", "la búsqueda por alumno filtra");
noContiene(historialAna, "María García López", "…y oculta al resto");
S.busqueda.historial = "";

S.filtros.mes = 11;
const historialVacio = UI.htmlListaHistorial();
contiene(historialVacio, "No hay pagos que coincidan", "filtro sin resultados tiene su mensaje");
S.filtros.mes = "";

// Aviso de borrador a medias
S.pago.alumnoId = "a1";
S.pago.guardado = null;
const historialBorrador = UI.htmlHistorial();
contiene(historialBorrador, "Volver al formulario", "desde el historial se vuelve al registro a medias");
S.pago = UI.nuevoBorradorPago();

/* ---------------- copias ---------------- */

console.log("\n== Copias de seguridad ==");
const copias = UI.htmlCopias();
contiene(copias, "Exportar copia completa (JSON)", "botón de exportar JSON");
contiene(copias, "Importar copia (JSON)", "botón de importar JSON");
contiene(copias, "Exportar pagos (CSV para Excel)", "botón de exportar CSV");
contiene(copias, "IndexedDB", "explica dónde se guardan los datos");
contiene(copias, "no se borran al actualizar la app", "avisa de que actualizar no borra datos");
contiene(copias, "3 alumno(s)", "cuenta los alumnos");
contiene(copias, "2 pago(s)", "cuenta los pagos");
contiene(copias, "Versión de la app: " + UI.VERSION, "muestra la versión de la app");

/* ---------------- escapado de HTML ---------------- */

console.log("\n== Seguridad del texto ==");
const raro = FT.crearAlumno({ id: "ax", nombre: "<script>", apellidos: 'O\'&"Torre' });
S.alumnos = [raro];
const escapado = UI.htmlInicio();
contiene(escapado, "&lt;script&gt;", "el nombre con etiquetas se escapa");
noContiene(escapado, "<script>", "no se escapa una etiqueta viva en la lista");
S.alumnos = [maria, ana, luis];

/* ---------------- navegación entre vistas ---------------- */

console.log("\n== Selector de pantalla ==");
["inicio", "pago", "alumnos", "historial", "resumen", "copias"].forEach((v) => {
  S.vista = v;
  const html = UI.htmlVista();
  ok(html.length > 100, `la vista «${v}» se pinta sin fallos`);
});
S.vista = "inicio";

function igualDefault(a, b, mensaje) {
  ok(a === b, `${mensaje} (esperado «${b}», sale «${a}»)`);
}

console.log(`\n${pruebas - fallos}/${pruebas} pruebas correctas.`);
if (fallos > 0) {
  console.log("HAY FALLOS.");
  std.exit(1);
}
