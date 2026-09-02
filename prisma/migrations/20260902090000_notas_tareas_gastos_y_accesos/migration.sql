-- AlterTable
ALTER TABLE `expense` ADD COLUMN `note` TEXT NULL;

-- AlterTable
ALTER TABLE `note` ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `login_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `user_uuid` VARCHAR(36) NOT NULL,
    `user_email` VARCHAR(255) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_login_event_ts`(`create_ts`),
    INDEX `idx_login_event_user`(`user_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `infra_sample` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `sampled_on` DATE NOT NULL,
    `disco_pct` SMALLINT NULL,
    `db_bytes` BIGINT NULL,
    `ssl_dias` SMALLINT NULL,
    `backup_horas` INTEGER NULL,
    `db_latencia_ms` INTEGER NULL,
    `web_ttfb_ms` INTEGER NULL,
    `memoria_pct` SMALLINT NULL,
    `cpu_pct` SMALLINT NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    UNIQUE INDEX `uq_infra_sample_day`(`sampled_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

