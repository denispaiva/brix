# Diagnóstico C5: por qué el KPI de entrega nunca tuvo datos

- Fecha: 2026-09-13
- Tarea: T-08, frente F2 de la Fase 0
- Estado: **causa verificada contra la historia; mecanismo propuesto, sin aprobar**
- Decide: Denis Paiva (product-owner)
- Origen: [propuesta de la Fase 0](../plans/2026-09-13-fase-0-propuesta.md), frente F2

## Qué responde

C5 pregunta por qué el KPI de entrega, `delivery_efficiency_percent`, no tiene
datos, y qué haría falta para que los tenga. El criterio de cierre de la
propuesta pide dos cosas: un diagnóstico con la causa verificada contra la
historia, y un mecanismo aprobado por el PO.

Este documento entrega la primera completa y la segunda como propuesta.

## Evidencia

La serie sale de [`scripts/kpi-history.mjs`](../../scripts/kpi-history.mjs),
que recorre la historia first-parent de `main` y cuenta los entregables de
todos los roadmaps, sin el de ejemplo. Dos corridas sobre `main` en `60e5c57`
dan la misma serie, versionada en
[`data/kpi-history/2026-09-13.json`](../../data/kpi-history/2026-09-13.json).

| Hecho | Valor |
|---|---|
| Días con cambios en roadmaps | 23, del 2026-08-06 al 2026-09-13 |
| Entregables hoy | 30: 27 en `vc/` y 3 en `ideas/` |
| Por estado hoy | 11 planificados, 6 en curso, 13 en revisión |
| Entregables con `actuals`, en toda la historia | **0** |
| Entregables medidos, en toda la historia | **0** |
| Días con algún entregable terminado o aceptado | **0** |
| En revisión | 13, con mediana de 24 días y máximo de 31 |
| En revisión y ya aprobados por el PO | **8 de 13** |

Los tres entregables más antiguos en revisión son de Teyst y están ahí desde el
2026-08-13. Los 5 en revisión sin aprobar son todos del motor de Pinot Index.

La historia de los campos y del código se reconstruyó con `git log`, `git show`
y `git grep` sobre `main` y sobre las ramas sin integrar de la cadena de CI/CD.

## Causa verificada

Cuatro causas, que se encadenan.

### 1. Nunca hubo quién produjera los datos

| Fecha | Commit | Qué entró |
|---|---|---|
| 2026-08-06 | `d59568b` | El esquema del roadmap nace con `measurementStatus`, `actuals` y `scores` en cada entregable |
| 2026-08-06 | `9cb26b2` | El estándar `role-matrix.md` entra importado de otro repo, con el KPI y la regla de que un entregable aceptado necesita medición |
| 2026-08-10 | `cebb079` | `actuals` suma los tokens de planificación y de ejecución, como campos opcionales |
| 2026-08-11 | `2f76dbb` | El agregador de uso de tooling empieza a leer `actuals` para calcular eficiencia |

Todo lo que se construyó después **consume** esos campos: el chequeo del
tablero, el validador de gobernanza y el agregador de uso. **Ningún archivo los
escribe.** No hay productor en `main`, y tampoco en las herramientas de
entrega, tren, cola y reciclado de las ramas sin integrar. El único plan de
trabajo del repo, el de Pinot Index, declara presupuestos de tokens por tarea,
no consumos.

El KPI llegó como un estándar completo, con sus reglas y sus lectores, pero sin
la pieza que genera el dato.

### 2. Los campos piden datos que ninguna fuente produce sola

El esquema exige, para registrar `actuals`, tokens de entrada y de salida,
tokens de retrabajo correctivo, tokens de refactor planificado, y defectos P0,
P1, P2 y escapados.

Los instrumentos de F1 obtienen los tokens por rama sin trabajo manual. El
retrabajo, el refactor y los defectos no salen de ningún registro existente:
requieren clasificar el trabajo, algo que hoy solo puede hacer una persona.
Aunque hubiera productor, no podría completar `actuals` entero por sí mismo.

### 3. La regla de aceptación convirtió la ausencia en estancamiento

[`roadmap/build.mjs`](../../../../roadmap/build.mjs) rechaza un entregable
`accepted` que no esté medido, y el job de gobernanza del CI lo corre en cada
PR. Como nada mide, nada puede aceptarse.

El efecto se ve en la serie: ningún entregable llegó nunca a terminado ni a
aceptado, y 13 esperan en revisión. **Ocho de ellos ya tienen la aprobación del
PO**, así que lo único que los separa de aceptados es una medición que nadie
puede producir. El CHANGELOG del estándar lo registra en `0abb26e`: la
protección de rama del framework se dejó en revisión a propósito porque no
había medición real que declarar. Hoy lleva 20 días ahí.

### 4. La ausencia es un estado válido y silencioso

Un entregable con medición pendiente y todos sus campos vacíos es válido para
el esquema y para el chequeo del tablero, sin plazo. Ningún chequeo avisa que
un entregable lleva semanas en revisión. `validate-governance.mjs`, que aplica
las mismas reglas con más detalle, no corre ni en CI ni en la batería local;
pesa poco, porque el tablero duplica la regla que bloquea.

Nada rompe, nada avisa, y el tablero muestra entregables en revisión que
parecen trabajo en curso.

## Contraste con la hipótesis del PO

El 2026-09-10, el PO respondió a C5 que primero faltó tooling y que esa
fricción mató la práctica después.

- **La primera mitad se sostiene, con una precisión.** Faltó tooling, pero no cualquiera: faltó el productor. Los consumidores sí se construyeron.
- **La segunda mitad no se sostiene.** No hubo práctica que muriera. Desde el primer día de la historia hubo cero mediciones, así que nunca empezó.

La consecuencia cambia la pregunta: no hay una práctica que revivir, hay una
que instalar por primera vez.

## Mecanismo propuesto

**Sin aprobar.** Tres piezas independientes, cada una atacando una causa:

| Pieza | Qué hace | Ataca la causa | Depende de | Qué toca fuera de `project-brix` |
|---|---|---|---|---|
| **M1. Visibilidad** | Un chequeo que avisa, sin bloquear, los entregables en revisión por más de N días sin medición | 4 | Nada | `vc/tools/check-lifecycle.mjs` |
| **M2. Productor** | Al reciclar un tren, correr los instrumentos de F1 sobre cada rama mergeada y registrar el consumo del entregable vinculado | 1 | D5, D6, y que `recycle.mjs` esté en `main` | `vc/tools/recycle.mjs`, y el esquema del roadmap si D5 elige extenderlo |
| **M3. Regla de aceptación** | Permitir `accepted` con medición pendiente, siempre que se declare el motivo y la fecha | 3 | Una decisión de estándar del PO | `roadmap/build.mjs` y `role-matrix.md` |

La causa 2 no tiene pieza propia: condiciona a M2. Para retrabajo, refactor y
defectos hay tres salidas, y ninguna está decidida:

- **Derivarlos**, por ejemplo tomando como retrabajo los tokens de ramas `fix/` vinculadas al mismo entregable. Automático, pero es una aproximación.
- **Volverlos opcionales en el esquema**, para que un registro parcial sea válido. Cambia el cálculo del KPI.
- **Registrarlos aparte**, en el registro que elija D5, sin tocar `actuals`.

### Recomendación del ejecutor

No autoriza nada. El orden recomendado es M1, después M3, después M2:

- **M1 primero,** porque es barato, no depende de ninguna decisión abierta, y hace visible hoy un estancamiento que ya lleva un mes.
- **M3 segundo,** porque es la única pieza que destraba a los 8 entregables aprobados sin esperar a M2. Tiene un costo que el PO tiene que pesar: aceptar sin medición vuelve opcional al KPI, y puede dejarlo vacío para siempre. La salvaguarda propuesta es exigir motivo y fecha, para que cada excepción quede a la vista.
- **M2 último,** porque necesita D5, D6 y la integración de `recycle.mjs`, que hoy está en la cadena de ramas de CI/CD sin integrar.

Las tres piezas tocan archivos fuera de `project-brix`, así que cada una va en
su propia rama, con la regla de alcance que corresponda o con excepción
declarada.

## Qué NO decide este documento

- No aprueba ni implementa ninguna pieza del mecanismo.
- No cambia la regla de aceptación.
- No decide D5 ni D6.
- No diagnostica por qué los 5 entregables del motor de Pinot Index en revisión no tienen aprobación.
- No decide si la hipótesis del PO se corrige en la ficha de la idea.
