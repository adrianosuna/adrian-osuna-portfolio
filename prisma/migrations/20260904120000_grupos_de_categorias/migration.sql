-- Grupos de categorias: `expense_category` gana `parent_uuid` (FK a si misma)
-- e `is_group`, para agrupar en DOS niveles: un GRUPO ("Coche") con las
-- categorias que se le asignan ("Taller", "Gasolina") y categorias SUELTAS.
--
-- El grupo es un CONTENEDOR explicito (`is_group`), no una categoria con
-- hijas: se crea vacio, agrupa, y nunca recibe movimientos. Por eso asignarle
-- una categoria con historial es seguro (se mueve la categoria, no sus
-- movimientos), y por eso hace falta la marca: sin ella, un grupo recien
-- creado seria indistinguible de una categoria suelta y se ofreceria al
-- apuntar un movimiento. Los movimientos cuelgan siempre de una categoria,
-- asi que cada gasto cuenta una vez y ninguna suma decide si incluye "lo del
-- padre".
--
-- El indice unico pasa de (name, type) a (name, type, parent_uuid) porque
-- "Varios" tiene que poder existir bajo Coche y bajo Casa.
--
-- ⚠ MySQL trata los NULL como distintos, asi que el indice nuevo NO protege
-- el primer nivel: dos "Coche" ahi pasarian por la BD. Ese caso lo comprueba
-- la aplicacion (mismo criterio que la integridad de `user_session`).
--
-- Nada destructivo: `parent_uuid` nace NULL e `is_group` en false, asi que
-- todo lo que hay queda como categoria suelta hasta que se agrupe a mano.
--
-- (Unifica las dos migraciones del 04/09/2026, `subcategorias_de_gasto` y
-- `grupos_explicitos`, que no llegaron a produccion por separado.)

-- DropIndex
DROP INDEX `uq_expense_category_name_type` ON `expense_category`;

-- AlterTable
ALTER TABLE `expense_category` ADD COLUMN `parent_uuid` VARCHAR(36) NULL,
    ADD COLUMN `is_group` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `fk_expense_category_parent` ON `expense_category`(`parent_uuid`);

-- CreateIndex
CREATE UNIQUE INDEX `uq_expense_category_name_type_parent` ON `expense_category`(`name`, `type`, `parent_uuid`);

-- AddForeignKey
ALTER TABLE `expense_category` ADD CONSTRAINT `fk_expense_category_parent` FOREIGN KEY (`parent_uuid`) REFERENCES `expense_category`(`uuid`) ON DELETE RESTRICT ON UPDATE NO ACTION;
