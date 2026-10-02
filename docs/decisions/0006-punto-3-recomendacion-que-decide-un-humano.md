# 0006 — El punto 3 de la idea pasa a ser una recomendación que decide un humano

- Fecha: 2026-10-02
- Autoridad: Denis Paiva (product-owner). Lo decidió el 2026-10-01, en la [revisión de la Fase 0](../plans/2026-10-01-revision-fase-0.md) (decisión 2), y se asienta acá como cierre de T-18.
- Estado: aceptada
- Origen: el [acta de graduación](./0001-graduation.md) heredó una colisión de gobernanza sin resolver: el punto 3 de la idea, «elegir el modelo automáticamente», choca con la regla que reserva los cambios de binding a decisión humana.

## Qué decide este registro

**El punto 3 deja de ser una automatización y pasa a ser una recomendación de modelo. Brix recomienda; un humano decide, y nunca el sistema cambia un binding por sí mismo.**

El texto anterior decía: «un benchmark basado en trabajo real elige el modelo Pareto-óptimo (el más barato que cumpla el umbral de calidad), y lo re-evalúa cada pocas semanas». El texto nuevo es:

> **Recomendar el modelo, que decide un humano.** Un benchmark basado en trabajo real calcula qué modelo es Pareto-óptimo (el más barato que cumpla el umbral de calidad) y lo presenta como recomendación con su evidencia. El cambio de binding lo decide el PO y queda en `model-baselines.json` con su `decisionRef`.

## Por qué

- **Coherencia con la regla de bindings.** [`role-matrix.md`](../../../docs/standards/role-matrix.md) fija que el binding vigente por agente en `vc/tooling/lifecycle/model-baselines.json` «solo lo actualiza una decisión humana», y que nunca se infiere ni se observa. Una elección automática exigiría derogar esa regla. Una recomendación no la toca.
- **No hay base para automatizar.** Los bindings de hoy son Claude y Codex bajo suscripción, que no exponen precio por token, y ningún entregable acumula todavía `actuals` (0 de 32 al 2026-10-01). El punto 3 depende del 2, y el 2 depende de que haya datos.
- **Es la salida de menor costo.** Las otras dos opciones eran archivar el punto 3 o mantenerlo con la colisión abierta. La primera tira una pregunta que sigue vigente; la segunda deja a Brix con una promesa que su propio gobierno prohíbe cumplir.

## Qué NO decide este registro

- **No instrumenta nada.** El punto 3 sigue sin funcionalidad: el CLI de Brix no gana comandos con esta decisión. Se retoma cuando el punto 2 (medir por resultado) tenga entregables con `actuals`.
- **No fija el umbral de calidad ni quién lo define.** Esa pregunta (la 5 de la ficha) queda para cuando el punto 3 tenga datos con qué trabajar.
- **No toca los bindings** del framework ni los de ningún proyecto.
- **No cambia la decisión sobre Codex** (no instrumentar por ahora).
