# 0008 — Frontera operativa entre Blends y Brix

- Fecha: 2026-10-18
- Autoridad: Denis Paiva (product-owner)
- Estado: aceptada
- Origen: el pedido `BL-20261016-frontera-blends-brix` (opción A, recomendada por
  arquitectura y decidida por el PO el 2026-10-18). Precisa la definición del PO
  del 2026-09-25 que abre
  `brix-capabilities.md` (precursor privado, `vc/docs/tooling/brix-capabilities.md` en `4742bb99`): Brix ejecuta
  las buenas prácticas de ingeniería; Blends gestiona el portfolio con ciclo de
  vida y control de eficiencia.

## Qué decide este registro

La definición del 2026-09-25 no daba un criterio que se pudiera comprobar, y el
código la cruza en los dos sentidos: hay motores portables en `vc/tools` (backlog,
tren, validadores) y vocabulario de ciclo de vida de Blends dentro de Brix (el
gate de graduación que nombra `brix idea`). Este registro fija la frontera.

1. **Blends decide y guarda el estado del portfolio:** ideas, roadmaps, sprints,
   backlog, cola y tren, escasez, actas, estándares y los valores de política.
2. **Brix provee mecanismos e instrumentos portables.** Una capacidad es de Brix
   si cumple **las tres** condiciones:
   1. **Funciona en un repositorio graduado**, fuera del monorepo de Blends.
   2. **No conoce ningún producto ni ruta de Blends:** todo le llega por
      configuración o por un driver.
   3. **Es mecanismo, no decisión:** calcula, ejecuta o valida; no fija un valor
      de política.
3. **Un motor se muda a Brix cuando lo necesita un segundo consumidor, no antes.**
   Mientras tenga un solo consumidor, puede vivir donde está ese consumidor, y su
   diseño se mantiene portable para que la mudanza sea barata.
4. **La política es dato de Blends que el motor recibe por configuración.** Los
   pesos, los umbrales y la matriz de roles viven en Blends; el motor los lee, como
   ya hace el Scoring Skill con `score.policyPath`.

Si una capacidad incumple alguna condición, es de Blends. Si cumple las tres pero
solo la usa Blends, queda de Blends hasta que aparezca el segundo consumidor.

## Por qué la regla del segundo consumidor

Es el patrón que ya siguieron los registros [0003](./0003-scoring-motor.md),
[0004](./0004-finops-motor.md) y [0007](./0007-seeding-motor.md): un motor vive en
Brix y el consumidor, afuera, lo importa. Mudar antes de tiempo paga el costo de la
portabilidad sin que nadie la use, y obliga a Brix a cargar con decisiones que
todavía no sabe separar de la política de su único consumidor.

## Qué no cambia

- **No se muda código ni se agrega funcionalidad al CLI de Brix.** La Fase 1
  (EP-04, hasta el 25 de octubre de 2026) sigue fijando que el CLI no gana
  funciones nuevas hasta que un entregable tenga actuals producidos por Brix.
- **No se reclasifica ninguna entrada del registro de capacidades.** El registro
  sigue en `vc/tooling/brix-capabilities.json` (precursor privado, `vc/tooling/brix-capabilities.json` en `4742bb99`).

## Casos que este criterio deja a la vista

Se anotan para revisarlos, no se resuelven acá:

- **`brix idea` y el gate de graduación.** El motor de Brix conoce el vocabulario
  de ciclo de vida de Blends, lo que incumple la condición 2. Corresponde revisar
  si ese vocabulario se pasa por configuración.
- **Motores de `vc/tools` con un solo consumidor** (backlog, tren, validadores):
  cumplan o no las tres condiciones, siguen en Blends hasta que haya un segundo
  consumidor.
- **El motor de specs** (contrato, validador y trazabilidad): su ubicación se decide
  en `BL-20261016-sdd-motor-donde-vive`, aplicando este criterio.

## Qué queda para una pieza aparte

Que `validate-brix-capabilities` compruebe las tres condiciones de manera
automática. Hoy la frontera se aplica por revisión; se registra como pedido propio
en el backlog.
