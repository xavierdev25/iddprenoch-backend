-- =================================================================================================
-- Sprint 1 — Roles, alcance por distrito y auditoría (ADR-026, ADR-027)
-- Migración de Prisma equivalente: prisma/migrations/20261113000000_roles_alcance_auditoria
--
-- CÓMO EJECUTARLO (phpMyAdmin, base de producción):
--   1. Antes de nada: Exportar > Rápido > SQL de la base completa (backup).
--   2. Ejecutar el PASO 0 y guardar el resultado (quién tenía qué rol antes del cambio).
--   3. Ejecutar el PASO 1 completo, de una sola vez, en la pestaña SQL.
--   4. Ejecutar el PASO 2 solo si existe la tabla `_prisma_migrations`.
--   5. Ejecutar el PASO 3 y comprobar los resultados esperados.
--   6. Recién después, desplegar el código del Sprint 1 (merge a main).
--
-- Es NO destructivo: agrega una columna nullable y una tabla nueva, renombra un rol conservando su
-- id e inserta dos roles. El código que hoy está en producción sigue funcionando con este esquema.
-- =================================================================================================


-- -------------------------------------------------------------------------------------------------
-- PASO 0 — Consulta previa (no modifica nada): usuarios y su rol actual.
-- -------------------------------------------------------------------------------------------------
SELECT u.id, u.nombre AS usuario, r.id AS rol_id, r.nombre AS rol_actual, e.nombre AS estado
FROM usuarios u
JOIN roles r ON r.id = u.rol_id
JOIN estados_usuario e ON e.id = u.estado_id
ORDER BY r.id, u.nombre;


-- -------------------------------------------------------------------------------------------------
-- PASO 1 — Migración (idéntica a la migración de Prisma).
-- -------------------------------------------------------------------------------------------------
-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `distrito_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `auditoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NULL,
    `usuario_nombre` VARCHAR(255) NULL,
    `accion` VARCHAR(40) NOT NULL,
    `recurso` VARCHAR(255) NOT NULL,
    `resultado` ENUM('PERMITIDO', 'DENEGADO') NOT NULL,
    `detalle` TEXT NULL,
    `ip` VARCHAR(45) NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoria_fecha_idx`(`fecha`),
    INDEX `auditoria_usuario_id_idx`(`usuario_id`),
    INDEX `auditoria_resultado_idx`(`resultado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `usuarios_distrito_id_idx` ON `usuarios`(`distrito_id`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_distrito_id_fkey` FOREIGN KEY (`distrito_id`) REFERENCES `distritos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Datos: roles del control de acceso (ADR-026). No destructivo: el UPDATE conserva el id, así que
-- los usuarios que ya tenían el rol no cambian de fila ni pierden la referencia.
UPDATE `roles` SET `nombre` = 'Responsable del sistema' WHERE `nombre` = 'Administrador Regional';

-- INSERT IGNORE se apoya en el UNIQUE de roles.nombre: re-ejecutar el script no duplica filas.
INSERT IGNORE INTO `roles` (`nombre`) VALUES ('Responsable del sistema'), ('Obispo regional'), ('Obispo distrital');


-- -------------------------------------------------------------------------------------------------
-- PASO 2 — Solo si existe la tabla `_prisma_migrations` (compruébalo con la consulta de abajo).
-- Registra la migración como aplicada para que un futuro `prisma migrate deploy` no la repita.
-- -------------------------------------------------------------------------------------------------
-- SHOW TABLES LIKE '_prisma_migrations';
--
-- INSERT INTO `_prisma_migrations`
--   (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
-- VALUES
--   (UUID(), '03314ac72c592f07f8ce935b04e38706ca181ba46cbf8d49669345f1eff6d557',
--    '20261113000000_roles_alcance_auditoria', NOW(3), NOW(3), 1);


-- -------------------------------------------------------------------------------------------------
-- PASO 3 — Verificación. Resultados esperados:
--   a) roles: aparecen 'Responsable del sistema' (con el id que tenía 'Administrador Regional'),
--      'Obispo regional', 'Obispo distrital', 'Editor', 'Secretario Regional', 'Tesorero Regional'.
--   b) usuarios: el usuario del id 1 figura como 'Responsable del sistema'; distrito_id en NULL.
--   c) auditoria: la tabla existe y está vacía (0).
-- -------------------------------------------------------------------------------------------------
SELECT id, nombre FROM roles ORDER BY id;

SELECT u.id, u.nombre AS usuario, r.nombre AS rol, u.distrito_id
FROM usuarios u JOIN roles r ON r.id = u.rol_id
ORDER BY u.id;

SELECT COUNT(*) AS registros_auditoria FROM auditoria;


-- -------------------------------------------------------------------------------------------------
-- REVERSIÓN DEL ESQUEMA — NO hace falta para revertir el código (ver ADR-026): el esquema nuevo
-- es compatible con el código anterior. Solo si se decidiera deshacer también la base. Borra la
-- tabla de auditoría con sus registros y los distritos asignados: por eso va comentado.
-- -------------------------------------------------------------------------------------------------
-- ALTER TABLE `auditoria` DROP FOREIGN KEY `auditoria_usuario_id_fkey`;
-- DROP TABLE `auditoria`;
-- ALTER TABLE `usuarios` DROP FOREIGN KEY `usuarios_distrito_id_fkey`;
-- DROP INDEX `usuarios_distrito_id_idx` ON `usuarios`;
-- ALTER TABLE `usuarios` DROP COLUMN `distrito_id`;
-- UPDATE `roles` SET `nombre` = 'Administrador Regional' WHERE `nombre` = 'Responsable del sistema';
-- (Los roles 'Obispo regional' y 'Obispo distrital' pueden quedarse: sin usuarios no tienen efecto.)
