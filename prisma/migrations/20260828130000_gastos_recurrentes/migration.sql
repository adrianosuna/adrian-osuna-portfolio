-- Movimientos recurrentes (alquiler, suscripciones, seguros, nómina...): el
-- cron diario crea el movimiento en `expense` cuando llega su fecha y adelanta
-- `next_date` tantos meses como diga `interval_months`. `day_anchor` guarda el
-- día original (1-31) para que un cargo del 31 no se quede clavado en el 28 al
-- pasar por febrero, y `active` permite pausar uno sin perder su configuración.
-- Borrar la categoría no borra el recurrente (SET NULL), igual que en expense.

-- CreateTable
CREATE TABLE `recurring_expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `category_uuid` VARCHAR(36) NULL,
    `type` ENUM('ingreso', 'gasto') NOT NULL,
    `concept` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `interval_months` SMALLINT NOT NULL,
    `next_date` DATE NOT NULL,
    `day_anchor` SMALLINT NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `last_created` DATE NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_recurring_next_date`(`next_date`),
    INDEX `fk_recurring_category`(`category_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recurring_expense` ADD CONSTRAINT `fk_recurring_category` FOREIGN KEY (`category_uuid`) REFERENCES `expense_category`(`uuid`) ON DELETE SET NULL ON UPDATE NO ACTION;
