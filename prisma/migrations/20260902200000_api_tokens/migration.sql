-- Tokens de la API v1 (Atajos de iOS y automatizaciones): se guarda solo el
-- SHA-256 del token, nunca el token. Sin FK fisica a `user` por el mismo
-- motivo que `user_session`: la colacion de `user` difiere entre la BD local
-- (0900_ai_ci, herencia del Portfolio antiguo) y produccion (unicode_ci); la
-- integridad la mantiene la aplicacion.
--
-- Y el indice de `opportunity.update_ts`: la tabla y el historico se ordenan
-- por ultima actividad, y EXPLAIN mostraba un escaneo completo con filesort.

-- CreateTable
CREATE TABLE `api_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `user_uuid` VARCHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `prefix` VARCHAR(12) NOT NULL,
    `last_used` TIMESTAMP(0) NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    UNIQUE INDEX `uq_api_token_hash`(`token_hash`),
    INDEX `idx_api_token_user`(`user_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_opportunity_updated` ON `opportunity`(`update_ts`);

