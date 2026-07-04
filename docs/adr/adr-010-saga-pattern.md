# ADR-010: Saga Pattern — no implementado

## Contexto

No existen transacciones distribuidas a través de múltiples servicios independientes: todo el estado del sistema vive en una única base MySQL, y Prisma ya soporta transacciones ACID locales cuando una operación necesita ser atómica (por ejemplo, crear un pastor y actualizar su iglesia asociada).

## Decisión

No se implementa un patrón Saga (orquestado o coreografiado) para coordinar consistencia entre servicios.

## Consecuencias

Usar transacciones de base de datos nativas resuelve por completo el único tipo de atomicidad que este proyecto necesita. Un Saga resolvería un problema —coordinar consistencia eventual entre servicios independientes— que no existe en un monolito con una sola base de datos compartida.
