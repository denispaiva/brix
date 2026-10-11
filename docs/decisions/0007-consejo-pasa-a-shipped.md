# 0007 — El consejo pasa de deprecated a shipped

- Fecha: 2026-10-11
- Autoridad: Denis Paiva (product-owner). Aprobó la [spec](../../../../docs/superpowers/specs/2026-10-11-brix-council-slash-design.md) y su plan el 2026-10-11.
- Estado: aceptada, **con el motivo pendiente del PO**
- Origen: el commit `28a1903c` (2026-09-27) pasó `skill.llm-council` a `deprecated` por «decisión del PO de no construirla por ahora». El motivo de fondo nunca se escribió.

## Qué decide este registro

**El consejo (`/council`, alias histórico `/consejo`) se implementa como comando slash y su entrada de registro pasa de `deprecated` a `shipped`.** Revierte la decisión del 2026-09-27.

## Por qué

**Motivo pendiente del PO.** Este registro no lo infiere: la decisión del 2026-09-27 no dejó motivo escrito y la reversión tampoco lo trajo. El PO lo completa en esta sección.

Lo que sí consta, con fuente:

- Las dos corridas manuales del 2026-09-10 (`ideas/brix/consejo-2026-09-10.md` y `-2.md`) produjeron siete preguntas candidatas que la ficha no tenía, y el PO respondió las siete el mismo día (`ideas/brix/README.md:224-238`).
- El procedimiento original nunca se commiteó (`.claude/commands/consejo.md` no existe en ninguna rama), así que el método solo vivía en esas dos trazas.

## Decisiones de detalle

- **Se salta el paso `evaluated`.** La nota de la entrada anterior decía «si se retoma, se vuelve a declarar `evaluated`». Aquí se pasa directo a `shipped` porque el método ya tiene dos corridas reales y esta implementación es propia, no el paquete externo.
- **La evaluación del paquete externo no cambia.** `vc/tooling/evaluations/llm-council-skill.evaluation.json` mide `tenfoldmarc/llm-council-skill@0dc0327` y sigue `decision_pending`, con `do_not_advance`; vence el 2026-12-10. Este registro no la resuelve.
- **El procedimiento es una reconstrucción.** Los prompts del comando original no se recuperaron; las consignas de `council.md` son un diseño nuevo inspirado en las corridas.
- **El resolver solo cubre dos asientos.** El Contrarian (rol `code-reviewer`) y la síntesis (rol `senior-developer`) pasan por `resolve-model.mjs`. Los demás usan la tabla de `council.md`, porque el resolver exige un perfil de tarea que ningún asesor tiene y para `economy` sustituiría hacia arriba. Es una enmienda mínima a la sección 2 de la spec, tomada al implementar.

## Qué NO decide este registro

- No construye un CLI `brix council` ni ejecución automática.
- No mide el costo de una corrida: v1 lo registra o escribe `not_measured`.
- No cambia ningún binding: la tabla de `council.md` la edita un humano.
- No promueve a asesina ninguna de las preguntas candidatas de las corridas.
