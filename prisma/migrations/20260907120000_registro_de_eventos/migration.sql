-- Registro de eventos: la tabla donde `lib/log.ts` deja lo que importa para
-- poder verlo desde el Panel de control.
--
-- Por que hace falta: hoy los logs solo van a la consola, y en produccion eso
-- significa `docker compose logs web` por SSH. Se miran cuando ya se sospecha
-- algo, no cuando pasa — asi que un error de un martes no se ve nunca.
--
-- Solo `warn` y `error` a proposito: `info` incluye una linea por cada pasada
-- del cron y por cada login, y guardar eso convierte la tabla en un vertedero
-- donde el error de verdad no se encuentra. La consola sigue con los cuatro
-- niveles, que es donde se programa.
--
-- El campo `data` guarda como JSON los campos que acompanaban al evento, y ahi
-- SI va la traza del error (a diferencia de la consola de produccion): es una
-- tabla privada del admin y la traza es justo lo que hace falta para depurar.
--
-- Los dos indices son por como se consulta: por fecha descendente (lo ultimo
-- primero, que es la vista por defecto) y por nivel + fecha (el filtro de
-- "solo errores").
--
-- Nada destructivo: tabla nueva, no toca ninguna existente.

-- CreateTable
CREATE TABLE `log_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `level` VARCHAR(10) NOT NULL,
    `scope` VARCHAR(60) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `data` TEXT NULL,
    `create_ts` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uuid`(`uuid`),
    INDEX `idx_log_event_created`(`create_ts`),
    INDEX `idx_log_event_level`(`level`, `create_ts`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
