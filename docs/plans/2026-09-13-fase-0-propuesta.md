# Propuesta de plan: Fase 0 de Brix

- Fecha: 2026-09-13
- Preparado por: sesión de ejecución, a pedido del PO
- Estado: **propuesta sin aprobar**
- Ajustes: tres ajustes del PO sobre F1 y las decisiones paralelas, y cuatro decisiones del PO sobre el motor del Scoring Skill y las condiciones para arrancar, todos del 2026-09-13
- Decide: Denis Paiva (product-owner)
- Origen: [acta de graduación](../decisions/0001-graduation.md), que fija la Fase 0 como responder las preguntas abiertas antes de sumar funcionalidad nueva al CLI

## Qué tiene que lograr la Fase 0

Cerrar con evidencia las cuatro preguntas que Brix llevó al gate sin responder:

| Pregunta | Qué exige cerrarla |
|---|---|
| Asesina 1 | Si el consumo por entregable de tiempo del PO, minutos de Actions y ventana de contexto se obtiene de forma reproducible y sin trabajo manual por sesión |
| Asesina 2 | Qué unidad de resultado cubre ideas y proyectos |
| Asesina 3 | Si el tooling de contexto paga su costo con un solo integrador |
| Diagnóstico C5 | Por qué el KPI de entrega está vacío y qué lo revive |

Una respuesta negativa cierra la pregunta igual. La ficha de la idea lo fija
así: si ningún recurso admite una serie reproducible, eso también es un veredicto.

## Restricciones

- **Atención del PO:** unas 5 horas por semana, según el acta.
- **GitHub Actions en modo austero:** los instrumentos corren en local, nunca en CI, y la Fase 0 no agrega workflows.
- **Sin consumo pago nuevo:** ningún instrumento usa la API de Gemini ni otra API paga.
- **Sin funcionalidad nueva del CLI:** los instrumentos no se suman como comandos de `brix`. Dónde viven es la decisión D1.
- **Privacidad de los transcripts:** los instrumentos leen solo metadatos, que son marca de tiempo, sesión, rama y uso de tokens. Nunca leen el contenido de las conversaciones, y solo se versionan agregados.
- **Fuera de alcance:** la elección automática de modelo, que choca con la regla que reserva los cambios de binding a decisión humana.

## Lo que ya se verificó el 2026-09-13

Hechos comprobados al preparar esta propuesta, que condicionan el plan:

| Hecho | Consecuencia para el plan |
|---|---|
| El [esquema del roadmap](../../../../roadmap/status.schema.json) solo acepta tokens y defectos en `actuals`, y no admite campos adicionales | Los tres recursos escasos no tienen dónde registrarse hoy |
| Ningún `.roadmap.json` tuvo `actuals` con datos en toda la historia de `main`, desde el 2026-08-06 | La práctica de medir nunca empezó, así que la hipótesis de que se abandonó no tiene sustento |
| Ni la entrega, ni la cola, ni el tren escriben `actuals` | No existe ningún camino automático que los complete |
| Los transcripts de Claude Code traen marca de tiempo, sesión, rama de git y uso de tokens | La ventana de contexto se puede atribuir por rama sin leer contenido |
| Hay transcripts para 247 ramas distintas | La atribución por rama es factible a escala |
| La mayoría de los turnos no automáticos vienen del SDK | Pueden mezclar prompts humanos con tareas programadas, y hay que separarlos antes de usarlos como indicador de atención |
| Codex guarda bases SQLite y un índice de sesiones sin tokens | Su formato no está verificado |
| Cowork guarda sesiones locales en JSON | Su formato no está verificado |
| El monitor de escasez reconstruye minutos por corrida con la API, y cada corrida trae su rama | La atribución de minutos es factible, pero el gasto se concentra en los trenes, que agrupan varias ramas |
| El comando `/tool` aplica el Scoring Skill | Code-mode y el gateway se pueden evaluar sin herramienta nueva |
| La idea [`clarificacion`](../../../../ideas/clarificacion/README.md) midió contexto y propone un script de auditoría con serie temporal | Se superpone con la asesina 1 y con la 3 |

Números de los transcripts de Claude Code de blends:

| Métrica | Valor |
|---|---|
| Transcripts | 105, del 2026-08-09 al 2026-09-13 |
| Ramas distintas | 247 |
| Turnos no automáticos | 1943, de los cuales 1820 vienen del SDK |
| Respuestas con uso de tokens | 46 416 |

## Plan propuesto

Cuatro frentes. F1 y F2 arrancan juntos, porque F2 trabaja sobre la historia y
no necesita instrumentos nuevos. F3 y F4 esperan a F1, porque necesitan sus datos.

### F1: consumo por entregable, asesina 1

**Instrumentos.** Tres scripts locales, uno por recurso, más una prueba de formato:

| Instrumento | Qué mide | Fuente |
|---|---|---|
| Contexto | Tokens de entrada, salida y caché por rama y por sesión, como serie diaria | Metadatos de los transcripts de Claude Code |
| Minutos | Minutos facturables por rama, con el método de [`ci-cd.md`](../../../docs/standards/ci-cd.md): redondeo hacia arriba por job, con mínimo de un minuto | API de corridas y jobs de GitHub, desde local |
| Atención | Turnos humanos y ventanas de actividad por rama | Marcas de tiempo de los transcripts, sin las tareas programadas |
| Prueba de formato | Si Codex y Cowork exponen tokens, marca de tiempo y rama | Bases SQLite de Codex y JSON de Cowork |

**Orden dentro de F1.** Los instrumentos se construyen en este orden:

1. **Minutos de Actions.** El método ya existe en el monitor de escasez y se valida rápido contra su medición. Además, es el recurso que hoy está en escasez.
2. **Ventana de contexto.** Parte de la medición de `clarificacion`, ya probada sobre los transcripts.
3. **Atención del PO.** Es el más incierto, porque depende de separar las tareas programadas y de la decisión D4.

Si un recurso resulta no medible, se registra su veredicto y se pasa al siguiente, sin frenar a los otros dos.

**Mapeo de rama a entregable.** Los entregables del roadmap no tienen campo de
rama. La propuesta es registrar la rama como una entrada del arreglo `evidence`
que el esquema ya admite, sin cambiar el esquema. Es la decisión D6.

**Criterio de cierre.** Un veredicto por recurso, con uno de tres valores:

- serie reproducible y atribuible por entregable;
- serie reproducible pero no atribuible;
- no obtenible.

Cada veredicto se prueba sobre entregables ya cerrados. Reproducible significa
que dos corridas sobre los mismos datos dan el mismo resultado. La serie de
minutos se valida además contra la medición del monitor de escasez, con la misma
tolerancia que ya usó `ci-cd.md`.

**Esfuerzo del PO:** decisiones D3 y D4, más revisar los veredictos. Unas 3 horas.

### F2: diagnóstico del KPI vacío, C5

**Tareas.**

1. Reconstruir con la historia de git cuándo se definieron el KPI y los campos de `actuals`, y qué documentos prometieron completarlos.
2. Contrastar esa historia con la hipótesis del PO.
3. Diseñar el mecanismo que revive la práctica. La propuesta es que la entrega complete `actuals` sola, con los instrumentos de F1, sin trabajo manual.
4. Decidir dónde se registran los tres recursos, que no caben en el esquema actual. Es la decisión D5.

**Criterio de cierre.** Un documento de diagnóstico con la causa verificada
contra la historia, y un mecanismo aprobado por el PO. Si ningún mecanismo
identificado revive la práctica, eso se registra.

**Esfuerzo del PO:** decisión D5 y aprobación del mecanismo. Unas 2 horas.

### F3: unidad de resultado, asesina 2

**Tareas.** Comparar tres candidatas sobre los trenes ya integrados y sobre las
ideas activas:

| Candidata | A favor | En contra |
|---|---|---|
| Entregable del `.roadmap.json` | Existe tanto en ideas como en proyectos | Su tamaño lo declara quien lo crea |
| Vagón del tren | Se cuenta solo, desde la cola | Una idea en exploración rara vez produce vagones |
| PR mergeado | Es la unidad del mercado, con referencias externas | El flujo de blends integra sin PR individual |

Cada candidata se evalúa con tres criterios: si cubre ideas y proyectos, si se
cuenta sin trabajo manual, y cuánto se presta a premiar actividad en lugar de
progreso, que es la tensión C3.

**Criterio de cierre.** Una unidad elegida por el PO con la comparación a la
vista, o el registro de que ninguna sola alcanza y hacen falta dos.

**Esfuerzo del PO:** la elección. Unas 2 horas.

### F4: punto de equilibrio del tooling de contexto, asesina 3

**Tareas.**

1. Evaluar con `/tool` un candidato concreto de code-mode y uno de gateway MCP.
2. Estimar el costo de operación de cada componente en los tres recursos escasos, no en dinero, porque las suscripciones son de tarifa plana.
3. Estimar el ahorro con la serie de contexto de F1, ubicando dónde se concentra el consumo. La medición de `clarificacion` sugiere que la mayor parte viene de lecturas por Bash, algo que code-mode y el gateway no atacan.

**Criterio de cierre.** Un cálculo de equilibrio por componente con datos de F1,
o el registro de que con un solo integrador no hay equilibrio.

**Esfuerzo del PO:** decisión D2 y lectura de las evaluaciones. Unas 3 horas.

## Decisiones del PO antes de arrancar

1. **D1: dónde viven los instrumentos.** En `vc/brix/scripts/`, junto al CLI pero fuera de sus comandos, dentro del alcance `project-brix`. O en `vc/tools/`, como tooling del framework, con otra regla de alcance.
2. **D2: `clarificacion`.** Plegarla a Brix, con su medición como punto de partida del instrumento de contexto. O dejarla como idea separada, con coordinación explícita.
3. **D3: cómo se reparten los minutos de un tren entre sus vagones.** Por partes iguales, en proporción a los archivos de cada rama, o en proporción al tiempo de sus jobs.
4. **D4: cómo se mide la atención del PO.** Con el indicador de turnos y ventanas de actividad. O con un registro manual breve por semana. O declarándola no medible.
5. **D5: dónde se registran los tres recursos.** Extendiendo el esquema de `actuals`, que es un cambio de estándar. O en un registro paralelo dentro de `vc/brix/`.
6. **D6: cómo se vincula una rama a un entregable.** Con una entrada en `evidence`, sin cambiar el esquema, o con un campo nuevo.
7. **D7: fecha de revisión de la Fase 0.** El acta no fijó plazo. La propuesta es revisar el avance el 2026-10-11, cuatro semanas después de la graduación, sin vuelta obligatoria a gate.

## Esfuerzo estimado del PO

| Frente | Horas |
|---|---|
| F1: consumo por entregable | 3 |
| F2: diagnóstico del KPI | 2 |
| F3: unidad de resultado | 2 |
| F4: equilibrio del tooling | 3 |
| Decisiones D1 a D7 | 1 |
| **Total** | **11** |

Con 5 horas por semana, entra en unas tres semanas de atención, antes de la
fecha de revisión propuesta.

## Riesgos del plan

- **El indicador de atención puede medir actividad y no atención.** Es exactamente la tensión C3, y por eso D4 incluye la opción de no medirla.
- **Las tareas programadas contaminan los turnos del SDK.** Si no se pueden separar, el indicador de atención queda inválido.
- **La retención de transcripts es local.** Si Claude Code borra transcripts viejos, la serie pierde historia. Los agregados se versionan para no depender de los originales.
- **Las sesiones sobre `main` no se atribuyen a un entregable.** Son una parte grande del volumen, y quedarían fuera de la atribución.
- **Codex y Cowork pueden no ser medibles.** En ese caso se declaran fuera del veredicto, con motivo.
- **La API de GitHub tiene límite de pedidos.** El instrumento de minutos tiene que trabajar de forma incremental, como ya hace el monitor.

## Fuera de la Fase 0

- Funcionalidad nueva del CLI.
- Elección automática de modelo.
- La línea de Gemini en el ledger y la alineación de la matriz al Scoring Skill. Avanzan en paralelo, como se detalla abajo.
- Los role bindings del proyecto, que son un registro aparte.

## Decisiones del gate que avanzan en paralelo

Ninguna de las dos es funcionalidad nueva del CLI, así que la Fase 0 no las bloquea. Las dos respetan igual las condiciones para arrancar de más abajo.

### Línea de Gemini en el ledger

- **Rama dedicada con prefijo `finops/`.** Su regla de alcance cubre `vc/finops/**`, así que el cambio no necesita `SCOPE-EXCEPTION.md`.
- **No se mezcla con la asesina 1.** La línea declara el consumo de la API de Gemini y no toca los minutos de Actions. Mezclarla con los instrumentos de Brix obligaría a declarar una excepción de alcance.
- **Contenido:** una línea dentro del free tier, con tope de excedente en cero, según el acta.

### Motor del Scoring Skill dentro de Brix

Decidido por el PO el 2026-09-13, al revisar esta propuesta:

- **`tool score` cambia de método.** Deja de pedirle el puntaje a Gemini sobre la matriz propia del CLI. Pasa a recolectar evidencia y a registrar la decisión humana aparte, como el Scoring Skill con la política `vc/tooling/scoring-policy.json`, versión 1.6.0. Una evaluación queda pendiente hasta que alguien decide.
- **El motor se muda al CLI.** El código de evaluación vive dentro de `vc/brix/packages/cli/`, con un punto de entrada explícito. `vc/tools/evaluate-tooling.mjs` queda como envoltorio que importa solo desde ese punto de entrada, así el comando `/tool` y el CI de gobernanza siguen funcionando.
- **Lo que no se muda.** `vc/tools/validate-tooling.mjs` valida los datos del registro y no es parte del motor, así que se queda en `vc/tools/`. La política y las evaluaciones se quedan en `vc/tooling/`, porque son datos del framework.
- **Resuelve la tensión de portabilidad.** Con el motor dentro del paquete, `tool score` funciona igual en el espejo que en blends.
- **Sin comandos nuevos hasta cerrar la Fase 0.** Alinear `tool score` es funcionalidad existente. Exponer `evaluate` o `decide` como comandos o banderas públicas de `brix` es funcionalidad nueva, y espera al cierre de la Fase 0.
- **Excepción de alcance obligatoria.** La rama de la migración toca `vc/tools/`, sus tests, `vc/docs/standards/skills.md` y el comando `/tool`, que están fuera de `project-brix`. Necesita un `SCOPE-EXCEPTION.md` explícito.
- **Registro de decisión propio, después de los bindings.** El acta fija que los role bindings son el siguiente registro del proyecto, así que el del motor va después. Ese registro tiene que tratar la inversión de dependencia: un estándar del framework pasa a depender de un proyecto recién graduado. El precedente de la decisión 0002 de Pinot Index cubre un proyecto dueño de una librería que consume otro proyecto, no el framework.
- **Momento.** La migración nace en su propia rama, después de que el tren integre la graduación.

## Condiciones para arrancar

Decidido por el PO el 2026-09-13: **ningún trabajo de la Fase 0 ni de las decisiones paralelas empieza antes de que se cumplan estas dos condiciones.**

1. El tren integró a `main` la rama de la graduación, `tooling/brix-decoupling-graduation`. Hasta entonces la regla `project-brix` no existe en `main`.
2. El PO aprobó formalmente esta propuesta y las decisiones D1 a D7.

La rama de la graduación queda en pausa hasta que el tren la integre. No recibe commits nuevos, para no invalidar su medición en la cola ni el espejo.

## Si el PO aprueba

1. Se registra la Fase 0 en `vc/brix/.roadmap.json` como épica, con una tarea por frente y por decisión.
2. La primera rama de trabajo espera a que el tren integre la graduación, para que su alcance caiga dentro de `project-brix`.
