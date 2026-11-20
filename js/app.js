import { h, toast } from './dom.js';
import * as S from './schema.js';
import { PASOS, evaluarPaso, evaluarContenido, estadoPaso, aplicaCruzados, mismaPersona } from './rules.js';
import { listarArts, obtenerArt, guardarArt, eliminarArt, duplicarArt, nuevoArt, nombresConocidos } from './store.js';
import { pedirFirma, formatearRun, describirFirma } from './firma.js';
import { generarPdf, huellaContenido } from './pdf.js';

const $app = document.getElementById('app');
let art = null;
let paso = 'antecedentes';

const ESTADOS = { borrador: 'Borrador', en_ejecucion: 'En ejecución', cerrado: 'Cerrado' };
const bloqueado = () => art.estado !== 'borrador';

/* ---------------- Rutas ---------------- */
function ruta() {
  const m = location.hash.match(/^#\/art\/([^/]+)(?:\/(\w+))?/);
  return m ? { id: m[1], paso: m[2] || 'antecedentes' } : null;
}
function ir(hash) { if (location.hash !== hash) location.hash = hash; else render(); }
window.addEventListener('hashchange', render);

function render() {
  const r = ruta();
  if (!r) { art = null; return renderLista(); }
  if (!art || art.id !== r.id) art = obtenerArt(r.id);
  if (!art) { toast('No se encontró el ART', 'error'); return ir('#/'); }
  const cambioPaso = paso !== r.paso;
  paso = PASOS.some(p => p.id === r.paso) ? r.paso : 'antecedentes';
  renderEditor();
  if (cambioPaso) window.scrollTo({ top: 0 });
}

/* ---------------- Guardado ---------------- */
let tGuardar;
function guardarPronto() {
  clearTimeout(tGuardar);
  tGuardar = setTimeout(() => { guardar(); actualizarNav(); }, 300);
}
function guardar() { if (!guardarArt(art)) toast('No se pudo guardar en el dispositivo (almacenamiento lleno o bloqueado).', 'error'); }
function cambio() {
  guardar();
  const y = window.scrollY;
  renderEditor();
  window.scrollTo({ top: y });
}

/* ---------------- Lista de ART ---------------- */
function renderLista() {
  const arts = listarArts();
  $app.replaceChildren(
    h('header', { class: 'barra' },
      h('div', { class: 'marca' }, h('span', { class: 'logo' }, 'ART'), h('span', {}, 'Análisis de Riesgos de la Tarea')),
    ),
    h('main', { class: 'lista' },
      h('div', { class: 'lista-top' },
        h('h1', {}, 'Mis ART'),
        h('button', { class: 'btn-pri grande', onclick: () => { const n = nuevoArt(); guardarArt(n); art = n; ir(`#/art/${n.id}/antecedentes`); } }, '+ Nuevo ART')),
      arts.length ? null : h('div', { class: 'vacio' },
        h('p', {}, 'Aún no tienes ART en este dispositivo.'),
        h('p', { class: 'sub' }, 'Crea uno nuevo. Para tareas que se repiten, usa "Duplicar": se conserva la descripción y el análisis de riesgo, y solo vuelves a responder las preguntas y firmar.')),
      h('ul', { class: 'tarjetas' }, arts.map(a => h('li', { class: 'tarjeta' },
        h('a', { href: `#/art/${a.id}/antecedentes`, class: 'tarjeta-cuerpo' },
          h('div', { class: 'tarjeta-top' },
            h('span', { class: `chip chip-${a.estado}` }, ESTADOS[a.estado]),
            h('span', { class: 'fecha' }, (a.antecedentes.fecha || '').split('-').reverse().join('/'), ' · ', a.folio)),
          h('div', { class: 'tarjeta-titulo' }, a.antecedentes.descripcion || 'Sin descripción'),
          h('div', { class: 'tarjeta-sub' }, [a.antecedentes.area, a.antecedentes.lugar].filter(Boolean).join(' · ') || '—',
            a.firmasInicio.length ? ` · ${a.firmasInicio.length} firma(s)` : '')),
        h('div', { class: 'tarjeta-acc' },
          h('button', { class: 'btn-sec', onclick: () => { const n = duplicarArt(a); guardarArt(n); toast('ART duplicado: revisa fecha, preguntas y firmas'); art = n; ir(`#/art/${n.id}/antecedentes`); } }, 'Duplicar'),
          h('button', { class: 'btn-txt peligro', onclick: () => { if (confirm('¿Eliminar este ART del dispositivo? No se puede deshacer.')) { eliminarArt(a.id); renderLista(); } } }, 'Eliminar'))))),
    ),
  );
}

/* ---------------- Editor ---------------- */
function renderEditor() {
  const i = PASOS.findIndex(p => p.id === paso);
  const nav = h('nav', { class: 'pasos', 'aria-label': 'Secciones del ART' },
    PASOS.map((p, n) => h('a', {
      href: `#/art/${art.id}/${p.id}`, class: 'paso' + (p.id === paso ? ' activo' : ''), dataset: { paso: p.id },
      'aria-current': p.id === paso ? 'step' : null,
    }, h('span', { class: 'paso-num' }, p.corto), h('span', { class: 'paso-tit' }, p.titulo))));

  $app.replaceChildren(
    h('header', { class: 'barra' },
      h('a', { href: '#/', class: 'volver', 'aria-label': 'Volver a mis ART' }, '‹'),
      h('div', { class: 'barra-tit' }, h('b', {}, art.antecedentes.descripcion || 'Nuevo ART'), h('small', {}, art.folio)),
      h('span', { class: `chip chip-${art.estado}` }, ESTADOS[art.estado]),
      h('button', { class: 'btn-pdf', onclick: exportarPdf, title: 'Generar PDF sobre el formulario oficial' }, 'PDF')),
    h('div', { class: 'editor' },
      nav,
      h('main', { class: 'contenido' },
        bloqueado() && !['firmas', 'cierre'].includes(paso)
          ? h('div', { class: 'aviso aviso-info' }, 'Este ART ya fue firmado y su contenido está bloqueado. Si cambian las condiciones, jornada, entorno, equipos o integrantes, confecciona un nuevo ART (botón "Duplicar" en Mis ART).')
          : null,
        PASO_RENDER[paso](),
        h('div', { class: 'nav-inferior' },
          i > 0 ? h('a', { class: 'btn-sec', href: `#/art/${art.id}/${PASOS[i - 1].id}` }, '‹ Anterior') : h('span'),
          i < PASOS.length - 1 ? h('a', { class: 'btn-pri', href: `#/art/${art.id}/${PASOS[i + 1].id}` }, 'Siguiente ›') : h('span')))));
  actualizarNav();
  document.querySelector('.paso.activo')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function actualizarNav() {
  document.querySelectorAll('.paso').forEach(el => {
    const e = estadoPaso(art, el.dataset.paso);
    el.classList.remove('st-ok', 'st-pendiente', 'st-detener', 'st-na');
    el.classList.add('st-' + e);
  });
}

/* ---------------- Componentes ---------------- */
function seccion(titulo, ...hijos) {
  return h('section', { class: 'seccion' }, h('h2', {}, titulo), ...hijos);
}
function faltantes(pasoId) {
  const e = evaluarPaso(art, pasoId);
  return [
    e.detener.length ? h('div', { class: 'aviso aviso-detener', role: 'alert' }, h('b', {}, '⛔ DETENER — NO INICIAR LA TAREA'), h('ul', {}, e.detener.map(t => h('li', {}, t)))) : null,
  ];
}
function siNo({ id, texto, num, store = art.r, detenerSi = null, aviso = null, disabled = bloqueado() }) {
  const v = store[id];
  const btn = (val) => h('button', {
    type: 'button', class: `sn sn-${val.toLowerCase()}` + (v === val ? ' on' : ''), 'aria-pressed': v === val ? 'true' : 'false', disabled,
    onclick: () => { store[id] = val; cambio(); },
  }, val === 'SI' ? 'SÍ' : 'NO');
  const alerta = detenerSi && v === detenerSi;
  return h('div', { class: 'preg' + (alerta ? ' preg-alerta' : '') },
    h('div', { class: 'preg-txt' }, num ? h('span', { class: 'num' }, num) : null, h('span', {}, texto),
      aviso ? h('small', { class: 'preg-aviso' }, aviso) : null),
    h('div', { class: 'sino', role: 'group' }, btn('SI'), btn('NO')));
}
function campo(etq, clave, { tipo = 'text', area = false, ph = '', lista = null } = {}) {
  const val = art.antecedentes[clave] || '';
  const attrs = { value: val, placeholder: ph, disabled: bloqueado(), oninput: e => { art.antecedentes[clave] = e.target.value; guardarPronto(); } };
  const input = area ? h('textarea', { rows: 3, ...attrs }) : h('input', { type: tipo, ...attrs, list: lista });
  return h('label', { class: 'campo' + (area ? ' ancho' : '') }, h('span', {}, etq), input);
}
function datalist(id, valores) {
  return h('datalist', { id }, [...new Set(valores.filter(Boolean))].map(v => h('option', { value: v })));
}
function tarjetaFirma(f, { onBorrar, etiqueta } = {}) {
  return h('div', { class: 'firma-card' },
    f.img ? h('img', { src: f.img, alt: 'Firma de ' + f.nombre }) : h('div', { class: 'firma-sin-img' }, f.metodos.includes('carnet') ? '🪪' : '🏷️'),
    h('div', { class: 'firma-info' },
      h('b', {}, f.nombre), etiqueta ? h('small', { class: 'firma-etq' }, etiqueta) : null,
      h('small', {}, [f.run ? 'RUN ' + formatearRun(f.run) : null, describirFirma(f)].filter(Boolean).join(' · ')),
      h('small', {}, new Date(f.ts).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }))),
    onBorrar ? h('button', { class: 'btn-txt peligro', onclick: onBorrar, 'aria-label': 'Quitar firma' }, 'Quitar') : null);
}

/* ---------------- Pasos ---------------- */
const PASO_RENDER = {
  antecedentes() {
    const previos = listarArts();
    return seccion('1.1 Antecedentes del trabajo',
      h('div', { class: 'grid-campos' },
        campo('Nombre de la empresa', 'empresa', { lista: 'dl-empresa' }),
        campo('Gerencia', 'gerencia', { ph: 'Opcional (se usa en hojas de controles críticos)', lista: 'dl-gerencia' }),
        campo('Descripción de la tarea', 'descripcion', { area: true, ph: 'Qué se hará, con qué equipos…' }),
        campo('Fecha', 'fecha', { tipo: 'date' }),
        h('div', { class: 'fila2' }, campo('Hora de inicio', 'horaInicio', { tipo: 'time' }), campo('Hora de término', 'horaTermino', { tipo: 'time' })),
        campo('Área de trabajo', 'area', { lista: 'dl-area' }),
        campo('Lugar específico', 'lugar'),
        campo('Supervisor responsable del trabajo', 'supervisor', { lista: 'dl-sup' })),
      datalist('dl-empresa', previos.map(a => a.antecedentes.empresa)),
      datalist('dl-gerencia', previos.map(a => a.antecedentes.gerencia)),
      datalist('dl-area', previos.map(a => a.antecedentes.area)),
      datalist('dl-sup', previos.map(a => a.antecedentes.supervisor)),
      h('p', { class: 'nota' }, 'La firma del supervisor se registra en el paso "Firmas de inicio".'));
  },

  trabajadores() {
    return seccion('1.2 De los trabajadores: conteste cada pregunta',
      faltantes('trabajadores'),
      S.PREGUNTAS_12.map((p, i) => siNo({ id: p.id, texto: p.texto, num: i + 1, detenerSi: 'NO' })),
      h('p', { class: 'aviso aviso-alerta' }, '⚠ ' + S.AVISO_12));
  },

  tarea() {
    const r = art.r;
    return seccion('1.3 De la tarea',
      faltantes('tarea'),
      siNo({ id: 'p13_1', texto: S.P13.p13_1, num: 1, detenerSi: 'NO', aviso: 'Un NO a esta pregunta significa no iniciar la tarea y dar aviso a su supervisión.' }),
      siNo({ id: 'p13_2', texto: S.P13.p13_2, num: 2 }),
      r.p13_2 === 'SI' ? h('label', { class: 'campo ancho sub-campo' }, h('span', {}, 'Indique cuál'),
        h('input', { type: 'text', value: art.docCual, disabled: bloqueado(), placeholder: 'Ej.: Procedimiento PTS-MAN-012 cambio de polines', oninput: e => { art.docCual = e.target.value; guardarPronto(); } })) : null,
      r.p13_2 === 'SI' ? siNo({ id: 'p13_3', texto: S.P13.p13_3, num: 3 }) : null,
      r.p13_2 === 'SI' && r.p13_3 === 'NO' ? h('p', { class: 'aviso aviso-alerta' }, 'El documento no cubre todas las actividades: revise con su supervisión las actividades fuera de alcance antes de iniciar.') : null);
  },

  controles() {
    const sel = new Set(art.estrategias);
    const toggle = id => {
      if (bloqueado()) return;
      if (sel.has(id)) art.estrategias = art.estrategias.filter(x => x !== id);
      else art.estrategias = S.ESTRATEGIAS.map(e => e.id).filter(x => sel.has(x) || x === id);
      cambio();
    };
    return [
      seccion('4. Estrategias de control que aplican',
        h('p', { class: 'nota' }, 'Seleccione una o más. Por cada una, responda su hoja de verificación de controles críticos.'),
        h('div', { class: 'estrategias' }, S.ESTRATEGIAS.map(e => h('button', {
          type: 'button', class: 'est' + (sel.has(e.id) ? ' on' : ''), 'aria-pressed': sel.has(e.id) ? 'true' : 'false', disabled: bloqueado(), onclick: () => toggle(e.id),
        }, h('span', { class: 'est-check' }, sel.has(e.id) ? '✓' : ''), h('span', {}, e.nombre), S.HOJAS_CC[e.id] ? h('small', { class: 'est-dig' }, 'hoja digital') : null)))),
      faltantes('controles'),
      art.estrategias.map(id => hojaControl(id)),
    ];
  },

  permisos() {
    const r = art.r;
    return seccion('5. Interacción con otros trabajos · 6. Permisos especiales',
      faltantes('permisos'),
      siNo({ id: 'p13_5', texto: S.P13.p13_5, num: 5, aviso: 'Un SÍ significa realizar adicionalmente la Etapa II, punto 2.1 "Verificación de trabajos cruzados".' }),
      siNo({ id: 'p13_6', texto: S.P13.p13_6, num: 6 }),
      r.p13_6 === 'SI' ? h('div', { class: 'permisos' },
        S.PERMISOS.map(p => h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: art.permisos.includes(p.id), disabled: bloqueado(), onchange: e => {
            art.permisos = e.target.checked ? [...art.permisos, p.id] : art.permisos.filter(x => x !== p.id); cambio();
          } }), h('span', {}, p.nombre))),
        art.permisos.includes('otros') ? h('label', { class: 'campo ancho sub-campo' }, h('span', {}, 'Indique cuál'),
          h('input', { type: 'text', value: art.otrosPermisoCual, disabled: bloqueado(), oninput: e => { art.otrosPermisoCual = e.target.value; guardarPronto(); } })) : null) : null,
      r.p13_6 === 'SI' ? siNo({ id: 'p13_6b', texto: S.P13.p13_6b, detenerSi: 'NO', aviso: 'Si requiere permisos y no los dispone, no inicie la tarea y dé aviso a su supervisión.' }) : null);
  },

  cruzados() {
    if (!aplicaCruzados(art)) {
      return seccion('2.1 Verificación de trabajos cruzados',
        h('div', { class: 'aviso aviso-info' }, art.r.p13_5 === 'NO'
          ? 'No aplica: en la pregunta 5 indicó que no hay interacción con otros trabajos.'
          : 'Responda primero la pregunta 5 (¿Existe interacción con otros trabajos?).',
        ' ', h('a', { href: `#/art/${art.id}/permisos` }, 'Ir a la pregunta 5')));
    }
    return seccion('2.1 Verificación de trabajos cruzados',
      faltantes('cruzados'),
      S.PREGUNTAS_21.map((p, i) => siNo({ id: p.id, texto: p.texto, num: i + 1, detenerSi: 'NO' })),
      h('p', { class: 'aviso aviso-alerta' }, '⚠ ' + S.AVISO_NO_ETAPA2));
  },

  riesgos() {
    const ro = bloqueado();
    const nombres = [...nombresConocidos(), ...art.firmasInicio.map(f => f.nombre)];
    const mover = (i, d) => { const j = i + d; if (j < 0 || j >= art.riesgos.length) return; [art.riesgos[i], art.riesgos[j]] = [art.riesgos[j], art.riesgos[i]]; cambio(); };
    const celda = (fila, k, etq, ayuda, color) => h('label', { class: `celda c-${color}` }, h('span', {}, etq, h('small', {}, ayuda)),
      h('textarea', { rows: 2, value: fila[k], disabled: ro, list: k === 'verificador' ? 'dl-verif' : null, oninput: e => { fila[k] = e.target.value; guardarPronto(); } }));
    return seccion('2.2 Análisis de riesgo: obligatorio para cada tarea',
      h('p', { class: 'nota' }, 'Verificador de los controles: trabajador con mayor rango y/o experiencia dentro del equipo. Lo anterior no exime al supervisor de su responsabilidad total y directa.'),
      faltantes('riesgos'),
      art.riesgos.map((fila, i) => h('div', { class: 'riesgo' },
        h('div', { class: 'riesgo-top' }, h('b', {}, `Paso ${i + 1}`),
          ro ? null : h('div', { class: 'riesgo-acc' },
            h('button', { class: 'btn-ico', title: 'Subir', disabled: i === 0, onclick: () => mover(i, -1) }, '↑'),
            h('button', { class: 'btn-ico', title: 'Bajar', disabled: i === art.riesgos.length - 1, onclick: () => mover(i, 1) }, '↓'),
            h('button', { class: 'btn-ico peligro', title: 'Eliminar paso', onclick: () => { art.riesgos.splice(i, 1); if (!art.riesgos.length) art.riesgos.push({ secuencia: '', evento: '', controles: '', verificador: '' }); cambio(); } }, '✕'))),
        h('div', { class: 'riesgo-celdas' },
          celda(fila, 'secuencia', 'Secuencia del trabajo', 'Paso a paso cómo se realizará la tarea', 'azul'),
          celda(fila, 'evento', 'Evento no deseado / incidente', 'Fuente, situación o acto que podría causar lesión', 'verde'),
          celda(fila, 'controles', 'Controles', 'Qué debo hacer para no sufrir un accidente', 'rojo'),
          celda(fila, 'verificador', 'Verificador de los controles', 'Nombre del trabajador que verifica', 'ambar')))),
      datalist('dl-verif', nombres),
      ro ? null : h('button', { class: 'btn-sec ancho', onclick: () => { art.riesgos.push({ secuencia: '', evento: '', controles: '', verificador: '' }); cambio(); } }, '+ Agregar paso'));
  },

  firmas() {
    const ev = evaluarContenido(art);
    const listo = !ev.faltan.length && !ev.detener.length;
    const cerrado = art.estado === 'cerrado';
    if (!listo && art.estado === 'borrador') {
      return seccion('Firmas de inicio',
        ev.detener.length ? h('div', { class: 'aviso aviso-detener', role: 'alert' }, h('b', {}, '⛔ NO INICIAR LA TAREA — dar aviso a su supervisión'), h('ul', {}, ev.detener.map(t => h('li', {}, t)))) : null,
        ev.faltan.length ? h('div', { class: 'aviso aviso-alerta' }, h('b', {}, 'Antes de firmar, complete:'), h('ul', {}, ev.faltan.map(t => h('li', {}, t)))) : null);
    }
    return seccion('Firmas de inicio',
      h('p', { class: 'nota' }, 'Todos los integrantes de la cuadrilla deben firmar para validar que las medidas de control de este ART son obligatorias. ',
        'Puede firmar con el dedo, escaneando el código QR del carnet, o con la credencial de faena.'),
      h('h3', {}, 'Supervisor responsable'),
      art.firmaSupervisor
        ? tarjetaFirma(art.firmaSupervisor, { onBorrar: cerrado ? null : () => { art.firmaSupervisor = null; revisarDesbloqueo(); cambio(); } })
        : h('button', { class: 'btn-firmar', onclick: async () => {
            const f = await firmar('Firma del supervisor responsable', S.DECLARACION_INICIO, { nombre: art.antecedentes.supervisor });
            if (f) { art.firmaSupervisor = f; cambio(); }
          } }, '✍ Firmar como supervisor'),
      h('h3', {}, `Trabajadores(as) al inicio (${art.firmasInicio.length})`),
      art.firmasInicio.map((f, i) => tarjetaFirma(f, { onBorrar: cerrado ? null : () => { art.firmasInicio.splice(i, 1); revisarDesbloqueo(); cambio(); } })),
      cerrado ? null : h('button', { class: 'btn-firmar', onclick: async () => {
        const f = await firmar('Firma de inicio — trabajador(a)', S.DECLARACION_INICIO, {});
        if (!f) return;
        if (art.firmasInicio.some(x => mismaPersona(x, f))) return toast(`${f.nombre} ya firmó al inicio`, 'error');
        art.firmasInicio.push(f); cambio();
      } }, '+ Agregar firma de trabajador(a)'),
      art.firmasInicio.length > 6 ? h('p', { class: 'nota' }, 'Más de 6 firmas: el PDF agrega una hoja adicional de firmas automáticamente.') : null,
      evaluarPaso(art, 'firmas').faltan.length ? null : h('div', { class: 'aviso aviso-ok' }, '✓ ART firmado. Puede iniciar la tarea. Al terminar, complete el paso "Cierre".'));
  },

  cierre() {
    if (art.estado === 'borrador') return seccion('Cierre', h('div', { class: 'aviso aviso-info' }, 'Primero complete las firmas de inicio.'));
    const cerrado = art.estado === 'cerrado';
    const pendientes = art.firmasInicio.filter(fi => !art.firmasTermino.some(ft => mismaPersona(fi, ft)));
    const firmarTermino = async (sug) => {
      const f = await firmar('Firma de término — trabajador(a)', S.DECLARACION_TERMINO, sug);
      if (!f) return;
      if (art.firmasTermino.some(x => mismaPersona(x, f))) return toast(`${f.nombre} ya firmó el término`, 'error');
      art.firmasTermino.push(f); cambio();
    };
    return seccion('Cierre: firmas al término de los trabajos',
      h('p', { class: 'nota' }, S.DECLARACION_TERMINO),
      art.firmasTermino.map((f, i) => tarjetaFirma(f, { onBorrar: cerrado ? null : () => { art.firmasTermino.splice(i, 1); cambio(); } })),
      cerrado ? null : pendientes.map(p => h('button', { class: 'btn-firmar', onclick: () => firmarTermino({ nombre: p.nombre, run: p.run }) }, `✍ Firmar término: ${p.nombre}`)),
      cerrado ? null : h('button', { class: 'btn-sec', onclick: () => firmarTermino({}) }, '+ Otro trabajador(a)'),
      cerrado
        ? h('div', { class: 'aviso aviso-ok' }, '✓ ART cerrado. Genere el PDF para archivarlo o enviarlo.', h('button', { class: 'btn-pri', onclick: exportarPdf }, 'Generar PDF'))
        : h('button', { class: 'btn-pri grande ancho', disabled: pendientes.length > 0, onclick: () => {
            if (!confirm('¿Cerrar el ART? Ya no se podrán agregar ni quitar firmas.')) return;
            art.estado = 'cerrado'; art.cerrado = new Date().toISOString(); cambio(); toast('ART cerrado', 'ok');
          } }, pendientes.length ? `Faltan ${pendientes.length} firma(s) de término` : 'Cerrar ART'));
  },
};

/* ---------------- Hoja de verificación de controles críticos ---------------- */
function hojaControl(id) {
  const est = S.ESTRATEGIAS.find(e => e.id === id);
  const hoja = S.HOJAS_CC[id];
  if (!hoja) {
    return h('section', { class: 'seccion hoja hoja-papel' },
      h('h2', {}, est.nombre),
      h('p', { class: 'nota' }, 'Esta hoja de verificación aún no está digitalizada. Respóndala en papel y confírmelo aquí.'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!art.hojasPapel[id], disabled: bloqueado(), onchange: e => { art.hojasPapel[id] = e.target.checked; cambio(); } }),
        h('span', {}, 'Respondí la hoja de verificación de controles críticos en papel')));
  }
  const datos = art.cc[id] || (art.cc[id] = { r: {}, verificadores: [] });
  return h('section', { class: 'seccion hoja' },
    h('h2', {}, `Hoja de verificación: ${hoja.titulo}`, h('small', {}, ` · ${hoja.rol} · cada vez`)),
    hoja.controles.map(c => h('div', { class: 'control' },
      h('div', { class: 'control-tit' }, h('b', {}, c.codigo), ' ', c.nombre),
      h('div', { class: 'control-grupo' }, c.grupo),
      c.preguntas.map(p => siNo({ id: p.id, texto: p.texto, store: datos.r, detenerSi: 'NO' })))),
    h('h3', {}, 'Verificador del control'),
    datos.verificadores.map((f, i) => tarjetaFirma(f, { onBorrar: bloqueado() ? null : () => { datos.verificadores.splice(i, 1); cambio(); } })),
    bloqueado() || datos.verificadores.length >= 5 ? null : h('button', { class: 'btn-firmar', onclick: async () => {
      const f = await pedirFirma({ titulo: `Verificador: ${hoja.titulo}`, declaracion: 'Declaro haber verificado los controles críticos de esta hoja.' });
      if (f) { datos.verificadores.push(f); cambio(); }
    } }, '✍ Firmar como verificador'));
}

/* ---------------- Firmar (bloquea el contenido en la primera firma) ---------------- */
async function firmar(titulo, declaracion, sugerido) {
  if (art.estado === 'borrador') {
    const ev = evaluarContenido(art);
    if (ev.faltan.length || ev.detener.length) { toast('Complete el ART antes de firmar', 'error'); return null; }
  }
  const f = await pedirFirma({ titulo, declaracion, sugerido });
  if (!f) return null;
  if (art.estado === 'borrador') {
    art.huellaContenido = await huellaContenido(art);
    art.estado = 'en_ejecucion';
    toast('Contenido del ART bloqueado con la primera firma');
  }
  f.huella = art.huellaContenido;
  return f;
}
function revisarDesbloqueo() {
  if (art.estado === 'en_ejecucion' && !art.firmaSupervisor && !art.firmasInicio.length && !art.firmasTermino.length) {
    art.estado = 'borrador'; art.huellaContenido = null;
    toast('Sin firmas: el ART vuelve a borrador y se puede editar');
  }
}

/* ---------------- PDF ---------------- */
async function exportarPdf() {
  const btn = document.querySelector('.btn-pdf');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    const huella = art.huellaContenido || await huellaContenido(art);
    const bytes = await generarPdf(art, { huella });
    const slug = (art.antecedentes.descripcion || 'tarea').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    const nombre = `ART_${art.antecedentes.fecha}_${slug}${art.estado === 'borrador' ? '_BORRADOR' : ''}.pdf`;
    const blob = new Blob([bytes], { type: 'application/pdf' });
    mostrarPdf(blob, nombre);
  } catch (e) {
    console.error(e);
    toast('No se pudo generar el PDF: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'PDF'; }
  }
}
function mostrarPdf(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const archivo = new File([blob], nombre, { type: 'application/pdf' });
  const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [archivo] }));
  const dlg = h('dialog', { class: 'dlg-pdf' },
    h('h2', {}, 'PDF listo'),
    h('p', {}, nombre),
    art.estado === 'borrador' ? h('p', { class: 'nota' }, 'Es un borrador (sin firmas): lleva la marca de agua BORRADOR.') : null,
    h('div', { class: 'dlg-acc' },
      puedeCompartir ? h('button', { class: 'btn-pri', onclick: async () => { try { await navigator.share({ files: [archivo], title: nombre }); } catch { /* cancelado */ } } }, 'Compartir (WhatsApp, correo…)') : null,
      h('a', { class: puedeCompartir ? 'btn-sec' : 'btn-pri', href: url, download: nombre }, 'Descargar'),
      h('a', { class: 'btn-sec', href: url, target: '_blank', rel: 'noopener' }, 'Ver'),
      h('button', { class: 'btn-txt', onclick: () => dlg.close() }, 'Cerrar')));
  dlg.addEventListener('close', () => { dlg.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); });
  document.body.appendChild(dlg);
  dlg.showModal();
}

/* ---------------- Inicio ---------------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(e => console.warn('SW', e));
  // Cuando se instala una versión nueva, recargar una vez para usarla de inmediato
  // (solo si ya había una versión anterior controlando la página).
  if (navigator.serviceWorker.controller) {
    let recargado = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recargado) { recargado = true; location.reload(); } });
  }
}
if (location.protocol === 'file:') {
  document.body.prepend(h('div', { class: 'aviso aviso-alerta', style: 'margin:0;border-radius:0' }, 'Abra la app desde un servidor (GitHub Pages o "python -m http.server"): desde file:// no se pueden cargar las plantillas PDF ni usar la cámara.'));
}
render();
