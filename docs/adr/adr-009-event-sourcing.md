# ADR-009: Event Sourcing — no implementado

## Contexto

No hay requisito de auditoría histórica completa de cada cambio de estado ni necesidad de reconstruir el estado pasado del sistema a partir de un log de eventos. Los campos `createdAt`/`updatedAt` que ya expone cada modelo de Prisma cubren la trazabilidad mínima que el proyecto necesita.

## Decisión

No se almacena el estado del sistema como una secuencia de eventos reproducibles.

## Consecuencias

Modelar el dominio como eventos (y mantener proyecciones derivadas de ellos) sería sobreingeniería para actualizaciones administrativas esporádicas sobre un volumen de datos pequeño; el modelo relacional directo de Prisma/MySQL es suficiente y más simple de razonar.
