# Capacidad de arquitectura de referencia y base de costos

Fecha: 2026-10-30. Estado: capacidad requerida por el usuario para VCX; interfaz y contenido propuestos. Su disponibilidad como comando no está demostrada por la documentación actual.

## Propósito

Proponer un modelo de arquitectura de referencia a partir de una idea aceptada, para que el documento FinOps pueda explicar de dónde provienen sus escenarios y estimaciones. El modelo es una hipótesis de solución, no la arquitectura final de implementación ni permiso para construir.

## Entradas explícitas

- Documento de idea aceptado, revisión, decisión de ingreso y reporte del consejo.
- Misión, visión, alcance, preguntas pendientes y restricciones conocidas.
- Hipótesis de volumen, uso, disponibilidad, datos y operación; lo desconocido se declara como supuesto.
- Alternativas permitidas, criterios de selección y límites de esfuerzo o gasto para este análisis.
- Plantillas, recursos de referencia, versiones y destino de salida suministrados por el consumidor.

No se presupone un portfolio o proveedor determinado, ni rutas internas de Blends. La capacidad puede ser utilizada sin Blends con entradas y permisos explícitos.

## Modelo de salida propuesto

El resultado es un documento de arquitectura de referencia con identidad, revisión y vínculo a la revisión de la idea. Debe incluir:

1. Problema que resuelve, límites y requisitos relevantes para el costo.
2. Alternativas y escenario de referencia propuesto, con motivos y decisiones todavía abiertas.
3. Componentes y servicios propuestos, responsabilidades, relaciones y entornos previstos, sin provisionarlos.
4. Factores de consumo por componente: unidad, cantidad hipotética, período, sensibilidad y fuente o supuesto.
5. Actividades de exploración, construcción y operación que pueden generar costo de equipo, agentes, tooling o servicios externos.
6. Riesgos, incertidumbre, posibilidades de simplificación, portabilidad y salida de proveedores cuando corresponda.
7. Cobertura: qué partes no tienen aún una hipótesis suficiente para estimar y qué dato falta.

La recomendación de escenario se identifica como propuesta. No se requiere cerrar una arquitectura definitiva para comenzar FinOps; pueden costearse varias alternativas si la incertidumbre lo justifica.

## Relación con FinOps

La [etapa de Blends](https://github.com/denispaiva/blends/blob/main/docs/architecture-and-finops.md) aplica la [plantilla FinOps](https://github.com/denispaiva/cellar/blob/main/templates/finops/README.md) sobre este modelo. Cada línea de estimación referencia un componente o actividad, una revisión del modelo y los supuestos de su escenario.

Los cálculos y validaciones reutilizables pertenecen a Brix; la política de presupuesto y las decisiones humanas se coordinan en Blends. La instancia de Cellar custodia modelo, documento FinOps, fuentes y decisiones. El formato documental no duplica el contrato de un motor de cálculo o de un ledger.

Cambiar componentes, volumen o restricciones requiere recalcular las líneas afectadas y revisar su cobertura. Una estimación incompleta no se etiqueta como costo cero y una estimación no se convierte en gasto real.

## Situación respecto de lo existente

En el índice de capacidades consultado de blends no se identificó una capacidad registrada de arquitectura de referencia con esta interfaz. Existe una plantilla de arquitectura general; no prueba por sí misma un generador implementado en Brix.

Sí está registrado el motor FinOps de Brix para validación y agregación de ledgers. Ese antecedente no demuestra generación automática de arquitectura, precios o presupuestos. No se inventan nombres de comandos o capacidades disponibles.
