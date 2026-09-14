# F3: unidad de resultado, asesina 2

- Fecha: 2026-09-13
- Tarea: T-09, frente F3 de la Fase 0
- Estado: **comparación cuantitativa completa; unidad pendiente de elección por el PO**
- Decide: Denis Paiva (product-owner)
- Origen: [propuesta de la Fase 0](../plans/2026-09-13-fase-0-propuesta.md), frente F3

## Qué responde

La asesina 2 pregunta qué unidad de resultado cubre ideas y proyectos. La
propuesta plantea tres candidatas — entregable del `.roadmap.json`, vagón del
tren, PR mergeado — y pide compararlas con tres criterios: si cubren ideas y
proyectos, si se cuentan sin trabajo manual, y cuánto se prestan a premiar
actividad en lugar de progreso (la tensión C3). El criterio de cierre admite
una unidad elegida por el PO con la comparación a la vista, **o el registro de
que ninguna sola alcanza y hacen falta dos**.

Este documento entrega la comparación. No elige.

## Método

Ventana: 2026-08-06 (bootstrap del repo) a 2026-09-13 inclusive, sobre
`denispaiva/blends`.

- **Entregable:** serie de
  [`scripts/kpi-history.mjs`](../../scripts/kpi-history.mjs), versionada en
  [`data/kpi-history/2026-09-13.json`](../../data/kpi-history/2026-09-13.json)
  (F2). Recorre la historia first-parent de `main` y cuenta los entregables de
  todos los `.roadmap.json`, sin el de ejemplo.
- **Vagón:** `gh pr view <n> --json mergeCommit` sobre cada PR `tren/...`
  mergeado, más `git log --first-parent` sobre el segundo padre del merge para
  leer los commits `merge: vagón i/n — <rama>`. Los archivos tocados por cada
  vagón salen de `git diff --name-only` contra su base.
- **PR mergeado:** `gh pr list -R denispaiva/blends --state merged --limit 500
  --json number,title,headRefName,mergedAt,additions,deletions,changedFiles,files`.

## Comparación cuantitativa

### Criterio 1 — cubre ideas y proyectos

| Candidata | Ideas | Proyectos | Framework/mixto | Lectura |
|---|---|---|---|---|
| Entregable | 3 de 30 (10 %), 1 por cada una de las 3 ideas activas | 27 de 30 (90 %) | — | Cubre ambos por diseño, pero una idea nunca tuvo más de 1 entregable declarado en toda su historia. La cobertura es estructural, no proporcional |
| Vagón (n=37) | 4 (11 %), toca solo `ideas/` | 4 (11 %), toca código de `vc/teyst`, `vc/pinot-index`, `vc/melquisedec` o `vc/brix` | 11 framework (30 %) + 18 mixto/ambiguo (49 %) | Casi la mitad de los vagones no se clasifica limpio en ninguna de las dos categorías: mezclan rutas de framework con código de proyecto en el mismo commit |
| PR mergeado (n=209) | 21 (10 %) | 94 (45 %) | 36 framework (17 %) + 58 mixto/ambiguo (28 %) | Proporción de ideas similar al vagón; menos ambigüedad relativa (28 % vs 49 %), pero la unidad está perdiendo volumen: ver la nota de tendencia abajo |

**Nota de tendencia, solo sobre PR mergeado.** El volumen semanal de PRs
individuales se desplomó cuando entró el tren: 47 en la semana del 17-23 de
agosto, 50 la del 24-30, 95 la del 31 de agosto al 6 de septiembre (el pico,
mismo día en que entró el primer tren) y **3** en la semana del 7 al 13 de
septiembre, reemplazadas por 5 PRs de tren. Es el "en contra" que la propuesta
ya anticipaba — "el flujo de blends integra sin PR individual" — verificado:
no es una fricción ocasional, es la forma en que ya integra la mayoría del
trabajo reciente.

### Criterio 2 — se cuenta sin trabajo manual

| Candidata | Resultado | Evidencia |
|---|---|---|
| Entregable | Sin trabajo manual | Un solo comando (`kpi-history.mjs`) reconstruye la serie completa desde `git log`; ya es el instrumento que F2 usa para C5 |
| Vagón | **Con trabajo manual en 2 de 6 trenes (33 %)** | `tren/2026-09-13` (PR #243) tiene un commit `fix: vagón 5/5 — aplicar Prettier...` encima del último `merge: vagón`, que rompe el patrón mecánico "contar hasta el primer commit que no sea `merge: vagón`" — hubo que decidir a mano que ese fixup no corta la cuenta. `tren/2026-09-12` (PR #242) numera sus vagones `10/12`, `9/12`, `2/12`, no contiguos, y hubo que verificar el conteo (3) contra el título del PR a mano. Además, las carpetas `archive/<fecha>/` de la rama `queue` no siempre coinciden con la fecha real de merge: las 6 entradas en `archive/2026-09-01/` en realidad se integraron por los PR #241 y #242 el 2026-09-11/12, no el 1° de septiembre |
| PR mergeado | Sin trabajo manual | Un solo comando (`gh pr list --json ...`) trae número, rama, fecha, tamaño y archivos. Ninguna clasificación necesitó leer el cuerpo de un PR a mano |

### Criterio 3 — premia actividad en lugar de progreso (tensión C3)

| Candidata | Solo doc/evaluación | Con código o datos | Lectura |
|---|---|---|---|
| Entregable | — | — | No aplica el mismo corte; en su lugar, el estado declarado **es** la señal de progreso, y ahí es donde falla: **0 de 30 entregables llegó a `accepted` en toda la historia** (mismo hallazgo que C5). Solo 13 de 30 (43 %) tienen movimiento hacia adelante confirmado (entraron a `review`, con mediana de 24 días); los otros 17 no tienen transición confirmada en la serie agregada disponible |
| Vagón | 8 de 37 (22 %) | 29 de 37 (78 %) | Une el tamaño de una rama entera con una etiqueta de "1 resultado", pero al menos una quinta parte de esos resultados es documentación o registro de evaluación, sin tocar código ni datos |
| PR mergeado | 61 de 209 (29 %) | 148 de 209 (71 %) | Proporción similar o algo peor que el vagón. Mediana 5 archivos y 215 líneas por PR, pero la media (8,56 archivos, 931,6 líneas) es mucho más alta que la mediana: la distribución tiene cola larga, así que "1 PR = 1 resultado" es fácil de inflar partiendo trabajo en PRs chicos, o de comprimir agrupando mucho trabajo en uno solo |

## Hallazgos de calidad de datos

- **El vagón, la única de las tres candidatas cuyo conteo mecánico falló en datos reales**, y en un tercio de los trenes del ciclo. Cualquier instrumento que cuente vagones de forma reproducible necesita manejar fixups post-vagón y numeración no contigua, o va a requerir el mismo juicio manual que tuvo esta comparación.
- **La categoría "framework/mixto" es la más grande en vagones (49 %) y sigue siendo grande en PRs (28 %).** No es evidencia de que las unidades sean ambiguas en sí — es que la taxonomía de tres categorías (idea/proyecto/framework) usada acá no cubre rutas frecuentes como `vc/framework/.roadmap.json`, `AGENTS.md`, `.claude/`, `SCOPE-EXCEPTION.md` o `vc/finops/billing-ledger.json`. Una clasificación más fina probablemente baja ese resto, pero no lo elimina: framework y proyecto se tocan juntos con frecuencia en este repo (el ejemplo más reciente es este mismo mecanismo: M3 toca `roadmap/`, `vc/docs/` y `vc/tools/` en una sola rama fuera de cualquier proyecto).
- **La serie de `kpi-history.mjs` no tiene, hoy, una transición de estado por entregable y por día para los que no están en revisión.** Cubre bien "cuántos por estado, por día" y "desde cuándo está cada uno en revisión", pero no "quién se movió de dónde a dónde" para los 17 entregables que no están en revisión ahora. Si el PO elige el entregable como unidad, esto es un hueco a cerrar antes de que sirva para medir progreso con precisión.

## Síntesis para el PO

No autoriza nada — es una lectura de la tabla de arriba, no una recomendación
con peso. Ningún candidato pasa los tres criterios limpio:

- **Entregable:** mejor en cobertura de ideas/proyectos y en conteo sin
  trabajo manual, pero es el que peor mide progreso *en la práctica* — el
  mismo vacío que diagnosticó C5. Además es el más grueso: una idea entera
  cabe en 1 entregable.
- **Vagón:** el único con fallas mecánicas reales en el conteo (2 de 6
  trenes), pero es el más granular y el de cadencia más alta — se produce
  cada vez que algo se integra, sin esperar a que alguien declare un estado.
- **PR mergeado:** el más fácil de contar sin trabajo manual, pero es la
  unidad que el propio flujo de `blends` está dejando de producir para la
  mayoría del trabajo — y la más volátil frente al tamaño real del cambio.

Si ninguna sola alcanza, la combinación que estos números sugieren —sin
decidirla— es **entregable para progreso, vagón para cadencia**: el
entregable ya es la unidad que declara intención y estado, y el vagón ya es la
unidad que el tren produce sin pedirle nada a nadie. Esa combinación no
resuelve el vacío del KPI por sí sola: sigue dependiendo del mecanismo M2
(productor) para que el entregable acumule datos reales.

## Qué NO decide este documento

- No elige la unidad de resultado. Esa es la decisión del PO que cierra F3.
- No corrige la clasificación de ideas/proyectos/framework: usa una taxonomía
  de tres categorías, declarada arriba, que deja un resto grande sin afinar.
- No construye el instrumento que contaría la unidad elegida de forma
  continua — eso es trabajo aparte, después de la elección.
- No resuelve el hueco de transición por entregable descrito arriba.
