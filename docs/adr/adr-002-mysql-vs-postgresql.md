# ADR-002: MySQL en el mismo cPanel, en vez de PostgreSQL externo

## Contexto

PostgreSQL era la mejora tecnológica explícita planteada para este proyecto, y así se construyó y probó por completo en un entorno local: el `schema.prisma` inicial, las migraciones y toda la capa de acceso a datos se desarrollaron y validaron contra PostgreSQL. Al momento de preparar el despliegue se confirmó que el plan de hosting contratado (`Personal_DA` de cPanel) **no ofrece PostgreSQL como servicio** — solo MySQL está disponible dentro de ese plan. La alternativa habría sido contratar o gestionar un proveedor de PostgreSQL externo (p. ej. un servicio gestionado en la nube) únicamente para la base de datos.

## Decisión

Se migró el proyecto a **MySQL**, alojado en el mismo servidor cPanel que ya aloja el backend (`iddpreno_main`), priorizando mantener toda la infraestructura dentro del hosting ya contratado por sobre conservar el motor de base de datos específico que se había planeado y probado originalmente.

Durante la migración se encontró una diferencia técnica real entre ambos motores vía Prisma: `String` se mapea por defecto a `VARCHAR(191)` en MySQL, mientras que en PostgreSQL se mapea a `text` sin límite práctico. Esto obligó a auditar campo por campo del schema y marcar explícitamente `@db.Text` o `@db.LongText` donde el contenido podía exceder 191 caracteres — en particular los campos de imagen almacenados como base64 (`foto` en `Iglesia`, `Pastor` y `Congregante`; `imagen` en `Evento` y `Comunicado`), que sin ese ajuste se habrían truncado en silencio al insertarse, sin lanzar un error de validación evidente.

## Consecuencias

- Toda la infraestructura (frontend, backend y base de datos) vive en un único proveedor y una única cuenta, sin credenciales ni facturación adicionales que gestionar.
- Se perdió la posibilidad de usar tipos y extensiones específicas de PostgreSQL que se habían aprovechado en la versión probada localmente (por ejemplo, tipos de texto sin límite por defecto).
- Quedó como práctica obligatoria para cualquier campo `String` nuevo en el schema: evaluar explícitamente si necesita `@db.Text`/`@db.LongText`, en vez de asumir el default de Prisma — el riesgo de truncamiento silencioso es real y ya se manifestó una vez en este proyecto.
- El detalle de conexión (`DATABASE_URL` apuntando a `localhost` en el mismo servidor) se documenta en [Nivel 2 — Contenedores](../c4/nivel2-contenedores.md) y el modelo de datos resultante en el [Diagrama Entidad-Relación](../er-diagrama.md).
