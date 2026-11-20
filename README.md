# ART digital (v2)

Análisis de Riesgos de la Tarea (ART VERS. 4) en el celular: se llena por pasos, se firma con el dedo, con el **carnet de identidad** (QR o PDF417) o con la **credencial de faena**, y genera el PDF **escribiendo sobre el formulario oficial**. Funciona sin señal una vez abierta (PWA).

## Probarla

```sh
python -m http.server 8765
# abrir http://localhost:8765
```

Para usar la cámara desde el celular se necesita https (por ejemplo GitHub Pages). Desde `file://` no funciona.

## Qué cubre

| Formulario | App |
|---|---|
| 1.1 Antecedentes | Sugiere empresa, área y supervisor de ART anteriores |
| 1.2 / 1.3 Preguntas SI/NO | Un NO crítico muestra **DETENER** y bloquea las firmas |
| 4. 27 estrategias de control | Cada una pide su hoja de controles críticos. *Manejo Manual de Carga* está digitalizada; las demás piden confirmar que se respondió en papel |
| 5. Interacción con otros trabajos | Un SÍ activa la Etapa 2.1 |
| 6. Permisos especiales | Lista completa + "Otros, indique cuál" + ¿Dispongo de los permisos? |
| 2.1 Trabajos cruzados | Solo si aplica |
| 2.2 Análisis de riesgo | Sin límite de filas: el PDF agrega páginas de continuación |
| Firmas de inicio y término | Supervisor + cuadrilla. Con más de 6 firmas se agrega una hoja adicional |

- **Primera firma = contenido bloqueado.** Se guarda una huella SHA-256 del contenido. Si cambian las condiciones de la tarea, se usa *Duplicar* (conserva la descripción y el análisis de riesgo; limpia las respuestas y las firmas).
- **El PDF** contiene las páginas oficiales llenas, la hoja de controles críticos marcada y una página final con el *Registro de firmas electrónicas* (método, RUN, N° de documento, fecha y hora, huella).
- Mientras el ART está en borrador, el PDF lleva una marca de agua "BORRADOR".

## Identificación por carnet o credencial

- **Cédula chilena (2013 en adelante):** el QR del reverso es una URL del Registro Civil (`...docstatus?RUN=...&serial=...`). La app toma el RUN y el N° de documento y valida el dígito verificador. No guarda la MRZ.
- **Cédula antigua:** se intenta leer el RUN del PDF417.
- **Credencial de faena:** si el código contiene un RUN, se usa. Si no, la primera vez se ingresan el nombre y el RUN, y desde ahí la credencial se reconoce sola. La asociación queda guardada solo en el dispositivo.
- Si la cámara no enfoca, se puede usar "Sacar foto del código".

## Estructura

```
index.html, css/app.css
js/schema.js   textos del formulario y hojas de controles críticos (agregar hojas aquí)
js/rules.js    reglas: faltantes, DETENER, qué aplica
js/pdf.js      coordenadas sobre las plantillas y generación del PDF (pdf-lib)
js/firma.js    firma manuscrita, lector QR/PDF417 (html5-qrcode), RUN
js/store.js    guardado local (localStorage)
plantillas/    PDF oficiales usados como fondo
vendor/        librerías locales (para funcionar sin conexión)
sw.js          caché sin conexión: subir VERSION al cambiar archivos
```

## Pendiente / próximos pasos

- Digitalizar las otras 26 hojas de controles críticos (solo datos en `schema.js` y coordenadas en `pdf.js`).
- Sincronizar con un servidor para respaldo y para que la supervisión vea los ART en línea. Hoy todo queda en el teléfono.
- Validar con prevención de riesgos o con el mandante que aceptan la firma electrónica simple (Ley 19.799).
