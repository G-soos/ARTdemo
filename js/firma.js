// Firma e identificación: firma manuscrita en pantalla, escaneo del carnet de identidad
// chileno (QR o PDF417) o de una credencial de faena (QR / código de barras).
import { buscarPersona, recordarPersona, nombresConocidos, uid } from './store.js';
import { h, esc } from './dom.js';

/* ---------------- RUN chileno ---------------- */
export function dvRun(num) {
  let s = 0, m = 2;
  for (let i = num.length - 1; i >= 0; i--) { s += +num[i] * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (s % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}
export function normalizarRun(txt) {
  const m = String(txt || '').toUpperCase().replace(/[.\s]/g, '').match(/^(\d{6,8})-?([\dK])$/);
  if (!m) return null;
  return dvRun(m[1]) === m[2] ? `${m[1]}-${m[2]}` : null;
}
export function formatearRun(run) {
  if (!run) return '';
  const [n, d] = run.split('-');
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + d;
}

/* ---------------- Interpretar el código escaneado ---------------- */
// Cédula chilena (desde 2013): el QR del reverso es una URL del Registro Civil, p. ej.
// https://portal.sidiv.registrocivil.cl/docstatus?RUN=12345678-5&type=CEDULA&serial=123456789&mrz=...
// Cédula antigua: PDF417 cuyos primeros caracteres son el RUN con su dígito verificador.
export function interpretarCodigo(raw) {
  const txt = String(raw || '').trim();
  try {
    const u = new URL(txt);
    if (/registrocivil\.cl$/i.test(u.hostname)) {
      return { tipo: 'carnet', run: normalizarRun(u.searchParams.get('RUN')), serie: u.searchParams.get('serial') || '', docTipo: u.searchParams.get('type') || 'CEDULA' };
    }
  } catch { /* no es URL */ }
  for (const m of txt.toUpperCase().matchAll(/(\d{1,2}\.?\d{3}\.?\d{3})\s*-\s*([\dK])/g)) {
    const r = normalizarRun(m[1] + '-' + m[2]);
    if (r) return { tipo: 'documento', run: r, raw: txt };
  }
  const m = txt.toUpperCase().match(/^(\d{7,8})([\dK])/);
  if (m) { const r = normalizarRun(m[1] + '-' + m[2]); if (r) return { tipo: 'carnet', run: r, serie: '', docTipo: 'CEDULA (antigua)' }; }
  return { tipo: 'credencial', run: null, raw: txt };
}

/* ---------------- Firma manuscrita ---------------- */
// Guarda los trazos como puntos: así se pueden redibujar si el lienzo cambia de tamaño
// (por ejemplo al girar el teléfono) y exportar la firma nítida a cualquier escala.
class PadFirma {
  constructor(canvas, { grosor = 2.6 } = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.grosor = grosor;
    this.trazos = []; this.dibujando = false; this.w = 0; this.h = 0;
    canvas.addEventListener('pointerdown', e => this.inicio(e));
    canvas.addEventListener('pointermove', e => this.mover(e));
    ['pointerup', 'pointercancel'].forEach(t => canvas.addEventListener(t, () => { this.dibujando = false; }));
  }
  ajustar() {
    const r = this.c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    const [ow, oh] = [this.w, this.h];
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ow && oh && this.trazos.length && (ow !== this.w || oh !== this.h)) {
      const k = Math.min(this.w / ow, this.h / oh);
      this.trazos = this.trazos.map(t => t.map(p => ({ x: p.x * k, y: p.y * k })));
    }
    this.redibujar();
  }
  estilo(ctx, grosor) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f3a'; ctx.fillStyle = '#0b1f3a'; ctx.lineWidth = grosor; }
  pintar(ctx, trazos, grosor, dx = 0, dy = 0, k = 1) {
    this.estilo(ctx, grosor);
    for (const t of trazos) {
      if (t.length === 1) { ctx.beginPath(); ctx.arc((t[0].x - dx) * k, (t[0].y - dy) * k, grosor / 2, 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo((t[0].x - dx) * k, (t[0].y - dy) * k);
      for (let i = 1; i < t.length; i++) ctx.lineTo((t[i].x - dx) * k, (t[i].y - dy) * k);
      ctx.stroke();
    }
  }
  redibujar() { this.ctx.clearRect(0, 0, this.w, this.h); this.pintar(this.ctx, this.trazos, this.grosor); }
  pos(e) { const r = this.c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  inicio(e) {
    e.preventDefault(); this.c.setPointerCapture?.(e.pointerId);
    this.dibujando = true; this.trazos.push([this.pos(e)]);
  }
  mover(e) {
    if (!this.dibujando) return;
    const t = this.trazos[this.trazos.length - 1];
    this.estilo(this.ctx, this.grosor);
    for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
      const p = this.pos(ev), u = t[t.length - 1];
      this.ctx.beginPath(); this.ctx.moveTo(u.x, u.y); this.ctx.lineTo(p.x, p.y); this.ctx.stroke();
      t.push(p);
    }
  }
  borrar() { this.trazos = []; this.redibujar(); }
  get tinta() { return this.trazos.some(t => t.length > 3); }
  // PNG recortado al trazo, fondo transparente, ~120 px de alto (liviano para guardar y para el PDF)
  png() {
    if (!this.tinta) return null;
    const pts = this.trazos.flat();
    const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x));
    const y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const margen = this.grosor * 2;
    const bw = x1 - x0 + margen * 2, bh = y1 - y0 + margen * 2;
    const k = Math.min(3, 120 / bh, 600 / bw);
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(bw * k)); t.height = Math.max(1, Math.round(bh * k));
    this.pintar(t.getContext('2d'), this.trazos, Math.max(2, this.grosor * k), x0 - margen, y0 - margen, k);
    return t.toDataURL('image/png');
  }
}

// Lienzo a pantalla completa para firmar cómodo en el celular. Devuelve el PNG o null.
async function lienzoGrande(contenedor) {
  const cv = h('canvas', { class: 'lienzo-canvas' });
  let pad, resolver;
  const fin = new Promise(r => { resolver = r; });
  const ov = h('div', { class: 'lienzo', role: 'dialog', 'aria-label': 'Firmar' },
    h('div', { class: 'lienzo-top' },
      h('b', {}, 'Firme dentro del recuadro'),
      h('small', { class: 'lienzo-giro' }, '↻ Gire el teléfono para tener más espacio')),
    h('div', { class: 'lienzo-area' }, cv, h('span', { class: 'lienzo-linea' }), h('span', { class: 'lienzo-x' }, '✕')),
    h('div', { class: 'lienzo-acc' },
      h('button', { type: 'button', class: 'btn-sec', onclick: () => pad.borrar() }, 'Borrar'),
      h('button', { type: 'button', class: 'btn-txt', onclick: () => cerrar(false) }, 'Cancelar'),
      h('button', { type: 'button', class: 'btn-pri', onclick: () => cerrar(true) }, 'Listo')));
  contenedor.appendChild(ov);
  // Capa fija a pantalla completa, sin forzar fullscreen ni rotación (en algunos Android dejaba el lienzo congelado).
  // El lienzo se reajusta cada vez que cambia de tamaño (p. ej. al girar el teléfono) sin perder el trazo.
  pad = new PadFirma(cv, { grosor: 3.2 });
  const ajustar = () => requestAnimationFrame(() => pad.ajustar());
  const obs = 'ResizeObserver' in window ? new ResizeObserver(ajustar) : null;
  if (obs) obs.observe(cv); else window.addEventListener('resize', ajustar);
  ajustar();

  async function cerrar(ok) {
    if (ok && !pad.tinta) { ov.querySelector('.lienzo-top b').textContent = 'Firme antes de presionar Listo'; return; }
    const img = ok ? pad.png() : null;
    if (obs) obs.disconnect(); else window.removeEventListener('resize', ajustar);
    ov.remove();
    resolver(img);
  }
  return fin;
}

/* ---------------- Lector de códigos ---------------- */
function crearLector(idElemento) {
  const lib = window.__Html5QrcodeLibrary__;
  if (!lib) throw new Error('Lector de códigos no disponible');
  const F = lib.Html5QrcodeSupportedFormats;
  return new lib.Html5Qrcode(idElemento, {
    formatsToSupport: [F.QR_CODE, F.PDF_417, F.CODE_128, F.CODE_39],
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    verbose: false,
  });
}

// Lee el código de una foto. Usa el detector nativo del teléfono si existe (Android Chrome),
// que es más robusto con fotos grandes; si no, la librería.
async function leerFoto(archivo, lector) {
  if ('BarcodeDetector' in window) {
    try {
      const bd = new window.BarcodeDetector({ formats: ['qr_code', 'pdf417', 'code_128', 'code_39'] });
      const res = await bd.detect(await createImageBitmap(archivo));
      if (res[0]?.rawValue) return res[0].rawValue;
    } catch { /* sin soporte: seguimos con la librería */ }
  }
  return lector.scanFile(archivo, false);
}

/* ---------------- Diálogo de firma ---------------- */
// Devuelve una Promise con la firma o null si se cancela.
// Firma = { id, nombre, run, metodos:[], img, documento, ts }
export function pedirFirma({ titulo, declaracion = '', sugerido = {} }) {
  return new Promise(resolve => {
    const idLector = 'lector-' + uid().slice(0, 8);
    const movil = window.matchMedia('(pointer: coarse)').matches;
    let identidad = null;   // resultado del escaneo
    let lector = null;
    let escaneando = false;
    let modoFoto = 'auto';
    let firmaImg = null;    // firma hecha en el lienzo grande (móvil)

    const nombre = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Nombre y apellido', value: sugerido.nombre || '', list: 'dl-nombres' });
    const run = h('input', { type: 'text', inputmode: 'text', placeholder: '12.345.678-9', value: sugerido.run ? formatearRun(sugerido.run) : '' });
    const runAviso = h('small', { class: 'campo-aviso' });
    const chip = h('div', { class: 'id-chip oculto' });
    const zonaLector = h('div', { class: 'lector oculto' }, h('div', { id: idLector, class: 'lector-video' }), h('p', { class: 'lector-ayuda' }, 'Apunte al código QR o de barras y manténgalo quieto.'));
    const archivo = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto' });
    const dl = h('datalist', { id: 'dl-nombres' }, ...nombresConocidos().map(n => h('option', { value: n })));
    const error = h('p', { class: 'dlg-error' });
    const leyendo = h('p', { class: 'lector-ayuda oculto' }, 'Leyendo el código…');

    const fotografiar = modo => { error.textContent = ''; modoFoto = modo; detenerLector(); archivo.click(); };
    const btnCarnet = h('button', { type: 'button', class: 'btn-id', onclick: () => fotografiar('carnet') }, h('span', { class: 'ico' }, '🪪'), h('span', {}, h('b', {}, 'Carnet'), h('small', {}, 'Foto al QR del reverso')));
    const btnCred = h('button', { type: 'button', class: 'btn-id', onclick: () => fotografiar('credencial') }, h('span', { class: 'ico' }, '🏷️'), h('span', {}, h('b', {}, 'Credencial'), h('small', {}, 'Foto al código de la credencial')));
    const btnVivo = h('button', { type: 'button', class: 'btn-link', onclick: () => escanear() }, 'o escanear en vivo con la cámara');

    // Zona de firma: en celular, una vista previa que abre el lienzo grande; en PC, el lienzo directo.
    let pad = null, zonaFirma;
    const vista = h('button', { type: 'button', class: 'pad-vista', onclick: async () => {
      const img = await lienzoGrande(dlg);
      if (img) { firmaImg = img; pintarVista(); }
    } });
    const pintarVista = () => vista.replaceChildren(firmaImg
      ? h('img', { src: firmaImg, alt: 'Firma' })
      : h('span', { class: 'pad-vista-txt' }, h('span', { class: 'ico' }, '✍️'), 'Toca aquí para firmar'),
      firmaImg ? h('small', {}, 'Toca para firmar de nuevo') : null);
    if (movil) { pintarVista(); zonaFirma = vista; }
    else {
      const canvas = h('canvas', { class: 'pad' });
      zonaFirma = h('div', { class: 'pad-wrap' }, canvas, h('span', { class: 'pad-linea' }), h('button', { type: 'button', class: 'btn-sec pad-borrar', onclick: () => pad.borrar() }, 'Borrar'));
      pad = new PadFirma(canvas);
    }

    const dlg = h('dialog', { class: 'dlg-firma' },
      h('form', { method: 'dialog', onsubmit: e => e.preventDefault() },
        h('header', {}, h('h2', {}, titulo), h('button', { type: 'button', class: 'x', 'aria-label': 'Cerrar', onclick: () => cerrar(null) }, '×')),
        h('div', { class: 'dlg-cuerpo' },
          declaracion ? h('p', { class: 'declaracion' }, declaracion) : null,
          h('section', {},
            h('h3', {}, '1. Identificación ', h('small', {}, '(opcional si firma a mano)')),
            h('div', { class: 'ids' }, btnCarnet, btnCred),
            btnVivo, zonaLector, leyendo, archivo, chip,
            h('div', { class: 'fila2' },
              h('label', {}, 'Nombre', nombre),
              h('label', {}, 'RUN', run, runAviso)),
            dl),
          h('section', {},
            h('h3', {}, '2. Firma manuscrita ', h('small', {}, '(opcional si leyó carnet o credencial)')),
            zonaFirma),
          error),
        h('footer', {},
          h('button', { type: 'button', class: 'btn-sec', onclick: () => cerrar(null) }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn-pri', onclick: confirmar }, 'Confirmar firma'))));

    document.body.appendChild(dlg);
    dlg.addEventListener('cancel', e => { e.preventDefault(); if (!dlg.querySelector('.lienzo')) cerrar(null); });
    dlg.showModal();
    if (pad) requestAnimationFrame(() => pad.ajustar());

    run.addEventListener('blur', () => {
      if (!run.value.trim()) { runAviso.textContent = ''; return; }
      const n = normalizarRun(run.value);
      runAviso.textContent = n ? '' : 'RUN inválido (revise el dígito verificador)';
      if (n) { run.value = formatearRun(n); const p = buscarPersona({ run: n }); if (p && !nombre.value.trim()) nombre.value = p.nombre; }
    });

    archivo.addEventListener('change', async () => {
      const f = archivo.files[0]; if (!f) return;
      leyendo.classList.remove('oculto');
      try {
        lector = lector || crearLector(idLector);
        procesar(await leerFoto(f, lector), modoFoto);
      } catch (e) {
        console.warn(e);
        error.textContent = modoFoto === 'carnet'
          ? 'No se pudo leer el QR. Saque la foto de cerca al código del reverso, con buena luz y sin reflejos.'
          : 'No se pudo leer el código. Acérquese más, con buena luz y sin reflejos.';
      } finally { archivo.value = ''; leyendo.classList.add('oculto'); }
    });

    async function escanear() {
      error.textContent = '';
      if (escaneando) { await detenerLector(); return; }
      zonaLector.classList.remove('oculto');
      btnVivo.textContent = 'Detener cámara';
      try {
        lector = lector || crearLector(idLector);
        escaneando = true;
        // Sin recuadro (se analiza la imagen completa) y en alta resolución: el QR de la cédula es denso.
        await lector.start({ facingMode: 'environment' }, {
          fps: 10,
          videoConstraints: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] },
        }, txt => { detenerLector(); procesar(txt, 'auto'); }, () => {});
      } catch (e) {
        console.warn(e);
        await detenerLector();
        error.textContent = location.protocol === 'https:' || location.hostname === 'localhost'
          ? 'No se pudo abrir la cámara en vivo. Use los botones Carnet / Credencial (foto).'
          : 'La cámara solo funciona en https:// o localhost.';
      }
    }

    async function detenerLector() {
      if (lector && escaneando) { try { await lector.stop(); } catch { /* ya detenido */ } }
      escaneando = false;
      zonaLector.classList.add('oculto');
      btnVivo.textContent = 'o escanear en vivo con la cámara';
    }

    function procesar(txt, modo) {
      navigator.vibrate?.(80);
      const info = interpretarCodigo(txt);
      identidad = { ...info, modo };
      const conocido = buscarPersona({ run: info.run, credencial: info.tipo === 'credencial' ? info.raw : null });
      if (info.run) run.value = formatearRun(info.run);
      else if (conocido) run.value = formatearRun(conocido.run);
      if (conocido && !nombre.value.trim()) nombre.value = conocido.nombre;

      let texto;
      if (info.tipo === 'carnet') texto = `🪪 Cédula leída · RUN ${formatearRun(info.run)}${info.serie ? ' · N° documento ' + esc(info.serie) : ''}`;
      else if (info.tipo === 'documento') texto = `🏷️ Credencial con RUN ${formatearRun(info.run)}`;
      else texto = conocido ? `🏷️ Credencial reconocida (${esc(conocido.nombre)})` : '🏷️ Credencial leída. Primera vez: ingrese nombre y RUN, se recordarán para la próxima.';
      if (modo === 'carnet' && info.tipo === 'credencial') texto = '⚠️ No parece una cédula chilena; se registró como credencial. ' + (conocido ? '' : 'Ingrese nombre y RUN.');
      chip.innerHTML = texto;
      chip.classList.remove('oculto');
      if (!nombre.value.trim()) nombre.focus();
    }

    function confirmar() {
      error.textContent = '';
      const n = nombre.value.trim();
      const r = run.value.trim() ? normalizarRun(run.value) : null;
      if (!n) { error.textContent = 'Ingrese el nombre.'; nombre.focus(); return; }
      if (run.value.trim() && !r) { error.textContent = 'El RUN no es válido.'; run.focus(); return; }
      const img = pad ? pad.png() : firmaImg;
      if (!img && !identidad) { error.textContent = 'Firme o lea su carnet / credencial.'; return; }
      if (identidad && identidad.run && r && identidad.run !== r) { error.textContent = 'El RUN escrito no coincide con el documento leído.'; return; }
      if (identidad && !r) { error.textContent = 'Ingrese el RUN para asociarlo al documento leído.'; run.focus(); return; }

      const metodos = [];
      if (identidad) metodos.push(identidad.tipo === 'carnet' ? 'carnet' : 'credencial');
      if (img) metodos.push('dibujo');
      const documento = identidad ? (identidad.tipo === 'carnet'
        ? { tipo: identidad.docTipo || 'CEDULA', serie: identidad.serie || '' }
        : { tipo: 'credencial', codigo: identidad.raw || '' }) : null;
      if (r) recordarPersona({ run: r, nombre: n, credencial: identidad && identidad.tipo !== 'carnet' ? identidad.raw : null });
      cerrar({ id: uid(), nombre: n, run: r, metodos, img, documento, ts: new Date().toISOString() });
    }

    async function cerrar(valor) {
      await detenerLector();
      try { lector?.clear?.(); } catch { /* nada */ }
      dlg.close(); dlg.remove();
      resolve(valor);
    }
  });
}

export function describirFirma(f) {
  if (!f) return '';
  const partes = [];
  if (f.metodos.includes('carnet')) partes.push('Cédula' + (f.documento?.serie ? ' N° ' + f.documento.serie : ''));
  if (f.metodos.includes('credencial')) partes.push('Credencial');
  if (f.metodos.includes('dibujo')) partes.push('Firma manuscrita');
  return partes.join(' + ');
}
