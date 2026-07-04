# ADR-023: BFF (Backend for Frontend) — no implementado

## Contexto

Un único cliente (el frontend Angular) consume la API — no hay múltiples clientes (móvil, web, integraciones de terceros) con necesidades de forma de datos distintas que justifiquen una capa de adaptación específica por cliente.

## Decisión

No se implementa un Backend for Frontend.

## Consecuencias

La API general (`/api/**`) sirve directamente al único frontend existente. Un BFF añadiría una capa intermedia sin que exista un segundo consumidor con necesidades distintas que la requiera.
