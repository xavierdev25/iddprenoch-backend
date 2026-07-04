# ADR-024: Event-Driven Architecture — no implementado

## Contexto

El dominio es CRUD administrativo sin reacciones en cadena entre módulos: crear un pastor, por ejemplo, no dispara efectos secundarios en otros módulos que necesiten desacoplarse vía eventos.

## Decisión

No se adopta una arquitectura orientada a eventos entre módulos.

## Consecuencias

Las pocas relaciones entre entidades (por ejemplo, iglesia-pastor, congregante-ministerio) se resuelven con llamadas directas y transacciones de Prisma dentro del mismo proceso. Una arquitectura orientada a eventos introduciría infraestructura de mensajería (broker, tópicos) sin un caso de uso real que la justifique en este monolito.
