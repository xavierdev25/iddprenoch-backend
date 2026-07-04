# ADR-015: Autoscaling — no implementado

## Contexto

El hosting cPanel compartido tiene capacidad fija y no expone una API de infraestructura para aprovisionar recursos adicionales bajo demanda.

## Decisión

No se implementa autoscaling.

## Consecuencias

El tráfico esperado (una congregación con 48 iglesias, no un producto de consumo masivo) nunca se acerca a los límites del plan actual. Autoscaling requeriría migrar a una infraestructura cloud distinta a la ya contratada, sin que exista una necesidad de capacidad variable que lo justifique hoy.
