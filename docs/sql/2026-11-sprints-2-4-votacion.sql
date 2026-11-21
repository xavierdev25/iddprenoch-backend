-- =================================================================================================
-- Sprints 2–4 — Votación electrónica en asambleas (ADR-028, ADR-029, ADR-030)
-- Migración de Prisma equivalente: prisma/migrations/20261120000000_votacion_asambleas
-- (único cambio de esquema de los Sprints 2, 3 y 4).
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
-- REQUISITO: el SQL del Sprint 1 aplicado (el PASO 0 lo muestra).
-- Antes: Exportar → Rápido → SQL de la base completa (backup).
-- =================================================================================================

USE `iddpreno_main`;

-- PASO 0 — ¿Está aplicado el Sprint 1? Debe mostrar UNA fila (distrito_id). Si no muestra nada,
-- detente: primero va el SQL del Sprint 1.
SHOW COLUMNS FROM `usuarios` LIKE 'distrito_id';

-- PASO 1 — Seis tablas nuevas y sus claves foráneas. No toca ninguna tabla existente.
-- CreateTable
CREATE TABLE IF NOT EXISTS `asambleas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` ENUM('REGIONAL', 'DISTRITAL') NOT NULL,
    `distrito_id` INTEGER NULL,
    `fecha` DATETIME(3) NOT NULL,
    `codigo_acceso` VARCHAR(12) NOT NULL,
    `estado` ENUM('PROGRAMADA', 'EN_CURSO', 'FINALIZADA') NOT NULL DEFAULT 'PROGRAMADA',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asambleas_codigo_acceso_key`(`codigo_acceso`),
    INDEX `asambleas_distrito_id_idx`(`distrito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `elecciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asamblea_id` INTEGER NOT NULL,
    `cargo` VARCHAR(191) NOT NULL,
    `ronda` INTEGER NOT NULL DEFAULT 1,
    `estado` ENUM('PENDIENTE', 'ABIERTA', 'CERRADA') NOT NULL DEFAULT 'PENDIENTE',
    `abierta_en` DATETIME(3) NULL,
    `cerrada_en` DATETIME(3) NULL,
    `publicada_en` DATETIME(3) NULL,
    `ganador_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `elecciones_ganador_id_key`(`ganador_id`),
    UNIQUE INDEX `elecciones_asamblea_id_cargo_ronda_key`(`asamblea_id`, `cargo`, `ronda`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `candidatos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eleccion_id` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `detalle` VARCHAR(191) NULL,
    `foto` LONGTEXT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,

    INDEX `candidatos_eleccion_id_idx`(`eleccion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `electores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asamblea_id` INTEGER NOT NULL,
    `dni` CHAR(8) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `iglesia_id` INTEGER NULL,
    `codigo_hash` VARCHAR(191) NULL,
    `acreditado` BOOLEAN NOT NULL DEFAULT false,
    `acreditado_en` DATETIME(3) NULL,

    INDEX `electores_iglesia_id_idx`(`iglesia_id`),
    UNIQUE INDEX `electores_asamblea_id_dni_key`(`asamblea_id`, `dni`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `emisiones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eleccion_id` INTEGER NOT NULL,
    `elector_id` INTEGER NOT NULL,
    `emitido_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `emisiones_elector_id_idx`(`elector_id`),
    UNIQUE INDEX `emisiones_eleccion_id_elector_id_key`(`eleccion_id`, `elector_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `votos` (
    `id` CHAR(36) NOT NULL,
    `eleccion_id` INTEGER NOT NULL,
    `candidato_id` INTEGER NOT NULL,

    INDEX `votos_eleccion_id_idx`(`eleccion_id`),
    INDEX `votos_candidato_id_idx`(`candidato_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `asambleas` ADD CONSTRAINT `asambleas_distrito_id_fkey` FOREIGN KEY IF NOT EXISTS (`distrito_id`) REFERENCES `distritos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `elecciones` ADD CONSTRAINT `elecciones_asamblea_id_fkey` FOREIGN KEY IF NOT EXISTS (`asamblea_id`) REFERENCES `asambleas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `elecciones` ADD CONSTRAINT `elecciones_ganador_id_fkey` FOREIGN KEY IF NOT EXISTS (`ganador_id`) REFERENCES `candidatos`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `candidatos` ADD CONSTRAINT `candidatos_eleccion_id_fkey` FOREIGN KEY IF NOT EXISTS (`eleccion_id`) REFERENCES `elecciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `electores` ADD CONSTRAINT `electores_asamblea_id_fkey` FOREIGN KEY IF NOT EXISTS (`asamblea_id`) REFERENCES `asambleas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `electores` ADD CONSTRAINT `electores_iglesia_id_fkey` FOREIGN KEY IF NOT EXISTS (`iglesia_id`) REFERENCES `iglesias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emisiones` ADD CONSTRAINT `emisiones_eleccion_id_fkey` FOREIGN KEY IF NOT EXISTS (`eleccion_id`) REFERENCES `elecciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emisiones` ADD CONSTRAINT `emisiones_elector_id_fkey` FOREIGN KEY IF NOT EXISTS (`elector_id`) REFERENCES `electores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `votos` ADD CONSTRAINT `votos_eleccion_id_fkey` FOREIGN KEY IF NOT EXISTS (`eleccion_id`) REFERENCES `elecciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `votos` ADD CONSTRAINT `votos_candidato_id_fkey` FOREIGN KEY IF NOT EXISTS (`candidato_id`) REFERENCES `candidatos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- PASO 2 — Registro de la migración (solo si todavía no hay un registro exitoso).
INSERT INTO `_prisma_migrations` (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT UUID(), '49d9bbdb3db592f86e7a78e06766d067acbf38934fe2c4dd2cb875237e83e351',
       '20261120000000_votacion_asambleas', NOW(3), NOW(3), 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `_prisma_migrations`
  WHERE migration_name = '20261120000000_votacion_asambleas' AND finished_at IS NOT NULL
);

-- PASO 3 — Verificación. Esperado: las seis tablas listadas, y `votos` con exactamente tres
-- columnas (id, eleccion_id, candidato_id): sin fecha ni elector, así se garantiza el voto secreto.
SHOW TABLES WHERE `Tables_in_iddpreno_main` IN ('asambleas', 'elecciones', 'candidatos', 'electores', 'emisiones', 'votos');
SHOW COLUMNS FROM `votos`;

-- REVERSIÓN DEL ESQUEMA (comentada; borra los datos de votación). Solo antes de usarla.
-- ALTER TABLE `elecciones` DROP FOREIGN KEY `elecciones_ganador_id_fkey`;
-- DROP TABLE `votos`;
-- DROP TABLE `emisiones`;
-- DROP TABLE `electores`;
-- DROP TABLE `candidatos`;
-- DROP TABLE `elecciones`;
-- DROP TABLE `asambleas`;
