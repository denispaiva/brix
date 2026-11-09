# Revisión de la Fase 0 de Brix (D7)

- Fecha de la revisión: 2026-10-11, fijada por D7 en la [propuesta de la Fase 0](./2026-09-13-fase-0-propuesta.md)
- Evidencia relevada el 2026-10-01 sobre `origin/main` en `4085d70f`
- Preparado por: sesión de ejecución, a pedido del PO (T-12)
- Estado: **decidida por el PO el 2026-10-01** (sección "Decisiones del PO"); T-12 se cerró ese día, antes de la fecha de D7
- Decide: Denis Paiva (product-owner)

## Resumen

Las cuatro preguntas que Brix llevó al gate tienen un veredicto escrito, y
ninguna quedó abierta. Pero ninguna respuesta se ejerció después del
2026-09-14: los instrumentos corrieron una vez, a mano, y la cadena que
convertiría la medición por rama en medición por entregable nunca se encendió.
El síntoma que motivó F2 sigue intacto: **0 de 32 entregables** del portfolio
tienen `actuals` y **0 de 32** están `accepted` (conteo sobre los
`.roadmap.json` de `origin/main` el 2026-10-01, sin contar el archivo de
ejemplo `roadmap/example.roadmap.json`).

La Fase 0 respondió qué se puede medir. Lo que falta es medir.

## Estado por frente

| Frente | Pregunta                                      | Veredicto                                                     | ¿Se ejerció?                                  |
| ------ | --------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| F1     | Asesina 1: consumo por entregable             | Sí para los tres recursos, **hasta la rama**                  | Una sola corrida, el 2026-09-14               |
| F2     | C5: KPI de entrega vacío                      | Causa verificada: nunca hubo productor de `actuals`           | M1 y M3 en main; M2 escrito pero sin conectar |
| F3     | Asesina 2: unidad de resultado                | Entregable (PO, 2026-09-14)                                   | Ningún entregable acumula datos               |
| F4     | Asesina 3: equilibrio del tooling de contexto | Sin equilibrio que calcular: los dos candidatos se rechazaron | No aplica; reevaluación el 2026-12-14         |

### F1: consumo por entregable

Fuente: [veredicto de formato](../research/2026-09-13-formato-codex-cowork.md).

- **Minutos de Actions:** serie reproducible y atribuible. Se validó contra el
  monitor de escasez: 2.321 minutos medidos contra 2.303 del monitor, 0,8 % de
  desvío con tolerancia de 10 % (serie (precursor privado, `vc/brix/data/actions-minutes/2026-09.json` en `4742bb99`)).
- **Ventana de contexto:** serie reproducible y atribuible para Claude Code,
  sin fuente externa contra la cual validar
  (serie (precursor privado, `vc/brix/data/context-window/2026-09.json` en `4742bb99`)).
- **Atención del PO:** indicador reproducible, reportado como banda entre topes
  de 5 y 15 minutos (D4) (serie (precursor privado, `vc/brix/data/po-attention/2026-09.json` en `4742bb99`)).
- **Codex:** su consumo se puede obtener y atribuir a una rama, pero no tiene
  instrumento, y su instrumentación se difirió a esta revisión. **Cowork:** se
  puede obtener pero no atribuir, así que queda fuera del veredicto.

**Reproducibilidad, comprobada el 2026-10-01.** Volví a correr la ventana de
contexto y la atención del PO para el ciclo 2026-09 y comparé por día contra
las series versionadas:

- **Ventana de contexto:** los 12 días completos (1 a 13 de septiembre)
  coinciden exactamente. Solo difiere el 14, que estaba en curso cuando se
  midió.
- **Atención del PO:** el 12 de septiembre suma 37 turnos humanos contra 35.
  El 13 y el 14 difieren porque estaban en curso al medir, en hora local. La
  causa de los 2 turnos de más no está verificada; puede ser una sesión
  reanudada que copia turnos anteriores.

Las corridas nuevas no se versionaron.

**Límite común:** la atribución llega hasta la rama. Pasar de rama a
entregable depende de D6 y de M2, y ninguno de los dos opera (ver F2).

### F2: diagnóstico del KPI vacío (C5)

Fuente: [diagnóstico](../research/2026-09-13-diagnostico-kpi-c5.md). La
causa está verificada contra la historia: nunca hubo un productor de
`actuals`, y la regla de aceptación convirtió esa ausencia en estancamiento.

| Mecanismo                                                | Estado en main                                                                                                                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1: avisar entregables estancados en revisión            | Implementado: `review-staleness.mjs` (precursor privado, `vc/tools/lib/review-staleness.mjs` en `4742bb99`)                                                                                                                    |
| M3: aceptar con medición pendiente (`measurementWaiver`) | Implementado; **0 entregables lo usan**, así que los 8 aprobados por el PO siguen en revisión                                                                                                      |
| M2: productor de los tres recursos por entregable        | Escrito (`produce-resource-actuals.mjs` (precursor privado, `vc/tools/produce-resource-actuals.mjs` en `4742bb99`)); **ningún paso de `recycle.mjs` ni de `train.mjs` lo llama**, y `vc/brix/data/resource-actuals/` no existe |

M2 además depende de D6: cada entregable declara su rama con una entrada
`rama:<nombre>` en `performance.evidence`. Hoy **0 de 10** `.roadmap.json` la
usan, así que aunque M2 corriera no resolvería ningún entregable.

### F3: unidad de resultado

Fuente: [F3](../research/2026-09-13-f3-unidad-de-resultado.md). El PO eligió
el entregable el 2026-09-14. El documento lo dejó advertido: es la unidad que
peor mide el progreso en la práctica, y sin M2 no acumula datos. Sigue
pendiente el hueco "transición de estado por entregable y por día" de
`kpi-history.mjs`.

### F4: punto de equilibrio del tooling de contexto

Fuente: [F4](../research/2026-09-14-f4-punto-equilibrio.md). Code-mode y
mcpjungle se evaluaron con `/tool` y se rechazaron, así que no hay equilibrio
que calcular con un solo integrador. El consumo atacable no está en esos
candidatos sino en cómo se lee el contexto. Por D2, eso es tema de
`clarificacion`, que sigue separada de Brix. Las dos evaluaciones vuelven a
revisarse el 2026-12-14.

## Decisiones paralelas

- **Línea de Gemini en el ledger:** está en main (`gemini-api-free-tier`, en
  capa gratuita).
- **Motor del Scoring Skill dentro de Brix:** está en main
  ([0003](../decisions/0003-scoring-motor.md)).
- **Motor FinOps dentro de Brix:** está en main
  ([0004](../decisions/0004-finops-motor.md)). No estaba en el plan de la
  Fase 0. Le quedan pendientes la pieza 2 (scaffolding en `brix graduate`) y
  la pieza 3 (atribución por uso medido), que depende de M2.
- **Deriva de texto:** el "Origen" de 0004 llama "no mergeada" a la rama de
  0003, que ya está en main. Se anota acá en lugar de editar el registro de
  decisión.

## Lo que la Fase 0 dejó sin registrar

- **D5 y D6** se decidieron (registro paralelo de los tres recursos y el
  vínculo `rama:<nombre>`), pero solo constan en la cabecera de
  `produce-resource-actuals.mjs` y en el mensaje del commit `29d23fda`. No
  tienen documento de decisión.
- **El único entregable de Brix**, `initial-validation`, sigue `planned`, sin
  evidencia ni medición, aunque EP-01 y su sprint están cerrados. Es un caso
  vivo de C5.
- **Las tareas T-07, T-09 y T-10** figuran `done` en SP-2026-W40, que sigue
  `planned`. Se ordena en el cierre de W40.
- **La rama `fix/brix-node-24`** tiene sus dos commits en main con otros SHA.
  Está desfasada y no figura en la cola, así que se puede borrar, no mergear.

## Qué dice el acta sobre lo que sigue

El [acta de graduación](../decisions/0001-graduation.md) fija dos cosas:

- la Fase 0 va antes de cualquier funcionalidad nueva del CLI;
- si la Fase 0 respondía que no, los puntos 2 y 3 de la idea perdían su base.
  El punto 2 es medir por resultado; el punto 3, elegir modelo por Pareto.

F1 respondió que sí, pero solo a nivel de rama. Mientras ningún entregable
tenga datos, el punto 2 no tiene con qué trabajar. El punto 3 arrastra además
una colisión que la Fase 0 no resolvió: elegir el modelo de forma automática
choca con la regla que reserva los cambios de binding a una decisión humana.
Bajo suscripción, además, no hay precio por token para un Pareto.

## Opciones presentadas al PO

1. **Qué sigue después de la Fase 0.**
   - **A (recomendada): Fase 1, poner la medición en marcha.** Es una lista
     cerrada:
     - conectar M2 al reciclaje de la cola;
     - declarar `rama:<nombre>` en los entregables activos;
     - ejercer M3 sobre los 8 entregables aprobados que siguen trabados;
     - producir las series de octubre;
     - dejar D5 y D6 en un documento de decisión.

     El CLI no gana funcionalidad nueva. Costo: cambios de alcance framework
     en `vc/tools/` y cero minutos de Actions. Criterio de cierre: al menos un
     entregable con `actuals` producidos por M2.

   - **B: descongelar el CLI** y empezar el punto 2 (medir por resultado).
     Arranca sin un solo entregable medido.
   - **C: cerrar la Fase 0 sin fase siguiente** y dejar Brix en
     mantenimiento: instrumentos a demanda y nada más.
2. **El punto 3, elegir modelo.**
   - **Recomendado:** redefinirlo como recomendación para que decida un
     humano, no como automatización. Así se resuelve la colisión con la regla
     de bindings.
   - Las alternativas son archivarlo, o mantenerlo tal cual con la colisión
     abierta.
3. **Instrumentar Codex**, la decisión diferida a esta revisión.
   - **Recomendado:** no instrumentarlo todavía. Aportaba el 0,43 % del
     contexto de blends en 2026-09, y esa medición no se repitió en esta
     revisión.
   - Se vuelve a evaluar cuando cambie su papel en los bindings
     ([0002](../decisions/0002-role-bindings.md)).
4. **Orden administrativo**, recomendado:
   - aceptar `initial-validation` con `measurementWaiver`, con motivo y fecha;
   - borrar `fix/brix-node-24`;
   - cerrar T-12 en esta revisión.

## Decisiones del PO

Tomadas el 2026-10-01, todas en la opción recomendada:

1. **Qué sigue:** la Fase 1, poner la medición en marcha. Va en el epic EP-04
   y el sprint SP-2026-W42 (12/10 al 25/10), con las tareas T-13 a T-18 del
   roadmap. Cierra cuando al menos un entregable tenga `actuals` producidos
   por M2.
2. **Punto 3 de la idea:** se redefine como una recomendación de modelo que
   decide un humano, no como automatización (T-18).
3. **Codex:** no se instrumenta por ahora. Se vuelve a evaluar si cambia su
   papel en los bindings.
4. **Orden administrativo:**
   - `initial-validation` queda `accepted` con `measurementWaiver`;
   - T-12 se cierra hoy;
   - `fix/brix-node-24` se borra, en local y en `origin`.
