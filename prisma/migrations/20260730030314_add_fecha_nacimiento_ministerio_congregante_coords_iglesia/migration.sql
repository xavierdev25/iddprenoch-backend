-- AlterTable
ALTER TABLE `congregantes` ADD COLUMN `fecha_nacimiento` DATE NULL,
    ADD COLUMN `ministerio_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `iglesias` ADD COLUMN `latitud` DOUBLE NULL,
    ADD COLUMN `longitud` DOUBLE NULL;

-- CreateIndex
CREATE INDEX `congregantes_ministerio_id_idx` ON `congregantes`(`ministerio_id`);

-- CreateIndex
CREATE INDEX `congregantes_fecha_nacimiento_idx` ON `congregantes`(`fecha_nacimiento`);

-- AddForeignKey
ALTER TABLE `congregantes` ADD CONSTRAINT `congregantes_ministerio_id_fkey` FOREIGN KEY (`ministerio_id`) REFERENCES `ministerios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
