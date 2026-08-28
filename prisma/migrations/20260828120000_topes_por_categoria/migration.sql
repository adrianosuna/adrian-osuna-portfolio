-- Topes de gasto por categoría: un límite MENSUAL opcional por categoría
-- (null = sin tope) y la marca del último aviso enviado, como 'YYYY-MM:nivel'
-- ('2026-08:100'), para mandar el correo una sola vez por mes y por nivel
-- alcanzado en vez de repetirlo cada semana.

-- AlterTable
ALTER TABLE `expense_category` ADD COLUMN `budget` DECIMAL(12, 2) NULL,
    ADD COLUMN `budget_notified` VARCHAR(16) NULL;
