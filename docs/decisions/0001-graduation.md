# 0001 — Graduación de Brix a `vc/`

- Fecha: 2026-09-13
- Autoridad: Denis Paiva (product-owner)
- Estado: aceptada
- Convocatoria: el PO convocó el gate el 2026-09-13, seis días antes del
  vencimiento del presupuesto de exploración, el 2026-09-19. Respondió en sesión
  las preguntas del expediente de insumos (precursor privado, `ideas/brix/gate-2026-09-19-insumos.md` en `4742bb99`).
  Convocar antes del vencimiento tiene el precedente de Melquisedec.

## Veredicto

**Graduada.**

Rige la lectura del estándar de ciclo de vida (precursor privado, `vc/docs/standards/idea-lifecycle.md` en `4742bb99`):
nace `vc/brix/` con scaffolding de gobernanza. El PO la eligió entre cuatro
lecturas que el portfolio sostenía en paralelo:

| Lectura | Qué hacía nacer | Estado tras este registro |
|---|---|---|
| Estándar de ciclo de vida | `vc/brix/` con scaffolding de gobernanza | **Rige** |
| Ficha de la idea (precursor privado, `ideas/brix/README.md` en `4742bb99`) | Cambios de estándar y tooling en `vc/tools/` | No rige |
| `SPEC.md` de la idea | Un PR de estándares y tooling dentro de blends | No rige |
| Protocolo del Gate (precursor privado, `vc/tooling/governance/gate-protocol.md` en `4742bb99`) | El código inyectado en `denispaiva/brix` | No rige |

## Motivo

Declarado por el PO el 2026-09-13, en tres partes:

1. **Gobernar el código existente.** `vc/brix` ya existe y opera. Graduarlo lo pone bajo gobernanza de proyecto, en vez de dejarlo fuera de todo alcance de rama.
2. **Responder como proyecto.** Las preguntas abiertas se responden mejor como trabajo del proyecto, con instrumentos reales, que extendiendo la exploración.
3. **Costo de seguir explorando.** Extender la ventana cuesta más atención del PO que graduar y corregir en marcha.

Contra los tres criterios del gate del estándar:

**1. Asesinas respondidas con evidencia: NO.** Estado de la evidencia al
2026-09-13, según el expediente de insumos:

| Pregunta | Estado |
|---|---|
| Asesina 1: consumo por entregable de tiempo del PO, minutos de Actions y ventana de contexto | Evidencia parcial: Actions tiene método reproducible, la ventana de contexto una medición única, el tiempo del PO nada |
| Asesina 2: unidad de resultado del portfolio | Sin responder, diferida fuera de la ventana por decisión del PO |
| Asesina 3: punto de equilibrio del tooling de contexto | Sin responder: graphify aprobado con excepción, graft rechazado, code-mode y gateway sin evaluar |
| Diagnóstico C5: por qué el KPI está vacío | Sin responder: 26 de 26 entregables sin `actuals` en `main` |

El gate acepta la graduación como **desviación deliberada y registrada del
criterio 1**, decidida por la misma autoridad del gate con ese estado a la vista.
Es más amplia que la enmienda de Melquisedec: allá tres de cuatro asesinas
estaban respondidas y una quedó enmendada; acá ninguna de las tres asesinas llegó
con evidencia completa. El gate hereda las preguntas como la Fase 0 del proyecto,
y lo registra abajo como riesgo principal.

**2. Sin bloqueo regulatorio: SÍ.** Brix trabaja sobre el propio framework, sin
usuarios ni datos externos. No hay impedimento legal para operar. Se hereda una
colisión de gobernanza, no regulatoria: el punto 3 de la idea, elegir el modelo
automáticamente, choca con la regla que reserva los cambios de binding a
decisión humana.

**3. Capacidad real del portfolio: SÍ, declarada.** Unas 5 horas por semana del
PO, el mismo nivel que Melquisedec durante M0, más ejecución delegable a
sesiones. Contexto al momento del gate: Actions en modo `austero`, con USD 13,82
usados de 18,00 en el ciclo, y 20 entradas en la cola de merge.

## Decisiones del gate

| Tema | Decisión del PO |
|---|---|
| Código de `vc/brix` y espejo | `vc/brix` entra a `main` por el tren y sigue activo. `denispaiva/brix` sigue como espejo privado de solo lectura, sincronizado desde blends |
| Workflow `.github/workflows/ci.yml` de la raíz de blends | Se elimina antes del tren |
| Alcance de ramas | Regla `project-brix` en `branch-scopes.json` (precursor privado, `vc/tooling/branch-scopes.json` en `4742bb99`): prefijos `feat`, `fix`, `docs`, `chore`, `hotfix` y `experiment` con slug `brix`, sobre `vc/brix/**` e `ideas/brix/**` |
| Consumo de la API de Gemini | Línea en el ledger FinOps (precursor privado, `vc/finops/billing-ledger.json` en `4742bb99`) dentro del free tier, con tope de excedente en cero |
| Métodos de scoring | La matriz del CLI se alinea a la política vigente del Scoring Skill (precursor privado, `vc/tooling/scoring-policy.json` en `4742bb99`), versión 1.6.0 |
| Preguntas sin responder | Son la Fase 0 del proyecto: se responden antes de sumar funcionalidad nueva al CLI |
| Horas del PO | Unas 5 horas por semana |

## Qué instancia este registro

Scaffolding de gobernanza del paso 5, en la misma rama que este registro:

- `vc/brix/.roadmap.json`, mudado desde `ideas/brix/`, con estado `active`.
- Este registro, y la nota de graduación en la ficha y en el README del proyecto.
- La fila de Brix en la tabla del estándar, en estado `graduated`.
- El codename `brix` asignado al proyecto.
- La regla de alcance `project-brix`.
- La eliminación del workflow de la raíz de blends.
- El tablero regenerado.

Decisiones que se ejecutan después, cada una en su rama:

- La línea de Gemini en el ledger FinOps.
- La alineación de la matriz del CLI al Scoring Skill.
- El plan de la Fase 0.

## Evidencia de la exploración

- `ideas/brix/README.md` (precursor privado, `ideas/brix/README.md` en `4742bb99`): ficha, asesinas, presupuesto y respuestas del PO del 2026-09-10, que la ficha declara hipótesis de trabajo.
- `ideas/brix/gate-2026-09-19-insumos.md` (precursor privado, `ideas/brix/gate-2026-09-19-insumos.md` en `4742bb99`): expediente con la evidencia verificada contra su fuente al 2026-09-13, y los datos buscados y no encontrados.
- `ideas/brix/consejo-2026-09-10.md` (precursor privado, `ideas/brix/consejo-2026-09-10.md` en `4742bb99`) y su segunda corrida: opinión de asesores, no evidencia.
- `docs/lifecycle/decoupling-brix.md` (precursor privado, `docs/lifecycle/decoupling-brix.md` en `4742bb99`): bitácora del desacople técnico y de la estrategia de espejo.

## Riesgo abierto que sobrevive a la graduación

1. **El proyecto gradúa sin responder su pregunta central.** No se sabe todavía si el consumo por entregable es medible para los tres recursos escasos. La ficha fija que ese dato es prerrequisito de medir por resultado, y que medir por resultado es prerrequisito de elegir modelo. Si la Fase 0 responde que no, los puntos 2 y 3 de la idea pierden su base. Mitigación: la Fase 0 va antes de cualquier funcionalidad nueva.
2. **El código existente no ataca esas preguntas.** Los cuatro comandos del CLI puntúan tooling, generan specs, extraen subcarpetas y generan workflows. Ninguno mide consumo, calcula un equilibrio o diagnostica el KPI, así que la Fase 0 parte sin instrumento propio.
3. **Código antes del gate.** El estándar fija que el primer código nace en `vc/<nombre>/` después de graduar. Este registro regulariza el código hacia adelante, pero no borra la desviación.
4. **Tensiones de la ficha sin resolver.** C3 contra C2: el guardarraíl anti-Goodhart gasta atención del PO, que es el recurso que Brix promete liberar. C6 contra C2: si Brix recupera minutos de Actions, es parte del arreglo de Actions y no un paso posterior.
5. **Asesina 2 disparada.** Su disparador era la decisión del gate, cualquiera fuera. Queda disparada y entra en la Fase 0, con el alcance de Brix todavía sin validar para ideas.
6. **Consumo de Gemini sin declarar hasta que exista la línea.** `tool score` e `idea` siguen llamando a la API mientras la línea del ledger no se registre.
7. **Mantenimiento del espejo.** La sincronización es manual. El espejo también recibe este registro y el roadmap del proyecto, cuyos enlaces relativos a blends no resuelven allá.
8. **Integración encadenada.** La rama depende en la cola de `tooling/comando-consejo` y de `tooling/validate-docs-spec-exento`. `tooling/comando-consejo` trae el workflow de la raíz en su propio diff, y ese workflow corre en sus pushes hasta que el tren integre la eliminación.

## FinOps

- **API de Gemini:** único consumo usage-based nuevo. Se declara en el ledger dentro del free tier, con tope de excedente en cero, siguiendo Free Tier First. Un excedente aparecería como línea en el ledger, nunca se presume.
- **GitHub Actions:** el CI del espejo consume la cuota de la cuenta, compartida con blends. El workflow de la raíz de blends se elimina, así que no suma corridas nuevas en `main`.
- **Suscripciones de agentes:** la ejecución delegable entra en las suscripciones fijas vigentes.

## Qué NO decide este registro

- **No instancia la matriz de autoridad del proyecto.** Los role bindings son el siguiente registro de decisión, con el PO asignando roles.
- **No define el plan de la Fase 0 ni sus instrumentos.** Solo fija que va antes de funcionalidad nueva.
- **No resuelve la colisión del punto 3** con la regla de bindings.
- **No autoriza publicar en npm.** El paquete sigue marcado privado y el espejo sigue siendo privado.
- **No edita la ficha, la `SPEC.md` ni el protocolo del Gate** para reconciliar sus lecturas de graduar. Este registro fija cuál rige; la reconciliación de esos documentos queda como trabajo aparte.
- **No mueve el drenado de la cola de merge.**
