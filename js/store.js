// Persistencia local (en el dispositivo). Todo envuelto en try/catch: en modo privado
// o con almacenamiento lleno, la app sigue funcionando en memoria.

const K_ARTS = 'artdigital.arts.v2';
const K_PERSONAS = 'artdigital.personas.v2';

function leer(k, def) {
  try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch { return def; }
}
function escribir(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { console.error(e); return false; }
}

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}

export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function nuevoArt() {
  return {
    id: uid(),
    folio: 'ART-' + Date.now().toString(36).toUpperCase(),
    estado: 'borrador', // borrador | en_ejecucion | cerrado
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
    antecedentes: { empresa: '', gerencia: '', descripcion: '', supervisor: '', fecha: hoyISO(), horaInicio: '', horaTermino: '', area: '', lugar: '' },
    r: {},              // respuestas SI/NO por id de pregunta
    docCual: '',
    estrategias: [],
    hojasPapel: {},     // estrategias sin hoja digital: confirmadas en papel
    cc: {},             // { mmc: { r: {}, verificadores: [Firma] } }
    permisos: [],
    otrosPermisoCual: '',
    riesgos: [{ secuencia: '', evento: '', controles: '', verificador: '' }],
    firmaSupervisor: null,
    firmasInicio: [],
    firmasTermino: [],
    huellaContenido: null,
  };
}

export function listarArts() {
  return leer(K_ARTS, []).sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''));
}
export function obtenerArt(id) { return leer(K_ARTS, []).find(a => a.id === id) || null; }
export function guardarArt(art) {
  art.actualizado = new Date().toISOString();
  const todos = leer(K_ARTS, []);
  const i = todos.findIndex(a => a.id === art.id);
  if (i >= 0) todos[i] = art; else todos.push(art);
  return escribir(K_ARTS, todos);
}
export function eliminarArt(id) { escribir(K_ARTS, leer(K_ARTS, []).filter(a => a.id !== id)); }

// Duplicar: conserva la tarea (descripción, lugar, estrategias, análisis de riesgo)
// y limpia todo lo que debe responderse de nuevo cada vez (respuestas, firmas, fecha).
export function duplicarArt(orig) {
  const n = nuevoArt();
  const a = orig.antecedentes;
  n.antecedentes = { ...n.antecedentes, empresa: a.empresa, gerencia: a.gerencia || '', descripcion: a.descripcion, supervisor: a.supervisor, area: a.area, lugar: a.lugar, horaInicio: a.horaInicio, horaTermino: a.horaTermino };
  n.estrategias = [...orig.estrategias];
  n.permisos = [...orig.permisos];
  n.otrosPermisoCual = orig.otrosPermisoCual || '';
  n.docCual = orig.docCual || '';
  n.riesgos = orig.riesgos.map(r => ({ ...r }));
  return n;
}

// ---- Personas conocidas (RUN -> nombre) para autocompletar al escanear carnet/credencial
export function personas() { return leer(K_PERSONAS, {}); }
export function buscarPersona({ run, credencial }) {
  const p = personas();
  if (run && p[run]) return { run, ...p[run] };
  if (credencial) {
    for (const [r, v] of Object.entries(p)) if ((v.credenciales || []).includes(credencial)) return { run: r, ...v };
  }
  return null;
}
export function recordarPersona({ run, nombre, credencial }) {
  if (!run || !nombre) return;
  const p = personas();
  const v = p[run] || { nombre, credenciales: [] };
  v.nombre = nombre;
  if (credencial && !v.credenciales.includes(credencial)) v.credenciales.push(credencial);
  p[run] = v;
  escribir(K_PERSONAS, p);
}
export function nombresConocidos() { return Object.values(personas()).map(v => v.nombre); }
