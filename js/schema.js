// Contenido del formulario ART (VERS. 4) y de las hojas de verificación de controles críticos.
// Todo lo que es "texto del formulario" vive aquí; la app solo lo renderiza.
// Para digitalizar una hoja nueva de controles críticos basta con agregarla a HOJAS_CC.

export const PREGUNTAS_12 = [
  { id: 'p12_1', texto: '¿Me encuentro en condiciones físicas y psicológicas para realizar la tarea?' },
  { id: 'p12_2', texto: '¿Las condiciones del entorno permiten realizar mi trabajo de manera segura? (condiciones climáticas, iluminación, otras).' },
  { id: 'p12_3', texto: '¿Verifiqué que las áreas de desplazamiento y trabajo (plataformas de trabajo, pasillos, grating, barandas, entre otros) se encuentran en condiciones para realizar mi tarea?' },
  { id: 'p12_4', texto: '¿Poseo todos los elementos de protección personal específicos para la tarea?' },
  { id: 'p12_5', texto: '¿Dispongo de equipos y herramientas apropiadas para la tarea, en buen estado y con su inspección al día?' },
  { id: 'p12_6', texto: '¿Sé cómo activar y actuar ante una emergencia?' },
];
export const AVISO_12 = 'UN NO A CUALQUIERA DE LAS PREGUNTAS SIGNIFICA NO INICIAR LA TAREA Y DAR AVISO A SU SUPERVISIÓN.';

export const P13 = {
  p13_1: '¿Estoy capacitado(a) y conozco las medidas de prevención que mi empleador ha definido para ejecutar mi trabajo o tarea de manera correcta y segura?',
  p13_2: '¿Existe algún documento que regule mi trabajo o tarea? Manual, reglamento, procedimiento, instructivo de trabajo u otro.',
  p13_3: '¿El manual, reglamento, procedimiento, instructivo u otro incluye todas las actividades (alcance) a desarrollar en terreno?',
  p13_5: '¿Existe interacción con otros trabajos?',
  p13_6: '¿Requiero de un permiso especial de trabajo?',
  p13_6b: '¿Dispongo de los permisos de trabajo requeridos?',
};

export const ESTRATEGIAS = [
  { id: 'vehiculos_livianos', nombre: 'Operación de Vehículos Livianos' },
  { id: 'silicosis', nombre: 'Prevención de Silicosis' },
  { id: 'equipos_pesados', nombre: 'Operación de Equipos Pesados' },
  { id: 'hipoacusia', nombre: 'Prevención de Hipoacusia' },
  { id: 'izaje', nombre: 'Operaciones de Izaje' },
  { id: 'fatiga', nombre: 'Fatiga y Somnolencia' },
  { id: 'altura', nombre: 'Trabajos en Altura' },
  { id: 'partes_moviles', nombre: 'Interacción con Partes Móviles' },
  { id: 'correas', nombre: 'Op. y Mantención de Correas Transp.' },
  { id: 'espacios_confinados', nombre: 'Trabajos en Espacios Confinados' },
  { id: 'energia_electrica', nombre: 'Interacción con Energía Eléctrica' },
  { id: 'explosivos', nombre: 'Manejo de Explosivos y Frag. de Roca' },
  { id: 'energia_hidraulica', nombre: 'Interacción con Energía Hidráulica' },
  { id: 'sustancias_peligrosas', nombre: 'Manejo de Sol. Ácidas, Aciduladas y Sustancias Peligrosas' },
  { id: 'geotecnia', nombre: 'Geotecnia' },
  { id: 'energia_neumatica', nombre: 'Interacción con Energía Neumática' },
  { id: 'perforacion', nombre: 'Operaciones de Perforación' },
  { id: 'neumaticos', nombre: 'Operación de Neumáticos Mineros' },
  { id: 'sondajes', nombre: 'Operaciones de Sondajes' },
  { id: 'almacenaje_drones', nombre: 'Op. de Almacenaje, Traslado de Materiales y Vuelo de Drones' },
  { id: 'estructuras', nombre: 'Operación de Estructuras' },
  { id: 'combustibles', nombre: 'Manejo de Elementos Combustibles' },
  { id: 'buceo', nombre: 'Buceo Profesional' },
  { id: 'zanjas', nombre: 'Construcción de Zanjas y Excavaciones' },
  { id: 'humos_metalicos', nombre: 'Humos Metálicos' },
  { id: 'mmc', nombre: 'Manejo Manual de Carga' },
  { id: 'relaves', nombre: 'Almacenamiento en Depósitos de Relave' },
];

export const PERMISOS = [
  { id: 'ingreso', nombre: 'Permiso de Ingreso al Área' },
  { id: 'caliente', nombre: 'Permiso de Trabajo en Caliente' },
  { id: 'confinados', nombre: 'Permiso de Trabajo en Espacios Confinados' },
  { id: 'aislacion', nombre: 'Permiso de Aislación y Bloqueo' },
  { id: 'energizado', nombre: 'Permiso de Trabajo para Intervenir Equipo Energizado' },
  { id: 'izaje', nombre: 'Permiso de Izaje (para izajes críticos)' },
  { id: 'retiro_piso', nombre: 'Permiso de Retiro de Piso (grating o piso) y barandas' },
  { id: 'altura', nombre: 'Permiso de Trabajo en Altura y Verificación de SPDC' },
  { id: 'lineas_electricas', nombre: 'Permiso de Trabajo Líneas Eléctricas Aéreas' },
  { id: 'radioactivos', nombre: 'Permiso de Trabajo con Equipos Radioactivos' },
  { id: 'otros', nombre: 'Otros Permisos' },
];

export const PREGUNTAS_21 = [
  { id: 'p21_1', texto: '¿Cuento con la autorización del dueño del área para segregar mi lugar de trabajo respecto a los otros?' },
  { id: 'p21_2', texto: '¿Coordiné mis acciones e informé los controles preventivos con los otros trabajos presentes en el área?' },
  { id: 'p21_3', texto: '¿Verifiqué la efectividad de la segregación en 360° incluyendo los niveles superiores e inferiores que pudiese afectar? Considere las "3 A": Arriba; Abajo; Alrededor.' },
  { id: 'p21_4', texto: '¿Revisé el análisis de riesgo de los trabajos cruzados y es posible realizar la tarea en condiciones seguras interactuando con otras labores en el área?' },
];
export const AVISO_NO_ETAPA2 = 'EN CASO DE UN NO, DETÉNGASE Y SOLICITE LA ASISTENCIA DEL SUPERVISOR DUEÑO DEL ÁREA.';

export const DECLARACION_INICIO = 'Declaro que participé en la identificación de peligros, evaluación de riesgos y medidas de control de este ART, y que son de carácter obligatorio.';
export const DECLARACION_TERMINO = 'Declaro terminar mi actividad, trabajo o tarea sin lesiones o incidentes, y entregar el área limpia y ordenada.';

// Hojas de verificación de controles críticos ("Prácticas seguras de gestión de controles críticos").
// Se incluye solo el rol Trabajador(a), que es la hoja que se responde con cada ART.
export const HOJAS_CC = {
  mmc: {
    titulo: 'Manejo manual de carga',
    rol: 'Trabajador(a)',
    plantilla: 'plantillas/PSGCC-SSO-SAL-006-211221.pdf',
    controles: [
      {
        id: 'cc1', codigo: 'CC1',
        nombre: 'Equipos de ayuda mecánica (equipos, herramientas, dispositivos, etc.) disponibles y en óptimas condiciones.',
        grupo: 'Competencias del personal',
        preguntas: [
          { id: 'cc1_1', texto: '¿He sido capacitado(a) e instruido(a) en el correcto uso de los equipos de ayuda mecánica?' },
          { id: 'cc1_2', texto: '¿Reviso y reporto periódicamente la disponibilidad y estado de los equipos de ayuda mecánica?' },
          { id: 'cc1_3', texto: '¿Cuento con las herramientas necesarias y en óptimas condiciones para realizar las tareas?' },
        ],
      },
      {
        id: 'cc2', codigo: 'CC2',
        nombre: 'Operador(a) acreditado(a) debe ejecutar sus actividades dentro de los límites ergonómicos seguros.',
        grupo: 'Competencias del personal',
        preguntas: [
          { id: 'cc2_1', texto: '¿He sido capacitado(a) e instruido(a) en manejo manual de carga, las posturas ergonómicas (técnicas de levante) y sus riesgos asociados?' },
          { id: 'cc2_2', texto: '¿Conozco el peso de la carga y/o herramienta a manipular?' },
          { id: 'cc2_3', texto: '¿Manipulo las cargas respetando los límites de peso legales establecidos?' },
        ],
      },
      {
        id: 'cc3', codigo: 'CC3',
        nombre: 'Puesto de trabajo adecuado al trabajador(a) (ergonomía del puesto de trabajo).',
        grupo: 'Condiciones ergonómicas',
        preguntas: [
          { id: 'cc3_1', texto: '¿Se cumple con el diseño ergonómico de mi puesto de trabajo?' },
          { id: 'cc3_2', texto: '¿Mantengo las condiciones ergonómicas de mi puesto de trabajo?' },
        ],
      },
    ],
  },
};

export const PLANTILLA_ART = 'plantillas/ART-FMT-SSO-SEG-001-V4.pdf';
