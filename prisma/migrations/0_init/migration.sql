-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `picture` VARCHAR(512) NULL,
    `google_sub` VARCHAR(255) NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `status` ENUM('invited', 'active', 'disabled') NOT NULL DEFAULT 'invited',
    `last_login` TIMESTAMP(0) NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    UNIQUE INDEX `email`(`email`),
    UNIQUE INDEX `google_sub`(`google_sub`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saving_year` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `year` SMALLINT NOT NULL,
    `initial_capital` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `goal` DECIMAL(12, 2) NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    UNIQUE INDEX `year`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saving_month` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `year_uuid` VARCHAR(36) NOT NULL,
    `month` TINYINT NOT NULL,
    `income` DECIMAL(12, 2) NULL,
    `saving_general` DECIMAL(12, 2) NULL,
    `saving_travel` DECIMAL(12, 2) NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    UNIQUE INDEX `uq_saving_month`(`year_uuid`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saving_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `year_uuid` VARCHAR(36) NOT NULL,
    `concept` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `fk_saving_extra_year`(`year_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `travel_expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `year_uuid` VARCHAR(36) NOT NULL,
    `concept` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `expense_date` DATE NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `fk_travel_expense_year`(`year_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `saving_month` ADD CONSTRAINT `fk_saving_month_year` FOREIGN KEY (`year_uuid`) REFERENCES `saving_year`(`uuid`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `saving_extra` ADD CONSTRAINT `fk_saving_extra_year` FOREIGN KEY (`year_uuid`) REFERENCES `saving_year`(`uuid`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `travel_expense` ADD CONSTRAINT `fk_travel_expense_year` FOREIGN KEY (`year_uuid`) REFERENCES `saving_year`(`uuid`) ON DELETE CASCADE ON UPDATE NO ACTION;
