# ADR-020: Message Queues / DLQ — no implementado

## Contexto

No hay procesamiento diferido ni tareas en segundo plano (envío de correos, generación de reportes pesados) — toda operación de este sistema se resuelve dentro del propio ciclo request/response.

## Decisión

No se implementa una cola de mensajes ni una dead-letter queue.

## Consecuencias

Introducir una cola (con su correspondiente DLQ para mensajes fallidos) resolvería un problema de desacoplamiento asíncrono que no existe en el alcance actual del proyecto. Ver también [ADR-018](adr-018-backpressure.md), con el que comparte la misma razón de fondo: no hay pipeline asíncrono que coordinar.
