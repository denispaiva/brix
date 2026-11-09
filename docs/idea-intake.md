# Capacidad de Brix para preparar propuestas de ideas

Fecha: 2026-10-30. Estado: capacidad requerida para el diseño de VCX; todavía no implementada. El usuario fijó `brix idea` = `/idea` y `brix council` = `/council`. Las equivalencias y la ayuda de parámetros se definen en [comandos de Brix](commands.md).

## Misión de la capacidad

Convertir una explicación en texto o archivo en un documento de idea comprensible para revisión humana, enriquecido mediante preguntas asesinas y preparado para enviarse al consejo.

## Entradas

- Texto directo o archivo Markdown/PDF en el primer alcance.
- Plantilla de ideas y versión explícitas, suministradas por el consumidor.
- Configuración del instrumento de preguntas asesinas, idioma visible y límites de ejecución.
- Ámbito de lectura y destino de salida explícitos; sin asumir un Cellar o rutas de Blends.

`brix idea` y `/idea` reciben texto o archivo; sin parámetro ofrecen ayuda para completarlo. Una entrada ambigua se aclara con el humano, sin adivinar si era texto o ruta. La [ayuda de comandos](commands.md) detalla el comportamiento común; la selección de plantilla y el tratamiento de varios adjuntos se precisarán antes de implementar. Un formato adicional no se declara compatible sin su adaptador.

## Operación

1. Preservar la entrada e identificar las partes extraídas, con referencias a páginas o secciones cuando corresponda.
2. Aplicar la plantilla y distinguir cita original, interpretación propuesta y datos ausentes.
3. Invocar el instrumento de preguntas asesinas: formular preguntas decisivas, exponer supuestos y señalar qué respuestas o evidencia faltan.
4. Presentar las preguntas al humano e incorporar sus respuestas al documento. Los pasos 3 y 4 forman una ronda.
5. Aplicar el [control de madurez](#control-de-madurez) al cerrar cada ronda.
6. Producir el documento `.md` con una revisión identificable. No producir un plan de implementación o una especificación ejecutable por haber completado una plantilla.
7. Si la propuesta maduró, presentar el resumen de envío y pedir aprobación para invocar `/council`, según VCX-D054.

Las preguntas no son respuestas; la capacidad no inventa entrevistas, validación de mercado, cifras o autoridad. Los fallos de extracción y las secciones pendientes aparecen en el resultado.

## Control de madurez

Requisito de VCX-D054. Madurez significa que la propuesta puede debatirse, no que esté validada: responder las preguntas asesinas con evidencia pertenece a la exploración. La regla es explícita y comprobable; la confianza del modelo no cuenta como evidencia.

La propuesta madura cuando se cumplen todas estas condiciones:

| Condición | Se comprueba viendo que |
|---|---|
| Problema, destinatario y decisión en juego están nombrados | Están escritos en el documento |
| No quedan aclaraciones que bloqueen | La lista está vacía o cada una tiene un motivo |
| Cada supuesto decisivo tiene pregunta refutable y evidencia | Cada ficha está completa, aunque diga «ninguna» |
| Lo desconocido está declarado | Nada se inventó para cubrir la plantilla |
| La última ronda no agregó supuestos decisivos | La propuesta dejó de cambiar en lo decisivo |
| Existe la única pregunta que debatirá el consejo | Está escrita de forma explícita |

El tope es de 3 rondas. La condición de que la última ronda no agregue supuestos pide al menos 2. Si se alcanza el tope sin madurez, `/idea` muestra qué condición falta y no marca la propuesta como madura; continuar requiere una decisión humana.

El documento señala qué afirmaciones no tienen fuente y qué supuestos llegan sin evidencia, para que una propuesta bien redactada no parezca más sólida de lo que es.

El resumen de envío muestra el documento y su revisión, la pregunta para el consejo, la evidencia ausente y el costo previsto, de 11 invocaciones por corrida. La aprobación humana autoriza una sola corrida sobre esa revisión. Sin aprobación, la propuesta queda pendiente y `/council` no se invoca.

## Instrumento de preguntas asesinas: herramienta candidata

Desde el 2026-11-01 existe una herramienta candidata, [`brix-killer-questions`](../.agents/skills/brix-killer-questions/PROVENANCE.md): adaptación local de una skill MIT de terceros, con procedencia fijada. Aplica el contrato de esta capacidad: lee el contexto antes de preguntar, separa hechos, afirmaciones sin fuente e inferencias, y por cada supuesto decisivo expresa pregunta refutable, decisión afectada y consecuencia, evidencia disponible y faltante con prueba proporcionada, y criterio observable. No asigna semáforo ni clasificación bloqueante (propuestas del [diseño de maduración](https://github.com/denispaiva/vcx/blob/main/docs/superpowers/specs/2026-10-31-idea-maturation-design.md), sin aprobar) ni exige MVP.

Estado: candidata sin admisión; probada solo con un caso ficticio ([reporte](https://github.com/denispaiva/vcx/blob/main/docs/superpowers/reports/2026-11-01-killer-questions-instrument.md)). No hay comando `brix idea` implementado ni capacidad registrada; la integración con la plantilla de ideas, las rondas y el control de madurez queda pendiente.

## Salidas y efectos

- Archivo Markdown basado en la plantilla, con ubicación accesible al consumidor.
- Referencias a fuentes y observaciones de extracción.
- Preguntas decisivas y supuestos, con distinción entre propuestas y confirmaciones.
- Identidad y revisión del proceso de preparación; diagnóstico de resultado completo, parcial o fallido, sin inferir aprobación humana.

La capacidad escribe solo en el destino declarado. No registra la idea en un portfolio, no crea un roadmap y no invoca un consejo sin la aprobación humana de su resumen de envío. Puede utilizarse sin instalar Blends; quien la invoque debe proporcionar plantilla, configuración y permisos necesarios.

## Relación con el consejo

El [flujo de Blends](https://github.com/denispaiva/vcx/blob/main/blends/docs/idea-intake.md) recibe el OK humano, informa el envío y consume `brix council` o `/council` con el documento Markdown. Esa capacidad de Brix devuelve un reporte asociado a la revisión de entrada. La aceptación del reporte y el ingreso son decisiones posteriores del humano, no resultados de Brix.

El instrumento de consejo se ofrece desde Brix; Blends conserva la coordinación del proceso. Se mantendrán trazabilidad, límites y controles de repetición al diseñar su adaptación por archivo. El método existente no se modifica ni se extrae en esta etapa documental.

## Diferencia respecto del sistema actual

El `brix idea <archivo.md>` existente convierte notas en `SPEC.md` ejecutable: tiene otro propósito y no satisface por sí solo esta capacidad de ingreso. El `/council <slug>` actual requiere una idea en `ideas/`; la nueva interfaz por archivo debe admitir propuestas todavía no registradas. La [correspondencia](https://github.com/denispaiva/vcx/blob/main/docs/architecture/current-system-mapping.md) identifica sus fuentes normativas.

La consulta previa al índice no identificó la formulación inicial `/ideas` ni `/asesinas` como capacidades independientes registradas. Es una observación histórica, no prueba de inexistencia de otros procedimientos. La equivalencia ahora decidida no demuestra que la nueva semántica de `/idea` esté implementada.
