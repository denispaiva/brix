# 0002 — Bindings de roles y aprobación de la Fase 0

- Fecha: 2026-09-13
- Autoridad: Denis Paiva (product-owner), instanciado sobre la matriz de Pinot Index por decisión del PO
- Estado: aceptada
- Origen: el [acta de graduación](./0001-graduation.md) fija los role bindings como el siguiente registro de decisión del proyecto

## Qué decide este registro

1. **Los bindings de roles de Brix**, en [`docs/governance/role-matrix.json`](../governance/role-matrix.json), copiados de los de Pinot Index por decisión del PO del 2026-09-13.
2. **La aprobación formal de la Fase 0**, según la [propuesta](../plans/2026-09-13-fase-0-propuesta.md), con tres decisiones que la destraban: D1, D3 y D7.

## Bindings

| Rol | Binding primario | Familia | Clase | Fallback |
|---|---|---|---|---|
| `product-owner` | humano | `human` | `human` | ninguno |
| `architect` | Codex | `openai-reasoning` | `frontier` | Claude frontier |
| `senior-developer` | Claude | `anthropic-claude` | `frontier` | Codex balanced |
| `code-reviewer` | Codex | `openai-reasoning` | `frontier` | Claude frontier |
| `researcher` | Claude | `anthropic-claude` | `economy` | Codex economy |
| `finops-analyst` | Claude | `anthropic-claude` | `economy` | Codex economy |

Se copian tal cual de Pinot Index porque son el único precedente del portfolio con acta propia, y porque ya ejercen la decorrelación P0 que el estándar exige. Lo que cambia respecto de Pinot son las descripciones de cada rol, ajustadas a lo que Brix hace.

## Decorrelación P0/P1 (invariante 3)

La superficie central de Brix es `business.rules`: las reglas de medición. Quién ejecuta y quién audita están en familias distintas por diseño:

| Rol | Sobre `business.rules` | Familia |
|---|---|---|
| `senior-developer` | ejecuta | `anthropic-claude` |
| `code-reviewer` | audita | `openai-reasoning` |

La misma separación cubre `finops.budget`, `finops.unit-economics`, `ecosystem.configuration`, `cloud.architecture` y `presentation.mobile`. `governance.research` es P2 y no exige decorrelación. `validate-governance.mjs` lo verifica: la matriz valida sin excepciones.

## Alcance de la matriz instanciada

Las ocho superficies son las mismas que declara Pinot Index, con las autoridades canónicas del estándar:

- `product.vision`, P0: el alcance de la Fase 0, las decisiones D1 a D7 y los veredictos de gate. El PO decide.
- `business.rules`, P0, superficie central: las reglas de medición de los tres recursos escasos. Cómo se atribuyen minutos, contexto y atención a una rama y a un entregable, y qué cuenta como serie reproducible. El architect decide el contrato, el senior-developer ejecuta, el code-reviewer audita.
- `governance.research`, P2: los frentes F2, F3 y F4, y las evaluaciones con `/tool`. El researcher decide y ejecuta.
- `finops.budget` y `finops.unit-economics`: obligatorias en toda matriz del framework, y acá con carga real. Brix mide exactamente lo que el finops-analyst valida, y la línea de Gemini en el ledger sale de esta superficie. `requiredBillingProviders` suma `google` por esa API.
- `ecosystem.configuration`, P1: `brix.config.json`, los manifiestos, la configuración del CLI y el workflow del espejo.
- `cloud.architecture` y `presentation.mobile`: declaradas por invariante del framework, sin carga. Brix corre en local, y su única pieza en la nube es el CI del espejo. No tiene interfaz móvil.

No se declaran `data.persistence`, `presentation.api` ni `presentation.ui`. La capa `data` de la arquitectura queda reservada en `data/**` hasta que el PO decida D5, dónde se registran los tres recursos. Los comandos del CLI son una superficie de presentación que el acta de graduación congeló hasta el cierre de la Fase 0, así que no se les asigna autoridad todavía.

## Aprobación de la Fase 0

Decidido por el PO el 2026-09-13, al revisar la propuesta:

| Decisión | Valor |
|---|---|
| Propuesta de la Fase 0 | **Aprobada** tal como está en `docs/plans/2026-09-13-fase-0-propuesta.md` |
| D1, dónde viven los instrumentos | `vc/brix/scripts/`, fuera de los comandos del CLI |
| D3, reparto de minutos de un tren | 1/N entre sus vagones, sobre el total facturado, arranque del runner incluido. La suma de los vagones tiene que coincidir con la medición del monitor de escasez |
| D7, fecha de revisión | 2026-10-11, cuatro semanas después de la graduación |

D2, D4, D5 y D6 quedan abiertas hasta que F1 tenga datos.

Con la aprobación quedan habilitados, en este orden: los instrumentos de F1 empezando por los minutos de Actions, F2 en paralelo, la línea de Gemini en el ledger en su rama `finops/`, y después de este registro la migración del motor del Scoring Skill con su propio registro.

## Huecos conocidos

- **El CLI no tiene pruebas propias.** El gate `unit-tests` declara `node --test vc/brix/**/*.test.mjs` y hoy no hay ningún archivo que lo satisfaga. Toda pieza nueva de la Fase 0 entra con pruebas, y las pruebas del CLI existente son deuda registrada.
- **`validate-governance.mjs` no corre en CI.** Ningún job de `blends-ci.yml` ni paso de `npm run verify` lo invoca. Esta matriz se validó a mano al instanciarla. Incorporarlo al job de gobernanza es un cambio de CI fuera de este registro.
- **`rulesFiles` declara `AGENTS.md` por exigencia del validador.** Brix no tiene uno propio: rige `vc/AGENTS.md`, un nivel arriba.
- **El gate `build` es un humo.** Corre `format:check` y el binario sin argumentos. Es lo que falló en el tren del 2026-09-13, así que queda declarado como gate.

## Qué NO decide este registro

- **No cambia los bindings del framework** ni los de ningún otro proyecto.
- **No decide D2, D4, D5 ni D6.**
- **No mueve el motor del Scoring Skill.** Ese es el registro siguiente, y trata la inversión de dependencia del framework hacia este proyecto.
- **No registra la línea de Gemini en el ledger.** Va en su rama `finops/`.
- **No incorpora `validate-governance.mjs` al CI.**
