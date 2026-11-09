# Comandos de Brix y equivalencias de conversación

Fecha: 2026-10-30. Estado: interfaces objetivo acordadas por el usuario; comportamiento de ayuda propuesto. Esta documentación no implementa comandos ni modifica el CLI existente.

## Una capacidad, dos formas de invocarla

| Capacidad de Brix | CLI | Conversación | Parámetro de ejecución |
|---|---|---|---|
| Preparar una propuesta de idea | `brix idea [<text-or-file>]` | `/idea [<text-or-file>]` | Explicación en texto o archivo Markdown/PDF |
| Obtener un reporte del consejo | `brix council [<file.md>]` | `/council [<file.md>]` | Documento Markdown y revisión que se analizarán |

Los corchetes indican que se puede iniciar sin parámetro para recibir ayuda. Para ejecutar la capacidad debe haberse resuelto una entrada válida. `/idea` es singular; la formulación inicial `/ideas` queda como antecedente, no como otro comando o alias aprobado.

CLI y conversación consumen la misma capacidad, contrato de entrada, validaciones y definición de ayuda. Los adaptadores cambian la interacción; no duplican la lógica de negocio. Brix ofrece ambos instrumentos de forma portable. Blends coordina cuándo usarlos y las decisiones del recorrido; Cellar conserva sus documentos y registros.

## Ayuda para completar el parámetro

| Situación | Comportamiento esperado |
|---|---|
| `/idea` o `brix idea` sin entrada, en modo interactivo | Explicar qué recibe; ofrecer escribir o pegar la explicación, o indicar/seleccionar un Markdown o PDF accesible |
| `/council` o `brix council` sin archivo, en modo interactivo | Pedir el Markdown; ofrecer el documento recién preparado o adjuntos pertinentes solo si se conocen y están dentro del ámbito autorizado |
| Hay varios archivos candidatos | Mostrar nombre, ubicación y revisión cuando esté disponible; pedir elegir uno, sin tomar el más reciente por inferencia |
| No es claro si la entrada es texto o ruta | Preguntar cuál interpretación corresponde, sin reinterpretar silenciosamente una ruta inválida como texto |
| La ruta no existe o no se puede leer | Explicar el problema y ayudar a corregirla o elegir otra entrada; conservar el texto ya aportado cuando corresponda |
| El tipo no es compatible o la extracción es insuficiente | Informar formatos y límites; pedir otra entrada o completar el contenido. Council recibe el Markdown preparado, no un PDF sin normalizar |
| El usuario cancela | Finalizar la ayuda sin ejecutar la capacidad o avanzar el recorrido |
| Ejecución no interactiva sin parámetro válido | Devolver diagnóstico y sintaxis accionables, con resultado de error; no esperar indefinidamente ni elegir archivos automáticamente |

La ayuda puede listar adjuntos de la conversación o archivos cuyo ámbito ya fue autorizado. No recorre todo el equipo o portfolio para buscar un documento. Una selección resuelve la entrada, sin reemplazar el OK del documento, la autorización del consejo o la confirmación de ingreso requeridas por el proceso.

## Ayuda explícita

`brix idea --help`, `brix council --help`, `/idea --help` y `/council --help` muestran propósito, entradas compatibles, parámetro, ejemplos, salida y efectos. No disparan extracción, generación, llamadas a modelos, consejo o escrituras de producto.

Ejemplos de la interfaz objetivo, todavía no disponibles en VCX:

```text
brix idea "Quiero coordinar los turnos de un equipo"
/idea "Quiero coordinar los turnos de un equipo"

brix idea "documents/proposal.pdf"
/idea "documents/proposal.pdf"

brix council "documents/idea.md"
/council "documents/idea.md"
```

Una ruta con espacios conserva la misma regla de entrada entre adaptadores. La sintaxis definitiva para adjuntos o selección visual dependerá del entorno, manteniendo este comportamiento.

## Continuidad y resultado

Al completar `/idea`, se presenta el Markdown al humano y se explica que, con su OK y dentro del alcance autorizado, se enviará al consejo. La ayuda de `/council` puede ofrecer ese mismo documento para evitar repetir una ruta; la llamada usa su revisión autorizada.

Al completar `/council`, se entrega el reporte Markdown y se pide la decisión de ingreso según el [flujo](https://github.com/denispaiva/vcx/blob/main/blends/docs/idea-intake.md). El comando no registra una idea, no cambia el documento sin permiso y no sustituye la decisión humana.

Los contratos de resultado de preparación se detallan en [preparación de ideas](idea-intake.md); la asesoría conserva preguntas, perspectivas, revisiones y límites explícitos. La selección interactiva de un parámetro no altera la semántica de esos resultados.

## Compatibilidad con el sistema actual

El CLI existente `brix idea <archivo.md>` genera `SPEC.md` ejecutable. La interfaz objetivo reutiliza el nombre con otra semántica: preparar una propuesta de idea con plantilla y preguntas asesinas. El generador conservará su función como `brix spec`, según VCX-D055. Antes de implementar se deberá resolver explícitamente la compatibilidad y ubicación de la capacidad de generar specs; no se cambia su comportamiento en el sistema activo por documentar esta decisión.

El `/council <slug>` actual pertenece a Blends y presupone una idea registrada. En VCX se decide ofrecer el instrumento mediante Brix con entrada por archivo, manteniendo la coordinación del recorrido en Blends. Su extracción o adaptación requiere un trabajo posterior; no se mueve código ahora.
