-- Los ámbitos de mantenimiento pasan de enum de tres a TABLA editable: la lista
-- (servidor, casa, vehículo... y los que hagan falta) la decide quien usa la
-- app, no el esquema. Se hace en dos pasos por el dato ya existente: primero se
-- siembran los tres del enum, después cada tarea apunta al suyo por nombre y se
-- retira la columna vieja.

-- CreateTable
CREATE TABLE `maintenance_scope` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Los tres que existían como enum (idempotente por si se reejecuta).
INSERT INTO `maintenance_scope` (`uuid`, `name`)
SELECT UUID(), 'Servidor'
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_scope` WHERE `name` = 'Servidor');
INSERT INTO `maintenance_scope` (`uuid`, `name`)
SELECT UUID(), 'Casa'
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_scope` WHERE `name` = 'Casa');
INSERT INTO `maintenance_scope` (`uuid`, `name`)
SELECT UUID(), 'Vehículo'
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_scope` WHERE `name` = 'Vehículo');

-- AlterTable
ALTER TABLE `maintenance_task` ADD COLUMN `scope_uuid` VARCHAR(36) NULL;

-- Cada tarea a su ámbito, traduciendo el valor del enum a su nombre.
UPDATE `maintenance_task` `t`
JOIN `maintenance_scope` `s`
  ON `s`.`name` = CASE `t`.`scope`
       WHEN 'casa' THEN 'Casa'
       WHEN 'vehiculo' THEN 'Vehículo'
       ELSE 'Servidor'
     END
SET `t`.`scope_uuid` = `s`.`uuid`;

-- DropColumn
ALTER TABLE `maintenance_task` DROP COLUMN `scope`;

-- CreateIndex
CREATE INDEX `fk_maintenance_scope` ON `maintenance_task`(`scope_uuid`);

-- AddForeignKey
ALTER TABLE `maintenance_task` ADD CONSTRAINT `fk_maintenance_scope` FOREIGN KEY (`scope_uuid`) REFERENCES `maintenance_scope`(`uuid`) ON DELETE SET NULL ON UPDATE NO ACTION;
