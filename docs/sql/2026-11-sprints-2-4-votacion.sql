-- =================================================================================================
-- Sprints 2–4 — Votación electrónica en asambleas (ADR-028, ADR-029, ADR-030)
-- Migración de Prisma equivalente: prisma/migrations/20261120000000_votacion_asambleas
-- Es el ÚNICO cambio de esquema de los Sprints 2, 3 y 4 (los Sprints 3 y 4 no tocan la base).
--
-- Validado el 20/11/2026 sobre el backup real de producción cargado en MariaDB 10.11 (ADR-031),
-- después del SQL del Sprint 1: datos previos intactos y esquema idéntico al de la aplicación.
--
-- REQUISITO: el SQL del Sprint 1 ya ejecutado (docs/sql/2026-11-sprint-1-roles-alcance-auditoria.sql).
-- El PASO 0 lo comprueba.
--
-- CÓMO EJECUTARLO (phpMyAdmin, base de producción):
--   1. Exportar > Rápido > SQL de la base completa (backup).
--   2. PASO 0: debe devolver 1 fila (columna usuarios.distrito_id). Si devuelve 0, NO sigas.
--   3. PASO 1 completo, de una sola vez, en la pestaña SQL.
--   4. PASO 2: la tabla `_prisma_migrations` EXISTE en producción (verificado con el backup del
--      20/11/2026), así que hay que descomentar y ejecutar el INSERT.
--   5. PASO 3: comprobar los resultados esperados.
--   6. Avisar "SQL 2–4 listo" para subir el código.
--
-- Es NO destructivo: solo crea seis tablas nuevas y sus claves foráneas. No modifica ni borra
-- ninguna tabla ni dato existente; el código actual de producción las ignora.
-- =================================================================================================


-- -------------------------------------------------------------------------------------------------
-- PASO 0 — Comprobación previa: ¿se aplicó el Sprint 1? Debe devolver una fila.
-- -------------------------------------------------------------------------------------------------
SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'distrito_id';


-- -------------------------------------------------------------------------------------------------
-- PASO 1 — Migración (idéntica a la migración de Prisma).
-- -------------------------------------------------------------------------------------------------
-- CreateTable
CREATE TABLE `asambleas` (
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
CREATE TABLE `elecciones` (
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
CREATE TABLE `candidatos` (
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
CREATE TABLE `electores` (
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
CREATE TABLE `emisiones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eleccion_id` INTEGER NOT NULL,
    `elector_id` INTEGER NOT NULL,
    `emitido_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `emisiones_elector_id_idx`(`elector_id`),
    UNIQUE INDEX `emisiones_eleccion_id_elector_id_key`(`eleccion_id`, `elector_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `votos` (
    `id` CHAR(36) NOT NULL,
    `eleccion_id` INTEGER NOT NULL,
    `candidato_id` INTEGER NOT NULL,

    INDEX `votos_eleccion_id_idx`(`eleccion_id`),
    INDEX `votos_candidato_id_idx`(`candidato_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `asambleas` ADD CONSTRAINT `asambleas_distrito_id_fkey` FOREIGN KEY (`distrito_id`) REFERENCES `distritos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `elecciones` ADD CONSTRAINT `elecciones_asamblea_id_fkey` FOREIGN KEY (`asamblea_id`) REFERENCES `asambleas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `elecciones` ADD CONSTRAINT `elecciones_ganador_id_fkey` FOREIGN KEY (`ganador_id`) REFERENCES `candidatos`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `candidatos` ADD CONSTRAINT `candidatos_eleccion_id_fkey` FOREIGN KEY (`eleccion_id`) REFERENCES `elecciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `electores` ADD CONSTRAINT `electores_asamblea_id_fkey` FOREIGN KEY (`asamblea_id`) REFERENCES `asambleas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `electores` ADD CONSTRAINT `electores_iglesia_id_fkey` FOREIGN KEY (`iglesia_id`) REFERENCES `iglesias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emisiones` ADD CONSTRAINT `emisiones_eleccion_id_fkey` FOREIGN KEY (`eleccion_id`) REFERENCES `elecciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emisiones` ADD CONSTRAINT `emisiones_elector_id_fkey` FOREIGN KEY (`elector_id`) REFERENCES `electores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `votos` ADD CONSTRAINT `votos_eleccion_id_fkey` FOREIGN KEY (`eleccion_id`) REFERENCES `elecciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `votos` ADD CONSTRAINT `votos_candidato_id_fkey` FOREIGN KEY (`candidato_id`) REFERENCES `candidatos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;



-- -------------------------------------------------------------------------------------------------
-- PASO 2 — Solo si existe `_prisma_migrations` (SHOW TABLES LIKE '_prisma_migrations';).
-- -------------------------------------------------------------------------------------------------
-- INSERT INTO `_prisma_migrations`
--   (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
-- VALUES
--   (UUID(), '49d9bbdb3db592f86e7a78e06766d067acbf38934fe2c4dd2cb875237e83e351',
--    '20261120000000_votacion_asambleas', NOW(3), NOW(3), 1);


-- -------------------------------------------------------------------------------------------------
-- PASO 3 — Verificación. Resultados esperados:
--   a) las seis tablas nuevas existen y están vacías (0 filas cada una);
--   b) `votos` tiene exactamente 3 columnas: id, eleccion_id, candidato_id (sin fecha ni elector:
--      es lo que garantiza el voto secreto, ADR-029).
-- -------------------------------------------------------------------------------------------------
SELECT 'asambleas' AS tabla, COUNT(*) AS filas FROM asambleas
UNION ALL SELECT 'elecciones', COUNT(*) FROM elecciones
UNION ALL SELECT 'candidatos', COUNT(*) FROM candidatos
UNION ALL SELECT 'electores', COUNT(*) FROM electores
UNION ALL SELECT 'emisiones', COUNT(*) FROM emisiones
UNION ALL SELECT 'votos', COUNT(*) FROM votos;

SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'votos'
ORDER BY ORDINAL_POSITION;


-- -------------------------------------------------------------------------------------------------
-- REVERSIÓN DEL ESQUEMA — NO hace falta para revertir el código: el código anterior ignora estas
-- tablas. Solo si se decidiera deshacer también la base ANTES de usarla (borra asambleas, padrones
-- y votos): por eso va comentada. El orden respeta las claves foráneas.
-- -------------------------------------------------------------------------------------------------
-- ALTER TABLE `elecciones` DROP FOREIGN KEY `elecciones_ganador_id_fkey`;
-- DROP TABLE `votos`;
-- DROP TABLE `emisiones`;
-- DROP TABLE `electores`;
-- DROP TABLE `candidatos`;
-- DROP TABLE `elecciones`;
-- DROP TABLE `asambleas`;
