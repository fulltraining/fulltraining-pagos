"use strict";
/* ============================================================
   Fulltraining · Control de pagos
   js/logica.js — reglas de negocio y formato.
   No toca el DOM ni IndexedDB: se usa en el navegador y en
   las pruebas con QuickJS (qjs tests/logica.test.mjs).
   ============================================================ */

globalThis.FT = (function () {
  const APP = "fulltraining-pagos";
  const VERSION = 1;

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];

  const MODALIDADES = {
    plana: { id: "plana", nombre: "Tarifa plana", detalle: "50 € al mes", importe: 50 },
    dosdias: { id: "dosdias", nombre: "Dos días a la semana", detalle: "49 € al mes", importe: 49 },
  };
  const MODALIDADES_ORDEN = ["plana", "dosdias"];
  const METODO_PAGO = "Metálico";

  /* ---------------- texto ---------------- */

  function dos(valor) {
    return String(valor).padStart(2, "0");
  }

  function nuevoId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const ACENTOS = {
    "á": "a", "à": "a", "ä": "a", "â": "a",
    "é": "e", "è": "e", "ë": "e", "ê": "e",
    "í": "i", "ì": "i", "ï": "i", "î": "i",
    "ó": "o", "ò": "o", "ö": "o", "ô": "o",
    "ú": "u", "ù": "u", "ü": "u", "û": "u",
    "ñ": "n", "ç": "c",
  };

  /** Minúsculas y sin acentos, para buscar sin importar cómo escriba el usuario. */
  function plano(texto) {
    return String(texto == null ? "" : texto)
      .toLowerCase()
      .replace(/[áàäâéèëêíìïîóòöôúùüûñç]/g, (c) => ACENTOS[c] || c);
  }

  /* ---------------- fechas (hora local del móvil) ---------------- */

  /** Fecha y hora locales en formato ISO sin zona horaria: "2026-10-18T21:04:07". */
  function fechaLocalAhora(ahora) {
    const d = ahora || new Date();
    return (
      d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) +
      "T" + dos(d.getHours()) + ":" + dos(d.getMinutes()) + ":" + dos(d.getSeconds())
    );
  }

  function partesFecha(iso) {
    const s = String(iso == null ? "" : iso);
    const trozos = s.split("T");
    const p = trozos[0].split("-");
    const hora = trozos[1] ? trozos[1].slice(0, 5) : "";
    if (p.length !== 3) return { fecha: s, hora: "", dia: "", mes: "", anio: "" };
    return { fecha: p[2] + "/" + p[1] + "/" + p[0], hora: hora, dia: p[2], mes: p[1], anio: p[0] };
  }

  /** "2026-10-18T21:04:07" → "18/10/2026" */
  function fechaCorta(iso) { return partesFecha(iso).fecha; }

  /** "2026-10-18T21:04:07" → "18/10/2026 21:04" */
  function fechaHoraCorta(iso) {
    const p = partesFecha(iso);
    return p.hora ? p.fecha + " " + p.hora : p.fecha;
  }

  function mesDeFecha(iso) {
    const m = partesFecha(iso).mes;
    return m ? parseInt(m, 10) : 0;
  }

  function anioDeFecha(iso) {
    const a = partesFecha(iso).anio;
    return a ? parseInt(a, 10) : 0;
  }

  function nombreMes(mes) { return MESES[Number(mes) - 1] || ""; }
  function etiquetaPeriodo(mes, anio) { return nombreMes(mes) + " de " + anio; }
  function etiquetaMesAnio(mes, anio) { return nombreMes(mes) + " " + anio; }

  /* ---------------- dinero ---------------- */

  /** 50 → "50,00 €" · 1234.5 → "1.234,50 €" */
  function euros(valor) {
    const v = Math.round((Number(valor) || 0) * 100) / 100;
    const signo = v < 0 ? "-" : "";
    const trozos = Math.abs(v).toFixed(2).split(".");
    const enteros = trozos[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return signo + enteros + "," + trozos[1] + " €";
  }

  function importeDeModalidad(modalidad) {
    const m = MODALIDADES[modalidad];
    return m ? m.importe : 0;
  }

  function nombreDeModalidad(modalidad) {
    const m = MODALIDADES[modalidad];
    return m ? m.nombre : String(modalidad || "");
  }

  function detalleDeModalidad(modalidad) {
    const m = MODALIDADES[modalidad];
    return m ? m.detalle : "";
  }

  function metodoPago() { return METODO_PAGO; }

  /* ---------------- alumnos ---------------- */

  function nombreCompleto(alumno) {
    if (!alumno) return "";
    const n = String(alumno.nombre || "").trim();
    const a = String(alumno.apellidos || "").trim();
    return (n + " " + a).replace(/\s+/g, " ").trim();
  }

  function compararAlumnos(a, b) {
    const x = plano(nombreCompleto(a));
    const y = plano(nombreCompleto(b));
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function crearAlumno(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      nombre: String(d.nombre || "").trim(),
      apellidos: String(d.apellidos || "").trim(),
      // Alumnos guardados antes de tener modalidad: valen como «plana».
      modalidad: MODALIDADES[d.modalidad] ? d.modalidad : "plana",
      archivado: !!d.archivado,
      creado: String(d.creado || "") || fechaLocalAhora(),
    };
  }

  function modalidadDeAlumno(alumno) {
    const m = alumno && alumno.modalidad;
    return MODALIDADES[m] ? m : "plana";
  }

  function validarAlumno(datos) {
    const errores = [];
    if (!String((datos && datos.nombre) || "").trim()) errores.push("Escribe el nombre del alumno.");
    if (!String((datos && datos.apellidos) || "").trim()) errores.push("Escribe los apellidos del alumno.");
    return errores;
  }

  function buscarAlumnos(alumnos, texto, opciones) {
    const incluirArchivados = !!(opciones && opciones.incluirArchivados);
    const q = plano(texto).trim();
    let lista = (alumnos || []).slice();
    if (!incluirArchivados) lista = lista.filter((a) => !a.archivado);
    if (q) lista = lista.filter((a) => plano(nombreCompleto(a)).indexOf(q) !== -1);
    return lista.sort(compararAlumnos);
  }

  function alumnoPorId(alumnos, id) {
    return (alumnos || []).filter((a) => a.id === id)[0] || null;
  }

  /* ---------------- pagos ---------------- */

  function crearPago(datos) {
    const d = datos || {};
    const modalidad = String(d.modalidad || "plana");
    return {
      id: String(d.id || "") || nuevoId(),
      alumnoId: String(d.alumnoId || ""),
      fecha: String(d.fecha || "") || fechaLocalAhora(), // hora local del cobro
      mes: Number(d.mes),       // periodo pagado (1-12)
      anio: Number(d.anio),     // periodo pagado (aaaa)
      modalidad: modalidad,
      importe: Number(d.importe),
      metodo: String(d.metodo || METODO_PAGO),
      observaciones: String(d.observaciones || "").trim(),
    };
  }

  function validarPago(datos) {
    const d = datos || {};
    const errores = [];
    if (!d.alumnoId) errores.push("Selecciona al alumno.");
    if (!MODALIDADES[d.modalidad]) errores.push("Selecciona la modalidad.");
    const mes = Number(d.mes);
    if (!(mes >= 1 && mes <= 12)) errores.push("Selecciona el mes que se está pagando.");
    const anio = Number(d.anio);
    if (!(anio >= 2000 && anio <= 2100)) errores.push("Selecciona el año que se está pagando.");
    const importe = Number(d.importe);
    if (!isFinite(importe) || importe <= 0) errores.push("El importe debe ser un número mayor que 0.");
    return errores;
  }

  /** Pagos del mismo alumno para el mismo periodo (aviso de duplicado). */
  function pagosDuplicados(pagos, referencia, excluirId) {
    const r = referencia || {};
    return (pagos || []).filter((p) =>
      p.id !== excluirId &&
      p.alumnoId === r.alumnoId &&
      Number(p.mes) === Number(r.mes) &&
      Number(p.anio) === Number(r.anio)
    );
  }

  /* ---------------- resumen mensual ---------------- */

  /**
   * Totales por FECHA DE COBRO (metálico) y estado de los alumnos ACTIVOS
   * según el PERIODO pagado. Los dos criterios se aplican al mes indicado.
   */
  function resumenMensual(pagos, alumnos, mes, anio) {
    const m = Number(mes);
    const a = Number(anio);
    const todos = pagos || [];

    const porFechaCobro = todos.filter((p) => mesDeFecha(p.fecha) === m && anioDeFecha(p.fecha) === a);
    const total = porFechaCobro.reduce((s, p) => s + (Number(p.importe) || 0), 0);

    const porModalidad = {};
    MODALIDADES_ORDEN.forEach((k) => { porModalidad[k] = { cantidad: 0, total: 0 }; });
    porFechaCobro.forEach((p) => {
      const k = p.modalidad;
      if (!porModalidad[k]) porModalidad[k] = { cantidad: 0, total: 0 };
      porModalidad[k].cantidad += 1;
      porModalidad[k].total += Number(p.importe) || 0;
    });

    const activos = (alumnos || []).filter((x) => !x.archivado).sort(compararAlumnos);
    const filas = activos.map((alumno) => {
      const delPeriodo = todos.filter((p) =>
        p.alumnoId === alumno.id && Number(p.mes) === m && Number(p.anio) === a
      );
      return { alumno: alumno, pagado: delPeriodo.length > 0, pagos: delPeriodo };
    });

    return {
      mes: m,
      anio: a,
      cobros: porFechaCobro,
      nPagos: porFechaCobro.length,
      total: total,
      porModalidad: porModalidad,
      filas: filas,
      abonados: filas.filter((f) => f.pagado).length,
      pendientes: filas.filter((f) => !f.pagado).length,
    };
  }

  /* ---------------- historial ---------------- */

  /**
   * filtros: { texto, mes, anio, modalidad, alumnoId, criterio }
   * criterio: "periodo" (mes/año abonado, por defecto) o "cobro" (fecha).
   * Devuelve la lista ordenada del cobro más reciente al más antiguo.
   */
  function filtrarPagos(pagos, alumnos, filtros) {
    const f = filtros || {};
    const criterio = f.criterio === "cobro" ? "cobro" : "periodo";
    const q = plano(f.texto).trim();
    let lista = (pagos || []).slice();

    if (f.alumnoId) lista = lista.filter((p) => p.alumnoId === f.alumnoId);
    if (f.mes) {
      const m = Number(f.mes);
      lista = lista.filter((p) => (criterio === "cobro" ? mesDeFecha(p.fecha) : Number(p.mes)) === m);
    }
    if (f.anio) {
      const a = Number(f.anio);
      lista = lista.filter((p) => (criterio === "cobro" ? anioDeFecha(p.fecha) : Number(p.anio)) === a);
    }
    if (f.modalidad) lista = lista.filter((p) => p.modalidad === f.modalidad);
    if (q) {
      const mapa = {};
      (alumnos || []).forEach((a) => { mapa[a.id] = nombreCompleto(a); });
      lista = lista.filter((p) => plano(mapa[p.alumnoId] || "").indexOf(q) !== -1);
    }

    return lista.sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0));
  }

  /** Años con pagos + los cercanos al actual, para los desplegables. */
  function aniosDisponibles(pagos, anioActual) {
    const set = {};
    (pagos || []).forEach((p) => {
      const a = Number(p.anio);
      if (a >= 2000 && a <= 2100) set[a] = true;
    });
    for (let i = -5; i <= 1; i++) set[Number(anioActual) + i] = true;
    return Object.keys(set).map(Number).sort((x, y) => y - x);
  }

  /* ---------------- exportación ---------------- */

  function csvPagos(pagos, alumnos) {
    const mapa = {};
    (alumnos || []).forEach((a) => { mapa[a.id] = a; });
    const cabecera = [
      "Alumno", "Apellidos", "Fecha de cobro", "Hora", "Mes abonado", "Año abonado",
      "Modalidad", "Importe (€)", "Método", "Observaciones",
    ];
    const filas = [cabecera];
    (pagos || []).slice()
      .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0))
      .forEach((p) => {
        const a = mapa[p.alumnoId] || {};
        const f = partesFecha(p.fecha);
        const importe = Number(p.importe) || 0;
        filas.push([
          String(a.nombre || ""),
          String(a.apellidos || ""),
          f.fecha,
          f.hora,
          nombreMes(Number(p.mes)),
          String(p.anio),
          nombreDeModalidad(p.modalidad),
          String(importe).replace(".", ","),
          String(p.metodo || METODO_PAGO),
          String(p.observaciones || ""),
        ]);
      });
    const lineas = filas.map((fila) =>
      fila.map((celda) => '"' + String(celda == null ? "" : celda).replace(/"/g, '""') + '"').join(";")
    );
    // BOM para que Excel abra bien los acentos; separador ";" (Excel en español).
    return "\ufeff" + lineas.join("\r\n") + "\r\n";
  }

  function exportarDatos(alumnos, pagos) {
    return {
      app: APP,
      version: VERSION,
      exportado: fechaLocalAhora(),
      alumnos: (alumnos || []).map(sanearAlumno).filter(Boolean),
      pagos: (pagos || []).map(sanearPago).filter(Boolean),
    };
  }

  function nombreCopia() {
    const d = new Date();
    return "fulltraining-copia-" + d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) + ".json";
  }

  function nombreCSV() {
    const d = new Date();
    return "fulltraining-pagos-" + d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) + ".csv";
  }

  /* ---------------- importación ---------------- */

  function sanearAlumno(obj) {
    if (!obj || typeof obj !== "object") return null;
    const nombre = String(obj.nombre || "").trim();
    const apellidos = String(obj.apellidos || "").trim();
    if (!nombre && !apellidos) return null;
    return {
      id: String(obj.id || "").trim() || nuevoId(),
      nombre: nombre,
      apellidos: apellidos,
      archivado: !!obj.archivado,
      creado: String(obj.creado || ""),
    };
  }

  function sanearPago(obj) {
    if (!obj || typeof obj !== "object") return null;
    const alumnoId = String(obj.alumnoId || "").trim();
    if (!alumnoId) return null;
    const mes = Number(obj.mes);
    const anio = Number(obj.anio);
    if (!(mes >= 1 && mes <= 12)) return null;
    if (!(anio >= 2000 && anio <= 2100)) return null;
    const modalidad = String(obj.modalidad || "plana");
    let fecha = String(obj.fecha || "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(fecha)) {
      fecha = anio + "-" + dos(mes) + "-01T00:00:00";
    }
    const importe = Number(obj.importe);
    return {
      id: String(obj.id || "").trim() || nuevoId(),
      alumnoId: alumnoId,
      fecha: fecha,
      mes: mes,
      anio: anio,
      modalidad: modalidad,
      importe: isFinite(importe) ? importe : importeDeModalidad(modalidad),
      metodo: String(obj.metodo || METODO_PAGO),
      observaciones: String(obj.observaciones || ""),
    };
  }

  /** Lee y valida una copia JSON. Devuelve { ok, error?, alumnos, pagos }. */
  function leerImportacion(texto) {
    let obj;
    try {
      obj = JSON.parse(texto);
    } catch (e) {
      return { ok: false, error: "El archivo no es un JSON válido." };
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { ok: false, error: "El archivo no contiene una copia válida." };
    }
    if (!Array.isArray(obj.alumnos) || !Array.isArray(obj.pagos)) {
      return { ok: false, error: "El archivo no tiene la estructura de una copia de Fulltraining (faltan alumnos o pagos)." };
    }
    const alumnos = obj.alumnos.map(sanearAlumno).filter(Boolean);
    const pagos = obj.pagos.map(sanearPago).filter(Boolean);
    return {
      ok: true,
      alumnos: alumnos,
      pagos: pagos,
      descartadosAlumnos: obj.alumnos.length - alumnos.length,
      descartadosPagos: obj.pagos.length - pagos.length,
    };
  }

  /** Fusión: por id manda lo importado; lo que solo está en el dispositivo se conserva. */
  function combinarDatos(actuales, entrantes) {
    const alumnos = {};
    const pagos = {};
    ((actuales && actuales.alumnos) || []).forEach((a) => { alumnos[a.id] = a; });
    ((actuales && actuales.pagos) || []).forEach((p) => { pagos[p.id] = p; });
    ((entrantes && entrantes.alumnos) || []).forEach((a) => { alumnos[a.id] = a; });
    ((entrantes && entrantes.pagos) || []).forEach((p) => { pagos[p.id] = p; });
    const listaAlumnos = Object.keys(alumnos).map((k) => alumnos[k]).sort(compararAlumnos);
    const listaPagos = Object.keys(pagos).map((k) => pagos[k])
      .sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0));
    return { alumnos: listaAlumnos, pagos: listaPagos };
  }

  return {
    APP: APP,
    VERSION: VERSION,
    MESES: MESES,
    MODALIDADES: MODALIDADES,
    MODALIDADES_ORDEN: MODALIDADES_ORDEN,
    METODO_PAGO: METODO_PAGO,
    dos: dos,
    nuevoId: nuevoId,
    esc: esc,
    plano: plano,
    fechaLocalAhora: fechaLocalAhora,
    partesFecha: partesFecha,
    fechaCorta: fechaCorta,
    fechaHoraCorta: fechaHoraCorta,
    mesDeFecha: mesDeFecha,
    anioDeFecha: anioDeFecha,
    nombreMes: nombreMes,
    etiquetaPeriodo: etiquetaPeriodo,
    etiquetaMesAnio: etiquetaMesAnio,
    euros: euros,
    importeDeModalidad: importeDeModalidad,
    nombreDeModalidad: nombreDeModalidad,
    detalleDeModalidad: detalleDeModalidad,
    metodoPago: metodoPago,
    nombreCompleto: nombreCompleto,
    compararAlumnos: compararAlumnos,
    crearAlumno: crearAlumno,
    modalidadDeAlumno: modalidadDeAlumno,
    validarAlumno: validarAlumno,
    buscarAlumnos: buscarAlumnos,
    alumnoPorId: alumnoPorId,
    crearPago: crearPago,
    validarPago: validarPago,
    pagosDuplicados: pagosDuplicados,
    resumenMensual: resumenMensual,
    filtrarPagos: filtrarPagos,
    aniosDisponibles: aniosDisponibles,
    csvPagos: csvPagos,
    exportarDatos: exportarDatos,
    nombreCopia: nombreCopia,
    nombreCSV: nombreCSV,
    sanearAlumno: sanearAlumno,
    sanearPago: sanearPago,
    leerImportacion: leerImportacion,
    combinarDatos: combinarDatos,
  };
})();
