# ADR-021: Serverless — no implementado

## Contexto

La infraestructura ya está fija y contratada (cPanel compartido con Passenger); no hay necesidad de facturación por invocación ni de escalar a cero, y el hosting elegido no ofrece un runtime serverless como servicio.

## Decisión

No se migra el backend a un modelo de funciones serverless.

## Consecuencias

Mantener un proceso Passenger de larga duración es más simple de operar dentro de este hosting que migrar a funciones serverless, lo que además requeriría contratar un proveedor de infraestructura distinto al ya usado para el resto del proyecto (ver [ADR-002](adr-002-mysql-vs-postgresql.md), donde se priorizó justamente lo contrario: mantener todo en una sola infraestructura).
