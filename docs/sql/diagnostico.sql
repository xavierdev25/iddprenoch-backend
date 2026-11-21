-- =================================================================================================
-- Diagnóstico del estado de la base de producción (solo lectura: no modifica nada).
-- Pegar en phpMyAdmin → pestaña SQL, sin elegir base (la primera línea la selecciona) y copiar
-- TODOS los resultados que aparezcan, de arriba abajo.
-- No consulta information_schema (ver el encabezado de los otros SQL).
-- =================================================================================================

USE `iddpreno_main`;

-- 1. ¿Existe la tabla auditoria? (Sprint 1) — una fila = sí; nada = no.
SHOW TABLES LIKE 'auditoria';

-- 2. ¿usuarios tiene la columna distrito_id? (Sprint 1) — una fila = sí; nada = no.
SHOW COLUMNS FROM `usuarios` LIKE 'distrito_id';

-- 3. ¿Existe alguna tabla de votación? (Sprints 2–4) — lista las que existan, de 0 a 6.
SHOW TABLES WHERE `Tables_in_iddpreno_main` IN ('asambleas', 'elecciones', 'candidatos', 'electores', 'emisiones', 'votos');

-- 4. Roles actuales y cuántos usuarios tiene cada uno.
SELECT r.id, r.nombre, COUNT(u.id) AS usuarios
FROM `roles` r LEFT JOIN `usuarios` u ON u.rol_id = r.id
GROUP BY r.id, r.nombre
ORDER BY r.id;

-- 5. Últimos registros de migraciones.
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM `_prisma_migrations`
ORDER BY started_at DESC
LIMIT 8;
