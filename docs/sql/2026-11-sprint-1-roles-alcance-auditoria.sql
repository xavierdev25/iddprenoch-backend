-- =================================================================================================
-- Sprint 1 — Roles, alcance por distrito y auditoría (ADR-026, ADR-027)
-- Migración de Prisma equivalente: prisma/migrations/20261113000000_roles_alcance_auditoria
--
-- Para pegar en phpMyAdmin → pestaña SQL. NO hace falta elegir la base antes: la primera línea
-- (USE) la selecciona. Es seguro ejecutarlo más de una vez: si algo ya existe, se salta (se ven
-- "advertencias", no errores) y no duplica nada.
--
-- No consulta `information_schema`: phpMyAdmin, al ver esa base en una consulta, cambia la base
-- activa y las sentencias siguientes fallan con "#1044 Acceso denegado … 'information_schema'".
--
-- Usa sintaxis de MariaDB (IF NOT EXISTS en columnas, índices y claves foráneas), el motor del
-- hosting (ADR-031). El resultado es idéntico al de la migración de Prisma indicada abajo.
--
-- Antes: Exportar → Rápido → SQL de la base completa (backup).
-- =================================================================================================

USE `iddpreno_main`;

-- PASO 0 — Usuarios y su rol ANTES del cambio (no modifica nada).
SELECT u.id, u.nombre AS usuario, r.id AS rol_id, r.nombre AS rol_actual, e.nombre AS estado
FROM usuarios u
JOIN roles r ON r.id = u.rol_id
JOIN estados_usuario e ON e.id = u.estado_id
ORDER BY r.id, u.nombre;

-- PASO 1 — Esquema y datos.
-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN IF NOT EXISTS `distrito_id` INTEGER NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS `auditoria` (
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
CREATE INDEX IF NOT EXISTS `usuarios_distrito_id_idx` ON `usuarios`(`distrito_id`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_distrito_id_fkey` FOREIGN KEY IF NOT EXISTS (`distrito_id`) REFERENCES `distritos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_usuario_id_fkey` FOREIGN KEY IF NOT EXISTS (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Datos: roles del control de acceso (ADR-026). No destructivo: el UPDATE conserva el id, así que
-- los usuarios que ya tenían el rol no cambian de fila ni pierden la referencia.
UPDATE `roles` SET `nombre` = 'Responsable del sistema' WHERE `nombre` = 'Administrador Regional';

-- INSERT IGNORE se apoya en el UNIQUE de roles.nombre: re-ejecutar el script no duplica filas.
INSERT IGNORE INTO `roles` (`nombre`) VALUES ('Responsable del sistema'), ('Obispo regional'), ('Obispo distrital');

-- PASO 2 — Registro de la migración (la tabla `_prisma_migrations` existe en producción). Solo
-- inserta si todavía no hay un registro exitoso de esta migración.
INSERT INTO `_prisma_migrations` (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT UUID(), '03314ac72c592f07f8ce935b04e38706ca181ba46cbf8d49669345f1eff6d557',
       '20261113000000_roles_alcance_auditoria', NOW(3), NOW(3), 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `_prisma_migrations`
  WHERE migration_name = '20261113000000_roles_alcance_auditoria' AND finished_at IS NOT NULL
);

-- PASO 3 — Verificación. Esperado: usuarios.distrito_id existe; la tabla auditoria existe; los
-- roles incluyen "Responsable del sistema" (con el id que tenía "Administrador Regional"),
-- "Obispo regional" y "Obispo distrital", cada uno UNA sola vez.
SHOW COLUMNS FROM `usuarios` LIKE 'distrito_id';
SHOW TABLES LIKE 'auditoria';
SELECT id, nombre FROM `roles` ORDER BY id;

-- REVERSIÓN DEL ESQUEMA (comentada; NO hace falta para revertir el código, ver ADR-026).
-- ALTER TABLE `auditoria` DROP FOREIGN KEY `auditoria_usuario_id_fkey`;
-- DROP TABLE `auditoria`;
-- ALTER TABLE `usuarios` DROP FOREIGN KEY `usuarios_distrito_id_fkey`;
-- DROP INDEX `usuarios_distrito_id_idx` ON `usuarios`;
-- ALTER TABLE `usuarios` DROP COLUMN `distrito_id`;
-- UPDATE `roles` SET `nombre` = 'Administrador Regional' WHERE `nombre` = 'Responsable del sistema';
