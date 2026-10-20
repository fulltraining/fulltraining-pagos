/* ============================================================
   Fulltraining · Control de pagos — pruebas de lógica
   Se ejecutan con QuickJS:  qjs tests/logica.test.mjs
   Comprueban fechas, importes, duplicados, resumen, historial,
   CSV e importación/exportación sin navegador.
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

function igual(a, b, mensaje) {
  ok(a === b, `${mensaje} (esperado «${b}», sale «${a}»)`);
}

eval(std.loadFile("js/logica.js"));
const FT = globalThis.FT;

/* ---------------- fechas: hora local del móvil ---------------- */

console.log("\n== Fechas (hora local) ==");
const momento = new Date(2026, 9, 18, 21, 4, 7); // 18 de octubre de 2026, 21:04:07
igual(FT.fechaLocalAhora(momento), "2026-10-18T21:04:07", "fechaLocalAhora usa la hora local sin zona horaria");
igual(FT.fechaCorta("2026-10-18T21:04:07"), "18/10/2026", "fechaCorta → 18/10/2026");
igual(FT.fechaHoraCorta("2026-10-18T21:04:07"), "18/10/2026 21:04", "fechaHoraCorta incluye la hora");
igual(FT.mesDeFecha("2026-10-18T21:04:07"), 10, "mesDeFecha = 10");
igual(FT.anioDeFecha("2026-10-18T21:04:07"), 2026, "anioDeFecha = 2026");
igual(FT.nombreMes(10), "octubre", "nombreMes(10) = octubre");
igual(FT.etiquetaPeriodo(10, 2026), "octubre de 2026", "etiquetaPeriodo");
const turnoMedianoche = new Date(2026, 11, 31, 23, 59, 59);
igual(FT.fechaLocalAhora(turnoMedianoche), "2026-12-31T23:59:59", "último día del año");

/* ---------------- importes en euros ---------------- */

console.log("\n== Importes en euros ==");
igual(FT.euros(50), "50,00 €", "50 → 50,00 €");
igual(FT.euros(40), "40,00 €", "40 → 40,00 €");
igual(FT.euros(1234.5), "1.234,50 €", "miles con punto y decimales con coma");
igual(FT.euros(0), "0,00 €", "0 → 0,00 €");
igual(FT.euros("30"), "30,00 €", "acepta texto numérico");

/* ---------------- alumnos ---------------- */

console.log("\n== Alumnos ==");
igual(FT.validarAlumno({ nombre: "", apellidos: "" }).length, 2, "alumno vacío tiene 2 errores");
igual(FT.validarAlumno({ nombre: "María", apellidos: "García" }).length, 0, "alumno completo no tiene errores");
const maria = FT.crearAlumno({ nombre: "  María ", apellidos: "García  López" });
igual(maria.nombre, "María", "quita espacios sobrantes");
igual(maria.archivado, false, "nace activo");
igual(FT.nombreCompleto(maria), "María García López", "nombre completo");

const alumnos = [
  FT.crearAlumno({ nombre: "Ana", apellidos: "Ruiz" }),
  FT.crearAlumno({ nombre: "María", apellidos: "García" }),
  FT.crearAlumno({ nombre: "Álvaro", apellidos: "Sanz", archivado: true }),
];
const sinAcentos = FT.buscarAlumnos(alumnos, "maria");
igual(sinAcentos.length, 1, "busca sin tener en cuenta las tildes");
igual(FT.nombreCompleto(sinAcentos[0]), "María García", "encuentra a María");
igual(FT.buscarAlumnos(alumnos, "").length, 2, "por defecto no muestra archivados");
igual(FT.buscarAlumnos(alumnos, "", { incluirArchivados: true }).length, 3, "con la opción se muestran archivados");
igual(FT.buscarAlumnos(alumnos, "sanz", { incluirArchivados: true }).length, 1, "búsqueda por apellidos");
const orden = FT.buscarAlumnos(alumnos, "", { incluirArchivados: true }).map(FT.nombreCompleto).join(", ");
igual(orden, "Álvaro Sanz, Ana Ruiz, María García", "orden alfabético");

// Modalidad del alumno (se guarda en el alumno y se usa al cobrar)
igual(maria.modalidad, "plana", "un alumno nuevo nace con tarifa plana");
igual(FT.crearAlumno({ nombre: "Luis", apellidos: "Vega", modalidad: "dosdias" }).modalidad, "dosdias", "se guarda la modalidad elegida");
igual(FT.crearAlumno({ nombre: "Eva", apellidos: "López", modalidad: "inventada" }).modalidad, "plana", "una modalidad desconocida cae en tarifa plana");
igual(FT.modalidadDeAlumno({ nombre: "Antiguo", apellidos: "Sin Modalidad" }), "plana", "los alumnos guardados antes de la modalidad siguen valiendo");
igual(FT.modalidadDeAlumno({ modalidad: "dosdias" }), "dosdias", "modalidadDeAlumno lee la modalidad del alumno");
igual(FT.modalidadDeAlumno(null), "plana", "modalidadDeAlumno aguanta alumnos inexistentes");

/* ---------------- modalidades y formas de pago ---------------- */

console.log("\n== Modalidades y formas de pago ==");
igual(FT.MODALIDADES_ORDEN.join(","), "plana,dosdias,mediomes", "hay exactamente tres modalidades");
igual(FT.importeDeModalidad("plana"), 50, "tarifa plana = 50 €");
igual(FT.importeDeModalidad("dosdias"), 40, "dos días a la semana = 40 €");
igual(FT.importeDeModalidad("mediomes"), 30, "medio mes, dos días = 30 €");
igual(FT.detalleDeModalidad("mediodias"), "", "una modalidad que no existe no tiene detalle");
ok(FT.detalleDeModalidad("plana").indexOf("50") !== -1, "el detalle de la tarifa plana lleva su precio");
ok(FT.detalleDeModalidad("dosdias").indexOf("40") !== -1, "el detalle de dos días lleva 40 €");
ok(FT.detalleDeModalidad("mediomes").indexOf("30") !== -1, "el detalle de medio mes lleva 30 €");
igual(FT.nombreDeModalidad("mediomes"), "Medio mes, dos días a la semana", "nombre de la modalidad de medio mes");
ok(FT.MODALIDADES_ORDEN.every((k) => String(FT.importeDeModalidad(k)) !== "49"), "ninguna modalidad cuesta 49 €");

igual(FT.FORMAS_PAGO_ORDEN.join(","), "transferencia,metalico", "hay dos formas de pago");
igual(FT.nombreDeForma("transferencia"), "Transferencia", "nombre de la forma transferencia");
igual(FT.nombreDeForma("metalico"), "Metálico", "nombre de la forma metálico");
igual(FT.nombreDeForma("bizum"), "Metálico", "una forma desconocida no rompe el nombre");
igual(FT.formaDePago({ forma: "transferencia" }), "transferencia", "lee la forma guardada");
igual(FT.formaDePago({}), "metalico", "un pago antiguo sin forma se lee como metálico");
igual(FT.formaDePago(null), "metalico", "formaDePago aguanta pagos inexistentes");

/* ---------------- validación y duplicados de pagos ---------------- */

console.log("\n== Registro de pago ==");
igual(FT.validarPago({ mes: 10, anio: 2026, modalidad: "plana", forma: "metalico", importe: 50 }).length, 1, "falta el alumno");
igual(FT.validarPago({ alumnoId: "x", mes: 13, anio: 2026, modalidad: "plana", forma: "metalico", importe: 50 }).length, 1, "mes inválido");
igual(FT.validarPago({ alumnoId: "x", mes: 10, anio: 2026, modalidad: "plana", forma: "metalico", importe: 0 }).length, 1, "importe 0");
igual(FT.validarPago({ alumnoId: "x", mes: 10, anio: 2026, modalidad: "plana", importe: 50 }).length, 1, "falta la forma de pago");
igual(FT.validarPago({ alumnoId: "x", mes: 10, anio: 2026, modalidad: "plana", forma: "", importe: 50 }).length, 1, "forma de pago vacía");
igual(FT.validarPago({ alumnoId: "x", mes: 10, anio: 2026, modalidad: "inventada", forma: "metalico", importe: 50 }).length, 1, "modalidad inválida");
igual(FT.validarPago({ alumnoId: "x", mes: 10, anio: 2026, modalidad: "dosdias", forma: "transferencia", importe: 40 }).length, 0, "pago válido");

const pago1 = FT.crearPago({
  alumnoId: maria.id, fecha: "2026-10-03T10:15:00", mes: 10, anio: 2026,
  modalidad: "plana", forma: "transferencia", importe: 50, observaciones: " Entrega en mano ",
});
igual(pago1.forma, "transferencia", "se guarda la forma de pago elegida");
igual(pago1.observaciones, "Entrega en mano", "recorta observaciones");
igual(FT.crearPago({ alumnoId: "x", modalidad: "plana", forma: "" }).forma, "metalico",
  "una forma vacía cae en metálico (no rompe los datos)");
const pago2 = FT.crearPago({ alumnoId: "otro", fecha: "2026-10-05T10:00:00", mes: 10, anio: 2026, modalidad: "dosdias", forma: "metalico", importe: 40 });
const pago3 = FT.crearPago({ alumnoId: maria.id, fecha: "2026-11-02T10:00:00", mes: 11, anio: 2026, modalidad: "plana", forma: "transferencia", importe: 50 });
const pagos = [pago1, pago2, pago3];

igual(FT.pagosDuplicados(pagos, { alumnoId: maria.id, mes: 10, anio: 2026 }).length, 1, "detecta duplicado del mismo periodo");
igual(FT.pagosDuplicados(pagos, { alumnoId: maria.id, mes: 12, anio: 2026 }).length, 0, "otro mes no es duplicado");
igual(FT.pagosDuplicados(pagos, { alumnoId: "otro", mes: 10, anio: 2026 }).length, 1, "el duplicado es por alumno");
igual(FT.pagosDuplicados(pagos, { alumnoId: maria.id, mes: 10, anio: 2026 }, pago1.id).length, 0, "al editar se excluye el propio pago");

/* ---------------- resumen mensual ---------------- */

console.log("\n== Resumen mensual ==");
const activos = [
  FT.crearAlumno({ id: "a1", nombre: "María", apellidos: "García" }),
  FT.crearAlumno({ id: "a2", nombre: "Ana", apellidos: "Ruiz" }),
  FT.crearAlumno({ id: "a3", nombre: "Luis", apellidos: "Vega", archivado: true }),
];
// María paga octubre el 3/10 y noviembre por adelantado el 6/10.
// Ana paga octubre el 5/10. Luis (archivado) paga octubre el 10/10.
const cobros = [
  FT.crearPago({ id: "p1", alumnoId: "a1", fecha: "2026-10-03T10:00:00", mes: 10, anio: 2026, modalidad: "plana", forma: "transferencia", importe: 50 }),
  FT.crearPago({ id: "p2", alumnoId: "a2", fecha: "2026-10-05T18:30:00", mes: 10, anio: 2026, modalidad: "dosdias", forma: "metalico", importe: 40 }),
  FT.crearPago({ id: "p3", alumnoId: "a1", fecha: "2026-10-06T09:00:00", mes: 11, anio: 2026, modalidad: "plana", forma: "transferencia", importe: 50 }),
  FT.crearPago({ id: "p4", alumnoId: "a3", fecha: "2026-10-10T12:00:00", mes: 10, anio: 2026, modalidad: "plana", forma: "metalico", importe: 50 }),
  FT.crearPago({ id: "p5", alumnoId: "a2", fecha: "2026-09-02T12:00:00", mes: 9, anio: 2026, modalidad: "dosdias", forma: "metalico", importe: 40 }),
];

const rOctubre = FT.resumenMensual(cobros, activos, 10, 2026);
igual(rOctubre.nPagos, 4, "octubre: 4 cobros con fecha en el mes");
igual(rOctubre.total, 190, "total cobrado en octubre = 50+40+50+50 = 190 €");
igual(rOctubre.totalTransferencia, 100, "octubre: 100 € por transferencia (50 + 50)");
igual(rOctubre.totalMetalico, 90, "octubre: 90 € en metálico (40 + 50)");
igual(rOctubre.totalTransferencia + rOctubre.totalMetalico, rOctubre.total,
  "transferencia + metálico = total cobrado");
igual(rOctubre.porForma.transferencia.cantidad, 2, "octubre: 2 pagos por transferencia");
igual(rOctubre.porForma.metalico.cantidad, 2, "octubre: 2 pagos en metálico");
igual(rOctubre.porModalidad.plana.cantidad, 3, "octubre: 3 de tarifa plana");
igual(rOctubre.porModalidad.plana.total, 150, "octubre: 150 € en tarifa plana");
igual(rOctubre.porModalidad.dosdias.cantidad, 1, "octubre: 1 de dos días");
igual(rOctubre.porModalidad.dosdias.total, 40, "octubre: 40 € en dos días");
igual(rOctubre.filas.length, 2, "la lista solo incluye alumnos activos");
igual(rOctubre.abonados, 2, "los dos activos han abonado octubre según el periodo");
igual(rOctubre.pendientes, 0, "nadie pendiente en octubre");

const rNoviembre = FT.resumenMensual(cobros, activos, 11, 2026);
igual(rNoviembre.total, 0, "aunque María pagó el 6/10, en noviembre no se cobró nada");
igual(rNoviembre.nPagos, 0, "noviembre: 0 cobros por fecha");
igual(rNoviembre.abonados, 1, "noviembre: María abonó (periodo), aunque pagó en octubre");
igual(rNoviembre.pendientes, 1, "noviembre: Ana pendiente (periodo)");

const rSeptiembre = FT.resumenMensual(cobros, activos, 9, 2026);
igual(rSeptiembre.total, 40, "septiembre: 40 € cobrados");
igual(rSeptiembre.totalTransferencia, 0, "septiembre: nada por transferencia");
igual(rSeptiembre.totalMetalico, 40, "septiembre: los 40 € fueron en metálico");
igual(rSeptiembre.abonados, 1, "septiembre: Ana abonó el periodo");
igual(rSeptiembre.pendientes, 1, "septiembre: María pendiente (periodo)");

/* Verificación pedida: 50 € por transferencia + 40 € y 30 € en metálico
   → total 120 €, transferencia 50 €, metálico 70 €. */
console.log("\n== Verificación de totales (50 transferencia + 40 y 30 metálico) ==");
const verificación = [
  FT.crearPago({ id: "v1", alumnoId: "a1", fecha: "2026-10-07T10:00:00", mes: 10, anio: 2026, modalidad: "plana", forma: "transferencia", importe: 50 }),
  FT.crearPago({ id: "v2", alumnoId: "a2", fecha: "2026-10-08T11:00:00", mes: 10, anio: 2026, modalidad: "dosdias", forma: "metalico", importe: 40 }),
  FT.crearPago({ id: "v3", alumnoId: "a3", fecha: "2026-10-09T12:00:00", mes: 10, anio: 2026, modalidad: "mediomes", forma: "metalico", importe: 30 }),
];
const rVerificación = FT.resumenMensual(verificación, activos, 10, 2026);
igual(rVerificación.total, 120, "total = 120 €");
igual(rVerificación.totalTransferencia, 50, "por transferencia = 50 €");
igual(rVerificación.totalMetalico, 70, "en metálico = 70 €");

/* ---------------- historial: buscar y filtrar ---------------- */

console.log("\n== Historial y filtros ==");
const todos = [pago1, pago2, pago3];
igual(FT.filtrarPagos(todos, alumnos, {}).length, 3, "sin filtros sale todo");

const rTexto = FT.filtrarPagos(todos, [maria], { texto: "maria" });
igual(rTexto.length, 2, "buscar por nombre de alumno (sin tildes) encuentra sus dos pagos");

const rPeriodo = FT.filtrarPagos(todos, [maria], { mes: 11, criterio: "periodo" });
igual(rPeriodo.length, 1, "filtro por mes abonado");
igual(rPeriodo[0].id, pago3.id, "…y es el de noviembre");

const rCobro = FT.filtrarPagos(todos, [maria], { mes: 10, criterio: "cobro", alumnoId: maria.id });
igual(rCobro.length, 1, "filtro por fecha de cobro");
igual(rCobro[0].id, pago1.id, "…y es el cobrado el 3/10 (periodo octubre)");

// La diferencia clave: el pago p3 (periodo noviembre) se cobró el 6 de octubre.
const cobroOct = FT.filtrarPagos(cobros, activos, { mes: 10, criterio: "cobro" });
const periodoOct = FT.filtrarPagos(cobros, activos, { mes: 10, criterio: "periodo" });
igual(cobroOct.length, 4, "por fecha de cobro: entran los 4 pagos hechos en octubre");
igual(periodoOct.length, 3, "por periodo abonado: solo los 3 que abonan octubre");

igual(FT.filtrarPagos(todos, alumnos, { anio: 2026 }).length, 3, "filtro por año");
igual(FT.filtrarPagos(todos, alumnos, { modalidad: "dosdias" }).length, 1, "filtro por modalidad");
igual(FT.filtrarPagos(todos, alumnos, { forma: "transferencia" }).length, 2, "filtro por forma de pago");
igual(FT.filtrarPagos(todos, alumnos, { forma: "metalico" }).length, 1, "filtro por metálico");
igual(FT.filtrarPagos(cobros, alumnos, { forma: "transferencia" }).length, 2, "el filtro de forma no cuenta los antiguos sin forma aparte");
const ordenHistorial = FT.filtrarPagos(todos, alumnos, {});
igual(ordenHistorial[0].fecha, "2026-11-02T10:00:00", "el más reciente primero");
igual(ordenHistorial[2].fecha, "2026-10-03T10:15:00", "el más antiguo al final");

const anios = FT.aniosDisponibles(todos, 2026);
ok(anios.indexOf(2026) !== -1 && anios.indexOf(2021) !== -1, "los años incluyen el actual y los cercanos");
igual(anios[0] >= anios[anios.length - 1], true, "los años van de mayor a menor");

/* ---------------- CSV para Excel ---------------- */

console.log("\n== CSV ==");
const csv = FT.csvPagos([
  FT.crearPago({
    id: "c1", alumnoId: maria.id, fecha: "2026-10-03T10:15:00", mes: 10, anio: 2026,
    modalidad: "plana", forma: "transferencia", importe: 50, observaciones: 'Pago "especial"; con coma',
  }),
], [maria]);
ok(csv.charCodeAt(0) === 0xfeff, "empieza con BOM para Excel");
const lineas = csv.replace(/^\ufeff/, "").trim().split("\r\n");
igual(lineas.length, 2, "una cabecera y un pago");
const cabecera = lineas[0].split(";");
igual(cabecera.length, 10, "10 columnas");
igual(cabecera[0], '"Alumno"', "primera columna Alumno");
igual(cabecera[7], '"Importe (€)"', "columna de importe");
igual(cabecera[8], '"Forma de pago"', "columna de forma de pago");
const fila = lineas[1];
ok(fila.indexOf('"María"') !== -1, "aparece el nombre con tilde");
ok(fila.indexOf('"octubre"') !== -1, "aparece el mes abonado");
ok(fila.indexOf('"50"') !== -1, "el importe es un número sin decimales de más");
ok(fila.indexOf('"Pago ""especial""; con coma"') !== -1, "escapa comillas y punto y coma");
ok(fila.indexOf('"Transferencia"') !== -1, "la forma de pago está en el CSV");
ok(csv.indexOf('"49"') === -1 && csv.indexOf("49 €") === -1, "el CSV no menciona la tarifa antigua de 49 €");
ok(FT.csvPagos([FT.crearPago({ alumnoId: maria.id, mes: 10, anio: 2026, modalidad: "plana", importe: 50 })], [maria])
  .indexOf('"Metálico"') !== -1, "un pago antiguo sin forma sale como metálico en el CSV");

/* ---------------- Copia JSON: exportar e importar ---------------- */

console.log("\n== Copia JSON ==");
const copia = FT.exportarDatos([maria], [pago1]);
igual(copia.app, "fulltraining-pagos", "la copia se marca con el nombre de la app");
igual(copia.alumnos.length, 1, "incluye al alumno");
igual(copia.pagos.length, 1, "incluye el pago");
const vuelta = FT.leerImportacion(JSON.stringify(copia));
ok(vuelta.ok, "la copia se puede leer de vuelta");
igual(vuelta.alumnos.length, 1, "alumnos al volver");
igual(vuelta.pagos.length, 1, "pagos al volver");
igual(vuelta.pagos[0].fecha, "2026-10-03T10:15:00", "la fecha del cobro se conserva igual");
igual(vuelta.pagos[0].forma, "transferencia", "la forma de pago se conserva");
igual(vuelta.alumnos[0].modalidad, "plana", "la modalidad del alumno se conserva en la copia");
const vueltaMediodias = FT.leerImportacion(JSON.stringify(
  FT.exportarDatos([FT.crearAlumno({ nombre: "Luis", apellidos: "Vega", modalidad: "mediomes" })], [])
));
igual(vueltaMediodias.alumnos[0].modalidad, "mediomes", "la modalidad de medio mes viaja en el JSON");

ok(!FT.leerImportacion("esto no es json").ok, "JSON inválido se rechaza");
ok(!FT.leerImportacion('{"hola":1}').ok, "estructura desconocida se rechaza");
const sucio = FT.leerImportacion(JSON.stringify({
  alumnos: [null, { nombre: "Ana", apellidos: "Ruiz" }, { nombre: "" }],
  pagos: [{ alumnoId: "no-se", mes: 10, anio: 2026 }, { alumnoId: "x", mes: 99, anio: 2026 }, null],
}));
ok(sucio.ok, "una copia con registros rotos se lee igualmente");
igual(sucio.alumnos.length, 1, "los alumnos inválidos se descartan");
igual(sucio.pagos.length, 1, "los pagos con periodo inválido se descartan");
igual(sucio.descartadosPagos, 2, "se cuenta lo descartado");
igual(sucio.pagos[0].forma, "metalico", "un pago importado sin forma se normaliza a metálico");
igual(sucio.pagos[0].modalidad, "plana", "un pago importado con modalidad fuera de catálogo cae en tarifa plana");
const importadoRaro = FT.leerImportacion(JSON.stringify({
  alumnos: [], pagos: [{ alumnoId: "x", mes: 10, anio: 2026, modalidad: "dosdias", forma: "bizum", importe: 40 }],
}));
ok(importadoRaro.ok && importadoRaro.pagos[0].forma === "metalico", "una forma desconocida al importar cae en metálico");

const combinado = FT.combinarDatos(
  { alumnos: [FT.crearAlumno({ id: "u1", nombre: "Local", apellidos: "Uno" })], pagos: [] },
  { alumnos: [FT.crearAlumno({ id: "u1", nombre: "Importado", apellidos: "Uno" }), FT.crearAlumno({ id: "u2", nombre: "Nuevo", apellidos: "Dos" })], pagos: [] }
);
igual(combinado.alumnos.length, 2, "la fusión une sin duplicar por id");
const uno = combinado.alumnos.filter((a) => a.id === "u1")[0];
igual(uno.nombre, "Importado", "en la fusión manda lo importado");

igual(FT.euros(FT.MODALIDADES.plana.importe), "50,00 €", "tarifa plana = 50 €");
igual(FT.euros(FT.MODALIDADES.dosdias.importe), "40,00 €", "dos días a la semana = 40 €");
igual(FT.euros(FT.MODALIDADES.mediomes.importe), "30,00 €", "medio mes, dos días = 30 €");
igual(FT.nombreDeModalidad("dosdias"), "Dos días a la semana", "nombre de la modalidad");
igual(FT.esc('<b>María</b> & "Ana"'), "&lt;b&gt;María&lt;/b&gt; &amp; &quot;Ana&quot;", "esc() protege el HTML");

console.log(`\n${pruebas - fallos}/${pruebas} pruebas correctas.`);
if (fallos > 0) {
  console.log("HAY FALLOS.");
  std.exit(1);
}
