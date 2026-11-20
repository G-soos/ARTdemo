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
class PadFirma {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.dibujando = false; this.tinta = false;
    this.box = null;
    canvas.addEventListener('pointerdown', e => this.inicio(e));
    canvas.addEventListener('pointermove', e => this.mover(e));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => canvas.addEventListener(t, () => { this.dibujando = false; }));
  }
  ajustar() {
    const r = this.c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.c.width = Math.max(1, Math.round(r.width * dpr));
    this.c.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#0b1f3a'; this.ctx.lineWidth = 2.6;
    this.borrar();
  }
  pos(e) { const r = this.c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  marcar(p) {
    const b = this.box || { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    this.box = { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) };
  }
  inicio(e) {
    e.preventDefault(); this.c.setPointerCapture?.(e.pointerId);
    this.dibujando = true; this.ultimo = this.pos(e); this.marcar(this.ultimo);
  }
  mover(e) {
    if (!this.dibujando) return;
    const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of eventos) {
      const p = this.pos(ev);
      this.ctx.beginPath(); this.ctx.moveTo(this.ultimo.x, this.ultimo.y); this.ctx.lineTo(p.x, p.y); this.ctx.stroke();
      this.ultimo = p; this.marcar(p); this.tinta = true;
    }
  }
  borrar() { this.ctx.clearRect(0, 0, this.c.width, this.c.height); this.tinta = false; this.box = null; }
  // PNG recortado al trazo, con fondo transparente, máx. 120 px de alto (liviano para guardar y para el PDF)
  png() {
    if (!this.tinta || !this.box) return null;
    const dpr = window.devicePixelRatio || 1, pad = 6;
    const x = Math.max(0, (this.box.x0 - pad) * dpr), y = Math.max(0, (this.box.y0 - pad) * dpr);
    const w = Math.min(this.c.width - x, (this.box.x1 - this.box.x0 + pad * 2) * dpr);
    const hgt = Math.min(this.c.height - y, (this.box.y1 - this.box.y0 + pad * 2) * dpr);
    const esc = Math.min(1, 120 / hgt);
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(w * esc)); t.height = Math.max(1, Math.round(hgt * esc));
    t.getContext('2d').drawImage(this.c, x, y, w, hgt, 0, 0, t.width, t.height);
    return t.toDataURL('image/png');
  }
}

/* ---------------- Lector de códigos ---------------- */
function crearLector(idElemento) {
  const lib = window.__Html5QrcodeLibrary__;
  if (!lib) throw new Error('Lector de códigos no disponible');
  const F = lib.Html5QrcodeSupportedFormats;
  return new lib.Html5Qrcode(idElemento, {
    formatsToSupport: [F.QR_CODE, F.PDF_417, F.CODE_128, F.CODE_39, F.DATA_MATRIX, F.AZTEC],
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    verbose: false,
  });
}

/* ---------------- Diálogo de firma ---------------- */
// Devuelve una Promise con la firma o null si se cancela.
// Firma = { id, nombre, run, metodos:[], img, documento, ts }
export function pedirFirma({ titulo, declaracion = '', sugerido = {} }) {
  return new Promise(resolve => {
    const idLector = 'lector-' + uid().slice(0, 8);
    let identidad = null;   // resultado del escaneo
    let lector = null;
    let escaneando = false;

    const nombre = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Nombre y apellido', value: sugerido.nombre || '', list: 'dl-nombres' });
    const run = h('input', { type: 'text', inputmode: 'text', placeholder: '12.345.678-9', value: sugerido.run ? formatearRun(sugerido.run) : '' });
    const runAviso = h('small', { class: 'campo-aviso' });
    const chip = h('div', { class: 'id-chip oculto' });
    const zonaLector = h('div', { class: 'lector oculto' }, h('div', { id: idLector, class: 'lector-video' }), h('p', { class: 'lector-ayuda' }, ''));
    const archivo = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto' });
    const canvas = h('canvas', { class: 'pad' });
    const dl = h('datalist', { id: 'dl-nombres' }, ...nombresConocidos().map(n => h('option', { value: n })));
    const error = h('p', { class: 'dlg-error' });

    const btnCarnet = h('button', { type: 'button', class: 'btn-id', onclick: () => escanear('carnet') }, h('span', { class: 'ico' }, '🪪'), h('span', {}, h('b', {}, 'Escanear carnet'), h('small', {}, 'QR del reverso de la cédula')));
    const btnCred = h('button', { type: 'button', class: 'btn-id', onclick: () => escanear('credencial') }, h('span', { class: 'ico' }, '🏷️'), h('span', {}, h('b', {}, 'Escanear credencial'), h('small', {}, 'Credencial de faena / empresa')));
    const btnFoto = h('button', { type: 'button', class: 'btn-link', onclick: () => archivo.click() }, '¿La cámara no lee? Sacar foto del código');

    const dlg = h('dialog', { class: 'dlg-firma' },
      h('form', { method: 'dialog', onsubmit: e => e.preventDefault() },
        h('header', {}, h('h2', {}, titulo), h('button', { type: 'button', class: 'x', 'aria-label': 'Cerrar', onclick: () => cerrar(null) }, '×')),
        declaracion ? h('p', { class: 'declaracion' }, declaracion) : null,
        h('section', {},
          h('h3', {}, '1. Identificación'),
          h('div', { class: 'ids' }, btnCarnet, btnCred),
          zonaLector, btnFoto, archivo, chip,
          h('div', { class: 'fila2' },
            h('label', {}, 'Nombre', nombre),
            h('label', {}, 'RUN', run, runAviso)),
          dl),
        h('section', {},
          h('h3', {}, '2. Firma manuscrita ', h('small', {}, '(opcional si escaneó carnet o credencial)')),
          h('div', { class: 'pad-wrap' }, canvas, h('span', { class: 'pad-linea' }), h('button', { type: 'button', class: 'btn-sec pad-borrar', onclick: () => pad.borrar() }, 'Borrar'))),
        error,
        h('footer', {},
          h('button', { type: 'button', class: 'btn-sec', onclick: () => cerrar(null) }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn-pri', onclick: confirmar }, 'Confirmar firma'))));

    document.body.appendChild(dlg);
    dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(null); });
    dlg.showModal();
    const pad = new PadFirma(canvas);
    requestAnimationFrame(() => pad.ajustar());

    run.addEventListener('blur', () => {
      if (!run.value.trim()) { runAviso.textContent = ''; return; }
      const n = normalizarRun(run.value);
      runAviso.textContent = n ? '' : 'RUN inválido (revise el dígito verificador)';
      if (n) { run.value = formatearRun(n); const p = buscarPersona({ run: n }); if (p && !nombre.value.trim()) nombre.value = p.nombre; }
    });

    archivo.addEventListener('change', async () => {
      const f = archivo.files[0]; if (!f) return;
      try {
        await detenerLector();
        lector = lector || crearLector(idLector);
        const txt = await lector.scanFile(f, false);
        procesar(txt, zonaLector.dataset.modo || 'auto');
      } catch (e) {
        console.warn(e); error.textContent = 'No se encontró un código legible en la foto. Acérquese más y evite reflejos.';
      } finally { archivo.value = ''; }
    });

    async function escanear(modo) {
      error.textContent = '';
      if (escaneando) { await detenerLector(); if (zonaLector.dataset.modo === modo) return; }
      zonaLector.dataset.modo = modo;
      zonaLector.classList.remove('oculto');
      zonaLector.querySelector('.lector-ayuda').textContent = modo === 'carnet'
        ? 'Apunte al código QR del reverso de la cédula (o al código de barras si es antigua).'
        : 'Apunte al código QR o de barras de la credencial.';
      try {
        lector = lector || crearLector(idLector);
        escaneando = true;
        await lector.start({ facingMode: 'environment' }, {
          fps: 12,
          qrbox: (w, hh) => ({ width: Math.floor(w * 0.85), height: Math.floor(Math.min(hh * 0.8, w * 0.85)) }),
        }, txt => { detenerLector(); procesar(txt, modo); }, () => {});
      } catch (e) {
        escaneando = false;
        console.warn(e);
        zonaLector.classList.add('oculto');
        error.textContent = location.protocol === 'https:' || location.hostname === 'localhost'
          ? 'No se pudo abrir la cámara. Revise el permiso de cámara del navegador o use "Sacar foto del código".'
          : 'La cámara solo funciona en https:// o localhost. Use "Sacar foto del código".';
      }
    }

    async function detenerLector() {
      if (lector && escaneando) { try { await lector.stop(); } catch { /* ya detenido */ } }
      escaneando = false;
      zonaLector.classList.add('oculto');
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
      const img = pad.png();
      if (!img && !identidad) { error.textContent = 'Firme en el recuadro o escanee su carnet / credencial.'; return; }
      if (identidad && identidad.run && r && identidad.run !== r) { error.textContent = 'El RUN escrito no coincide con el documento escaneado.'; return; }
      if (identidad && !r) { error.textContent = 'Ingrese el RUN para asociarlo al documento escaneado.'; run.focus(); return; }

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
