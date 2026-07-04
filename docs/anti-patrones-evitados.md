# Anti-patrones evitados

Breve nota de arquitectura sobre anti-patrones de sistemas distribuidos que este proyecto conscientemente no introduce, dado su alcance (monolito CRUD, hosting compartido de un solo servidor, volumen de datos pequeño).

## Chatty Communication

Evitado al mantener el backend como un monolito con acceso directo a Prisma dentro del mismo proceso: no hay múltiples servicios que necesiten decenas de llamadas de red entre sí para resolver una sola operación de negocio. Cada request HTTP se resuelve con las consultas SQL necesarias en un único proceso, sin saltos de red intermedios.

## Polling Excesivo

No hay clientes ni servicios que consulten periódicamente el estado de un recurso en espera de un cambio. El frontend pide datos bajo demanda (navegación del usuario) y no implementa refrescos automáticos agresivos; no existe un proceso en segundo plano que dependa de sondear otro servicio.

## DLQ Graveyard

Al no implementarse colas de mensajes ni dead-letter queues (ver [ADR-020](adr/adr-020-message-queues-dlq.md)), no existe el riesgo de acumular mensajes fallidos sin monitoreo ni proceso de reintento — un anti-patrón que solo puede ocurrir si primero se introduce una cola sin la disciplina operativa de revisarla.

## Blind Retry

El backend no reintenta ciegamente operaciones fallidas contra dependencias externas: no hay dependencias externas de terceros (ver [ADR-016](adr/adr-016-circuit-breaker.md)), y las consultas a la propia base de datos fallan explícitamente hacia `errorHandler`, que traduce el error a una respuesta clara en vez de reintentar en silencio y enmascarar un problema de fondo.
