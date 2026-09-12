# Matriz de Scoring y Evaluación — Ecosistema Vibe Coding (Brix)

Este documento define la metodología obligatoria en blends para auditar bibliotecas, repositorios y skills externos antes de autorizar su uso o empaquetarlos en el CLI de Brix.

1. Criterios de Evaluación (Total: 100 pts)
- Vibe Coding Fit (25 pts): Compatibilidad con agentes LLM, documentación estructurada (llms.txt), APIs predictivas y cobertura de tipos clara.
- Seguridad y Salud (25 pts): Licencias permisivas (MIT, Apache 2.0), ausencia de scripts de post-instalación sospechosos, frecuencia de mantenimiento e historial de vulnerabilidades.
- Eficiencia de Cómputo / DX (20 pts): Cero impacto en cuotas de CI/CD, builds ligeros y bajo overhead en entornos locales.
- Curva de Adopción (15 pts): Facilidad de integración sin forzar refactorizaciones masivas en la arquitectura existente.
- Scope y Valor Proporcional (15 pts): Justificación quirúrgica sobre el problema puntual que resuelve en el proyecto de destino.

2. Umbrales de Veredicto
- Score >= 80 (Aprobado): Se registra en vc/tooling/approved/ y queda elegible para absorción en el CLI de Brix.
- Score 50 - 79 (Sandbox / Observación): Restringido a pruebas locales en blends. Se prohíbe su graduación a producción.
- Score < 50 (Rechazado): Se archiva la evaluación en docs/evaluations/rejected/ para evitar reevaluaciones futuras.
