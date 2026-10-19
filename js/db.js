"use strict";
/* ============================================================
   Fulltraining · Control de pagos
   js/db.js — almacén local en IndexedDB.
   Las tablas son "alumnos", "pagos" y "meta". Al actualizar la
   app solo se crean tablas nuevas: nunca se borran datos.
   ============================================================ */

globalThis.FTDB = (function () {
  const NOMBRE = "fulltraining-pagos";
  const VERSION = 1;
  let promesaDb = null;

  function abrir() {
    if (promesaDb) return promesaDb;
    promesaDb = new Promise((resolver, rechazar) => {
      if (typeof indexedDB === "undefined") {
        rechazar(new Error("Este navegador no permite guardar datos sin conexión (IndexedDB)."));
        return;
      }
      const peticion = indexedDB.open(NOMBRE, VERSION);
      peticion.onupgradeneeded = (evento) => {
        const db = evento.target.result;
        if (!db.objectStoreNames.contains("alumnos")) db.createObjectStore("alumnos", { keyPath: "id" });
        if (!db.objectStoreNames.contains("pagos")) db.createObjectStore("pagos", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "clave" });
      };
      peticion.onsuccess = () => {
        const db = peticion.result;
        db.onversionchange = () => {
          try { db.close(); } catch (e) { /* nada */ }
          promesaDb = null;
        };
        resolver(db);
      };
      peticion.onerror = () => {
        rechazar(peticion.error || new Error("No se pudo abrir el almacén de datos."));
      };
      peticion.onblocked = () => {
        rechazar(new Error("El almacén está bloqueado por otra pestaña de la app."));
      };
    }).catch((err) => {
      promesaDb = null;
      throw err;
    });
    return promesaDb;
  }

  /** Cierra la conexión (las pruebas lo usan para simular "cerrar y reabrir"). */
  function cerrar() {
    const pendiente = promesaDb;
    promesaDb = null;
    if (!pendiente) return Promise.resolve();
    return pendiente.then((db) => {
      try { db.close(); } catch (e) { /* nada */ }
    });
  }

  /** Ejecuta una operación de escritura sobre una tienda. */
  function transaccion(tienda, modo, trabajador) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction([tienda], modo);
      let salida;
      tx.oncomplete = () => resolver(salida);
      tx.onerror = () => rechazar(tx.error || new Error("Error al acceder al almacén."));
      tx.onabort = () => rechazar(tx.error || new Error("Operación cancelada."));
      try {
        salida = trabajador(tx.objectStore(tienda));
      } catch (e) {
        try { tx.abort(); } catch (err) { /* nada */ }
        rechazar(e);
      }
    }));
  }

  /** Ejecuta una operación de escritura sobre varias tiendas a la vez. */
  function transaccionVarias(tiendas, modo, trabajador) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction(tiendas, modo);
      let salida;
      tx.oncomplete = () => resolver(salida);
      tx.onerror = () => rechazar(tx.error || new Error("Error al acceder al almacén."));
      tx.onabort = () => rechazar(tx.error || new Error("Operación cancelada."));
      try {
        salida = trabajador((nombre) => tx.objectStore(nombre));
      } catch (e) {
        try { tx.abort(); } catch (err) { /* nada */ }
        rechazar(e);
      }
    }));
  }

  /** Lectura de una tienda completa o de una clave. */
  function leer(tienda, metodo, argumento) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction([tienda], "readonly");
      let datos;
      tx.oncomplete = () => resolver(datos);
      tx.onerror = () => rechazar(tx.error || new Error("Error al leer el almacén."));
      tx.onabort = () => rechazar(tx.error || new Error("Lectura cancelada."));
      const peticion = argumento === undefined
        ? tx.objectStore(tienda)[metodo]()
        : tx.objectStore(tienda)[metodo](argumento);
      peticion.onsuccess = () => { datos = peticion.result; };
      peticion.onerror = () => rechazar(peticion.error || new Error("Lectura fallida."));
    }));
  }

  /* ---------------- API ---------------- */

  function listarAlumnos() {
    return leer("alumnos", "getAll");
  }

  function listarPagos() {
    return leer("pagos", "getAll");
  }

  function guardarAlumno(alumno) {
    return transaccion("alumnos", "readwrite", (tienda) => {
      tienda.put(alumno);
      return true;
    });
  }

  function guardarPago(pago) {
    return transaccion("pagos", "readwrite", (tienda) => {
      tienda.put(pago);
      return true;
    });
  }

  function eliminarPago(id) {
    return transaccion("pagos", "readwrite", (tienda) => {
      tienda.delete(id);
      return true;
    });
  }

  /** Sustituye el contenido por completo (usado por importar con "reemplazar" y "fusionar"). */
  function guardarTodo(alumnos, pagos) {
    return transaccionVarias(["alumnos", "pagos"], "readwrite", (tienda) => {
      const a = tienda("alumnos");
      const p = tienda("pagos");
      a.clear();
      p.clear();
      (alumnos || []).forEach((alumno) => a.put(alumno));
      (pagos || []).forEach((pago) => p.put(pago));
      return true;
    });
  }

  function guardarMeta(clave, valor) {
    return transaccion("meta", "readwrite", (tienda) => {
      tienda.put({ clave: clave, valor: valor });
      return true;
    });
  }

  function leerMeta(clave) {
    return leer("meta", "get", clave).then((fila) => (fila ? fila.valor : undefined));
  }

  return {
    NOMBRE: NOMBRE,
    VERSION: VERSION,
    abrir: abrir,
    cerrar: cerrar,
    listarAlumnos: listarAlumnos,
    listarPagos: listarPagos,
    guardarAlumno: guardarAlumno,
    guardarPago: guardarPago,
    eliminarPago: eliminarPago,
    guardarTodo: guardarTodo,
    guardarMeta: guardarMeta,
    leerMeta: leerMeta,
  };
})();
