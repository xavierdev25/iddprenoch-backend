# ADR-019: Distributed Tracing — no implementado

## Contexto

Un solo servicio backend atiende cada request (no una cadena de microservicios): la petición entra por Apache, pasa por Passenger y termina en MySQL, todo dentro del mismo host físico.

## Decisión

No se implementa tracing distribuido (Jaeger, Zipkin, OpenTelemetry entre servicios).

## Consecuencias

`pino-http` ya registra cada request con su latencia en un único log estructurado, suficiente para depurar en un sistema de un solo servicio. Correlacionar trazas entre servicios no aporta valor cuando solo existe un servicio que atraviesa la petición.
