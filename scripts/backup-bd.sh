#!/usr/bin/env bash
# Backup diario de la BD de producción (DESPLIEGUE.md, «Copias de seguridad»): volcado del MySQL del compose,
# comprimido y comprobado, rotado por día de la semana (7 copias) y subido a Google Drive con rclone.
# Lo lanza el cron del VPS:
#   0 4 * * * bash /var/www/adrian-osuna-portfolio/scripts/backup-bd.sh >> $HOME/backups/backup.log 2>&1
set -euo pipefail

DIR="${BACKUP_PROYECTO:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${BACKUP_ENV:-$DIR/.env.production}"
# La que monta el compose para el Panel de control, que mira la edad de los portfolio-*.sql.gz
COPIAS="${BACKUP_COPIAS:-$HOME/backups}"
# Vacío, no sube (para probarlo sin rclone)
DRIVE="${BACKUP_DRIVE-gdrive:vps-backups/adrianosuna.com}"

mkdir -p "$COPIAS"
destino="$COPIAS/portfolio-$(date +%u).sql.gz"
tmp="$destino.part"
trap 'rm -f "$tmp"' EXIT

# Con el usuario y la contraseña del propio contenedor, que no salen de él. Sin el privilegio PROCESS,
# el usuario de la app necesita --no-tablespaces; --single-transaction vuelca sin bloquear la app
docker compose --project-directory "$DIR" -f "$DIR/docker-compose.yml" --env-file "$ENV_FILE" exec -T db \
  sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF -u"$MYSQL_USER" "$MYSQL_DATABASE"' \
  | gzip -9 > "$tmp"

# Un volcado cortado no pisa la copia buena de hace una semana: mysqldump termina con «-- Dump completed».
# Y como no se toca ningún portfolio-*.sql.gz, el Panel ve envejecer el último y avisa
gzip -t "$tmp"
if ! gzip -dc "$tmp" | tail -n 1 | grep -q '^-- Dump completed'; then
  echo "$(date '+%F %T') volcado incompleto: no se guarda" >&2
  exit 1
fi
mv "$tmp" "$destino"
echo "$(date '+%F %T') $(basename "$destino") $(du -h "$destino" | cut -f1)"

# copy no borra: en Drive quedan las 7 del día de la semana. Solo los dumps: ni el log ni nada más de la carpeta
if [ -n "$DRIVE" ]; then rclone copy "$COPIAS" "$DRIVE" --include 'portfolio-*.sql.gz' --quiet; fi
