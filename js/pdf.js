// Genera el PDF escribiendo sobre los formularios oficiales (plantillas/), de modo que el
// resultado es el mismo ART de papel, pero lleno. Coordenadas en puntos, origen arriba-izquierda
// (se convierten al sistema de PDF, origen abajo-izquierda, al dibujar).
import { PLANTILLA_ART, HOJAS_CC, ESTRATEGIAS, PREGUNTAS_12, PREGUNTAS_21 } from './schema.js';
import { formatearRun, describirFirma } from './firma.js';
import { filaRiesgoVacia } from './rules.js';

const L = () => window.PDFLib;
const tinta = () => L().rgb(0.05, 0.13, 0.42);
const gris = () => L().rgb(0.35, 0.38, 0.45);

/* ---------------- Mapa de coordenadas: ART VERS. 4 (carta 612x792) ---------------- */
const ART = {
  empresa: [134, 80, 324, 17.4],
  fechaD: [494, 80, 20, 17.4], fechaM: [519, 80, 23, 17.4], fechaA: [547, 80, 40, 17.4],
  descripcion: [34, 110, 312, 38.5],
  horaInicio: [416, 97.4, 44, 17.2], horaTermino: [541, 97.4, 47, 17.2],
  area: [423, 114.6, 165, 17.2], lugar: [424, 131.8, 164, 17.1],
  supervisor: [242, 148.9, 216, 17.1], firmaSup: [492, 148.9, 94, 17.1],
  docCual: [100, 382.5, 405, 12],
  otrosCual: [362, 731, 192, 12],
  si12: [520.6, 532], no12: [557.4, 568.8], filas12: [193.8, 207.8, 226.2, 244.7, 258.8, 273.0],
  si13: [520.3, 531.6], no13: [557.2, 568.4], filas13: { p13_1: 339.0, p13_2: 379.2, p13_3: 407.4 },
  siB: [511.6, 522.8], noB: [557.2, 568.4], filasB: { p13_5: 613.2, p13_6: 644.3, p13_6b: 746.3 },
  altoBox: 11.4,
  permIzq: [278.8, 290.2], permDer: [557.2, 568.4], filasPerm: [659.8, 673.9, 688.2, 702.4, 716.5, 730.7],
  estX: [128.5, 238.7, 349.0, 459.1, 569.9], estW: 8.4, estY: [446.4, 471.8, 497.5, 522.6, 548.5, 574.9], estH: 17,
  // página 2
  si21: [474.5, 485.9], no21: [508, 519.2], filas21: [299.8, 314.0, 332.5, 355.2], alto21: 11.2,
  firmas: { y0: 124.8, paso: 17.43, n: 6, iniNom: [30, 184], iniFir: [216, 86], terNom: [308, 187], terFir: [498, 85] },
  cols: [[28, 155.4], [155.4, 319.8], [319.8, 428.3], [428.3, 584.2]],
  riesgosP2: { y0: 480.6, paso: 21.26, n: 11 },
  riesgosP3: { y0: 153.7, paso: 50.9, n: 11 },
};
const PERM_IZQ = ['ingreso', 'caliente', 'confinados', 'aislacion', 'energizado', 'izaje'];
const PERM_DER = ['retiro_piso', 'altura', 'lineas_electricas', 'radioactivos', 'otros'];

/* ---------------- Mapa: hoja de controles críticos MMC (horizontal 792x612) ---------------- */
const MMC = {
  si: [579.9, 596.5], no: [600.1, 616.7], alto: 13.6,
  p0: { cc1_1: 218.7, cc1_2: 263.7, cc1_3: 308.7, cc2_1: 398.7, cc2_2: 434.7, cc2_3: 470.7 },
  p1: { cc3_1: 47.7, cc3_2: 83.7 },
  lineas: [512, 530, 548, 566, 584],
  verNom: [29, 174], verFir: [222, 178],
  ident: { x: 455, w: 308, gerencia: 512, empresa: 530, area: 548, fecha: 566, hora: 584 },
};

/* ---------------- Utilidades de dibujo ---------------- */
// Helvetica estándar usa WinAnsi: se reemplazan caracteres que no puede codificar.
function limpiar(s) {
  return String(s ?? '').replace(/[“”«»]/g, '"').replace(/[‘’´]/g, "'").replace(/[–—]/g, '-')
    .replace(/…/g, '...').replace(/\t/g, ' ').replace(/\r/g, '').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
}
function envolver(font, s, w, sz) {
  const out = [];
  for (const par of s.split('\n')) {
    let linea = '';
    for (let pal of par.split(/\s+/)) {
      if (!pal) continue;
      while (font.widthOfTextAtSize(pal, sz) > w) { // palabra más larga que la celda
        let i = pal.length; while (i > 1 && font.widthOfTextAtSize(pal.slice(0, i), sz) > w) i--;
        if (linea) { out.push(linea); linea = ''; }
        out.push(pal.slice(0, i)); pal = pal.slice(i);
      }
      const prueba = linea ? linea + ' ' + pal : pal;
      if (font.widthOfTextAtSize(prueba, sz) <= w) linea = prueba; else { if (linea) out.push(linea); linea = pal; }
    }
    out.push(linea);
  }
  while (out.length > 1 && !out[out.length - 1]) out.pop();
  return out;
}
function recortar(font, s, w, sz) {
  if (font.widthOfTextAtSize(s, sz) <= w) return s;
  while (s.length > 1 && font.widthOfTextAtSize(s + '...', sz) > w) s = s.slice(0, -1);
  return s + '...';
}

function crearPintor(page, font, bold) {
  const H = page.getHeight();
  const P = {
    // Texto en una caja [x, yTop, w, h]; achica la letra hasta que quepa.
    texto(s, [x, y, w, hh], { size = 8.5, min = 5, multi = false, centrar = false, f = font, color = tinta(), pad = 1.5 } = {}) {
      s = limpiar(s).trim(); if (!s) return;
      const W = w - pad * 2, HH = hh - pad * 2;
      let sz = size, lineas;
      for (; sz >= min; sz -= 0.25) {
        lineas = multi ? envolver(f, s, W, sz) : [s.replace(/\n/g, ' ')];
        if (multi ? lineas.length * sz * 1.18 <= HH : f.widthOfTextAtSize(lineas[0], sz) <= W) break;
      }
      if (sz < min) {
        sz = min;
        if (multi) {
          lineas = envolver(f, s, W, sz);
          const max = Math.max(1, Math.floor(HH / (sz * 1.18)));
          if (lineas.length > max) { lineas = lineas.slice(0, max); lineas[max - 1] = recortar(f, lineas[max - 1] + ' ', W, sz); }
        } else lineas = [recortar(f, s.replace(/\n/g, ' '), W, sz)];
      }
      const lh = sz * 1.18;
      const bloque = lineas.length * lh;
      const y0 = multi ? y + pad + Math.max(0, (HH - bloque) / 2) : y + hh / 2 - lh / 2;
      lineas.forEach((ln, i) => {
        const tw = f.widthOfTextAtSize(ln, sz);
        page.drawText(ln, { x: centrar ? x + (w - tw) / 2 : x + pad, y: H - (y0 + i * lh + sz * 0.88), size: sz, font: f, color });
      });
    },
    cruz([x0, x1], y0, alto) {
      const p = 2.2, y1 = y0 + alto;
      page.drawLine({ start: { x: x0 + p, y: H - (y0 + p) }, end: { x: x1 - p, y: H - (y1 - p) }, thickness: 1.7, color: tinta() });
      page.drawLine({ start: { x: x0 + p, y: H - (y1 - p) }, end: { x: x1 - p, y: H - (y0 + p) }, thickness: 1.7, color: tinta() });
    },
    siNo(valor, si, no, y0, alto) { if (valor === 'SI') P.cruz(si, y0, alto); else if (valor === 'NO') P.cruz(no, y0, alto); },
    ovalo([x0, x1], y0, alto) {
      page.drawEllipse({ x: (x0 + x1) / 2, y: H - (y0 + alto / 2), xScale: (x1 - x0) / 2 + 3, yScale: alto / 2 + 3, borderColor: tinta(), borderWidth: 1.8 });
    },
    async firma(doc, f, [x, y, w, hh], cache) {
      if (!f) return;
      if (f.img) {
        let img = cache.get(f.id);
        if (!img) { img = await doc.embedPng(f.img); cache.set(f.id, img); }
        const esc = Math.min((w - 4) / img.width, (hh - 2) / img.height);
        const iw = img.width * esc, ih = img.height * esc;
        page.drawImage(img, { x: x + (w - iw) / 2, y: H - (y + (hh + ih) / 2), width: iw, height: ih });
      } else {
        const hora = new Date(f.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
        P.texto(`[${f.metodos.includes('carnet') ? 'Cédula' : 'Credencial'}] ${f.run ? formatearRun(f.run) : ''} ${hora}`, [x, y, w, hh], { size: 6.5, min: 4.5, f: bold });
      }
    },
    marcaAgua(txt) {
      page.drawText(txt, { x: page.getWidth() * 0.16, y: H * 0.3, size: 74, font: bold, color: L().rgb(0.85, 0.1, 0.12), opacity: 0.13, rotate: L().degrees(35) });
    },
    pie(txt) {
      const t = limpiar(txt), w = font.widthOfTextAtSize(t, 5.5);
      page.drawRectangle({ x: 27, y: 3.5, width: w + 6, height: 8.5, color: L().rgb(1, 1, 1), opacity: 0.85 });
      page.drawText(t, { x: 30, y: 6, size: 5.5, font, color: gris() });
    },
  };
  return P;
}

const cacheBytes = new Map();
async function cargar(url) {
  if (!cacheBytes.has(url)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('No se encontró la plantilla ' + url);
    cacheBytes.set(url, await r.arrayBuffer());
  }
  return cacheBytes.get(url);
}

function fechaPartes(iso) { const [a, m, d] = (iso || '').split('-'); return { d: d || '', m: m || '', a: a || '' }; }
const fmtFechaHora = iso => new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

/* ---------------- Generación ---------------- */
export async function generarPdf(art, { huella } = {}) {
  const { PDFDocument, StandardFonts } = L();
  const out = await PDFDocument.create();
  out.setTitle(`ART ${art.folio} - ${art.antecedentes.descripcion.slice(0, 60)}`);
  out.setSubject('Análisis de Riesgos de la Tarea');
  out.setProducer('ART digital');
  out.setCreationDate(new Date());
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const cacheImg = new Map();
  const tpl = await PDFDocument.load(await cargar(PLANTILLA_ART));
  const a = art.antecedentes, r = art.r;
  const borrador = art.estado === 'borrador';
  const pieTxt = `ART digital · Folio ${art.folio} · Generado ${fmtFechaHora(new Date().toISOString())}${huella ? ' · Huella ' + huella.slice(0, 16) : ''}`;

  /* ---- Página 1 ---- */
  const [p1] = await out.copyPages(tpl, [0]); out.addPage(p1);
  const d1 = crearPintor(p1, font, bold);
  d1.texto(a.empresa, ART.empresa);
  const f = fechaPartes(a.fecha);
  d1.texto(f.d, ART.fechaD, { centrar: true }); d1.texto(f.m, ART.fechaM, { centrar: true }); d1.texto(f.a, ART.fechaA, { centrar: true });
  d1.texto(a.descripcion, ART.descripcion, { multi: true, size: 8.5 });
  d1.texto(a.horaInicio, ART.horaInicio); d1.texto(a.horaTermino, ART.horaTermino);
  d1.texto(a.area, ART.area); d1.texto(a.lugar, ART.lugar);
  d1.texto(a.supervisor, ART.supervisor);
  await d1.firma(out, art.firmaSupervisor, ART.firmaSup, cacheImg);
  PREGUNTAS_12.forEach((p, i) => d1.siNo(r[p.id], ART.si12, ART.no12, ART.filas12[i], ART.altoBox));
  for (const [id, y] of Object.entries(ART.filas13)) d1.siNo(r[id], ART.si13, ART.no13, y, ART.altoBox);
  if (r.p13_2 === 'SI') d1.texto(art.docCual, ART.docCual, { size: 8 });
  art.estrategias.forEach(id => {
    const i = ESTRATEGIAS.findIndex(e => e.id === id); if (i < 0) return;
    const x = ART.estX[i % 5], y = ART.estY[Math.floor(i / 5)];
    d1.cruz([x, x + ART.estW], y + 2, ART.estH - 4);
  });
  for (const [id, y] of Object.entries(ART.filasB)) d1.siNo(r[id], ART.siB, ART.noB, y, ART.altoBox);
  if (r.p13_6 === 'SI') {
    art.permisos.forEach(id => {
      let i = PERM_IZQ.indexOf(id);
      if (i >= 0) return d1.cruz(ART.permIzq, ART.filasPerm[i], ART.altoBox);
      i = PERM_DER.indexOf(id);
      if (i >= 0) d1.cruz(ART.permDer, ART.filasPerm[i], ART.altoBox);
    });
    if (art.permisos.includes('otros')) d1.texto(art.otrosPermisoCual, ART.otrosCual, { size: 7.5 });
  }
  if (borrador) d1.marcaAgua('BORRADOR');
  d1.pie(pieTxt);

  /* ---- Página 2 ---- */
  const [p2] = await out.copyPages(tpl, [1]); out.addPage(p2);
  const d2 = crearPintor(p2, font, bold);
  const F = ART.firmas;
  for (let i = 0; i < F.n; i++) {
    const y = F.y0 + i * F.paso;
    const fi = art.firmasInicio[i], ft = art.firmasTermino[i];
    if (fi) { d2.texto(fi.nombre, [F.iniNom[0], y, F.iniNom[1], F.paso], { size: 8 }); await d2.firma(out, fi, [F.iniFir[0], y, F.iniFir[1], F.paso], cacheImg); }
    if (ft) { d2.texto(ft.nombre, [F.terNom[0], y, F.terNom[1], F.paso], { size: 8 }); await d2.firma(out, ft, [F.terFir[0], y, F.terFir[1], F.paso], cacheImg); }
  }
  if (r.p13_5 === 'SI') PREGUNTAS_21.forEach((p, i) => d2.siNo(r[p.id], ART.si21, ART.no21, ART.filas21[i], ART.alto21));
  const filas = art.riesgos.filter(x => !filaRiesgoVacia(x));
  const pintarFilas = (d, lista, cfg) => lista.forEach((fila, i) => {
    const y = cfg.y0 + i * cfg.paso;
    [fila.secuencia, fila.evento, fila.controles, fila.verificador].forEach((t, c) => {
      const [x0, x1] = ART.cols[c];
      d.texto(t, [x0 + 1, y, x1 - x0 - 2, cfg.paso], { multi: true, size: 7.5, min: 4.8 });
    });
  });
  pintarFilas(d2, filas.slice(0, ART.riesgosP2.n), ART.riesgosP2);
  if (borrador) d2.marcaAgua('BORRADOR');
  d2.pie(pieTxt);

  /* ---- Página 3 (continuación del análisis de riesgo), repetida si hace falta ---- */
  let resto = filas.slice(ART.riesgosP2.n);
  do {
    const [p3] = await out.copyPages(tpl, [2]); out.addPage(p3);
    const d3 = crearPintor(p3, font, bold);
    pintarFilas(d3, resto.slice(0, ART.riesgosP3.n), ART.riesgosP3);
    resto = resto.slice(ART.riesgosP3.n);
    if (borrador) d3.marcaAgua('BORRADOR');
    d3.pie(pieTxt);
  } while (resto.length);

  /* ---- Firmas adicionales (más de 6 trabajadores) ---- */
  const extraIni = art.firmasInicio.slice(F.n), extraTer = art.firmasTermino.slice(F.n);
  if (extraIni.length || extraTer.length) await paginaFirmasExtra(out, font, bold, extraIni, extraTer, cacheImg, pieTxt);

  /* ---- Hojas de verificación de controles críticos ---- */
  for (const id of art.estrategias) {
    const hoja = HOJAS_CC[id];
    if (hoja && id === 'mmc') await hojaMMC(out, font, bold, art, hoja, cacheImg, borrador, pieTxt);
  }

  /* ---- Registro de firmas electrónicas (trazabilidad) ---- */
  await paginaRegistro(out, font, bold, art, huella);

  return out.save();
}

async function hojaMMC(out, font, bold, art, hoja, cacheImg, borrador, pieTxt) {
  const tpl = await L().PDFDocument.load(await cargar(hoja.plantilla));
  const datos = art.cc.mmc || { r: {}, verificadores: [] };
  const [q0, q1] = await out.copyPages(tpl, [0, 1]);
  out.addPage(q0); out.addPage(q1);
  const d0 = crearPintor(q0, font, bold), d1 = crearPintor(q1, font, bold);
  const marcar = (d, mapa) => { for (const [id, y] of Object.entries(mapa)) { const v = datos.r[id]; if (v === 'SI') d.ovalo(MMC.si, y, MMC.alto); else if (v === 'NO') d.ovalo(MMC.no, y, MMC.alto); } };
  marcar(d0, MMC.p0); marcar(d1, MMC.p1);
  const lista = datos.verificadores || [];
  for (let i = 0; i < Math.min(lista.length, MMC.lineas.length); i++) {
    const y = MMC.lineas[i] - 13, v = lista[i];
    d1.texto(v.nombre + (v.run ? ' · ' + formatearRun(v.run) : ''), [MMC.verNom[0], y, MMC.verNom[1], 14], { size: 8 });
    await d1.firma(out, v, [MMC.verFir[0], y - 1, MMC.verFir[1], 15], cacheImg);
  }
  const a = art.antecedentes, I = MMC.ident;
  const fila = (txt, yl) => d1.texto(txt, [I.x, yl - 12, I.w, 11], { size: 8.5 });
  fila(a.gerencia, I.gerencia); fila(a.empresa, I.empresa); fila(`${a.area} - ${a.lugar}`, I.area);
  fila(a.fecha.split('-').reverse().join('/'), I.fecha); fila(`${a.horaInicio} a ${a.horaTermino}`, I.hora);
  if (borrador) { d0.marcaAgua('BORRADOR'); d1.marcaAgua('BORRADOR'); }
  d0.pie(pieTxt); d1.pie(pieTxt);
}

async function paginaFirmasExtra(out, font, bold, ini, ter, cacheImg, pieTxt) {
  const p = out.addPage([612, 792]);
  const d = crearPintor(p, font, bold);
  d.texto('ART - HOJA ADICIONAL DE FIRMAS DE TRABAJADORES(AS)', [30, 40, 552, 20], { size: 12, f: bold, color: L().rgb(0, 0.47, 0.54) });
  const H = 792, fila = 24;
  const tabla = async (titulo, lista, x) => {
    d.texto(titulo, [x, 75, 270, 16], { size: 8.5, f: bold });
    for (let i = 0; i < lista.length && i < 26; i++) {
      const y = 95 + i * fila;
      p.drawRectangle({ x, y: H - (y + fila), width: 270, height: fila, borderColor: gris(), borderWidth: 0.5 });
      p.drawLine({ start: { x: x + 165, y: H - y }, end: { x: x + 165, y: H - (y + fila) }, thickness: 0.5, color: gris() });
      d.texto(lista[i].nombre, [x + 2, y, 161, fila], { size: 8 });
      await d.firma(out, lista[i], [x + 166, y, 103, fila], cacheImg);
    }
  };
  await tabla('FIRMAR AL INICIO DE LOS TRABAJOS', ini, 30);
  await tabla('FIRMAR AL TÉRMINO DE LOS TRABAJOS', ter, 312);
  d.pie(pieTxt);
}

async function paginaRegistro(out, font, bold, art, huella) {
  const p = out.addPage([612, 792]);
  const d = crearPintor(p, font, bold);
  const H = 792;
  const negro = L().rgb(0.1, 0.1, 0.12);
  d.texto('REGISTRO DE FIRMAS ELECTRÓNICAS', [30, 34, 552, 20], { size: 13, f: bold, color: L().rgb(0, 0.47, 0.54) });
  d.texto(`Folio ${art.folio} · Estado: ${art.estado.replace('_', ' ').toUpperCase()} · ${art.antecedentes.descripcion}`, [30, 56, 552, 14], { size: 8, color: negro });
  d.texto(huella ? `Huella SHA-256 del contenido firmado: ${huella}` : 'Huella del contenido no disponible (requiere https).', [30, 70, 552, 12], { size: 7, color: gris() });

  const filas = [];
  if (art.firmaSupervisor) filas.push(['Supervisor responsable', art.firmaSupervisor]);
  art.firmasInicio.forEach(f => filas.push(['Trabajador(a) - inicio', f]));
  art.firmasTermino.forEach(f => filas.push(['Trabajador(a) - término', f]));
  Object.entries(art.cc).forEach(([id, v]) => (v.verificadores || []).forEach(f => filas.push([`Verificador ${ESTRATEGIAS.find(e => e.id === id)?.nombre || id}`, f])));

  const cols = [[30, 120, 'Rol'], [150, 130, 'Nombre'], [280, 70, 'RUN'], [350, 130, 'Método de firma'], [480, 102, 'Fecha y hora']];
  let y = 92;
  p.drawRectangle({ x: 30, y: H - (y + 14), width: 552, height: 14, color: L().rgb(0, 0.47, 0.54) });
  cols.forEach(([x, w, t]) => d.texto(t, [x + 2, y, w, 14], { size: 7.5, f: bold, color: L().rgb(1, 1, 1) }));
  y += 14;
  for (const [rol, f] of filas) {
    if (y > 740) break;
    p.drawLine({ start: { x: 30, y: H - (y + 16) }, end: { x: 582, y: H - (y + 16) }, thickness: 0.4, color: gris() });
    const vals = [rol, f.nombre, f.run ? formatearRun(f.run) : '-', describirFirma(f), fmtFechaHora(f.ts)];
    cols.forEach(([x, w], i) => d.texto(vals[i], [x + 2, y, w - 4, 16], { size: 7, min: 4.5, color: negro }));
    y += 16;
  }
  y += 14;
  const nota = 'Cada firma registra el método de identificación usado: lectura del código QR / PDF417 de la cédula de identidad (RUN y N° de documento), '
    + 'lectura de credencial, y/o firma manuscrita en pantalla, junto con la fecha y hora del dispositivo. La huella SHA-256 permite comprobar que el '
    + 'contenido del ART (etapas 1 y 2) no cambió después de las firmas de inicio. Si cambian las condiciones de la tarea, jornadas, entorno, equipos '
    + 'o integrantes iniciales, se debe confeccionar un nuevo ART.';
  d.texto(nota, [30, y, 552, 60], { multi: true, size: 7, color: gris() });
}

/* ---------------- Huella del contenido ---------------- */
// SHA-256 de todo lo que define la tarea (sin firmas). Requiere contexto seguro (https/localhost).
export async function huellaContenido(art) {
  if (!crypto.subtle) return null;
  const c = { folio: art.folio, antecedentes: art.antecedentes, r: art.r, docCual: art.docCual, estrategias: art.estrategias, hojasPapel: art.hojasPapel,
    cc: Object.fromEntries(Object.entries(art.cc).map(([k, v]) => [k, v.r])), permisos: art.permisos, otrosPermisoCual: art.otrosPermisoCual,
    riesgos: art.riesgos.filter(f => !filaRiesgoVacia(f)) };
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(c)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

