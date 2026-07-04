# ADR-011: Service Mesh — no implementado

## Contexto

No hay múltiples microservicios comunicándose entre sí sobre una red interna — solo un backend monolítico y un frontend estático, servidos por el mismo Apache en el mismo servidor cPanel compartido (ver [Nivel 2 — Contenedores](../c4/nivel2-contenedores.md)).

## Decisión

No se implementa un service mesh (Istio, Linkerd, etc.).

## Consecuencias

No existe tráfico servicio-a-servicio que necesite mTLS automático, retries a nivel de red u observabilidad de malla. Introducir un service mesh no tendría ningún tráfico interno real que gestionar en esta arquitectura de un solo servicio.
