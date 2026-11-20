// Reglas del ART: qué falta, qué obliga a detenerse, y qué secciones aplican.
import { PREGUNTAS_12, PREGUNTAS_21, HOJAS_CC, ESTRATEGIAS, AVISO_12, AVISO_NO_ETAPA2 } from './schema.js';

export const PASOS = [
  { id: 'antecedentes', titulo: 'Antecedentes', corto: '1.1' },
  { id: 'trabajadores', titulo: 'De los trabajadores', corto: '1.2' },
  { id: 'tarea', titulo: 'De la tarea', corto: '1.3' },
  { id: 'controles', titulo: 'Controles críticos', corto: '4' },
  { id: 'permisos', titulo: 'Interacción y permisos', corto: '5-6' },
  { id: 'cruzados', titulo: 'Trabajos cruzados', corto: '2.1' },
  { id: 'riesgos', titulo: 'Análisis de riesgo', corto: '2.2' },
  { id: 'firmas', titulo: 'Firmas de inicio', corto: '✍' },
  { id: 'cierre', titulo: 'Cierre', corto: '✓' },
];

const CAMPOS_ANT = { empresa: 'Nombre de la empresa', descripcion: 'Descripción de la tarea', supervisor: 'Supervisor responsable', fecha: 'Fecha', horaInicio: 'Hora de inicio', horaTermino: 'Hora de término', area: 'Área de trabajo', lugar: 'Lugar específico' };

export const aplicaCruzados = art => art.r.p13_5 === 'SI';
export const filaRiesgoVacia = f => !f.secuencia.trim() && !f.evento.trim() && !f.controles.trim() && !f.verificador.trim();
export const filaRiesgoCompleta = f => f.secuencia.trim() && f.evento.trim() && f.controles.trim() && f.verificador.trim();

// Devuelve { faltan: [texto], detener: [texto] } para un paso
export function evaluarPaso(art, paso) {
  const faltan = [], detener = [];
  const r = art.r;
  switch (paso) {
    case 'antecedentes':
      for (const [k, n] of Object.entries(CAMPOS_ANT)) if (!String(art.antecedentes[k] || '').trim()) faltan.push(n);
      break;
    case 'trabajadores':
      PREGUNTAS_12.forEach((p, i) => {
        if (!r[p.id]) faltan.push(`Pregunta ${i + 1}`);
        if (r[p.id] === 'NO') detener.push(`1.2 pregunta ${i + 1} respondida NO. ${AVISO_12}`);
      });
      break;
    case 'tarea':
      if (!r.p13_1) faltan.push('Pregunta 1 (capacitación)');
      if (r.p13_1 === 'NO') detener.push('1.3 pregunta 1 respondida NO: no está capacitado(a). NO INICIAR LA TAREA Y DAR AVISO A SU SUPERVISIÓN.');
      if (!r.p13_2) faltan.push('Pregunta 2 (documento que regula)');
      if (r.p13_2 === 'SI' && !art.docCual.trim()) faltan.push('Indique cuál documento');
      if (r.p13_2 === 'SI' && !r.p13_3) faltan.push('Pregunta 3 (alcance)');
      break;
    case 'controles':
      for (const id of art.estrategias) {
        const est = ESTRATEGIAS.find(e => e.id === id);
        const hoja = HOJAS_CC[id];
        if (hoja) {
          const datos = art.cc[id] || { r: {}, verificadores: [] };
          const preg = hoja.controles.flatMap(c => c.preguntas);
          const sin = preg.filter(p => !datos.r[p.id]).length;
          if (sin) faltan.push(`${est.nombre}: ${sin} pregunta(s) sin responder`);
          preg.forEach(p => { if (datos.r[p.id] === 'NO') detener.push(`${est.nombre}: "${p.texto}" respondida NO. ${AVISO_NO_ETAPA2}`); });
          if (!(datos.verificadores || []).length) faltan.push(`${est.nombre}: firma del verificador del control`);
        } else if (!art.hojasPapel[id]) {
          faltan.push(`${est.nombre}: confirmar hoja de verificación respondida en papel`);
        }
      }
      break;
    case 'permisos':
      if (!r.p13_5) faltan.push('Pregunta 5 (interacción con otros trabajos)');
      if (!r.p13_6) faltan.push('Pregunta 6 (permiso especial)');
      if (r.p13_6 === 'SI') {
        if (!art.permisos.length) faltan.push('Seleccione al menos un permiso');
        if (art.permisos.includes('otros') && !art.otrosPermisoCual.trim()) faltan.push('Indique cuál otro permiso');
        if (!r.p13_6b) faltan.push('¿Dispongo de los permisos requeridos?');
        if (r.p13_6b === 'NO') detener.push('Requiere permisos y no los dispone: NO INICIAR LA TAREA Y DAR AVISO A SU SUPERVISIÓN.');
      }
      break;
    case 'cruzados':
      if (aplicaCruzados(art)) PREGUNTAS_21.forEach((p, i) => {
        if (!r[p.id]) faltan.push(`Pregunta ${i + 1}`);
        if (r[p.id] === 'NO') detener.push(`2.1 pregunta ${i + 1} respondida NO. ${AVISO_NO_ETAPA2}`);
      });
      break;
    case 'riesgos': {
      const llenas = art.riesgos.filter(f => !filaRiesgoVacia(f));
      if (!llenas.length) faltan.push('Al menos un paso de la tarea con su evento, control y verificador');
      llenas.forEach((f, i) => { if (!filaRiesgoCompleta(f)) faltan.push(`Fila ${i + 1}: complete las 4 columnas`); });
      break;
    }
    case 'firmas':
      if (!art.firmaSupervisor) faltan.push('Firma del supervisor responsable');
      if (!art.firmasInicio.length) faltan.push('Al menos un trabajador(a) firmando al inicio');
      break;
    case 'cierre': {
      const pend = art.firmasInicio.filter(fi => !art.firmasTermino.some(ft => mismaPersona(fi, ft)));
      pend.forEach(p => faltan.push(`Firma de término de ${p.nombre}`));
      break;
    }
  }
  return { faltan, detener };
}

export const mismaPersona = (a, b) => (a.run && b.run) ? a.run === b.run : a.nombre.trim().toLowerCase() === b.nombre.trim().toLowerCase();

export const PASOS_CONTENIDO = ['antecedentes', 'trabajadores', 'tarea', 'controles', 'permisos', 'cruzados', 'riesgos'];

export function evaluarContenido(art) {
  const faltan = [], detener = [];
  for (const p of PASOS_CONTENIDO) {
    const e = evaluarPaso(art, p);
    const t = PASOS.find(x => x.id === p).titulo;
    e.faltan.forEach(f => faltan.push(`${t}: ${f}`));
    detener.push(...e.detener);
  }
  return { faltan, detener };
}

export function estadoPaso(art, paso) {
  if (paso === 'cruzados' && !aplicaCruzados(art)) return 'na';
  const e = evaluarPaso(art, paso);
  if (e.detener.length) return 'detener';
  if (e.faltan.length) return 'pendiente';
  return 'ok';
}
