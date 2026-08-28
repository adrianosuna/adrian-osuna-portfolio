-- Ámbito de las tareas de mantenimiento: las mismas tareas recurrentes sirven
-- para el servidor, para casa y para el vehículo (ITV, seguro, revisión), que
-- son el mismo problema. Las que ya existían son todas del servidor, que es
-- además el valor por defecto, así que no hay que rellenar nada.

-- AlterTable
ALTER TABLE `maintenance_task` ADD COLUMN `scope` ENUM('servidor', 'casa', 'vehiculo') NOT NULL DEFAULT 'servidor';
