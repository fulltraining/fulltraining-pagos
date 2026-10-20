/* ============================================================
   Fulltraining · Control de pagos — pruebas de almacenamiento
   Se ejecutan con QuickJS:  qjs tests/db.test.mjs

   Simulan el flujo completo sobre un IndexedDB falso:
   crear alumno → registrar pago → consultarlo → cerrar y
   reabrir → exportar → importar (fusionar y reemplazar) →
   eliminar. Los datos viven en el "dispositivo" simulado,
   igual que en el móvil.
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

/* ---------------- IndexedDB falso ---------------- */

function crearIndexedDBFake() {
  const tablas = { alumnos: new Map(), pagos: new Map(), meta: new Map() };
  const keyPaths = {};
  const creadas = new Set();
  let version = 0;

  function micro(funcion) { Promise.resolve().then(funcion); }
  function copia(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  function programarPeticion(peticion) {
    if (peticion._tx) peticion._tx._pendientes.push(peticion);
  }

  function nuevaPeticion(tx) {
    return { result: undefined, error: null, onsuccess: null, onerror: null, _tx: tx };
  }

  class ObjetoStore {
    constructor(nombre, tx) {
      this.nombre = nombre;
      this._tx = tx;
    }
    _tabla() { return tablas[this.nombre]; }
    _clave(obj) {
      const kp = keyPaths[this.nombre];
      if (kp && obj[kp] !== undefined) return obj[kp];
      return obj.id;
    }
    put(obj) {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      const clave = this._clave(obj);
      this._tabla().set(clave, copia(obj));
      req.result = clave;
      programarPeticion(req);
      return req;
    }
    get(clave) {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      req.result = copia(this._tabla().get(clave));
      programarPeticion(req);
      return req;
    }
    getAll() {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      req.result = Array.from(this._tabla().values()).map(copia);
      programarPeticion(req);
      return req;
    }
    delete(clave) {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      this._tabla().delete(clave);
      req.result = undefined;
      programarPeticion(req);
      return req;
    }
    clear() {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      this._tabla().clear();
      req.result = undefined;
      programarPeticion(req);
      return req;
    }
  }

  class Transaccion {
    constructor(tiendas, modo) {
      this.tiendas = tiendas;
      this.modo = modo;
      this.error = null;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      this._pendientes = [];
      // Como en el navegador: primero las peticiones, luego oncomplete.
      Promise.resolve()
        .then(() => {
          const pendientes = this._pendientes;
          this._pendientes = [];
          pendientes.forEach((req) => {
            if (req.onsuccess) req.onsuccess({ target: req });
          });
        })
        .then(() => {
          if (this.oncomplete) this.oncomplete({ target: this });
        });
    }
    objectStore(nombre) {
      if (!creadas.has(nombre)) {
        throw new Error("NotFoundError: no existe la tienda " + nombre);
      }
      return new ObjetoStore(nombre, this);
    }
    abort() { /* las pruebas no lo usan */ }
  }

  class BaseFake {
    constructor() {
      this.objectStoreNames = { contains: (n) => creadas.has(n) };
      this.onversionchange = null;
    }
    createObjectStore(nombre, opciones) {
      creadas.add(nombre);
      if (!tablas[nombre]) tablas[nombre] = new Map();
      if (opciones && opciones.keyPath) keyPaths[nombre] = opciones.keyPath;
      return new ObjetoStore(nombre, null);
    }
    transaction(tiendas, modo) {
      return new Transaccion(tiendas, modo);
    }
    close() { /* nada */ }
  }

  return {
    open(nombre, versionPedida) {
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      micro(() => {
        const db = new BaseFake();
        req.result = db;
        const nueva = versionPedida || 1;
        if (nueva > version) {
          version = nueva;
          if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        }
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
    _estado: { tablas: tablas, creadas: creadas, version: () => version },
  };
}

const fake = crearIndexedDBFake();
globalThis.indexedDB = fake;

eval(std.loadFile("js/logica.js"));
eval(std.loadFile("js/db.js"));
const FT = globalThis.FT;
const FTDB = globalThis.FTDB;

/* ---------------- datos antiguos (versiones anteriores a 1.2.0) ---------------- */

// Se meten a mano en el "dispositivo" para simular una instalación antigua:
// alumnos y pagos con la tarifa de 49 € y sin forma de pago.
function sembrarDatosAntiguos() {
  fake._estado.tablas.alumnos.set("viejo-1", {
    id: "viejo-1", nombre: "Cliente", apellidos: "Antiguo", modalidad: "dosdias",
    archivado: false, creado: "2025-01-01T10:00:00",
  });
  fake._estado.tablas.pagos.set("viejo-p1", {
    id: "viejo-p1", alumnoId: "viejo-1", fecha: "2025-02-01T10:00:00", mes: 2, anio: 2025,
    modalidad: "dosdias", importe: 49, metodo: "Metálico", observaciones: "",
  });
}

function pruebasBorradoUnico() {
  sembrarDatosAntiguos();
  return FTDB.listarAlumnos()
    .then((lista) => {
      igual(lista.length, 1, "el dispositivo simulado arranca con un alumno antiguo de 49 €");
      return FTDB.limpiarDatosAntiguos();
    })
    .then(() => Promise.all([FTDB.listarAlumnos(), FTDB.listarPagos(), FTDB.leerMeta("borradoDatosHasta")]))
    .then((r) => {
      igual(r[0].length, 0, "el borrado único elimina los alumnos antiguos");
      igual(r[1].length, 0, "el borrado único elimina los pagos antiguos (incluidos los de 49 €)");
      igual(r[2], FTDB.MARCA_BORRADO, "queda guardada la marca de versión del borrado");
      // Datos nuevos creados después del borrado.
      return FTDB.guardarAlumno(FT.crearAlumno({ id: "nuevo-1", nombre: "Nuevo", apellidos: "Alumno" }))
        .then(() => FTDB.guardarPago(FT.crearPago({
          id: "nuevo-p1", alumnoId: "nuevo-1", fecha: "2026-10-20T09:00:00",
          mes: 10, anio: 2026, modalidad: "plana", forma: "transferencia", importe: 50,
        })));
    })
    .then(() => FTDB.cerrar())
    // Se vuelve a abrir la app: la marca debe impedir otro borrado.
    .then(() => FTDB.limpiarDatosAntiguos())
    .then(() => Promise.all([FTDB.listarAlumnos(), FTDB.listarPagos()]))
    .then((r) => {
      igual(r[0].length, 1, "al reabrir la app no se vuelve a borrar: el alumno nuevo sigue ahí");
      igual(r[1].length, 1, "…y el pago nuevo también");
      // Una segunda llamada seguida tampoco borra nada (recargas, navegación…).
      return FTDB.limpiarDatosAntiguos();
    })
    .then(() => FTDB.listarPagos())
    .then((lista) => {
      igual(lista.length, 1, "ni al recargar ni al actualizar se repite el borrado");
    });
}

/* ---------------- flujo completo ---------------- */

function principal() {
  let alumnos;
  let pagos;
  let maria;
  let ana;
  let pagoMaria;

  return pruebasBorradoUnico()
    // El dispositivo queda limpio para el flujo normal.
    .then(() => FTDB.guardarTodo([], []))
    .then(() => FTDB.abrir())
    .then(() => {
      ok(true, "la base de datos se abre y crea sus tablas");
      ok(fake._estado.creadas.has("alumnos") && fake._estado.creadas.has("pagos") && fake._estado.creadas.has("meta"),
        "existen las tablas alumnos, pagos y meta");
      return FTDB.listarAlumnos();
    })
    .then((lista) => {
      ok(Array.isArray(lista) && lista.length === 0, "empieza vacía: no hay datos ficticios");
      return FTDB.listarPagos();
    })
    .then((lista) => {
      igual(lista.length, 0, "empieza sin pagos");

      // 1) crear alumno
      maria = FT.crearAlumno({ nombre: "María", apellidos: "García López" });
      return FTDB.guardarAlumno(maria);
    })
    .then(() => {
      ana = FT.crearAlumno({ nombre: "Ana", apellidos: "Ruiz" });
      return FTDB.guardarAlumno(ana);
    })
    .then(() => FTDB.listarAlumnos())
    .then((lista) => {
      alumnos = lista;
      igual(alumnos.length, 2, "hay dos alumnos guardados");
      ok(alumnos.some((a) => FT.nombreCompleto(a) === "María García López"), "María está guardada");

      // 2) registrar un pago con fecha local
      pagoMaria = FT.crearPago({
        alumnoId: maria.id,
        fecha: "2026-10-03T10:15:00",
        mes: 10,
        anio: 2026,
        modalidad: "plana",
        forma: "transferencia",
        importe: FT.importeDeModalidad("plana"),
        observaciones: "Pago de octubre",
      });
      return FTDB.guardarPago(pagoMaria);
    })
    .then(() => {
      const pagoAna = FT.crearPago({
        alumnoId: ana.id,
        fecha: "2026-10-05T18:00:00",
        mes: 10,
        anio: 2026,
        modalidad: "dosdias",
        forma: "metalico",
        importe: FT.importeDeModalidad("dosdias"),
      });
      return FTDB.guardarPago(pagoAna);
    })
    .then(() => FTDB.listarPagos())
    .then((lista) => {
      pagos = lista;
      igual(pagos.length, 2, "los dos pagos quedan guardados");
      ok(pagos.some((p) => p.forma === "transferencia") && pagos.some((p) => p.forma === "metalico"),
        "se guarda la forma de pago de cada cobro");
      const r = FT.resumenMensual(pagos, alumnos, 10, 2026);
      igual(r.total, 90, "resumen de octubre: 50 + 40 = 90 €");
      igual(r.totalTransferencia, 50, "50 € por transferencia");
      igual(r.totalMetalico, 40, "40 € en metálico");
      igual(r.abonados, 2, "los dos alumnos activos han abonado octubre (periodo)");

      // 3) consultar el historial
      const historial = FT.filtrarPagos(pagos, alumnos, { texto: "maria" });
      igual(historial.length, 1, "el historial encuentra el pago de María por su nombre");

      // 4) cerrar y reabrir el dispositivo
      return FTDB.cerrar();
    })
    .then(() => FTDB.listarPagos())
    .then((lista) => {
      ok(lista.length === 2, "tras cerrar y reabrir, los pagos siguen ahí");
      return FTDB.listarAlumnos();
    })
    .then((lista) => {
      ok(lista.length === 2, "tras cerrar y reabrir, los alumnos siguen ahí");

      // 5) exportar copia JSON
      const copiaTexto = JSON.stringify(FT.exportarDatos(lista, pagos));
      ok(copiaTexto.indexOf('"app":"fulltraining-pagos"') !== -1, "la copia JSON se exporta con su cabecera");
      const lectura = FT.leerImportacion(copiaTexto);
      ok(lectura.ok, "la copia se puede volver a leer");

      // 6) importar fusionando sobre datos existentes
      const combinado = FT.combinarDatos({ alumnos: lista, pagos: pagos }, lectura);
      igual(combinado.alumnos.length, 2, "fusionar no duplica alumnos");
      igual(combinado.pagos.length, 2, "fusionar no duplica pagos");
      return FTDB.guardarTodo(combinado.alumnos, combinado.pagos)
        .then(() => FTDB.guardarMeta("ultimaImportacion", "2026-10-19T09:00:00"))
        .then(() => FTDB.leerMeta("ultimaImportacion"))
        .then((valor) => {
          igual(valor, "2026-10-19T09:00:00", "se guarda el marcador de última copia importada");

          // 7) importar reemplazando todo (solo lo de la copia)
          return FTDB.guardarTodo(lectura.alumnos, lectura.pagos);
        })
        .then(() => FTDB.listarPagos())
        .then((lista2) => {
          igual(lista2.length, 2, "reemplazar deja exactamente los pagos de la copia");

          // 8) eliminar un pago
          return FTDB.eliminarPago(pagoMaria.id);
        })
        .then(() => FTDB.listarPagos())
        .then((lista3) => {
          igual(lista3.length, 1, "el pago se elimina");
          ok(lista3.every((p) => p.id !== pagoMaria.id), "…y es el de María");

          // 9) archivar alumno sin tocar sus pagos
          return FTDB.guardarAlumno(FT.crearAlumno({
            id: maria.id, nombre: maria.nombre, apellidos: maria.apellidos, archivado: true, creado: maria.creado,
          }));
        })
        .then(() => FTDB.listarAlumnos())
        .then((lista4) => {
          const m = lista4.filter((a) => a.id === maria.id)[0];
          ok(m.archivado, "el alumno queda archivado");
          return FTDB.listarPagos();
        })
        .then((lista5) => {
          ok(lista5.length === 1, "archivar al alumno no borra ningún pago");

          // 10) actualizar la app: misma base de datos, sin borrados posteriores
          ok(fake._estado.version() === 1, "la base sigue en su versión (sin migraciones destructivas)");
          ok(fake._estado.creadas.has("alumnos"), "las tablas siguen existiendo");
          return FTDB.limpiarDatosAntiguos().then(() => FTDB.listarPagos());
        })
        .then((lista6) => {
          igual(lista6.length, 1, "tras actualizar, el borrado único no se repite y el pago sigue guardado");
          return FTDB.leerMeta("borradoDatosHasta");
        })
        .then((marca) => {
          igual(marca, FTDB.MARCA_BORRADO, "la marca del borrado se conserva entre actualizaciones");
        });
    })
    .then(() => {
      console.log(`\n${pruebas - fallos}/${pruebas} pruebas correctas.`);
      if (fallos > 0) {
        console.log("HAY FALLOS.");
        std.exit(1);
      }
    })
    .catch((e) => {
      console.log("  ✗ ERROR INESPERADO: " + (e && e.message ? e.message : e));
      if (e && e.stack) console.log(e.stack);
      console.log(`\n${pruebas - fallos}/${pruebas} pruebas correctas.`);
      std.exit(1);
    });
}

principal();
