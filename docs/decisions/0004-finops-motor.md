# 0004 — Motor de FinOps mudado a Brix, con ledger multi-proyecto

- Fecha: 2026-09-15
- Autoridad: Denis Paiva (product-owner)
- Estado: aceptada
- Origen: la [spec de diseño](../../../../docs/superpowers/specs/2026-09-15-brix-finops-motor-design.md)
  y su [plan de implementación](../../../../docs/superpowers/plans/2026-09-15-brix-finops-motor.md),
  con el registro 0003 (motor del Scoring Skill mudado a `vc/brix/`, mismo patrón,
  en la rama `tooling/brix-scoring-motor-migration`, no mergeada) como precedente
  directo: el mismo movimiento — motor del framework mudado a Brix, envoltorio
  delgado en `vc/tools/`, inversión de dependencia documentada — aplicado ahora
  al ledger FinOps.

## Qué decide este registro

1. **Mudar el motor de validación/agregación** de `vc/tools/` a
   `vc/brix/packages/cli/finops/`.
2. **Pasar de un ledger único** (`vc/finops/billing-ledger.json`) **a
   multi-ledger**: uno compartido (blends) y uno por proyecto graduado que
   tenga costo propio.
3. **La regla nueva:** todo proyecto bajo `vc/*/` tiene su propia carpeta
   `finops/`, con costo cero declarado explícitamente si no tiene ninguno —
   no una carpeta ausente.
4. **Migrar los datos reales de blends a ese modelo, hoy mismo** (no en una
   pieza aparte).

## Qué se mudó

| Qué                                        | Antes                                            | Ahora                                                                                          |
| ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Lógica de validación y agregación          | inline en `vc/tools/validate-billing-ledger.mjs` | `vc/brix/packages/cli/finops/lib/` + punto de entrada `vc/brix/packages/cli/finops/engine.mjs` |
| Schema del ledger                          | `vc/docs/standards/billing-ledger.schema.json`   | `vc/brix/packages/cli/finops/billing-ledger.schema.json`                                       |
| `vc/tools/validate-billing-ledger.mjs`     | motor completo                                   | envoltorio delgado, reexporta y delega a `engine.mjs`                                          |
| Ledger compartido de blends                | `vc/finops/billing-ledger.json` (18 ítems)       | mismo archivo, mismo lugar, 12 ítems (los `project: blends-portfolio`)                         |
| Ledger de Teyst                            | no existía                                       | `vc/teyst/finops/billing-ledger.json`, 6 ítems (los `project: teyst`)                          |
| Ledger de Brix / Melquisedec / Pinot Index | no existían                                      | `vc/<proyecto>/finops/billing-ledger.json`, `items: []` (verificado: sin costo propio hoy)     |

## Inversión de dependencia

Antes, `vc/tools/` contenía el motor completo del ledger FinOps y ningún
proyecto bajo `vc/*/` tenía que saber nada de su implementación: el framework
era dueño de la lógica, y el único ledger vivía en `vc/finops/`. Con este
registro esa dependencia se invierte: el motor —schema, validación y
agregación— nace y vive en `vc/brix/packages/cli/finops/`, y es
`vc/tools/validate-billing-ledger.mjs` el que pasa a depender de Brix,
reducido a un envoltorio delgado que reexporta y delega en `engine.mjs`.
Es el mismo argumento que sostiene el registro 0003 para el motor del
Scoring Skill: el framework compartido no es dueño de la lógica de dominio
de FinOps, la consume. `vc/tools/validate-versions.mjs` sincroniza su
`SCHEMA_PATH` contra la ubicación nueva por el mismo motivo — el framework
bump coordinado sigue tocando sus 9 puntos habituales, pero uno de ellos
ahora apunta a `vc/brix/`, no a `vc/docs/standards/`.

## Huecos conocidos

- **Sheets/Apps Script/BigQuery no se actualizan.** `vc/finops/apps-script/`
  y `vc/finops/integration.md` quedan sin tocar. `Code.gs`'s `LEDGER_ITEMS`
  es una lista mantenida a mano que hoy refleja un solo archivo — con
  multi-ledger, quien la mantenga tiene que mirar más de un archivo. No se
  automatiza en este registro.
- **Pieza 2 — scaffolding en `brix graduate`** queda pendiente: proponer
  automáticamente el `finops/billing-ledger.json` inicial de un proyecto
  nuevo al graduar, inspeccionando su código, sigue sin implementar.
- **Pieza 3 — motor de atribución por uso medido** queda pendiente:
  reemplazar el `allocationPercent` manual de los ítems de IA compartidos
  por un cálculo derivado de F1 vía M2 sigue sin implementar, y depende de
  que esta pieza (1) exista, cosa que este registro ya resuelve.

## Qué NO decide este registro

- **El scaffolding automático al graduar** (pieza 2 de la visión de tres
  piezas).
- **El motor de atribución por uso medido** (pieza 3).
- **No toca Sheets/Apps Script/BigQuery ni `legacy-projects.json`**
  (`vc/finops/apps-script/`, `vc/finops/integration.md`).
- **No toca la política de escasez de GitHub Actions**
  (`vc/docs/standards/github-scarcity.md`, variables `GH_SCARCITY_*`) — por
  decisión explícita del PO, si algún día se mueven es como una capacidad de
  CI/CD separada, no FinOps.
