# 0003 — Motor del Scoring Skill mudado a Brix

- Fecha: 2026-09-15
- Autoridad: Denis Paiva (product-owner), decisión tomada el 2026-09-13 al revisar `docs/plans/2026-09-13-fase-0-propuesta.md`
- Estado: aceptada
- Origen: el [registro 0002](./0002-role-bindings.md) fija este registro como el siguiente de la serie: "no mueve el motor del Scoring Skill. Ese es el registro siguiente, y trata la inversión de dependencia del framework hacia este proyecto."

## Qué decide este registro

1. **El motor real del Scoring Skill se muda** de `vc/tools/lib/` (framework) a `vc/brix/packages/cli/scoring/` (este proyecto).
2. **`brix tool score` deja de llamar a Gemini** y pasa a usar ese mismo motor.
3. **Tres decisiones de diseño que la propuesta del 13/9 no resolvía**, tomadas por el PO al ejecutar este registro (ver "Decisiones de diseño no cubiertas por la propuesta" más abajo).

## Qué se mudó

| Pieza                                                                                                                                                                               | Antes                                                                                        | Ahora                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scoring-engine.mjs`, `risk-analyzer.mjs`, `baseline-recommender.mjs`, `decision-registry.mjs`, `subfactor-contract.mjs`, `normalize.mjs`, collector de GitHub                      | `vc/tools/lib/`                                                                              | `vc/brix/packages/cli/scoring/lib/`                                                                                                |
| Punto de entrada explícito (`loadEvidenceInput`, `runEvaluation`, `renderReport`, las funciones narrativas, `resolveRoots`, `runEvaluateCommand`/`runDecideCommand`, `runScoreCli`) | vivía sin nombre propio dentro de `vc/tools/evaluate-tooling.mjs`                            | `vc/brix/packages/cli/scoring/engine.mjs`                                                                                          |
| Política congelada para el espejo standalone                                                                                                                                        | no existía                                                                                   | `vc/brix/packages/cli/scoring/default-scoring-policy.json` (copia de `vc/tooling/scoring-policy.json` al momento de este registro) |
| `brix tool score <pkg>` (llamaba a Gemini como subproceso)                                                                                                                          | `vc/brix/packages/cli/scripts/score-evaluator.js` + `vc/brix/packages/cli/scoring/matrix.md` | retirados; `brix tool score evaluate/decide` invoca `engine.mjs` directo                                                           |

El código se movió tal cual — mismo comportamiento, mismos comentarios, misma cobertura de tests (movidos de import, no reescritos). El único cambio de comportamiento real es cómo se resuelven `policyPath`/`outputDir`/`narrativeDocPath` (ver más abajo).

## Qué NO se mudó, y por qué

- **`vc/tools/validate-tooling.mjs`** (el gate de CI que verifica que toda skill activa tenga evaluación vigente) se queda en `vc/tools/`: valida datos del framework contra su propio roadmap, no es el motor de scoring.
- **La política canónica**, `vc/tooling/scoring-policy.json`, y **las evaluaciones**, `vc/tooling/evaluations/`, se quedan en `vc/tooling/`: son datos del framework — el registro de qué se evaluó y con qué pesos, compartido por todo el portfolio, no algo que un proyecto individual sea dueño de mover.
- **`vc/docs/standards/skills.md`** (este mismo estándar) no se muda: sigue siendo la política narrativa, solo actualiza el puntero a dónde vive el motor.

## Inversión de dependencia, aceptada explícitamente

Antes de este registro, `vc/tools/` (framework) nunca dependía de código dentro de `vc/<proyecto>/` — la dirección siempre fue la contraria: un proyecto depende del framework, no al revés. Con el motor mudado, eso cambia: `vc/tools/evaluate-tooling.mjs`, `vc/tools/backfill-tooling-evaluations.mjs` y `vc/tools/validate-tooling.mjs` (esta última solo para `evidenceInputFilePath`) ahora importan desde `vc/brix/packages/cli/scoring/`.

**Por qué se acepta.** El precedente más cercano, la [decisión 0002 de Pinot Index](../../../pinot-index/docs/decisions/0002-repo-extraction.md), cubre un proyecto dueño de una librería que otro proyecto consume — no cubre al framework mismo dependiendo de un proyecto. Este caso es distinto: Brix es, por dominio, la pieza que mide y puntúa — el Scoring Skill es exactamente lo que Brix existe para hacer. El framework delegando en Brix para `/tool` es la misma relación que ya existe en la otra dirección para todo lo demás (Brix depende del framework para gobernanza, versiones, CI): acá el dominio específico manda, no la capa arquitectónica. La alternativa — mantener una copia del motor en `vc/tools/` y otra en Brix — habría significado dos fuentes de verdad para el mismo cálculo, exactamente el tipo de deriva que el Scoring Skill existe para prevenir en otros candidatos.

**Qué no cambia por esto.** `vc/tools/validate-tooling.mjs` y la política siguen siendo del framework. La inversión es puntual (el motor de cálculo), no general — el framework no pasa a depender de Brix para nada más.

## Decisiones de diseño no cubiertas por la propuesta

La propuesta del 13/9 fijó QUÉ se muda y por qué, pero no resolvía tres preguntas de diseño que aparecieron al ejecutar la migración. Las tres las decidió el PO en chat el 2026-09-15, antes de escribir código:

| Pregunta                                                                                                                                                | Decisión                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vc/tools/backfill-tooling-evaluations.mjs` importa el mismo motor que `evaluate-tooling.mjs` pero la propuesta no lo mencionaba como envoltorio        | Se trata igual: también pasa a importar desde `vc/brix/`. Dejarlo importando de un `vc/tools/lib/` vacío lo habría roto en silencio.                                                                                                                                                                           |
| En el espejo standalone, `vc/tooling/scoring-policy.json` no existe — ¿cómo resuelve `brix tool score` su política ahí?                                 | Default embebido en el paquete (`default-scoring-policy.json`), con la misma precedencia que el resto del CLI: flag > `brix.config.json` del proyecto que invoca > default embebido. Dentro de blends, el `brix.config.json` de la raíz fija la política real; en el espejo, sin ese archivo, usa el embebido. |
| `brix tool score <paquete>` era un solo comando con un llamado a Gemini; el motor nuevo separa evidencia → evaluate → decide — ¿cómo queda la interfaz? | Espeja `evaluate`/`decide`, los mismos subcomandos que `evaluate-tooling.mjs` y que `/tool`: `brix tool score evaluate --input <archivo>` y `brix tool score decide --id ... --status ...`. Coherente con el resto del Scoring Skill, aunque cambia la forma de invocar el comando respecto de antes.          |

## Portabilidad hacia el espejo

`vc/brix/packages/cli/scoring/engine.mjs` resuelve tres rutas —`policyPath`, `toolingRoot` (el directorio que contiene `evaluations/`), `narrativeDocPath`— con la misma disciplina de parametrización que ya usan `graduate`/`idea`/`ci` (`docs/lifecycle/decoupling-brix.md`, commit `da5e013`): flag de línea de comandos > `brix.config.json` del proyecto que invoca > default embebido.

- Dentro de blends, el `brix.config.json` de la raíz declara `score.policyPath`, `score.outputDir` y `score.narrativeDocPath` apuntando a las rutas reales (`vc/tooling/scoring-policy.json`, `vc/tooling`, `vc/docs/tooling/evaluations.md`) — el envoltorio nunca usa el embebido.
- En `denispaiva/brix` standalone, sin ese `brix.config.json` (el suyo propio solo fija `score.outputDir: "."`), `brix tool score` usa `default-scoring-policy.json` y escribe en `./evaluations/`. `narrativeDocPath` queda sin configurar: `evaluate`/`decide` simplemente se saltean la actualización de doc narrativo — esa convención es de blends, no del motor.
- La política embebida es una copia congelada al momento de este registro. Si la política canónica cambia después, el embebido queda desactualizado hasta que alguien lo vuelva a copiar — riesgo aceptado, documentado en "Huecos conocidos".

## Huecos conocidos

- **La política embebida se desincroniza con el tiempo.** No hay mecanismo automático que la mantenga igual a `vc/tooling/scoring-policy.json`; una evaluación corrida en el espejo después de un cambio de política real usará pesos viejos, sin aviso.
- **`brix tool score` no tiene pruebas end-to-end contra el espejo real** (`denispaiva/brix`), solo contra un proyecto temporal que imita su layout (`vc/brix/tests/scoring/cli-wiring.test.mjs`).
- **El CLI de Brix venía sin pruebas propias** (huella conocida desde el [registro 0002](./0002-role-bindings.md)). Esta migración suma las primeras: `vc/brix/tests/scoring/resolve-roots.test.mjs` (7 pruebas de la resolución de rutas) y `vc/brix/tests/scoring/cli-wiring.test.mjs` (5 pruebas de extremo a extremo de `brix tool score`), corriendo el binario real. La deuda de pruebas del resto del CLI (`idea`, `graduate`, `ci`) sigue abierta.

## Qué NO decide este registro

- **No cambia la política de scoring** (pesos, umbrales, niveles de riesgo) — sigue siendo `vc/tooling/scoring-policy.json`, sin tocar.
- **No mueve `vc/tools/validate-tooling.mjs`** ni el gate de CI que corre.
- **No publica el paquete en npm** ni cambia nada de la estrategia de espejo — ver [`docs/lifecycle/decoupling-brix.md`](../../../../docs/lifecycle/decoupling-brix.md).
- **No resuelve la deuda de pruebas** de `idea`/`graduate`/`ci`, solo suma las de `tool score`.
