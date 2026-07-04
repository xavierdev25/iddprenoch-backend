# ADR-012: Sharding — no implementado

## Contexto

El volumen de datos del sistema (48 iglesias reales y sus entidades relacionadas: pastores, líderes, congregantes) está muy por debajo de cualquier umbral donde particionar horizontalmente una tabla aporte valor real.

## Decisión

No se particiona (shard) ninguna tabla de la base de datos.

## Consecuencias

Una sola base MySQL sin particionar es más simple de operar, respaldar y razonar, y es más que suficiente en throughput y tamaño para este proyecto. Shardear introduciría complejidad de enrutamiento de queries entre particiones sin ningún beneficio medible a este volumen.
