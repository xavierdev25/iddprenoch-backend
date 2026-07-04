# ADR-014: Load Balancer — no implementado

## Contexto

Una única instancia de Passenger corre el backend en un único servidor cPanel compartido (ver [Nivel 2 — Contenedores](../c4/nivel2-contenedores.md)) — no hay múltiples instancias entre las cuales repartir tráfico.

## Decisión

No se introduce un balanceador de carga.

## Consecuencias

Este plan de hosting no permite ni requiere múltiples instancias horizontales del backend; Apache ya actúa como único front del tráfico entrante. Si el tráfico creciera al punto de necesitar más de una instancia, el plan de hosting tendría que cambiar antes de que un balanceador tuviera sentido.
