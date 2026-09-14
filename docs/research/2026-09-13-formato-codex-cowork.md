# Prueba de formato de Codex y Cowork, y veredicto por recurso de F1

- Fecha: 2026-09-13
- Tarea: T-07 de la Fase 0, que cierra F1 con un veredicto por recurso
- Método: solo estructura de los datos locales. Claves, tipos, conteos y fechas. Nunca contenido de mensajes, títulos ni vistas previas
- Origen: [propuesta de la Fase 0](../plans/2026-09-13-fase-0-propuesta.md), frente F1

## Qué responde

La asesina 1 pregunta si el consumo por entregable de los tres recursos escasos
se obtiene de forma reproducible y sin trabajo manual por sesión. F1 ya tiene
tres instrumentos sobre Claude Code y GitHub. Esta prueba agrega lo que faltaba:
si Codex y Cowork, las otras dos herramientas del portfolio, exponen tokens,
marcas de tiempo y rama.

El criterio de cierre de la propuesta admite tres valores por recurso: serie
reproducible y atribuible por entregable, serie reproducible pero no atribuible,
o no obtenible.

## Veredicto por recurso

| Recurso | Veredicto | Fuente | Validación | Condiciones |
|---|---|---|---|---|
| Minutos de Actions | Serie reproducible y atribuible | API de corridas y jobs de GitHub, sin importar qué herramienta abrió la corrida | 0,8 % de desvío contra el monitor de escasez, dentro de la tolerancia del 10 % | Atribuye por rama; el paso de rama a entregable espera D6 |
| Ventana de contexto | Serie reproducible y atribuible | Transcripts de Claude Code, con instrumento. Codex: obtenible y atribuible, sin instrumento. Cowork: obtenible, no atribuible | Sin fuente externa. Reproducible entre corridas | Codex aporta el 0,43 % del contexto de blends en el ciclo 2026-09. Cowork no tiene sesiones de blends |
| Atención del PO | Serie reproducible y atribuible, como indicador | Marcas de tiempo de turnos humanos de Claude Code, con instrumento. Codex: obtenible por turno, sin instrumento | Sin fuente externa. Reproducible entre corridas | Cambia casi por completo con el tope por hueco. Por D4 se reporta como banda entre el tope de 5 y el de 15 minutos |

Ningún recurso quedó como no obtenible. El límite común es el mismo en los
tres: la atribución llega hasta la rama, y el vínculo de rama a entregable es
una decisión pendiente, D6.

## Codex

### Dónde están los datos

| Fuente | Qué contiene | Volumen al 2026-09-13 |
|---|---|---|
| `~/.codex/sessions/` y `~/.codex/archived_sessions/` | Un rollout JSONL por sesión, con eventos fechados | 217 rollouts, del 2025-12-20 al 2026-09-13 |
| `~/.codex/state_5.sqlite`, tabla `threads` | Una fila por hilo: `tokens_used`, `git_branch`, `cwd`, `source`, fechas | 214 hilos |
| `~/.codex/thread_history_1.sqlite`, tabla `thread_turns` | Una fila por turno: `started_at`, `completed_at`, `duration_ms` | 2649 turnos |

Las bases SQLite están en modo WAL y no abren en solo lectura común. Abren con
el URI `file:<ruta>?immutable=1`, que no escribe ni toma locks.

### Qué expone

| Dato | Campo | Cobertura en blends |
|---|---|---|
| Tokens | Eventos `token_count`, con `last_token_usage` por llamada y `total_token_usage` acumulado por hilo | 17 de 22 sesiones |
| Marca de tiempo | `timestamp` en cada línea; `started_at` por turno | Todas |
| Rama | `session_meta.git.branch`, y `threads.git_branch` en SQLite | 20 de 22 sesiones |
| Tipo de sesión | `session_meta.source`: interactiva, `exec` o subagente | Todas |

Las 22 sesiones de Codex en blends corren en la raíz del clon. Ninguna en un
worktree.

### Semántica de los tokens

Medido sobre 27 172 llamadas distintas:

| Relación | Se cumple en |
|---|---|
| Los tokens cacheados están incluidos en los de entrada | 27 172 |
| La escritura de caché está incluida en los de entrada | 27 172 |
| El razonamiento está incluido en los de salida | 27 172 |
| El total es entrada más salida | 27 167 |

**El contexto de una llamada de Codex es `input_tokens`, sin sumarle los
cacheados.** Sumarlos contaría el caché dos veces. Es la misma magnitud que el
instrumento de Claude Code mide como entrada más creación de caché más lectura
de caché, porque ahí esos tres contadores son disjuntos.

### Tres trampas para un instrumento

- **Eventos repetidos.** 4876 de 32 048 eventos `token_count` repiten un acumulado ya visto. Hay que deduplicar por acumulado distinto. El registro nuevo `token_usage_record` trae un `response_id` que nunca se repite, pero solo aparece en 29 de 217 rollouts.
- **Caídas del acumulado.** El total acumulado baja 46 veces en 7 rollouts, sin compactación previa ni bifurcación de hilo. La causa no está verificada. En 4 de esos rollouts el total final queda por debajo del máximo, y uno es de blends en 2026-09: su total final es de 1,1 millones de tokens y su máximo de 6,7. **El instrumento tiene que sumar la entrada de cada llamada deduplicada, no leer el total final.**
- **La validación local no protege contra las caídas.** `threads.tokens_used` en SQLite coincide con el total final del rollout en los 200 hilos que tienen tokens en ambas fuentes. Confirma que las dos fuentes locales son consistentes, pero comparten el mismo total final, así que heredan la misma subestimación.

### Magnitud en blends, ciclo 2026-09

| Tipo de sesión | Sesiones | Tokens de entrada, suma por llamada | Con el total final |
|---|---|---|---|
| Interactiva | 6 | 12,9 M | 6,3 M |
| Subagente | 5 | 0,33 M | 0,33 M |
| `exec` | 7 | 0,04 M | 0,04 M |
| **Total** | **18** | **13,3 M** | **6,6 M** |

Contra los 3120 millones de tokens de contexto que midió el instrumento de Claude
Code en el mismo ciclo, Codex aporta el 0,43 %. Con el total final hubiera dado
la mitad.

### Atención

Las sesiones interactivas de Codex, desde VS Code o la app de escritorio, no
emiten eventos `user_message`. La señal de un turno humano es el inicio de cada
turno en `thread_turns.started_at`, que siempre trae un ítem de usuario. En
blends, en 2026-09, hay 63 turnos en sesiones interactivas y 2 en sesiones
`exec`. Las sesiones `exec` y los subagentes, entre ellos el guardián, son
automáticos y se excluyen por `source`.

## Cowork

### Dónde están los datos

Bajo `~/Library/Application Support/Claude/local-agent-mode-sessions/`, cada
sesión tiene dos cosas:

- **Un archivo de configuración** `local_<id>.json`, con carpetas elegidas, `cwd`, modelo, `createdAt` y `lastActivityAt`. No trae tokens ni rama.
- **Una carpeta de trabajo** donde la sesión corre Claude Code dentro de una VM. Adentro hay transcripts con el mismo formato que los de Claude Code, uno por sesión y uno por subagente, y un `audit.jsonl`.

### Qué expone

| Dato | Cobertura |
|---|---|
| Tokens | Sí: `message.usage` en los transcripts, con los mismos duplicados por id de mensaje que Claude Code. El `audit.jsonl` agrega eventos `result` con `modelUsage` por modelo, que podría servir de validación interna; no se verificó |
| Marca de tiempo | Sí: `timestamp` por línea |
| Turnos humanos | Sí: `origin.kind`, igual que Claude Code |
| Rama | **No.** Dentro de la VM, `gitBranch` vale `HEAD` en 3121 líneas y está vacío en 78. La carpeta del host se monta sin información de git |

### Uso en blends

Hay tres sesiones de Cowork en esta Mac, del 2026-01-25, del 2026-07-12 al
2026-07-14, y del 2026-07-15 al 2026-07-24. **Ninguna toca blends**: ni sus
carpetas elegidas ni su `cwd` apuntan al repo. Ninguna cae en el ciclo 2026-09.

Por las dos razones, sin rama y sin uso en blends, Cowork queda fuera del
veredicto de blends. Es la salida que la propuesta preveía para una herramienta
no medible.

## Consecuencias para la Fase 0

- **F1 queda cerrado.** Los tres recursos tienen serie reproducible y atribuible por rama sobre Claude Code y GitHub.
- **D6 limita a los tres recursos por igual.** Sin vínculo de rama a entregable, ninguna serie llega al entregable.

## Decisiones del PO sobre el cierre de F1

Tomadas el 2026-09-13, al leer este documento:

| Decisión | Valor |
|---|---|
| D4, cómo se usa la atención del PO | Se reporta como **banda**: el piso es la atención calculada con un tope de 5 minutos por hueco entre turnos, y el techo la calculada con 15. Ninguno de los dos valores se reporta solo |
| Instrumentación de Codex | **Diferida a la revisión de la Fase 0 del 2026-10-11.** Hoy aporta el 0,43 % del contexto de blends; se vuelve a medir con esta misma prueba, sabiendo que Codex es architect y code-reviewer en los bindings del proyecto |

Los dos topes no son una ventana mínima y una máxima de atención. Son dos
supuestos sobre el mismo hueco entre turnos consecutivos: con 5 minutos se asume
que un silencio largo es distracción, con 15 que es lectura o espera del agente.
La atención real de un ciclo está, con alta probabilidad, dentro de la banda. Por
rama, la banda es el rango entre las dos estimaciones, porque el reparto de los
tramos simultáneos puede darle a una rama más minutos con el tope bajo.

El instrumento `scripts/po-attention.mjs` implementa la banda como salida por
defecto. Si en la revisión se instrumenta Codex, el lector costaría un módulo en
`scripts/lib/`, con las tres trampas de arriba cubiertas por pruebas.

## Qué NO decide este documento

- No extiende los instrumentos a Codex ni a Cowork.
- No decide D6. D4 y la instrumentación de Codex quedan decididas arriba por el PO, no por este documento.
- No mide Codex fuera de blends ni fuera del ciclo 2026-09.
- No verifica la causa de las caídas del acumulado de Codex ni los totales del `audit.jsonl` de Cowork.
