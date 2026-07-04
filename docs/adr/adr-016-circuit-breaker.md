# ADR-016: Circuit Breaker — no implementado

## Contexto

El backend no depende de servicios externos de terceros: no hay pasarela de pago, servicio de correo, almacenamiento en la nube ni API externa que pueda fallar y necesite aislarse del resto del sistema.

## Decisión

No se implementa un circuit breaker.

## Consecuencias

La única dependencia real de la API es la propia base de datos MySQL en el mismo servidor. Un circuit breaker protegería contra fallos de dependencias externas intermitentes, que este proyecto simplemente no tiene.
