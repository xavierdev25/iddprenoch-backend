# ADR-013: Consistent Hashing — no implementado

## Contexto

No existe un clúster de nodos (caché distribuida, almacenamiento distribuido) entre los cuales repartir claves de forma balanceada.

## Decisión

No se implementa un esquema de hashing consistente.

## Consecuencias

Al no existir múltiples nodos de datos ni de caché en la arquitectura (un único servidor MySQL, sin capa de caché distribuida), no hay ningún problema de distribución de claves entre nodos que resolver.
