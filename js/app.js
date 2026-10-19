"use strict";
/* ============================================================
   Fulltraining · Control de pagos
   js/app.js — interfaz y conexión con el almacén.
   Pantallas: inicio, registrar pago, alumnos, historial,
   resumen mensual y copias de seguridad.
   ============================================================ */

(function () {
  /* Versión visible en «Copias de seguridad».
     Debe coincidir con «version» de manifest.json (lo comprueba tests/estaticas.py). */
  const VERSION = "1.1.0";

  /* ---------------- estado ---------------- */

  function nuevoBorradorPago() {
    const hoy = new Date();
    return {
      alumnoId: null,
      modalidad: "plana",
      importe: String(FT.importeDeModalidad("plana")),
      mes: hoy.getMonth() + 1,
      anio: hoy.getFullYear(),
      observaciones: "",
      errores: [],
      avisos: [],
      aceptarDuplicado: false,
      guardado: null,
      editandoId: null,
      fechaOriginal: null,
    };
  }

  function nuevoBorradorAlumno() {
    return { nombre: "", apellidos: "", modalidad: "plana", errores: [] };
  }

  const S = {
    vista: "inicio",
    alumnos: [],
    pagos: [],
    meta: { ultimaImportacion: null },
    busqueda: { inicio: "", pago: "", alumnos: "", historial: "" },
    mostrarArchivados: false,
    alumnoEditando: null,
    borradorAlumno: nuevoBorradorAlumno(),
    pago: nuevoBorradorPago(),
    resumen: { mes: new Date().getMonth() + 1, anio: new Date().getFullYear() },
    filtros: { texto: "", mes: "", anio: "", modalidad: "", criterio: "periodo" },
    guardando: false,
  };

  /* ---------------- utilidades ---------------- */

  const esc = FT.esc;
  const euros = FT.euros;

  function porId(id) { return document.getElementById(id); }

  function pintarEn(id, html) {
    const el = porId(id);
    if (el) el.innerHTML = html;
  }

  function htmlDe(marcas) {
    return marcas.map((m) => `<li>${esc(m)}</li>`).join("");
  }

  let temporizadorToast = null;
  function avisar(texto, tipo) {
    const t = porId("toast");
    if (!t) return;
    t.textContent = texto;
    t.className = "toast visible" + (tipo === "error" ? " toast-error" : "");
    if (temporizadorToast) clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { t.className = "toast"; }, 3600);
  }

  /* La capa del diálogo: se muestra solo cuando hay contenido (clase
     «abierto») y siempre se oculta al cerrar, sin fiarse únicamente del
     atributo hidden. */
  function mostrarModal() {
    const m = porId("modal");
    m.hidden = false;
    m.classList.add("abierto");
  }

  function ocultarModal() {
    const m = porId("modal");
    m.hidden = true;
    m.classList.remove("abierto");
  }

  let resolverModal = null;
  function preguntar(opciones) {
    return new Promise((resolver) => {
      resolverModal = resolver;
      porId("modal-titulo").textContent = opciones.titulo || "";
      porId("modal-texto").innerHTML = opciones.texto || "";
      const cont = porId("modal-botones");
      cont.innerHTML = "";
      (opciones.botones || []).forEach((b) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn " + (b.clase || "btn-secundario");
        btn.textContent = b.texto;
        btn.addEventListener("click", () => cerrarModal(b.valor));
        cont.appendChild(btn);
      });
      mostrarModal();
      const primero = cont.querySelector("button");
      if (primero) primero.focus();
    });
  }

  function cerrarModal(valor) {
    ocultarModal();
    if (resolverModal) {
      const r = resolverModal;
      resolverModal = null;
      r(valor);
    }
  }

  function confirmar(titulo, texto, textoAceptar) {
    return preguntar({
      titulo: titulo,
      texto: texto,
      botones: [
        { texto: textoAceptar, valor: true, clase: "btn-peligro" },
        { texto: "Cancelar", valor: false, clase: "btn-ghost" },
      ],
    }).then((v) => v === true);
  }

  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------------- datos ---------------- */

  function recargar() {
    return Promise.all([
      FTDB.listarAlumnos(),
      FTDB.listarPagos(),
      FTDB.leerMeta("ultimaImportacion"),
    ]).then((r) => {
      S.alumnos = (r[0] || []).slice().sort(FT.compararAlumnos);
      S.pagos = r[1] || [];
      S.meta.ultimaImportacion = r[2] || null;
    });
  }

  function pagosDe(alumnoId) {
    return S.pagos.filter((p) => p.alumnoId === alumnoId);
  }

  /* ---------------- desplegables ---------------- */

  function opcionesMes(seleccion, conTodos) {
    let html = conTodos
      ? `<option value=""${String(seleccion) === "" ? " selected" : ""}>Todos los meses</option>`
      : "";
    FT.MESES.forEach((nombre, i) => {
      const v = i + 1;
      html += `<option value="${v}"${String(seleccion) === String(v) ? " selected" : ""}>${nombre}</option>`;
    });
    return html;
  }

  function opcionesAnio(seleccion, conTodos, anios) {
    let html = conTodos
      ? `<option value=""${String(seleccion) === "" ? " selected" : ""}>Todos los años</option>`
      : "";
    (anios || FT.aniosDisponibles(S.pagos, new Date().getFullYear())).forEach((a) => {
      html += `<option value="${a}"${String(seleccion) === String(a) ? " selected" : ""}>${a}</option>`;
    });
    return html;
  }

  function opcionesModalidad(seleccion, conTodas) {
    let html = conTodas
      ? `<option value=""${String(seleccion) === "" ? " selected" : ""}>Todas las modalidades</option>`
      : "";
    FT.MODALIDADES_ORDEN.forEach((k) => {
      html += `<option value="${k}"${String(seleccion) === k ? " selected" : ""}>${FT.MODALIDADES[k].nombre}</option>`;
    });
    return html;
  }

  /* ---------------- pantallas: inicio ---------------- */

  function htmlSinAlumnos() {
    return `<p class="vacio">Todavía no hay alumnos.<br>Crea el primero para poder registrar pagos.</p>
      <button type="button" class="btn btn-grande btn-primario btn-bloque" data-accion="nuevo-alumno">＋ Nuevo alumno</button>`;
  }

  function filaAlumno(alumno, acciones) {
    const tag = alumno.archivado ? `<span class="archivado-tag">archivado</span>` : "";
    const n = pagosDe(alumno.id).length;
    return `<div class="fila-alumno">
      <div class="datos-alumno">
        <p class="fuerte">${esc(FT.nombreCompleto(alumno))}${tag}</p>
        <p class="nota">${n} pago(s) registrado(s)</p>
      </div>
      <div class="acciones">${acciones}</div>
    </div>`;
  }

  function htmlResultadosBusqueda() {
    if (S.alumnos.length === 0) return htmlSinAlumnos();
    const texto = S.busqueda.inicio;
    // Con la búsqueda vacía solo se listan alumnos activos; al escribir,
    // también aparecen los archivados (etiquetados como tales).
    const encontrados = FT.buscarAlumnos(S.alumnos, texto, {
      incluirArchivados: texto.trim().length > 0,
    });
    if (encontrados.length === 0) {
      return `<p class="vacio">No hay alumnos que coincidan con «${esc(texto)}».</p>`;
    }
    const limite = texto.trim() ? encontrados : encontrados.slice(0, 20);
    const filas = limite.map((a) => filaAlumno(a, `
      <button type="button" class="btn btn-mini-primario" data-accion="alumno-pago" data-valor="${a.id}">Registrar pago</button>
      <button type="button" class="btn btn-mini" data-accion="alumno-editar" data-valor="${a.id}">Editar</button>
    `)).join("");
    const sobra = !texto.trim() && encontrados.length > limite.length
      ? `<p class="nota">…y ${encontrados.length - limite.length} más. Usa el buscador para encontrarlos.</p>`
      : "";
    return filas + sobra;
  }

  function htmlInicio() {
    const r = FT.resumenMensual(S.pagos, S.alumnos, S.resumen.mes, S.resumen.anio);
    const etiqueta = FT.etiquetaPeriodo(r.mes, r.anio);
    const anios = FT.aniosDisponibles(S.pagos, new Date().getFullYear());
    return `
      <section class="tarjeta tarjeta-destaque">
        <button type="button" class="btn btn-grande btn-primario btn-bloque" data-accion="nuevo-pago">Registrar pago</button>
        <button type="button" class="btn btn-grande btn-secundario btn-bloque" data-accion="nuevo-alumno">＋ Nuevo alumno</button>
      </section>

      <section class="tarjeta">
        <h2>Buscar alumno</h2>
        <label class="etiqueta" for="buscar-inicio">Nombre o apellidos</label>
        <input class="entrada entrada-grande" type="search" id="buscar-inicio" data-campo="buscar-inicio"
               placeholder="Escribe un nombre…" value="${esc(S.busqueda.inicio)}" autocomplete="off">
        <div class="lista" id="lista-busqueda">${htmlResultadosBusqueda()}</div>
      </section>

      <section class="tarjeta">
        <div class="fila-entre">
          <h2>Resumen del mes</h2>
          <button type="button" class="btn btn-mini" data-accion="ir" data-valor="resumen">Ver completo</button>
        </div>
        <div class="filtros">
          <div>
            <label class="etiqueta" for="resumen-mes">Mes</label>
            <select class="select" id="resumen-mes" data-campo="resumen-mes">${opcionesMes(S.resumen.mes, false)}</select>
          </div>
          <div>
            <label class="etiqueta" for="resumen-anio">Año</label>
            <select class="select" id="resumen-anio" data-campo="resumen-anio">${opcionesAnio(S.resumen.anio, false, anios)}</select>
          </div>
        </div>
        <p class="cifra-grande">${euros(r.total)}</p>
        <p class="nota">Cobrado en metálico en ${esc(etiqueta)} según la fecha del cobro · ${r.nPagos} pago(s).</p>
        <p class="nota">Alumnos activos con ${esc(etiqueta)}: <strong>${r.abonados} abonado(s)</strong> · ${r.pendientes} pendiente(s) (según periodo pagado).</p>
        <button type="button" class="btn btn-secundario btn-bloque" data-accion="ir" data-valor="resumen">Ver resumen mensual</button>
      </section>`;
  }

  /* ---------------- pantallas: registrar pago ---------------- */

  function htmlListaPicker() {
    const encontrados = FT.buscarAlumnos(S.alumnos, S.busqueda.pago, { incluirArchivados: true });
    if (S.alumnos.length === 0) return htmlSinAlumnos();
    if (encontrados.length === 0) {
      return `<p class="vacio">No hay alumnos que coincidan con «${esc(S.busqueda.pago)}».</p>`;
    }
    return encontrados.map((a) => filaAlumno(a, `
      <button type="button" class="btn btn-mini-primario" data-accion="elegir-alumno" data-valor="${a.id}">Elegir</button>
    `)).join("");
  }

  function htmlAvisoDuplicado(b) {
    if (!b.avisos || b.avisos.length === 0) return "";
    const alumno = FT.alumnoPorId(S.alumnos, b.alumnoId);
    const lista = b.avisos.map((p) =>
      `<li>${euros(p.importe)} · ${esc(FT.nombreDeModalidad(p.modalidad))} · cobrado el ${FT.fechaHoraCorta(p.fecha)}</li>`
    ).join("");
    return `<div class="aviso" role="alert">
      <p><strong>⚠ Ya hay ${b.avisos.length} pago(s) de ${esc(FT.nombreCompleto(alumno))} para ${esc(FT.etiquetaPeriodo(b.mes, b.anio))}.</strong></p>
      <ul>${lista}</ul>
      <p>Revisa estos pagos antes de registrar otro.</p>
      <div class="botones-fila">
        <button type="button" class="btn btn-secundario" data-accion="revisar-existentes">Revisar pagos existentes</button>
        <button type="button" class="btn btn-peligro" data-accion="forzar-guardar">Guardar de todas formas</button>
      </div>
    </div>`;
  }

  function htmlFormularioPago(b, alumno) {
    const editando = !!b.editandoId;
    const anios = FT.aniosDisponibles(S.pagos, new Date().getFullYear());
    const errores = b.errores.length
      ? `<div class="errores" role="alert"><strong>Revisa esto:</strong><ul>${htmlDe(b.errores)}</ul></div>`
      : "";
    const modalidades = FT.MODALIDADES_ORDEN.map((k) => {
      const mod = FT.MODALIDADES[k];
      const activa = b.modalidad === k;
      return `<button type="button" class="tarjeta-radio${activa ? " activa" : ""}" data-accion="modalidad" data-valor="${k}" aria-pressed="${activa}">
        <span class="titulo-modalidad">${esc(mod.nombre)}${activa ? " ✓" : ""}</span>
        <span class="detalle-modalidad">${esc(mod.detalle)}</span>
      </button>`;
    }).join("");

    return `
      <h2>${editando ? "Editar pago" : "Registrar pago"}</h2>
      ${errores}
      ${htmlAvisoDuplicado(b)}

      <section class="tarjeta">
        <div class="fila-entre">
          <div>
            <p class="etiqueta">Alumno</p>
            <p class="fuerte">${esc(FT.nombreCompleto(alumno))}${alumno.archivado ? ' <span class="archivado-tag">archivado</span>' : ""}</p>
          </div>
          ${editando ? "" : `<button type="button" class="btn btn-mini" data-accion="cambiar-alumno">Cambiar</button>`}
        </div>
      </section>

      <section class="tarjeta">
        <h3>Modalidad</h3>
        <div class="modalidades">${modalidades}</div>
        <label class="etiqueta" for="pago-importe">Importe</label>
        <div class="entrada-con-sufijo">
          <input class="entrada entrada-grande" type="number" inputmode="decimal" step="0.01" min="0"
                 id="pago-importe" data-campo="pago-importe" value="${esc(b.importe)}">
          <span class="sufijo">€</span>
        </div>
        <p class="nota">Se rellena solo con la modalidad (${euros(FT.importeDeModalidad(b.modalidad))}); puedes corregirlo si hace falta.</p>
      </section>

      <section class="tarjeta">
        <h3>Periodo que se está pagando</h3>
        <div class="dos-selects">
          <div>
            <label class="etiqueta" for="pago-mes">Mes</label>
            <select class="select" id="pago-mes" data-campo="pago-mes">${opcionesMes(b.mes, false)}</select>
          </div>
          <div>
            <label class="etiqueta" for="pago-anio">Año</label>
            <select class="select" id="pago-anio" data-campo="pago-anio">${opcionesAnio(b.anio, false, anios)}</select>
          </div>
        </div>
        <p class="nota">Es el mes y el año que abonas; no tienen por qué coincidir con la fecha del cobro.</p>
        <div class="fila-estatica">
          <span class="etiqueta">Fecha y hora del cobro</span>
          <span>${editando ? FT.fechaHoraCorta(b.fechaOriginal) : "Se asigna al guardar (hora local)"}</span>
        </div>
        <div class="fila-estatica">
          <span class="etiqueta">Método de pago</span>
          <span class="chip">${esc(FT.metodoPago())}</span>
        </div>
      </section>

      <section class="tarjeta">
        <h3>Observaciones <span class="opcional">(opcional)</span></h3>
        <textarea class="textarea" rows="3" data-campo="pago-observaciones"
                  placeholder="Por ejemplo: pago atrasado, entrega en mano…">${esc(b.observaciones)}</textarea>
      </section>

      <button type="button" class="btn btn-grande btn-primario btn-bloque" data-accion="guardar-pago">
        ${editando ? "Guardar cambios" : "Guardar pago"}
      </button>`;
  }

  function htmlPagoGuardado(b) {
    const p = b.guardado;
    const alumno = FT.alumnoPorId(S.alumnos, p.alumnoId);
    const editado = !!b.editandoId;
    return `
      <section class="tarjeta confirmacion" role="status">
        <p class="ok-titulo">✓ ${editado ? "Pago actualizado" : "Pago guardado"}</p>
        <p class="detalle fuerte">${esc(FT.nombreCompleto(alumno))} — ${euros(p.importe)}</p>
        <p class="detalle">Periodo abonado: ${esc(FT.etiquetaPeriodo(p.mes, p.anio))}</p>
        <p class="detalle">Cobro: ${FT.fechaHoraCorta(p.fecha)} · ${esc(p.metodo)}</p>
        <p class="detalle">Modalidad: ${esc(FT.nombreDeModalidad(p.modalidad))}</p>
        ${p.observaciones ? `<p class="nota">Observaciones: ${esc(p.observaciones)}</p>` : ""}
        <div class="botones-apilados">
          ${editado
            ? `<button type="button" class="btn btn-grande btn-primario" data-accion="ir" data-valor="historial">Ver historial</button>
               <button type="button" class="btn btn-secundario" data-accion="nuevo-pago">Registrar otro pago</button>`
            : `<button type="button" class="btn btn-grande btn-primario" data-accion="nuevo-pago">Registrar otro pago</button>
               <button type="button" class="btn btn-secundario" data-accion="ir" data-valor="historial">Ver historial</button>`}
          <button type="button" class="btn btn-ghost" data-accion="ir" data-valor="inicio">Inicio</button>
        </div>
      </section>`;
  }

  function htmlPago() {
    const b = S.pago;
    if (b.guardado) return htmlPagoGuardado(b);
    const alumno = b.alumnoId ? FT.alumnoPorId(S.alumnos, b.alumnoId) : null;
    if (!alumno) {
      return `
        <h2>${b.editandoId ? "Editar pago" : "Registrar pago"}</h2>
        <section class="tarjeta">
          <label class="etiqueta" for="buscar-pago">Paso 1 · Selecciona al alumno</label>
          <input class="entrada entrada-grande" type="search" id="buscar-pago" data-campo="buscar-pago"
                 placeholder="Nombre o apellidos…" value="${esc(S.busqueda.pago)}" autocomplete="off">
          <div class="lista" id="lista-pago">${htmlListaPicker()}</div>
        </section>
        <button type="button" class="btn btn-ghost btn-bloque" data-accion="ir" data-valor="inicio">Cancelar y volver al inicio</button>`;
    }
    return htmlFormularioPago(b, alumno);
  }

  /* ---------------- pantallas: alumnos ---------------- */

  function htmlListaAlumnos() {
    if (S.alumnos.length === 0) return htmlSinAlumnos();
    const encontrados = FT.buscarAlumnos(S.alumnos, S.busqueda.alumnos, {
      incluirArchivados: S.mostrarArchivados,
    });
    if (encontrados.length === 0) {
      if (S.busqueda.alumnos.trim()) {
        return `<p class="vacio">No hay alumnos que coincidan con «${esc(S.busqueda.alumnos)}».</p>`;
      }
      return `<p class="vacio">No hay alumnos activos. Marca «Mostrar alumnos archivados» para ver los archivados.</p>`;
    }
    return encontrados.map((a) => filaAlumno(a, `
      <button type="button" class="btn btn-mini-primario" data-accion="alumno-pago" data-valor="${a.id}">Registrar pago</button>
      <button type="button" class="btn btn-mini" data-accion="alumno-editar" data-valor="${a.id}">Editar</button>
      <button type="button" class="btn btn-mini" data-accion="alumno-archivar" data-valor="${a.id}">${a.archivado ? "Reactivar" : "Archivar"}</button>
    `)).join("");
  }

  /* ---------------- formulario de alumno (dentro del diálogo) ---------------- */

  function formularioAlumnoHTML() {
    const b = S.borradorAlumno;
    const errores = b.errores.length
      ? `<div class="errores" role="alert"><ul>${htmlDe(b.errores)}</ul></div>`
      : "";
    const tarjetas = FT.MODALIDADES_ORDEN.map((k) => {
      const activa = b.modalidad === k;
      const m = FT.MODALIDADES[k];
      return `<button type="button" class="tarjeta-radio${activa ? " activa" : ""}" data-accion="alumno-modalidad" data-valor="${k}" aria-pressed="${activa}">
        <span class="titulo-modalidad">${esc(m.nombre)}${activa ? " ✓" : ""}</span>
        <span class="detalle-modalidad">${esc(m.detalle)}</span>
      </button>`;
    }).join("");
    return `${errores}
      <label class="etiqueta" for="alumno-nombre">Nombre</label>
      <input class="entrada entrada-grande" type="text" id="alumno-nombre" data-campo="alumno-nombre"
             value="${esc(b.nombre)}" autocomplete="given-name" placeholder="Nombre">
      <label class="etiqueta" for="alumno-apellidos">Apellidos</label>
      <input class="entrada entrada-grande" type="text" id="alumno-apellidos" data-campo="alumno-apellidos"
             value="${esc(b.apellidos)}" autocomplete="family-name" placeholder="Apellidos">
      <p class="etiqueta" id="etiqueta-modalidad-alumno">Modalidad</p>
      <div class="modalidades" role="group" aria-labelledby="etiqueta-modalidad-alumno">${tarjetas}</div>`;
  }

  function pintarFormularioEnModal() {
    pintarEn("modal-texto", formularioAlumnoHTML());
  }

  function abrirFormularioAlumno() {
    const editando = !!S.alumnoEditando;
    porId("modal-titulo").textContent = editando ? "Editar alumno" : "Nuevo alumno";
    pintarFormularioEnModal();
    pintarEn("modal-botones", `
      <button type="button" class="btn btn-grande btn-primario" data-accion="alumno-guardar">${editando ? "Guardar cambios" : "Guardar"}</button>
      <button type="button" class="btn btn-ghost" data-accion="alumno-cancelar">Cancelar</button>`);
    mostrarModal();
    const primerCampo = porId("alumno-nombre");
    if (primerCampo && primerCampo.focus) primerCampo.focus();
  }

  function htmlAlumnos() {
    return `
      <h2>Alumnos</h2>
      <section class="tarjeta tarjeta-destaque">
        <button type="button" class="btn btn-grande btn-primario btn-bloque" data-accion="nuevo-alumno">＋ Nuevo alumno</button>
        <p class="nota">Se abre un diálogo para escribir nombre, apellidos y modalidad.</p>
      </section>

      <section class="tarjeta">
        <h3>Lista</h3>
        <label class="etiqueta" for="buscar-alumnos">Buscar alumno</label>
        <input class="entrada" type="search" id="buscar-alumnos" data-campo="buscar-alumnos"
               value="${esc(S.busqueda.alumnos)}" placeholder="Nombre o apellidos…" autocomplete="off">
        <label class="casilla">
          <input type="checkbox" data-campo="mostrar-archivados"${S.mostrarArchivados ? " checked" : ""}>
          Mostrar alumnos archivados
        </label>
        <div class="lista" id="lista-alumnos">${htmlListaAlumnos()}</div>
      </section>`;
  }

  /* ---------------- pantallas: historial ---------------- */

  function htmlTarjetaPago(p) {
    const alumno = FT.alumnoPorId(S.alumnos, p.alumnoId);
    const nombre = alumno ? FT.nombreCompleto(alumno) : "Alumno no encontrado";
    const tag = alumno && alumno.archivado ? `<span class="archivado-tag">archivado</span>` : "";
    return `
      <article class="tarjeta pago">
        <div class="pago-cabecera">
          <h3>${esc(nombre)}${tag}</h3>
          <span class="importe">${euros(p.importe)}</span>
        </div>
        <dl class="datos">
          <div><dt>Fecha del cobro</dt><dd>${FT.fechaHoraCorta(p.fecha)}</dd></div>
          <div><dt>Mes y año abonados</dt><dd>${esc(FT.etiquetaPeriodo(p.mes, p.anio))}</dd></div>
          <div><dt>Modalidad</dt><dd>${esc(FT.nombreDeModalidad(p.modalidad))}</dd></div>
          <div><dt>Método de pago</dt><dd>${esc(p.metodo || FT.metodoPago())}</dd></div>
          ${p.observaciones ? `<div><dt>Observaciones</dt><dd>${esc(p.observaciones)}</dd></div>` : ""}
        </dl>
        <div class="botones-fila">
          <button type="button" class="btn btn-mini" data-accion="editar-pago" data-valor="${p.id}">Editar</button>
          <button type="button" class="btn btn-peligro" data-accion="eliminar-pago" data-valor="${p.id}">Eliminar</button>
        </div>
      </article>`;
  }

  function htmlListaHistorial() {
    const lista = FT.filtrarPagos(S.pagos, S.alumnos, {
      texto: S.busqueda.historial,
      mes: S.filtros.mes,
      anio: S.filtros.anio,
      modalidad: S.filtros.modalidad,
      criterio: S.filtros.criterio,
    });
    if (S.pagos.length === 0) {
      return `<p class="vacio">Todavía no hay pagos registrados.</p>`;
    }
    if (lista.length === 0) {
      return `<p class="cuenta-resultados">0 pagos con estos filtros.</p>
              <p class="vacio">No hay pagos que coincidan con la búsqueda.</p>`;
    }
    return `<p class="cuenta-resultados">${lista.length} pago(s) · del más reciente al más antiguo.</p>` +
      lista.map(htmlTarjetaPago).join("");
  }

  function htmlHistorial() {
    const anios = FT.aniosDisponibles(S.pagos, new Date().getFullYear());
    const notaBorrador = S.pago.alumnoId && !S.pago.guardado
      ? `<div class="barra-nota">
           <span>Hay un registro de pago a medias.</span>
           <button type="button" class="btn btn-mini-primario" data-accion="volver-formulario">Volver al formulario</button>
         </div>`
      : "";
    return `
      <h2>Historial de pagos</h2>
      ${notaBorrador}
      <section class="tarjeta">
        <label class="etiqueta" for="buscar-historial">Buscar por alumno</label>
        <input class="entrada" type="search" id="buscar-historial" data-campo="buscar-historial"
               value="${esc(S.busqueda.historial)}" placeholder="Nombre o apellidos…" autocomplete="off">
        <div class="filtros">
          <div>
            <label class="etiqueta" for="filtro-criterio">Mes y año se aplican a</label>
            <select class="select" id="filtro-criterio" data-campo="filtro-criterio">
              <option value="periodo"${S.filtros.criterio !== "cobro" ? " selected" : ""}>Mes abonado</option>
              <option value="cobro"${S.filtros.criterio === "cobro" ? " selected" : ""}>Fecha de cobro</option>
            </select>
          </div>
          <div>
            <label class="etiqueta" for="filtro-mes">Mes</label>
            <select class="select" id="filtro-mes" data-campo="filtro-mes">${opcionesMes(S.filtros.mes, true)}</select>
          </div>
          <div>
            <label class="etiqueta" for="filtro-anio">Año</label>
            <select class="select" id="filtro-anio" data-campo="filtro-anio">${opcionesAnio(S.filtros.anio, true, anios)}</select>
          </div>
          <div>
            <label class="etiqueta" for="filtro-modalidad">Modalidad</label>
            <select class="select" id="filtro-modalidad" data-campo="filtro-modalidad">${opcionesModalidad(S.filtros.modalidad, true)}</select>
          </div>
        </div>
        <div class="botones-fila">
          <button type="button" class="btn btn-mini" data-accion="limpiar-filtros">Limpiar filtros</button>
        </div>
      </section>
      <div id="lista-historial">${htmlListaHistorial()}</div>`;
  }

  /* ---------------- pantallas: resumen ---------------- */

  function htmlResumenContenido() {
    const r = FT.resumenMensual(S.pagos, S.alumnos, S.resumen.mes, S.resumen.anio);
    const etiqueta = FT.etiquetaPeriodo(r.mes, r.anio);

    const claves = FT.MODALIDADES_ORDEN.concat(
      Object.keys(r.porModalidad).filter((k) => FT.MODALIDADES_ORDEN.indexOf(k) === -1)
    );
    const desglose = claves.map((k) => {
      const d = r.porModalidad[k];
      if (!d) return "";
      const mod = FT.MODALIDADES[k];
      const titulo = mod ? mod.nombre : FT.nombreDeModalidad(k);
      const detalle = mod ? mod.detalle : "";
      return `<div class="desglose-row">
        <span><strong>${esc(titulo)}</strong>${detalle ? `<br><span class="nota">${esc(detalle)}</span>` : ""}</span>
        <span style="text-align:right"><strong>${euros(d.total)}</strong><br><span class="nota">${d.cantidad} pago(s)</span></span>
      </div>`;
    }).join("");

    const filas = r.filas.map((f) => `
      <div class="fila-resumen">
        <span>${esc(FT.nombreCompleto(f.alumno))}</span>
        ${f.pagado ? `<span class="badge badge-ok">Abonado ✓</span>` : `<span class="badge badge-pend">Pendiente</span>`}
      </div>`).join("");

    return `
      <section class="tarjeta">
        <h3>Cobrado en ${esc(etiqueta)}</h3>
        <p class="cifra-grande">${euros(r.total)}</p>
        <p class="nota">${r.nPagos} pago(s) en metálico · calculado por la <strong>fecha del cobro</strong>.</p>
      </section>

      <section class="tarjeta">
        <h3>Desglose por modalidad</h3>
        ${desglose || `<p class="vacio">Sin cobros en este mes.</p>`}
        <p class="nota">Solo incluye los cobros con fecha en ${esc(etiqueta)}.</p>
      </section>

      <section class="tarjeta">
        <h3>Alumnos activos · periodo ${esc(etiqueta)}</h3>
        <p class="nota">${r.abonados} abonado(s) · ${r.pendientes} pendiente(s) — según el <strong>mes y año abonados</strong>, no según la fecha del cobro.</p>
        ${filas || `<p class="vacio">Todavía no hay alumnos activos.</p>`}
      </section>`;
  }

  function htmlResumen() {
    const anios = FT.aniosDisponibles(S.pagos, new Date().getFullYear());
    return `
      <h2>Resumen mensual</h2>
      <section class="tarjeta">
        <div class="filtros">
          <div>
            <label class="etiqueta" for="resumen-mes">Mes</label>
            <select class="select" id="resumen-mes" data-campo="resumen-mes">${opcionesMes(S.resumen.mes, false)}</select>
          </div>
          <div>
            <label class="etiqueta" for="resumen-anio">Año</label>
            <select class="select" id="resumen-anio" data-campo="resumen-anio">${opcionesAnio(S.resumen.anio, false, anios)}</select>
          </div>
        </div>
        <p class="nota">Los totales se calculan por <strong>fecha de cobro</strong>; la lista de abonados, por el <strong>periodo pagado</strong>.</p>
      </section>
      <div id="resumen-contenido">${htmlResumenContenido()}</div>`;
  }

  /* ---------------- pantallas: copias ---------------- */

  function htmlCopias() {
    const activos = S.alumnos.filter((a) => !a.archivado).length;
    const ultima = S.meta.ultimaImportacion;
    return `
      <h2>Copias de seguridad</h2>
      <section class="tarjeta">
        <p><strong>${S.alumnos.length} alumno(s)</strong> (${activos} activos) · <strong>${S.pagos.length} pago(s)</strong></p>
        <p class="nota">Los datos se guardan en este dispositivo (IndexedDB) y <strong>no se borran al actualizar la app</strong>. La app no incluye alumnos ni pagos de ejemplo.</p>
        ${ultima ? `<p class="nota">Última copia importada: ${FT.fechaHoraCorta(ultima)}</p>` : ""}
      </section>

      <section class="tarjeta">
        <button type="button" class="btn btn-grande btn-primario btn-bloque" data-accion="exportar-json">Exportar copia completa (JSON)</button>
        <button type="button" class="btn btn-grande btn-secundario btn-bloque" data-accion="importar-json">Importar copia (JSON)</button>
        <button type="button" class="btn btn-grande btn-secundario btn-bloque" data-accion="exportar-csv">Exportar pagos (CSV para Excel)</button>
        <p class="nota">La copia JSON contiene todos tus alumnos y pagos. El CSV solo incluye los pagos y usa «;» como separador, para que Excel en español lo abra bien.</p>
      </section>

      <section class="tarjeta">
        <h3>Consejo</h3>
        <p class="nota">Exporta una copia JSON de vez en cuando y guárdala en el móvil o en el ordenador. Si desinstalas la app o borras los datos del sitio web, los pagos solo se recuperarían con esa copia.</p>
        <p class="nota">Versión de la app: ${VERSION}</p>
      </section>`;
  }

  /* ---------------- pintado general ---------------- */

  function htmlVista() {
    switch (S.vista) {
      case "pago": return htmlPago();
      case "alumnos": return htmlAlumnos();
      case "historial": return htmlHistorial();
      case "resumen": return htmlResumen();
      case "copias": return htmlCopias();
      default: return htmlInicio();
    }
  }

  function render() {
    document.querySelectorAll(".nav-inferior button").forEach((b) => {
      const esta = b.dataset.vista === S.vista ||
        (S.vista === "pago" && b.dataset.vista === "inicio");
      b.classList.toggle("activo", esta);
    });
    porId("vista").innerHTML = htmlVista();
  }

  function ir(vista) {
    S.vista = vista;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- acciones ---------------- */

  async function guardarPago() {
    const b = S.pago;
    if (S.guardando) return;

    const errores = FT.validarPago({
      alumnoId: b.alumnoId,
      mes: b.mes,
      anio: b.anio,
      modalidad: b.modalidad,
      importe: b.importe,
    });
    if (errores.length) {
      b.errores = errores;
      b.avisos = [];
      render();
      avisar("Revisa los campos marcados.", "error");
      return;
    }

    const duplicados = FT.pagosDuplicados(S.pagos, b, b.editandoId);
    if (duplicados.length > 0 && !b.aceptarDuplicado) {
      b.avisos = duplicados;
      b.errores = [];
      render();
      return;
    }

    S.guardando = true;
    try {
      let pago;
      if (b.editandoId) {
        const original = S.pagos.filter((p) => p.id === b.editandoId)[0];
        if (!original) throw new Error("El pago que querías editar ya no existe.");
        pago = FT.crearPago({
          id: original.id,
          alumnoId: b.alumnoId,
          fecha: original.fecha, // la fecha del cobro original se conserva
          mes: b.mes,
          anio: b.anio,
          modalidad: b.modalidad,
          importe: b.importe,
          observaciones: b.observaciones,
        });
      } else {
        pago = FT.crearPago({
          alumnoId: b.alumnoId,
          fecha: FT.fechaLocalAhora(), // hora local del móvil
          mes: b.mes,
          anio: b.anio,
          modalidad: b.modalidad,
          importe: b.importe,
          observaciones: b.observaciones,
        });
      }
      await FTDB.guardarPago(pago);
      await recargar();
      b.guardado = pago;
      b.errores = [];
      b.avisos = [];
      render();
      avisar(b.editandoId ? "Pago actualizado ✓" : "Pago guardado ✓");
    } finally {
      S.guardando = false;
    }
  }

  async function guardarAlumno() {
    const b = S.borradorAlumno;
    const errores = FT.validarAlumno(b);
    if (errores.length) {
      b.errores = errores;
      pintarFormularioEnModal(); // los errores se ven dentro del diálogo, sin cerrarlo
      avisar("Revisa los campos marcados.", "error");
      return;
    }
    if (S.guardando) return;
    const editando = !!S.alumnoEditando;
    S.guardando = true;
    try {
      if (editando) {
        const original = FT.alumnoPorId(S.alumnos, S.alumnoEditando);
        if (!original) throw new Error("El alumno ya no existe.");
        await FTDB.guardarAlumno(FT.crearAlumno({
          id: original.id,
          nombre: b.nombre,
          apellidos: b.apellidos,
          modalidad: b.modalidad,
          archivado: original.archivado,
          creado: original.creado,
        }));
      } else {
        await FTDB.guardarAlumno(FT.crearAlumno({
          nombre: b.nombre,
          apellidos: b.apellidos,
          modalidad: b.modalidad,
        }));
      }
      S.alumnoEditando = null;
      S.borradorAlumno = nuevoBorradorAlumno();
      await recargar();
      cerrarModal(null); // la capa oscura desaparece al guardar
      if (editando) {
        render();
      } else {
        ir("alumnos"); // se ve el alumno recién creado en la lista
      }
      avisar(editando ? "Alumno actualizado ✓" : "Alumno guardado ✓");
    } finally {
      S.guardando = false;
    }
  }

  async function alternarArchivo(id) {
    const alumno = FT.alumnoPorId(S.alumnos, id);
    if (!alumno) return;
    const archivar = !alumno.archivado;
    const seguro = await confirmar(
      archivar ? "Archivar alumno" : "Reactivar alumno",
      archivar
        ? `${esc(FT.nombreCompleto(alumno))} dejará de aparecer como alumno activo. Sus pagos se conservan en el historial.`
        : `${esc(FT.nombreCompleto(alumno))} volverá a aparecer como alumno activo.`,
      archivar ? "Sí, archivar" : "Sí, reactivar"
    );
    if (!seguro) return;
    await FTDB.guardarAlumno(FT.crearAlumno({
      id: alumno.id,
      nombre: alumno.nombre,
      apellidos: alumno.apellidos,
      modalidad: FT.modalidadDeAlumno(alumno),
      archivado: archivar,
      creado: alumno.creado,
    }));
    await recargar();
    render();
    avisar(archivar ? "Alumno archivado ✓" : "Alumno reactivado ✓");
  }

  async function eliminarPago(id) {
    const pago = S.pagos.filter((p) => p.id === id)[0];
    if (!pago) return;
    const alumno = FT.alumnoPorId(S.alumnos, pago.alumnoId);
    const seguro = await confirmar(
      "Eliminar pago",
      `Se eliminará el pago de <strong>${esc(FT.nombreCompleto(alumno))}</strong> por ${euros(pago.importe)} (${esc(FT.etiquetaPeriodo(pago.mes, pago.anio))}), cobrado el ${FT.fechaHoraCorta(pago.fecha)}. Esta acción no se puede deshacer.`,
      "Sí, eliminar el pago"
    );
    if (!seguro) return;
    await FTDB.eliminarPago(id);
    await recargar();
    render();
    avisar("Pago eliminado ✓");
  }

  function importarCopia(archivo) {
    const lector = new FileReader();
    lector.onload = async () => {
      try {
        const lectura = FT.leerImportacion(String(lector.result || ""));
        if (!lectura.ok) {
          await preguntar({ titulo: "No se pudo importar", texto: esc(lectura.error), botones: [{ texto: "Entendido", valor: true, clase: "btn-primario" }] });
          return;
        }
        const eleccion = await preguntar({
          titulo: "Importar copia",
          texto: `El archivo contiene <strong>${lectura.alumnos.length} alumno(s)</strong> y <strong>${lectura.pagos.length} pago(s)</strong>. ¿Cómo quieres importarlos?`,
          botones: [
            { texto: "Fusionar (recomendado)", valor: "fusionar", clase: "btn-primario" },
            { texto: "Reemplazar todo", valor: "reemplazar", clase: "btn-peligro" },
            { texto: "Cancelar", valor: "cancelar", clase: "btn-ghost" },
          ],
        });
        if (eleccion === "cancelar" || eleccion === null) return;
        if (eleccion === "reemplazar") {
          const seguro = await confirmar(
            "¿Reemplazar todos los datos?",
            "Se borrarán los alumnos y pagos actuales de este dispositivo y se sustituirán por los de la copia.",
            "Sí, reemplazar todo"
          );
          if (!seguro) return;
          await FTDB.guardarTodo(lectura.alumnos, lectura.pagos);
        } else {
          const combinado = FT.combinarDatos({ alumnos: S.alumnos, pagos: S.pagos }, lectura);
          await FTDB.guardarTodo(combinado.alumnos, combinado.pagos);
        }
        await FTDB.guardarMeta("ultimaImportacion", FT.fechaLocalAhora());
        await recargar();
        render();
        avisar(`Copia importada ✓ (${lectura.alumnos.length} alumnos, ${lectura.pagos.length} pagos)`);
      } catch (e) {
        console.error(e);
        avisar("Error al importar: " + (e && e.message ? e.message : e), "error");
      }
    };
    lector.onerror = () => avisar("No se pudo leer el archivo.", "error");
    lector.readAsText(archivo);
  }

  /* Al elegir alumno para un pago nuevo, se anticipa su modalidad
     (y su importe). Al editar un pago, se conserva la del pago. */
  function aplicarModalidadAlumnoAlPago(alumnoId) {
    if (S.pago.editandoId) return;
    const alumno = FT.alumnoPorId(S.alumnos, alumnoId);
    if (!alumno) return;
    const modalidad = FT.modalidadDeAlumno(alumno);
    S.pago.modalidad = modalidad;
    S.pago.importe = String(FT.importeDeModalidad(modalidad));
  }

  async function manejarAccion(accion, valor) {
    switch (accion) {
      case "ir":
        ir(valor);
        break;

      case "nuevo-pago":
        S.pago = nuevoBorradorPago();
        S.busqueda.pago = "";
        ir("pago");
        break;

      case "nuevo-alumno":
        S.alumnoEditando = null;
        S.borradorAlumno = nuevoBorradorAlumno();
        abrirFormularioAlumno();
        break;

      case "elegir-alumno":
        S.pago.alumnoId = valor;
        S.pago.avisos = [];
        aplicarModalidadAlumnoAlPago(valor);
        render();
        break;

      case "cambiar-alumno":
        S.pago.alumnoId = null;
        S.pago.avisos = [];
        render();
        break;

      case "modalidad":
        S.pago.modalidad = valor;
        S.pago.importe = String(FT.importeDeModalidad(valor));
        S.pago.aceptarDuplicado = false;
        render();
        break;

      case "guardar-pago":
        await guardarPago();
        break;

      case "forzar-guardar":
        S.pago.aceptarDuplicado = true;
        await guardarPago();
        break;

      case "revisar-existentes": {
        const alumno = FT.alumnoPorId(S.alumnos, S.pago.alumnoId);
        S.busqueda.historial = alumno ? FT.nombreCompleto(alumno) : "";
        S.filtros = { texto: "", mes: S.pago.mes, anio: S.pago.anio, modalidad: "", criterio: "periodo" };
        ir("historial");
        break;
      }

      case "volver-formulario":
        ir("pago");
        break;

      case "editar-pago": {
        const pago = S.pagos.filter((p) => p.id === valor)[0];
        if (!pago) break;
        S.pago = Object.assign(nuevoBorradorPago(), {
          alumnoId: pago.alumnoId,
          modalidad: pago.modalidad,
          importe: String(pago.importe),
          mes: pago.mes,
          anio: pago.anio,
          observaciones: pago.observaciones || "",
          editandoId: pago.id,
          fechaOriginal: pago.fecha,
        });
        ir("pago");
        break;
      }

      case "eliminar-pago":
        await eliminarPago(valor);
        break;

      case "alumno-guardar":
        await guardarAlumno();
        break;

      case "alumno-cancelar":
        S.alumnoEditando = null;
        S.borradorAlumno = nuevoBorradorAlumno();
        cerrarModal(null);
        break;

      case "alumno-modalidad":
        S.borradorAlumno.modalidad = valor;
        pintarFormularioEnModal();
        break;

      case "alumno-editar": {
        const alumno = FT.alumnoPorId(S.alumnos, valor);
        if (!alumno) break;
        S.alumnoEditando = alumno.id;
        S.borradorAlumno = {
          nombre: alumno.nombre,
          apellidos: alumno.apellidos,
          modalidad: FT.modalidadDeAlumno(alumno),
          errores: [],
        };
        abrirFormularioAlumno();
        break;
      }

      case "alumno-archivar":
        await alternarArchivo(valor);
        break;

      case "alumno-pago":
        S.pago = nuevoBorradorPago();
        S.pago.alumnoId = valor;
        aplicarModalidadAlumnoAlPago(valor);
        S.busqueda.pago = "";
        ir("pago");
        break;

      case "limpiar-filtros":
        S.filtros = { texto: "", mes: "", anio: "", modalidad: "", criterio: "periodo" };
        S.busqueda.historial = "";
        render();
        break;

      case "exportar-json":
        descargar(FT.nombreCopia(), JSON.stringify(FT.exportarDatos(S.alumnos, S.pagos), null, 2), "application/json");
        avisar("Copia JSON descargada ✓");
        break;

      case "exportar-csv":
        descargar(FT.nombreCSV(), FT.csvPagos(S.pagos, S.alumnos), "text/csv;charset=utf-8");
        avisar("CSV de pagos descargado ✓");
        break;

      case "importar-json":
        porId("archivo-copia").click();
        break;

      default:
        break;
    }
  }

  /* ---------------- campos ---------------- */

  function alCambiarCampo(campo, valor, el) {
    switch (campo) {
      case "buscar-inicio":
        S.busqueda.inicio = valor;
        pintarEn("lista-busqueda", htmlResultadosBusqueda());
        break;
      case "buscar-pago":
        S.busqueda.pago = valor;
        pintarEn("lista-pago", htmlListaPicker());
        break;
      case "buscar-alumnos":
        S.busqueda.alumnos = valor;
        pintarEn("lista-alumnos", htmlListaAlumnos());
        break;
      case "buscar-historial":
        S.busqueda.historial = valor;
        pintarEn("lista-historial", htmlListaHistorial());
        break;
      case "mostrar-archivados":
        S.mostrarArchivados = !!el.checked;
        pintarEn("lista-alumnos", htmlListaAlumnos());
        break;
      case "resumen-mes":
        S.resumen.mes = Number(valor);
        render();
        break;
      case "resumen-anio":
        S.resumen.anio = Number(valor);
        render();
        break;
      case "pago-mes":
        S.pago.mes = Number(valor);
        S.pago.aceptarDuplicado = false;
        break;
      case "pago-anio":
        S.pago.anio = Number(valor);
        S.pago.aceptarDuplicado = false;
        break;
      case "pago-importe":
        S.pago.importe = valor;
        break;
      case "pago-observaciones":
        S.pago.observaciones = valor;
        break;
      case "filtro-criterio":
        S.filtros.criterio = valor;
        pintarEn("lista-historial", htmlListaHistorial());
        break;
      case "filtro-mes":
        S.filtros.mes = valor;
        pintarEn("lista-historial", htmlListaHistorial());
        break;
      case "filtro-anio":
        S.filtros.anio = valor;
        pintarEn("lista-historial", htmlListaHistorial());
        break;
      case "filtro-modalidad":
        S.filtros.modalidad = valor;
        pintarEn("lista-historial", htmlListaHistorial());
        break;
      case "alumno-nombre":
        S.borradorAlumno.nombre = valor;
        break;
      case "alumno-apellidos":
        S.borradorAlumno.apellidos = valor;
        break;
      default:
        break;
    }
  }

  /* ---------------- arranque ---------------- */

  function manejarEventoCampo(ev) {
    const el = ev.target;
    if (!el || !el.dataset || !el.dataset.campo) return;
    const valor = el.type === "checkbox" ? el.checked : el.value;
    try {
      alCambiarCampo(el.dataset.campo, valor, el);
    } catch (e) {
      console.error(e);
    }
  }

  function alClic(ev) {
    if (!ev.target || !ev.target.closest) return;
    const btn = ev.target.closest("[data-accion]");
    if (!btn) return;
    ev.preventDefault();
    manejarAccion(btn.dataset.accion, btn.dataset.valor).catch((e) => {
      console.error(e);
      avisar("Error: " + (e && e.message ? e.message : e), "error");
    });
  }

  function iniciar() {
    const vista = porId("vista");
    vista.addEventListener("click", alClic);
    vista.addEventListener("input", manejarEventoCampo);
    vista.addEventListener("change", manejarEventoCampo);

    document.querySelector(".nav-inferior").addEventListener("click", (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest("button[data-vista]") : null;
      if (btn) ir(btn.dataset.vista);
    });

    // El diálogo lleva su propio formulario: mismos manejores que la vista
    // (escribir, elegir modalidad, pulsar «Guardar»/«Cancelar»).
    const capaModal = porId("modal");
    capaModal.addEventListener("click", alClic);
    capaModal.addEventListener("input", manejarEventoCampo);
    capaModal.addEventListener("change", manejarEventoCampo);
    // Tocar la parte oscura (fuera de la caja) cierra el diálogo.
    capaModal.addEventListener("click", (ev) => {
      if (ev.target && ev.target.id === "modal") cerrarModal(null);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !porId("modal").hidden) cerrarModal(null);
    });

    porId("archivo-copia").addEventListener("change", function () {
      const archivo = this.files && this.files[0];
      if (archivo) importarCopia(archivo);
      this.value = "";
    });

    recargar()
      .then(() => render())
      .catch((e) => {
        console.error(e);
        porId("vista").innerHTML = `
          <section class="tarjeta">
            <h2>No se pudo abrir el almacén de datos</h2>
            <p>${esc(e && e.message ? e.message : String(e))}</p>
            <p class="nota">Prueba a recargar la página. Si usas el navegador en modo incógnito, sal de él e inténtalo otra vez: en incógnito no se guardan datos.</p>
          </section>`;
      });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* sin conexión a la red la primera vez: se intentará al recargar */
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  /* Gancho para las pruebas sin navegador (tests/ui.test.mjs):
     permite comprobar el HTML de cada pantalla con datos de prueba. */
  globalThis.FTUI = {
    S: S,
    VERSION: VERSION,
    nuevoBorradorPago: nuevoBorradorPago,
    nuevoBorradorAlumno: nuevoBorradorAlumno,
    htmlVista: htmlVista,
    htmlInicio: htmlInicio,
    htmlPago: htmlPago,
    htmlAlumnos: htmlAlumnos,
    htmlHistorial: htmlHistorial,
    htmlResumen: htmlResumen,
    htmlResumenContenido: htmlResumenContenido,
    htmlCopias: htmlCopias,
    htmlListaHistorial: htmlListaHistorial,
    htmlListaAlumnos: htmlListaAlumnos,
    htmlResultadosBusqueda: htmlResultadosBusqueda,
    formularioAlumnoHTML: formularioAlumnoHTML,
    abrirFormularioAlumno: abrirFormularioAlumno,
    pintarFormularioEnModal: pintarFormularioEnModal,
    guardarAlumno: guardarAlumno,
    cerrarModal: cerrarModal,
    manejarAccion: manejarAccion,
  };
})();
