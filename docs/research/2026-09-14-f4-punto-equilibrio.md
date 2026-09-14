# F4: punto de equilibrio del tooling de contexto — asesina 3

## Qué responde

Si mantener un integrador de code-mode o de gateway MCP se justifica hoy,
midiendo el costo de operarlo contra el ahorro que produciría, en los tres
recursos escasos de Brix — nunca en dinero, porque las suscripciones
(Claude Code, Codex, Cowork) son de tarifa plana.

## Método

Tres tareas, en el orden de [la propuesta de Fase
0](../plans/2026-09-13-fase-0-propuesta.md#f4-punto-de-equilibrio-del-tooling-de-contexto-asesina-3):

1. Evaluar con `/tool` (Scoring Skill) un candidato concreto de code-mode y
   uno de gateway MCP unificado.
2. Estimar el costo de operar cada componente en los tres recursos escasos.
3. Estimar el ahorro con la serie de contexto real de F1, ubicando dónde se
   concentra el consumo.

## Tarea 1: las dos evaluaciones

Candidatos elegidos por señales de comunidad y actividad entre varias
alternativas reales investigadas (repos con nombres y fechas verificables,
no ejemplos hipotéticos):

| Candidato | Alternativas descartadas | Por qué este |
|---|---|---|
| `universal-tool-calling-protocol/code-mode` | `elusznik/mcp-server-code-execution-mode` (339 ⭐, sin push desde 2025-12-05 — 9 meses), `janwilmake/agent-codemode` (29 ⭐, creado hace un mes) | 1.563 ⭐, push hace 3 semanas (2026-08-25) |
| `mcpjungle/MCPJungle` | `adamwattis/mcp-proxy-server` (203 ⭐, sin push desde 2025-02-02 — año y medio), `lucky-aeon/mcp-gateway` (34 ⭐, sin licencia) | 1.255 ⭐, "unified MCP gateway" en su propia descripción, push hace 6 semanas |

Resultado de la evaluación completa (los 23 subfactores del Scoring Skill,
`vc/tooling/evaluations/{code-mode,mcpjungle}.evaluation.json`):

| | `mcpjungle` | `code-mode` |
|---|---|---|
| Score | 49,0/100 | 55,2/100 |
| Riesgo | high | **critical** |
| Recomendación | `do_not_advance` | `do_not_advance` |
| Decisión del PO | **Rejected** | **Rejected** |

**Ninguno de los dos cruzó la vara de evaluación.** El riesgo `critical` de
`code-mode` no es una interpretación — su propio README documenta que el
plugin `@utcp/cli` permite ejecutar comandos locales arbitrarios. Además, el
harness detectó y neutralizó contenido con forma de instrucción al leer el
repo de `code-mode` (probablemente su `SKILL.md`, pensado para que lo lea un
agente) — dato de seguridad aparte del score, registrado en el commit de la
evaluación.

## Tarea 2: costo de operación, por recurso

Con ambos candidatos rechazados, esto queda como estimación informativa —
lo que habría costado, no una decisión pendiente.

| Recurso | `mcpjungle` (gateway) | `code-mode` (UTCP) |
|---|---|---|
| Contexto | Mientras coexistan las dos formas de conectar MCP (directa y por gateway), el contexto de sesión probablemente **aumenta**, no baja: hay que declarar ambas. Solo baja si los ~30 servidores migran por completo, sin ruta de importación masiva documentada. | Reducción solo si el agente adopta activamente el modo código en vez de llamadas directas — no es automático, y hoy exige un sistema de configuración paralelo (`.utcp_config.json`) que no reemplaza al existente. |
| Minutos de Actions | Ninguno directo, pero exige un servicio siempre-activo con su propia base de datos en cada entorno donde corran sesiones — carga operativa nueva, sumada, no CI en sí. | Ninguno: corre local, sin servicio persistente. |
| Atención del PO | Alta: instalar y mantener el servicio, decidir modo `development` vs `enterprise` (auth/ACL), re-registrar ~30 servidores a mano vía CLI, reconfigurar cada cliente (Claude Code, Codex, Cowork) para apuntar al gateway. Revertirlo cuesta lo mismo, en reversa. | Moderada para configurar; alta y recurrente para *auditar* — el riesgo `critical` de ejecución arbitraria obliga a revisar cada "manual" antes de registrarlo, no es un costo de una sola vez. |

## Tarea 3: dónde se concentra el consumo (datos reales de F1)

Serie real del ciclo 2026-09 (`vc/brix/data/context-window/2026-09.json`,
instrumento cerrado en T-06):

- **3.120.091.442 tokens de contexto** en el ciclo, 12.484 llamadas, 110
  sesiones.
- **98,5 % viene de caché** (`cacheReadTokens`: 3.072.708.121). La creación
  de caché fresca es solo 47.336.221 tokens, y el input sin caché, 47.100.

Esto acota el ahorro real que un code-mode o gateway podrían producir: las
cifras de los vendors (Cloudflare 1,17 M → 1.000; Anthropic 150.000 → 2.000)
describen el costo de **declarar** los esquemas MCP al arrancar una sesión —
la parte que se paga una vez y después se sirve desde caché. Con un
`cacheReadPercent` del 98,5 %, la enorme mayoría del consumo mensual de Brix
ya es barata por estar cacheada; el espacio de ahorro real está acotado a
esa porción fresca de cada sesión nueva (47,3 M tokens del ciclo), no al
total de 3.120 M.

Un segundo límite, estructural: **los servidores MCP de Blends no están
declarados en el repo** — se configuran del lado del cliente de Claude
Code, por sesión y por persona. Ni un code-mode ni un gateway implementados
como tooling del repo tienen autoridad sobre qué carga una sesión
interactiva como esta a menos que cada persona reconfigure su propio
cliente. El punto de apalancamiento no es de repo, es de configuración
individual — lo que sube el costo real de adopción por encima de lo que la
Tarea 2 ya describe.

## Punto de equilibrio

**No hay equilibrio que calcular con estos dos candidatos**: los dos
fueron rechazados en la evaluación misma — antes de llegar a pesar costo
contra ahorro, el candidato ya no pasaba el umbral de riesgo y calidad.
Se registra la segunda salida del criterio de cierre de F4: *"o el registro
de que con un solo integrador no hay equilibrio"*.

Esto no cierra la pregunta genérica de si *algún* code-mode o gateway
podría valer la pena algún día — cierra que estos dos, evaluados con
evidencia real el 2026-09-14, no. Una futura re-evaluación (`--review-at
2026-12-14` en ambos registros) puede encontrar un panorama distinto si el
mantenimiento de cualquiera de los dos se retoma, o si aparece un candidato
nuevo con mejor higiene de seguridad y una ruta de migración documentada.

## Qué NO decide este documento

No autoriza nada nuevo — las dos decisiones que contiene (rechazar
`mcpjungle` y `code-mode`) ya las tomó el PO en el paso 5-7 del Scoring
Skill, antes de escribir esto. No evalúa Context Graphing (`graphify`/
`graft`), que `ideas/brix/SPEC.md` mencionaba como tercer componente pero
que la propuesta de Fase 0, posterior y aprobada, dejó fuera del alcance de
F4 (dos candidatos, no tres). No decide la salida del paso 2 de la
exploración de Brix (gate, extensión declarada o archivo) — esa decisión
es de T-04, más amplia que F4, y sigue abierta.
