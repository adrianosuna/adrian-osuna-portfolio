# Despliegue en OVH (VPS + Docker)

Guía completa para publicar `adrianosuna.com` en un VPS de OVH. Pensada para
seguirla de arriba abajo la primera vez; al final hay una sección de
actualizaciones y copias de seguridad.

> ✅ **Procedimiento validado**: el 25/08/2026 se ensayó completo en local
> (build de la imagen, `migrate` con tablas + admin, stack arrancado y web
> verificada con headers y robots). En el VPS es repetir estos mismos pasos.

## Requisito previo (antes de tocar el VPS)

- [ ] **Rotar el client secret de Google** (se compartió por chat durante el
      desarrollo): Google Cloud Console → Credenciales → cliente OAuth →
      "Agregar secreto", borrar el antiguo, y añadir la redirect URI
      `https://adrianosuna.com/api/auth/callback/google`.

## 0 · Qué contratar

- **VPS de OVH** con **Ubuntu 24.04 LTS**. Con 2 GB de RAM va sobrado
  (si el `docker compose build` se quedara sin memoria, ver "Swap" abajo).
- El dominio `adrianosuna.com` (si está en OVH, la zona DNS se edita en el
  mismo panel).

## 1 · DNS

En la zona DNS del dominio:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | `@` | IP pública del VPS |
| A | `www` | IP pública del VPS |

Propaga en minutos-horas. Puede hacerse antes que todo lo demás.

## 2 · Primer acceso y seguridad básica

Entrar por SSH con lo que OVH facilite (root o usuario `ubuntu`):

```bash
ssh ubuntu@IP-DEL-VPS
```

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Firewall: solo SSH, HTTP y HTTPS (el 9443 NO se abre: es interno)
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Recomendado: claves SSH en vez de contraseña y deshabilitar el login root
# (OVH suele configurarlo ya si añadiste tu clave al crear el VPS).
```

> ⚠ El `docker-compose.yml` ata el puerto de la app a `127.0.0.1` a propósito:
> Docker ignora ufw, y así nadie puede saltarse el proxy accediendo a `IP:9443`.

## 3 · Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Cerrar sesión SSH y volver a entrar (para que aplique el grupo). Verificar:

```bash
docker --version && docker compose version
```

## 4 · Subir el código

Opción recomendada — repositorio privado en GitHub:

```bash
# En tu PC: crear el repo privado en GitHub y subir el proyecto.
# En el VPS (con un token de acceso o clave de deploy):
git clone https://github.com/TU-USUARIO/adrian-osuna-portfolio.git
cd adrian-osuna-portfolio
```

Alternativa sin GitHub: copiar el proyecto desde tu PC con `scp`/`rsync`
(excluyendo `node_modules`, `.next` y `.env*`).

## 5 · Configuración

```bash
cp .env.production.example .env.production
nano .env.production
```

⚠ Crear el archivo EN EL SERVIDOR desde el example — no copiar el
`.env.production` del PC de desarrollo (ese es el del ensayo local, con
contraseñas de prueba y URLs de localhost).

Rellenar TODO:

- `MYSQL_PASSWORD` y `MYSQL_ROOT_PASSWORD`: contraseñas largas nuevas.
- `DATABASE_URL`: misma contraseña que `MYSQL_PASSWORD`, host `db`.
- `ADMIN_EMAIL`: tu Gmail (el seed lo crea como admin).
- `AUTH_SECRET`: generar uno nuevo (`npx auth secret` en tu PC y pegarlo).
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: el cliente OAuth **con el secret ya
  rotado** (ver requisito previo).
- `AUTH_URL` y `NEXT_PUBLIC_SITE_URL`: `https://adrianosuna.com`.
- `NEXT_PUBLIC_GA_ID`: el example ya trae el ID real (G-04BLBZ1KMM). Se hornea
  en el build: si se cambia, hay que reconstruir la imagen.

## 6 · Construir y arrancar

```bash
docker compose --env-file .env.production --profile setup build
docker compose --env-file .env.production --profile setup run --rm migrate   # 1.ª vez y con migraciones nuevas
docker compose --env-file .env.production up -d
```

⚠ El build lleva `--profile setup` a propósito: sin él, compose **no
reconstruye el servicio `migrate`** (los servicios de perfiles inactivos se
saltan) y el `run migrate` usaría una imagen vieja sin las migraciones nuevas
("No pending migrations" con la BD desactualizada — pasó el 26/08/2026).

El paso `migrate` crea las tablas (BD vacía) y asegura `ADMIN_EMAIL` como
admin activo. Comprobar que responde:

```bash
curl -I http://localhost:9443
```

Ver logs si algo falla: `docker compose logs -f web`

## 7 · Proxy inverso: Caddy

Caddy consigue y renueva los certificados HTTPS **solo** (Let's Encrypt) y
redirige http→https automáticamente: cero mantenimiento de certificados.
Único requisito: el DNS del paso 1 ya debe apuntar al VPS.

Instalar (repositorio oficial):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Sustituir el contenido de `/etc/caddy/Caddyfile` por:

```caddyfile
adrianosuna.com {
	# Tope defensivo genérico para cuerpos de petición.
	request_body {
		max_size 5MB
	}
	encode gzip
	reverse_proxy 127.0.0.1:9443
}

www.adrianosuna.com {
	redir https://adrianosuna.com{uri} permanent
}
```

Aplicar:

```bash
sudo systemctl reload caddy
```

Y ya está: `reverse_proxy` reenvía solo las cabeceras `Host` y `X-Forwarded-*`
que NextAuth necesita, y el 301 de http→https lo pone Caddy sin configurarlo.

> Nota — rate limit de `/api/*`: el Caddy estándar no trae módulo de rate
> limiting (requiere un build custom con `caddy-ratelimit`). Es un refuerzo
> opcional, no un bloqueante: los únicos endpoints públicos son los de auth,
> que los protege Google. Queda anotado como mejora en TAREAS.md.

## 8 · Verificación final (checklist de docs/TAREAS.md §1.4)

- `https://adrianosuna.com` carga; `http://` y `www.` redirigen con 301.
- Los headers de seguridad llegan (DevTools → Network: HSTS, X-Frame-Options, CSP…).
- Login con Google funciona y la cookie sale con `Secure`.
- Una cuenta USER de prueba no ve Finanzas (ni la URL directa `/app/finance`).
- `/robots.txt` y `/sitemap.xml` muestran el dominio real.
- La URL pegada en opengraph.xyz muestra la tarjeta con imagen.
- El banner de cookies aparece; al aceptar, la visita sale en GA4 → Tiempo real
  (y al rechazar, ninguna petición a Google). `/privacidad` accesible desde el
  footer y su botón de "cambiar elección" funciona.
- Probar la landing desde el móvil con datos (no wifi local).
- Opcional: alta en Google Search Console y envío del sitemap; filtro de
  tráfico interno en GA4 con tu IP para no contar tus propias visitas.

## Actualizaciones (redeploy)

```bash
cd adrian-osuna-portfolio
git pull
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

Si hay **migraciones nuevas de BD**, el build debe llevar el perfil (para
reconstruir también la imagen de `migrate`) y ejecutarse el paso `migrate`
antes del `up`:

```bash
docker compose --env-file .env.production --profile setup build
docker compose --env-file .env.production --profile setup run --rm migrate
docker compose --env-file .env.production up -d
```

(Los datos sobreviven: viven en el volumen `db-data`.)

## Copias de seguridad

Dump diario de la BD con cron (guarda los últimos 7 días):

```bash
crontab -e
# 0 4 * * * docker compose -f /var/www/adrian-osuna-portfolio/docker-compose.yml --env-file /var/www/adrian-osuna-portfolio/.env.production exec -T db sh -c 'mysqldump --no-tablespaces -uportfolio -p"$MYSQL_PASSWORD" portfolio' | gzip > /home/ubuntu/backups/portfolio-$(date +\%u).sql.gz && /usr/bin/rclone copy /home/ubuntu/backups gdrive:vps-backups/adrianosuna.com --quiet
# (--no-tablespaces: el usuario de la app no tiene el privilegio PROCESS y no
# lo necesita; sin el flag, el dump falla en MySQL 8)
```

(Crear antes la carpeta: `mkdir -p ~/backups`.)

**Copia fuera del VPS (configurado el 26/08/2026)**: tras el dump, el mismo
cron sube `~/backups` a Google Drive con `rclone copy` — carpeta
`vps-backups/adrianosuna.com` (un subdirectorio por dominio, pensado para
futuros proyectos en el mismo VPS). Como `copy` no borra y los nombres rotan
por día de semana, Drive mantiene el espejo de los últimos 7 días sin crecer.
Montaje de rclone (si hubiera que rehacerlo): instalador oficial de rclone.org,
remote `gdrive` tipo `drive` con scope `drive.file` (solo ve sus propios
ficheros) y **client_id OAuth propio** (app de escritorio "rclone-backups" en
el proyecto de Google Cloud del portfolio, con la Drive API habilitada y la
pantalla de consentimiento PUBLICADA — en modo "Prueba" los tokens caducan a
los 7 días); la autorización se hace con `rclone config reconnect gdrive:` en
el VPS + `rclone authorize` en una máquina con navegador. El token vive en
`~/.config/rclone/rclone.conf` del VPS.

El Panel de control del dashboard (`/app/panel`) vigila esta carpeta:
el compose la monta de solo lectura en el contenedor (`/backups`) para medir la
edad del último dump y el uso de disco del VPS. Si los backups estuvieran en
otra ruta, definir `BACKUPS_HOST_DIR` en `.env.production`.

## Avisos de mantenimiento por correo

La pestaña **Mantenimiento** de `/app/panel` gestiona tareas recurrentes del
servidor; un cron interno de la app (node-cron, arrancado en
`src/instrumentation.ts`) avisa por correo de las vencidas a diario a las 8:00
(hora española), con reaviso semanal. Requiere las variables `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `ALERT_EMAIL` en `.env.production`
(con Gmail: contraseña de aplicación en myaccount.google.com/apppasswords).
Son variables de runtime: basta recrear el contenedor, sin rebuild. **El cron
solo se programa en producción** (`NODE_ENV=production`): en desarrollo no se
arranca aunque haya SMTP en el `.env`, para no mandar correos reales al
levantar el dev server; `CRON_EN_DEV=1` lo fuerza si hace falta probarlo. La tabla
`maintenance_task` llega con la migración `add_maintenance_task` (servicio
`migrate`). El botón "Probar correo" de la pestaña verifica el SMTP.

El mismo cron y el mismo SMTP avisan también de los **seguimientos vencidos
del pipeline** (`/app/pipeline`: oportunidades vivas cuya próxima acción tiene
fecha ya pasada) y de los **meses de ahorro sin rellenar** (`/app/finance`:
al cerrarse un mes sin datos llega un recordatorio), ambos con idéntico
reaviso semanal. No requieren configuración extra; sus campos llegan con las
migraciones `pipeline_seguimiento_e_historial` y `add_saving_reminder`.

## Visitas en el Panel de control (GA Data API)

La pestaña **Visitas** de `/app/panel` lee Google Analytics con la Data API y
una **service account**. Configuración (una sola vez):

1. En [Google Cloud Console](https://console.cloud.google.com/), con el mismo
   proyecto del OAuth de login (o uno nuevo): **APIs y servicios → Biblioteca →
   "Google Analytics Data API" → Habilitar**.
2. **IAM y administración → Cuentas de servicio → Crear**: nombre libre (p. ej.
   `portfolio-visitas`), sin roles de proyecto. Dentro de la cuenta creada:
   **Claves → Agregar clave → JSON** (se descarga un fichero, guardarlo bien:
   no se puede volver a descargar).
3. En [Google Analytics](https://analytics.google.com/): **Administrar →
   Gestión de accesos a la propiedad → +** y añadir el correo de la service
   account (`...@...iam.gserviceaccount.com`) con rol **Lector**.
4. El id de propiedad: **Administrar → Configuración de la propiedad →
   ID de la propiedad** (numérico, no el G-XXXX).
5. En `.env.production`, del JSON descargado: `GA_PROPERTY_ID` (paso 4),
   `GA_SA_CLIENT_EMAIL` = `client_email` y `GA_SA_PRIVATE_KEY` = `private_key`
   **tal cual** (una sola línea con `\n` escapados, entre comillas dobles).
   Después, recrear el contenedor (`docker compose --env-file .env.production
   up -d`; no requiere rebuild: son variables de runtime).

Sin estas variables la pestaña muestra "sin configurar" y no llama a nada.

## Swap (solo si el build se queda sin memoria)

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
