-- De qué recurrente vino cada movimiento. Hasta ahora lo generado por el cron
-- era indistinguible de lo apuntado a mano, así que no se podía ver qué había
-- apuntado cada recurrente. SET NULL a propósito: borrar el recurrente NO borra
-- sus movimientos (son gasto real), solo pierden el origen.
-- Los movimientos ya existentes se quedan en null: nadie sabe de dónde vinieron.

-- AlterTable
ALTER TABLE `expense` ADD COLUMN `recurring_uuid` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `fk_expense_recurring` ON `expense`(`recurring_uuid`);

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `fk_expense_recurring` FOREIGN KEY (`recurring_uuid`) REFERENCES `recurring_expense`(`uuid`) ON DELETE SET NULL ON UPDATE NO ACTION;
