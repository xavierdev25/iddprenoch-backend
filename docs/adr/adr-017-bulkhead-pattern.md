# ADR-017: Bulkhead Pattern — no implementado

## Contexto

Un único proceso Passenger atiende todas las rutas de la API; no hay pools de recursos distintos por tipo de cliente o de operación que necesiten aislarse entre sí para evitar que uno agote los recursos de otro.

## Decisión

No se implementa aislamiento de recursos por bulkhead.

## Consecuencias

Separar pools de conexión o de cómputo por funcionalidad añadiría complejidad operativa sin que exista, al volumen de uso actual, un escenario real donde un módulo sature recursos que otro módulo necesite proteger.
