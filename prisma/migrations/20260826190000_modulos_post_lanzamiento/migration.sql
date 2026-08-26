-- Módulos del 25-26/08/2026, consolidados en una sola migración (las 8
-- individuales nunca llegaron a producción): registro de sesiones, tareas de
-- mantenimiento con su seed, pipeline de oportunidades v2 (seguimientos +
-- historial) y los cambios de finanzas (sin capital inicial, sin fecha en
-- viajes, recordatorio de mes sin rellenar).

-- AlterTable
ALTER TABLE `saving_year` DROP COLUMN `initial_capital`,
    ADD COLUMN `last_reminded` TIMESTAMP(0) NULL;

-- AlterTable
ALTER TABLE `travel_expense` DROP COLUMN `expense_date`;

-- CreateTable
CREATE TABLE `user_session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `user_uuid` VARCHAR(36) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `last_seen` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_user_session_user`(`user_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `notes` TEXT NULL,
    `interval_months` SMALLINT NOT NULL,
    `next_due` DATE NOT NULL,
    `last_done` DATE NULL,
    `last_notified` TIMESTAMP(0) NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_maintenance_next_due`(`next_due`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opportunity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `company` VARCHAR(255) NULL,
    `contact` VARCHAR(255) NULL,
    `origin` VARCHAR(100) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `status` ENUM('contacto', 'conversacion', 'propuesta', 'cerrado', 'descartado') NOT NULL DEFAULT 'contacto',
    `next_action` VARCHAR(255) NULL,
    `next_action_date` DATE NULL,
    `next_action_notified` TIMESTAMP(0) NULL,
    `closed_at` TIMESTAMP(0) NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_opportunity_next_action`(`next_action_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opportunity_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `opportunity_uuid` VARCHAR(36) NOT NULL,
    `type` ENUM('estado', 'nota', 'llamada', 'email', 'reunion') NOT NULL,
    `detail` VARCHAR(500) NOT NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `fk_opportunity_event_opportunity`(`opportunity_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `opportunity_event` ADD CONSTRAINT `fk_opportunity_event_opportunity` FOREIGN KEY (`opportunity_uuid`) REFERENCES `opportunity`(`uuid`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Tareas de mantenimiento iniciales (las de la operación recurrente de
-- docs/TAREAS.md). Idempotente: cada INSERT se salta si ya existe una tarea
-- con el mismo título, así no duplica en una BD donde ya se hayan creado.
-- Las mensuales parten como "hechas hoy" (se revisaron el 25/08/2026);
-- las fechas se calculan relativas al día en que corre la migración.

INSERT INTO `maintenance_task` (`uuid`, `title`, `notes`, `interval_months`, `next_due`, `last_done`)
SELECT UUID(),
       'Revisar dependencias (pnpm deps + pnpm audit)',
       'Actualizar lo que toque y redesplegar. Retenidas a propósito: eslint 10 (espera a eslint-config-next), TypeScript 7 (espera a typescript-eslint ≥7.1), @types/node (solo al cambiar Node) y next-auth (fijado en beta.32).',
       1, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_task` WHERE `title` = 'Revisar dependencias (pnpm deps + pnpm audit)');

INSERT INTO `maintenance_task` (`uuid`, `title`, `notes`, `interval_months`, `next_due`, `last_done`)
SELECT UUID(),
       'Comprobar backups y contenedores en el VPS',
       'ls -lh ~/backups/ (7 dumps rotando, el último de esta madrugada) y docker compose ps (db healthy, web up). La edad del último dump también se ve en Panel de control → Servidor.',
       1, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_task` WHERE `title` = 'Comprobar backups y contenedores en el VPS');

INSERT INTO `maintenance_task` (`uuid`, `title`, `notes`, `interval_months`, `next_due`, `last_done`)
SELECT UUID(),
       'Vistazo a GA4 y Search Console',
       'Visitas y orígenes en Panel de control → Visitas; en Search Console: indexación, búsquedas y errores de rastreo.',
       1, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_task` WHERE `title` = 'Vistazo a GA4 y Search Console');

INSERT INTO `maintenance_task` (`uuid`, `title`, `notes`, `interval_months`, `next_due`, `last_done`)
SELECT UUID(),
       'Probar la restauración de un backup',
       'Un backup no probado no es un backup: restaurar el último dump en una BD temporal (mysql < dump) y comprobar que las tablas y datos están. Primero a los 2 meses; después, semestral.',
       6, DATE_ADD(CURDATE(), INTERVAL 2 MONTH), NULL
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_task` WHERE `title` = 'Probar la restauración de un backup');

INSERT INTO `maintenance_task` (`uuid`, `title`, `notes`, `interval_months`, `next_due`, `last_done`)
SELECT UUID(),
       'Renovar el dominio adrianosuna.com',
       'OVH avisa por correo, pero comprobar en el panel de OVH que la renovación está pagada o la auto-renovación activa. AJUSTAR la fecha de esta tarea a la caducidad real del dominio (editar → próximo vencimiento).',
       12, DATE_ADD(CURDATE(), INTERVAL 11 MONTH), NULL
WHERE NOT EXISTS (SELECT 1 FROM `maintenance_task` WHERE `title` = 'Renovar el dominio adrianosuna.com');
