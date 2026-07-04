# ADR-008: CQRS — no implementado

## Contexto

El dominio es CRUD directo sobre una decena de entidades relacionadas (iglesias, pastores, líderes, congregantes, eventos, comunicados), con un volumen de datos pequeño (48 iglesias reales). No hay necesidad de modelos de lectura optimizados distintos a los de escritura, ni de escalar lecturas y escrituras de forma independiente.

## Decisión

No se separan los modelos de comando y de consulta (Command Query Responsibility Segregation).

## Consecuencias

Separar comandos y queries duplicaría lógica y modelos de datos sin que exista un problema real de rendimiento o de contención de escritura que lo justifique a este volumen. Prisma sobre un único esquema relacional cubre tanto lecturas como escrituras sin fricción.
