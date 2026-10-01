# 0005 — Dónde se registran los tres recursos (D5) y cómo una rama se vincula a un entregable (D6)

- Fecha: 2026-10-01
- Autoridad: Denis Paiva (product-owner). D5 y D6 las decidió el 2026-09-14, antes de que se escribiera M2. El destino actual del registro lo decidió el 2026-10-01, al conectar M2 al reciclado (T-13).
- Estado: aceptada
- Origen: la [revisión de la Fase 0](../plans/2026-10-01-revision-fase-0.md) encontró que D5 y D6 solo constaban en la cabecera de `vc/tools/produce-resource-actuals.mjs` y en los mensajes de los commits `85f193f1` y `29d23fda`, sin un registro de decisión. Este registro cierra ese hueco (T-17).

## Qué decide este registro

Asienta, con su fecha y su porqué, dos decisiones que la [propuesta de la Fase 0](../plans/2026-09-13-fase-0-propuesta.md) dejó abiertas para el PO:

1. **D5: los tres recursos (minutos de Actions, ventana de contexto y atención del PO) van a un registro paralelo, sin extender el esquema de `actuals`.**
2. **D6: una rama se vincula a su entregable con una entrada `rama:<nombre>` en `performance.evidence`, sin agregar un campo nuevo.**

Además deja escrito un cambio posterior en el destino del registro de D5: desde el 2026-10-01 vive en la rama `queue` y no en `vc/brix/data/`.

## D5: registro paralelo

**Las opciones** (propuesta, decisión 5): extender el esquema de `actuals`, que es un cambio de estándar, o llevar un registro paralelo dentro de Brix.

**La decisión** (2026-09-14): registro paralelo, un archivo por ciclo, con un registro por rama mergeada. Cada registro lleva la rama, el PR del tren, el ciclo, el entregable resuelto (o por qué no se resolvió) y la medición de cada recurso, o `sin-datos` cuando el recurso no tiene serie para ese ciclo.

**Por qué:**

- Lo que piden `actuals` y `measurementStatus: "measured"` es de otro eje. `roadmap/build.mjs` exige defectos (`P0`, `P1`, `P2`, `escaped`) y tokens de retrabajo y refactor, y nada de lo que mide F1 cubre esos campos. Meter los tres recursos ahí obligaría a inventar ceros para el resto. Es justo la medición falsa que el [diagnóstico C5](../research/2026-09-13-diagnostico-kpi-c5.md) identificó como causa del KPI vacío.
- Un registro paralelo no toca el estándar del roadmap ni su `schemaVersion`. Se puede cambiar o retirar sin migrar los `.roadmap.json` del portfolio.
- Por la misma razón, M4 (`vc/tools/link-resource-evidence.mjs`) solo agrega a `performance.evidence` un puntero `resource-actuals:<ciclo>#<rama>` y deja `measurementStatus` en `pending`. Para pasar a `accepted`, el entregable sigue necesitando el waiver de M3.

**Destino del registro**, que cambió una vez:

| Desde      | Dónde                                                              | Quién lo escribe                                       | Decisión                            |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------- |
| 2026-09-14 | `vc/brix/data/resource-actuals/<ciclo>.json`, en el árbol del repo | `produce-resource-actuals.mjs`, corrido a mano         | D5 original                         |
| 2026-10-01 | rama huérfana `queue`, `resource-actuals/<ciclo>.json`             | `recycle.mjs --after-train`, después de drenar la cola | PO, 2026-10-01, al implementar T-13 |

El cambio de destino no cambia D5: el registro sigue siendo paralelo y fuera del esquema. Lo que cambió es dónde queda guardado. El reciclado corre fuera de cualquier rama de trabajo, y la rama `queue` ya es el lugar de los datos que escribe una máquina. Así el registro queda guardado en el momento, sin tren, sin batería y sin minutos de Actions. M4 lo lee de `origin/queue`, con `--actuals <archivo>` como alternativa explícita y la ruta vieja como último recurso.

## D6: `rama:<nombre>` en `performance.evidence`

**Las opciones** (propuesta, decisión 6): una entrada en `evidence`, que el esquema ya admite, o un campo nuevo en el entregable.

**La decisión** (2026-09-14): una entrada de texto con la forma exacta `rama:<nombre>` (por ejemplo `rama:feat/teyst-fase-4-5-t3a-ronda`) en el arreglo `performance.evidence` del entregable que la rama implementa.

**Por qué:**

- `performance.evidence` ya es un arreglo de strings libres, así que la convención es aditiva. No hay cambio de esquema ni de `schemaVersion`, ni en el estándar ni en `roadmap/build.mjs`.
- Un entregable puede declarar varias ramas, una entrada por rama.

**Reglas de resolución** (implementadas en `vc/tools/lib/resource-actuals.mjs`):

- Una rama que ningún entregable declara queda `sin-entregable`. Su consumo se registra igual, pero no llega a ningún entregable.
- Una rama que declaran dos o más entregables queda `ambiguo`, con los candidatos listados, y no se asigna a ninguno. Nunca se reparte el consumo entre ellos.

**Límite conocido:** las sesiones que trabajan sobre `main` no tienen rama de trabajo, así que su consumo no se atribuye a ningún entregable. Ya lo anticipaban los riesgos de la propuesta.

## Estado al 2026-10-01

- **D5:** M2 está conectado al reciclado, en la rama `chore/recycle-resource-actuals`, que todavía no está en `main`. Todavía no se produjo ningún registro con el destino nuevo.
- **D6:** 0 de los 10 `.roadmap.json` usan `rama:`, así que M2 todavía no resolvería ningún entregable. Declarar las ramas de los entregables activos es T-14.

## Qué NO decide este registro

- **No decide qué entregables declaran qué ramas.** Eso es T-14.
- **No decide cuándo se producen las series de F1 de cada ciclo.** Eso es T-16.
- **No cambia la regla de aceptación.** `accepted` sigue exigiendo medición completa o el waiver de M3 con motivo y fecha.
