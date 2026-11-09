# Decisiones de Brix

Registro de las decisiones cuyo efecto recae solo en Brix. Las que afectan a varios productos siguen en el [registro de VCX](https://github.com/denispaiva/vcx/blob/main/docs/decisions/README.md).

## Registros

| Registro | Título |
|---|---|
| [0001-graduation](0001-graduation.md) | 0001 — Graduación de Brix a `vc/` |
| [0002-role-bindings](0002-role-bindings.md) | 0002 — Bindings de roles y aprobación de la Fase 0 |
| [0003-scoring-motor](0003-scoring-motor.md) | 0003 — Motor del Scoring Skill mudado a Brix |
| [0004-finops-motor](0004-finops-motor.md) | 0004 — Motor de FinOps mudado a Brix, con ledger multi-proyecto |
| [0005-registro-de-recursos-y-vinculo-rama](0005-registro-de-recursos-y-vinculo-rama.md) | 0005 — Dónde se registran los tres recursos (D5) y cómo una rama se vincula a un entregable (D6) |
| [0006-punto-3-recomendacion-que-decide-un-humano](0006-punto-3-recomendacion-que-decide-un-humano.md) | 0006 — El punto 3 de la idea pasa a ser una recomendación que decide un humano |
| [0007-consejo-pasa-a-shipped](0007-consejo-pasa-a-shipped.md) | 0007 — El consejo pasa de deprecated a shipped |
| [0007-seeding-motor](0007-seeding-motor.md) | 0007 — Motor de sembrado en Brix, con el driver de Teyst como primer consumidor |
| [0008-frontera-blends-brix](0008-frontera-blends-brix.md) | 0008 — Frontera operativa entre Blends y Brix |

Hay dos registros con número `0007`. Ambos se conservan con su nombre y no se renumeran: cambiarlo rompería las referencias del historial. Para citar uno sin ambigüedad, usar el nombre del archivo completo.

## Trasladadas desde VCX

| Decisión | Título | Acuerdo | Traslado |
|---|---|---|---|
| VCX-D019 | Equivalencias de comandos y ayuda para completar parámetros | 2026-10-30: «brix idea = /idea; brix council = /council; contemplar la ayuda para completar el parámetro». Brix ofrece ambas capacidades con lógica compartida entre CLI y conversación; usar `/idea` singular, ayudar con entradas ausentes o ambiguas y resolver compatibilidad antes de alterar el sistema actual. Ver [interfaces de comandos](../commands.md) | 2026-11-09, en la incorporación E4 de VCX-D056, según la [clasificación de decisiones](https://github.com/denispaiva/vcx/blob/main/docs/architecture/repository-map.md#clasificación-de-decisiones) de VCX. El ID se conserva |
