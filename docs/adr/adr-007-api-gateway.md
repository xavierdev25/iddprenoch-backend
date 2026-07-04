# ADR-007: API Gateway — no implementado

## Contexto

Con un único backend monolítico expuesto bajo una sola ruta base (`/api`) detrás de Apache/Passenger, no hay múltiples servicios independientes que necesiten un punto de entrada unificado, enrutamiento dinámico entre ellos, agregación de respuestas ni políticas de acceso diferenciadas por servicio.

## Decisión

No se implementa un API Gateway dedicado (Kong, AWS API Gateway, etc.).

## Consecuencias

Apache ya cumple el rol mínimo de enrutamiento por path (`/` para el sitio estático, `/api` hacia Passenger). Introducir un gateway añadiría un proceso más que administrar en un hosting compartido sin beneficio real, dado que existe un único servicio backend que atender.
