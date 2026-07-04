# ADR-018: Backpressure — no implementado

## Contexto

No hay colas de mensajes ni procesamiento asíncrono de alto volumen en el sistema — cada request HTTP se atiende y responde de forma síncrona directamente sobre Prisma/MySQL.

## Decisión

No se implementa un mecanismo explícito de backpressure.

## Consecuencias

`express-rate-limit` ya acota el único endpoint con riesgo real de abuso (`POST /api/auth/login`, ver [Nivel 3 — Componentes del backend](../c4/nivel3-componentes-backend.md)). No existe un productor/consumidor desacoplado en la arquitectura que necesite señalizar presión hacia atrás.
