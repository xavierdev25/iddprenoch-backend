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
