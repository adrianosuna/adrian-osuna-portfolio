-- Recordatorios puntuales: `interval_months` pasa a admitir NULL.
--
-- Una tarea de mantenimiento con periodicidad NULL es un recordatorio que NO
-- se repite ("renovar el dominio el 12/03/2027"): al marcarlo como hecho se
-- queda hecho, en vez de encadenar el siguiente vencimiento.
--
-- Se reutiliza el modulo de mantenimiento en vez de crear una tabla nueva por
-- el mismo motivo por el que la ITV y las dependencias comparten modulo: es
-- el mismo problema (algo con fecha de lo que hay que acordarse), y una tabla
-- aparte obligaria a duplicar el calendario, los avisos del cron y la UI.

-- AlterTable
ALTER TABLE `maintenance_task` MODIFY `interval_months` SMALLINT NULL;

