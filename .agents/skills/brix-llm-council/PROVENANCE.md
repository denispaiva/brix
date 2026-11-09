# Procedencia de `brix-llm-council`

Fecha: 2026-11-01. Estado: herramienta candidata de Brix, creada a partir de un diseño aprobado por el usuario el 2026-11-01 y ajustada el mismo día según las decisiones VCX-D033; aprobada con excepción el 2026-11-02 según VCX-D035 ([evaluación](https://github.com/denispaiva/vcx/blob/main/docs/superpowers/reports/2026-11-01-council-stage3-evaluation.md)), sin uso medido.

## Origen

| Dato | Valor |
|---|---|
| Método | LLM Council de Andrej Karpathy (https://github.com/karpathy/llm-council): asesores independientes, revisión cruzada anónima y presidente que sintetiza. No se copió su código. |
| Adaptación base | Comando `/council` del precursor: `blends/.claude/commands/council.md`, lectura de solo lectura |
| Revisión del precursor | `f86a2a7df72e55bbb97451c1a35ef3c03b961fc3` (`HEAD` del precursor al leer); último commit que tocó el archivo: `f9237df9f384c5acf09644943ce97fe3524cc714` (2026-10-11) |
| SHA-256 del comando leído | `bcc70adc5edaccf849754b6763ade9a9bfdf57ddbca26a6e6069371bb7885004` |
| Licencia | Sin archivo de licencia propio todavía; pendiente de decidir por el dueño del repositorio de Brix. No se incorpora texto de terceros sin licencia declarada |

## Qué no se usó

`tenfoldmarc/llm-council-skill` (evaluación del precursor: 39,6, `do_not_advance`, sin licencia en archivo) y `aiwithremy/claude-skills-llm-council` se leyeron el 2026-11-01 solo para revisar su evidencia ([informe](https://github.com/denispaiva/vcx/blob/main/docs/superpowers/reports/2026-11-01-llm-council-alternatives-evidence.md)), no como base de esta adaptación. No se copió su texto.

## Diferencias frente a `/council`

| Elemento | `/council` | Esta skill |
|---|---|---|
| Entrada | Slug de `ideas/<slug>/`, ficha y `.roadmap.json`; pregunta de `--question` o de las preguntas asesinas vigentes | Documento Markdown con revisión identificada y una pregunta explícita escrita por el consumidor |
| Lecturas | El orquestador lee la ficha y trazas previas; los asesores leen el repo nombrando archivos | Solo el documento y una lista cerrada de referencias autorizadas, pasadas dentro de la consigna; cada asiento declara qué leyó. El contexto que el host carga en cada subagente se declara como canal no cubierto y la consigna pide no usarlo como fuente. La restricción es instructiva en ambos casos |
| Longitud | Máximo de 400 palabras por asesor, sin verificación | Límites como criterio de calidad: el orquestador cuenta y registra por asiento, sin recortar ni reintentar |
| Anonimización | Letras aleatorias; mapeo al final de la traza | Igual, más la prohibición de autoidentificarse y el recorte registrado de menciones del asiento en las copias anonimizadas |
| Revisión cruzada | Pregunta 4: «¿alguna afirmación de hecho parece inventada?» | Los revisores no reciben el documento y su pregunta 4 es qué afirmaciones no se sostienen con lo que recibieron; la síntesis verifica contra la fuente |
| Modelos | Tabla de bindings, resolver y runner del precursor; Contrarian por `codex` | Un binding por asiento declarado por el consumidor; en esta versión solo runner `subagent`, `decorrelated: false` declarado |
| Recursos | Costo anotado si se puede medir | Tope de invocaciones declarado antes de ejecutar (11, sin reintentos); gasto observado o `not_measured` |
| Salida | Traza en la carpeta de la idea | Reporte Markdown en destino autorizado, vinculado a la revisión de entrada |
| Repetición | Guarda por hash de la pregunta | Guarda por hash de revisión del documento, pregunta normalizada y bindings solicitados, calculado con `shasum` |
| Fallos | Se explican en la traza | Salida parcial conservada sin mapeo de anonimización, marcada `partial`; sin reanudación, consumo perdido declarado |

## Decisiones de diseño aplicadas

El 2026-11-01 el usuario confirmó ocho decisiones tras la revisión crítica del diseño; quedan registradas como VCX-D033 en el [registro de decisiones](https://github.com/denispaiva/vcx/blob/main/docs/decisions/README.md). Resumen de lo que fijan en esta skill: pregunta explícita única; solo asientos por subagente en esta versión; tope de invocaciones declarado sin exigir cuota verificable; sin reanudación. Las otras cuatro fijan su entorno: fuente única, regla de `sourceUrl`, lugar de la evaluación y distribución, descritas abajo.

Tras la etapa 2 con consumo real ([reporte](https://github.com/denispaiva/vcx/blob/main/docs/superpowers/reports/2026-11-01-council-stage2-runs.md)) se corrigieron sus hallazgos 1 a 3: contexto del host declarado, límites de palabras verificados y registrados, autoidentificación prohibida y recortada. Para el hallazgo 4 el usuario eligió el 2026-11-01 reformular la pregunta 4 de los revisores en vez de pasarles el documento. El hallazgo 5, la síntesis como único asiento que verifica hechos, queda como riesgo declarado.

## Fuente única

La skill es la fuente canónica del procedimiento de consejo en VCX. El comando `/council` del precursor sigue vigente en Blends hasta su migración; al migrar, pasará a adaptador delgado sobre esta skill, con trazabilidad en la matriz de tooling. Hasta entonces son dos textos del mismo método y esa duplicación se declara como deuda; esta procedencia no autoriza modificar el precursor.

## Distribución

La skill se descubre solo desde el directorio donde está instalada (`brix/` en este workspace); una sesión abierta en otro directorio no la ve. El mecanismo vigente es copia por consumidor: cada consumidor copia la carpeta completa, conserva este archivo y registra la revisión copiada. La sincronización es manual. Un plugin con espacio de nombres propio se considerará cuando Brix tenga repositorio.

## Qué falta

- Un runtime o driver público: esta skill describe el procedimiento y no está implementada como comando.
- Evidencia para la revisión del 2026-12-02: una corrida que verifique la corrección de la etapa 2, usos reales y un contador de uso; y el envoltorio que VCX-D035 exige antes de reevaluar. `sourceUrl` se declara si existe repositorio público al evaluar, nunca se omite para subir el puntaje. Detalle en la [evaluación](https://github.com/denispaiva/vcx/blob/main/docs/superpowers/reports/2026-11-01-council-stage3-evaluation.md).
- Licencia del producto.
- Asiento de otra familia de modelo por runner `command`, en una versión posterior y con evaluación de riesgo propia.

## Actualización

El comando original no se sincroniza solo. Para actualizar: leer la nueva revisión, comparar contra el SHA-256 anterior y registrar la revisión aquí. Para retirar: marcar con fecha y motivo en la matriz de tooling antes de borrar.

## Reubicación

El 2026-11-02 se movió de `brix/.claude/skills/` a `brix/.agents/skills/`, sin cambio de contenido, por decisión del usuario de unificar las skills de Brix en la carpeta del estándar abierto; `brix/.claude/skills` es desde entonces un symlink de directorio para Claude Code. Los registros de evaluación en `brix/tooling/evaluations/` conservan `evaluatedRef` `vcx@45f961a48236d51a42106ea153578f64900d84f3:brix/.claude/skills/brix-llm-council/` y `sourceUrl` con la ruta anterior: son evidencia fechada de esa revisión y no se reescriben. La próxima evaluación llevará la ruta nueva en su `evaluatedRef`. Los reportes y planes fechados anteriores conservan la ruta de entonces.

## Activación solo explícita

El 2026-11-09 el usuario autorizó en el chat con Claude («Sí, implementarla») impedir que los agentes activen esta skill por su cuenta, en coherencia con su descripción («Use only when the user explicitly asks»). La inspiración fue el uso de esa marca en los plugins de [ruflo](https://github.com/ruvnet/ruflo) (revisión `29be054`); la definición sale de la documentación oficial de cada host, no de ruflo:

| Host | Mecanismo | Efecto documentado | Verificación del 2026-11-09 |
|---|---|---|---|
| Claude Code | `disable-model-invocation: true` en el frontmatter de `SKILL.md` | Claude no la invoca solo y su descripción sale del contexto; se invoca con `/brix-llm-council` ([skills](https://code.claude.com/docs/en/skills)) | Con Claude Code 2.1.311 (CLI instalado ese día con autorización del usuario) y haiku, desde `brix/`: `claude -p "/brix-llm-council"` cargó la skill y devolvió en un turno el diagnóstico de entrada faltante sin iniciar el consejo. Un pedido implícito («Corré un consejo de cinco asesores sobre README.md…») no invocó la herramienta Skill: el modelo buscó archivos y respondió sin el procedimiento. La skill sigue en la lista de comandos de barra del `init`, como corresponde a una invocación manual. Antes, la sesión de la app de escritorio había listado al modelo solo `brix-killer-questions` |
| Codex | `policy.allow_implicit_invocation: false` en `agents/openai.yaml` | Codex no la invoca por coincidencia con el pedido; `$brix-llm-council` sigue funcionando ([build skills](https://learn.chatgpt.com/docs/build-skills)) | Con codex-cli 0.167.0-alpha.3.2, desde `brix/`: `codex debug prompt-input` dejó de incluir la descripción (antes sí la incluía), y `codex exec -s read-only '$brix-llm-council'` cargó la skill y devolvió el diagnóstico de entrada faltante sin iniciar el consejo |

Codex cargó la skill con la clave de Claude Code en el frontmatter; Claude Code no documenta `agents/openai.yaml`. Una skill nueva que solo deba usarse a pedido lleva ambas.
