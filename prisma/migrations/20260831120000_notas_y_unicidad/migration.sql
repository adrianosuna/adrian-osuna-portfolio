-- Notas del Panel de control + unicidad de nombres a nivel de BD.
--
-- Notas (personal del admin): apuntes con formato. El contenido se guarda como
-- HTML, saneado en el servidor antes de guardarlo (`lib/sanitizar-html.ts`), y
-- se pinta con dangerouslySetInnerHTML — sin superficie de XSS. Tabla nueva.
--
-- Unicidad (de la auditoría del 28/08): hasta ahora la garantizaba solo la
-- aplicación. Estos índices la pasan al motor. El nombre de la categoría es
-- único DENTRO de su tipo ("Regalos" puede ser de gasto y de ingreso); el del
-- ámbito, único a secas. Verificado que no hay duplicados.

-- CreateTable
CREATE TABLE `note` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NULL,
    `content` TEXT NOT NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_note_updated`(`update_ts`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `uq_maintenance_scope_name` ON `maintenance_scope`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `uq_expense_category_name_type` ON `expense_category`(`name`, `type`);
