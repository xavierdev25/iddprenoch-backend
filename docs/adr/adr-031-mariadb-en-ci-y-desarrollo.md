# ADR-031: MariaDB 10.11 en el CI y en desarrollo, igual que el hosting

## Contexto

El ADR-002 eligió "MySQL en el mismo cPanel", y el CI y el `docker-compose.dev.yml` usaban
MySQL 8. Al validar los SQL de despliegue sobre el backup real de producción (20/11/2026), la
cabecera del volcado mostró el motor verdadero del hosting: **MariaDB 10.11**
(`10.11.19-MariaDB-cll-lve`).

No es un detalle. La transacción del voto usaba `SELECT … FOR SHARE`, que MySQL 8 acepta y MariaDB
10.11 rechaza con un error de sintaxis. Con MySQL 8 en el CI, todas las pruebas pasaban, pero **en
producción habría fallado cada voto**. Al repetir la suite sobre MariaDB 10.11 con esa sentencia,
fallan 5 pruebas.

## Decisión

- El CI (servicio de GitHub Actions) y el entorno de desarrollo usan **`mariadb:10.11`**, la misma
  versión mayor del hosting. Las pruebas de integración corren contra ese motor en cada push y PR.
- El bloqueo compartido del voto pasa a `SELECT … LOCK IN SHARE MODE`, que aceptan MariaDB y MySQL.
- Prisma sigue con `provider = "mysql"` (Prisma soporta MariaDB con ese provider) y las URLs
  siguen siendo `mysql://`.
- Los SQL manuales de cada sprint se validan sobre una copia del backup de producción cargada en
  MariaDB 10.11, que se borra al terminar. El backup nunca entra a un repositorio.

## Consecuencias

- La suite completa de integración (93 pruebas, incluidas las de concurrencia) pasa sobre MariaDB
  10.11.
- El contenedor de desarrollo cambia de nombre (`iddp-mariadb-dev`) y de volumen
  (`iddp-mariadb-data`): los archivos de datos de MySQL 8 no son compatibles. El volumen viejo
  (`iddp-mysql-data`) se puede borrar; solo tenía datos del seed.
- El ADR-002 sigue vigente en lo esencial (base en el mismo cPanel, sin servicio externo); lo que
  cambia es el motor exacto contra el que se prueba.
