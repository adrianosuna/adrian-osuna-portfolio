-- Control de gastos e ingresos (réplica del Excel "Control de gastos"): cada
-- movimiento es un ingreso o un gasto con su fecha, categoría e importe. Las
-- categorías son libres y propias de cada tipo; borrar una no borra sus
-- movimientos (SET NULL): quedan "sin categoría".

-- CreateTable
CREATE TABLE `expense_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('ingreso', 'gasto') NOT NULL,
    `color` VARCHAR(9) NOT NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_expense_category_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `category_uuid` VARCHAR(36) NULL,
    `type` ENUM('ingreso', 'gasto') NOT NULL,
    `concept` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `expense_date` DATE NOT NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_expense_date`(`expense_date`),
    INDEX `fk_expense_category`(`category_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `fk_expense_category` FOREIGN KEY (`category_uuid`) REFERENCES `expense_category`(`uuid`) ON DELETE SET NULL ON UPDATE NO ACTION;


-- Categorías de GASTO (editables y ampliables desde el módulo).
-- Idempotente por nombre + tipo: no duplica si la migración se repite.
INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Supermercado', 'gasto', '#10b981'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Supermercado' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Comer fuera / Cafés', 'gasto', '#f59e0b'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Comer fuera / Cafés' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Transporte / Gasolina', 'gasto', '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Transporte / Gasolina' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Ocio y salidas', 'gasto', '#a855f7'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Ocio y salidas' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Ropa y calzado', 'gasto', '#ec4899'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Ropa y calzado' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Belleza y cuidado', 'gasto', '#f472b6'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Belleza y cuidado' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Salud y farmacia', 'gasto', '#ef4444'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Salud y farmacia' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Suscripciones', 'gasto', '#14b8a6'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Suscripciones' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Móvil y teléfono', 'gasto', '#06b6d4'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Móvil y teléfono' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Estudios', 'gasto', '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Estudios' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Regalos', 'gasto', '#fb7185'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Regalos' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Casa', 'gasto', '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Casa' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Viajes', 'gasto', '#eab308'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Viajes' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Imprevistos', 'gasto', '#f97316'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Imprevistos' AND `type` = 'gasto');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Otros gastos', 'gasto', '#94a3b8'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Otros gastos' AND `type` = 'gasto');

-- Categorías de INGRESO.
INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Trabajo / Nómina', 'ingreso', '#10b981'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Trabajo / Nómina' AND `type` = 'ingreso');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Ayuda familiar', 'ingreso', '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Ayuda familiar' AND `type` = 'ingreso');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Regalos recibidos', 'ingreso', '#a855f7'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Regalos recibidos' AND `type` = 'ingreso');

INSERT INTO `expense_category` (`uuid`, `name`, `type`, `color`)
SELECT UUID(), 'Otros ingresos', 'ingreso', '#94a3b8'
WHERE NOT EXISTS (SELECT 1 FROM `expense_category` WHERE `name` = 'Otros ingresos' AND `type` = 'ingreso');
