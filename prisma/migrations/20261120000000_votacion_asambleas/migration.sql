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

