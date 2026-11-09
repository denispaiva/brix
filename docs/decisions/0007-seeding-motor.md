# 0007 — Motor de sembrado en Brix, con el driver de Teyst como primer consumidor

- Fecha: 2026-10-06
- Registro escrito el 2026-10-10.
- Autoridad: Denis Paiva (product-owner)
- Estado: aceptada
- Origen: la spec de diseño (precursor privado, `docs/superpowers/specs/2026-10-06-brix-seeding-capability-design.md` en `4742bb99`)
  y su plan de implementación (precursor privado, `docs/superpowers/plans/2026-10-06-brix-seeding-capability.md` en `4742bb99`),
  con los registros [0003](./0003-scoring-motor.md) (motor del Scoring Skill) y
  [0004](./0004-finops-motor.md) (motor de FinOps) como precedentes de forma: un
  motor que vive en `vc/brix/packages/cli/<motor>/`. La diferencia es que acá el
  motor no se muda desde el framework: nace nuevo, y por eso no hay inversión de
  dependencia (ver la sección correspondiente).

## Qué decide este registro

1. **Nace el motor de sembrado** en `vc/brix/packages/cli/seeding/`: la forma de
   describir un escenario sintético (actores, pasos, expectativas), ejecutarlo
   contra un producto, registrar en un manifiesto todo lo que se creó y poder
   barrerlo. Se expone como `brix seed run|validate|clean|list`.
2. **Brix define el contrato del driver y no conoce ningún producto.** El
   contrato (`lib/driver-contract.mjs`), la batería de conformidad que todo
   driver debe pasar y el runner viven en Brix; qué es un callable, un target o
   una credencial lo sabe el driver de cada producto.
3. **El primer driver es el kit de gates de Teyst, refactorizado**
   (`vc/teyst/tools/gate-kit/driver.mjs`). `gate-kit.mjs` queda como consola
   conducida construida sobre ese driver; una sola pieza sabe de Teyst.
4. **D-8: el token del PO sobre `dev-teyst` pasa de solo lectura a leer y
   borrar, acotado a las raíces del manifiesto de una corrida.** La decisión del
   2026-09-29 (token del PO solo para leer; la cuenta de servicio `@appspot`
   sin roles) se extiende únicamente a borrar. Nunca escribir ni editar con ese
   token, y nada fuera de las raíces que el manifiesto de la corrida lista:
   `delete` rechaza cualquier ref que el manifiesto no contenga. La cuenta de
   servicio `@appspot` **sigue sin roles**.

Además, la entrega son **dos ramas, no apiladas**, ambas con orden de sync 4
(decisión del PO del 2026-10-06, sección «Entrega: dos ramas, orden de sync 4»
de la spec):

- `docs/seeding-capability-design`: la spec, el plan y las cuatro entradas
  `idea` del registro de capacidades. Ya está en `main` (tren #268, 2026-10-07).
- `feat/brix-seeding-capability`: el motor, el driver de Teyst y las entradas
  del registro pasadas a `shipped` viajan juntos en esta rama, que nació de
  `main` una vez mergeada la primera. Lleva un `SCOPE-EXCEPTION.md` que declara
  los archivos fuera de `vc/brix/**` que toca.

No se apilan porque el chequeo local de alcance
(`vc/tools/check-branch-scope.mjs`) calcula el diff contra `origin/main`: una
rama apilada bajo otra regla «toca» los archivos heredados y la batería local de
`npm run entregar` la rechaza.

## Inversión de dependencia

**Acá no la hay.** En 0003 y 0004 el motor existía en `vc/tools/` y se mudó a
Brix; el framework pasó a depender de Brix, y eso exigió documentar la inversión.
Este motor nace en Brix y su único consumidor es un producto: el driver de Teyst
**importa el contrato de Brix**, no al revés. Producto → Brix es la dirección
normal de dependencia. Brix no importa nada de `vc/teyst/`, y la conformidad rechaza
drivers cuyo mapa de targets contenga `prod`, de modo que ningún producto puede
pedirle al motor que toque producción.

## Qué no cambia

- **`devSeedPolicy.ts` sigue siendo de Teyst**
  (`vc/teyst/functions/src/devSeedPolicy.ts`). La política que concede
  privilegios de harness a eventos `source_type: 'seed'` solo en emulador no se
  mueve ni se generaliza; el driver marca el evento para heredarla cuando el
  escenario lo pide. `botsPlayInternal` tampoco se implementa del lado del
  servidor: los bots son clientes que votan por los callables.
- **CI no suma emuladores de Auth ni de Functions.** Los tests del motor
  (`vc/brix/tests/seeding/*.test.mjs`) corren contra un driver falso en memoria;
  los del kit de Teyst siguen sin correr en CI, a propósito.
- **No existe target de producción**, por construcción, y el runner no tiene un
  flag para forzarlo.
- **Los manifiestos no entran al repo**: viven en `$BRIX_SEED_DIR` o en
  `~/.brix/seed-runs/`, y los tokens solo existen en memoria del driver.
- **La compuerta de secretos sigue siendo `betterleaks`.** Los escenarios llevan
  ids lógicos, no claves ni correos.

## Alternativas descartadas

- **B: todo en Brix** (contrato, runner y también el código que habla con Teyst).
  Rompe la frontera que verifica la regla R4 del registro de capacidades
  (`vc/tools/validate-brix-capabilities.mjs`): las entradas de `owner: brix`
  apuntan a código de `vc/brix/`, y meter ahí callables, endpoints y lógica de
  `dev-teyst` haría que Brix conociera un producto.
- **C: todo en Teyst** (el motor como una evolución del kit de gates). No es
  reutilizable: el siguiente producto que necesite sembrar tendría que copiar el
  motor o importarlo desde otro producto, y la limpieza por manifiesto, los
  bots con semilla y las guardas de target quedarían atados a un solo repo.

El camino elegido (A: contrato y runner en Brix, driver por producto) se decidió
el 2026-10-06 como D-7 de la spec.

## Referencias

- Spec de diseño (precursor privado, `docs/superpowers/specs/2026-10-06-brix-seeding-capability-design.md` en `4742bb99`):
  «Qué es esto», «Decisiones de encuadre» (D-1..D-8), «Arquitectura»,
  «Limpieza» y «Entrega».
- Plan de implementación (precursor privado, `docs/superpowers/plans/2026-10-06-brix-seeding-capability.md` en `4742bb99`).
- [0003 — Motor del Scoring Skill](./0003-scoring-motor.md) y
  [0004 — Motor de FinOps](./0004-finops-motor.md): precedentes de forma, con
  inversión de dependencia.
- Motor: `vc/brix/packages/cli/seeding/`; tests: `vc/brix/tests/seeding/`.
- Driver de Teyst: `vc/teyst/tools/gate-kit/driver.mjs`.
