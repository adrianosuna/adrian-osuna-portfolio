// La superficie pública: que la landing y sus rutas satélite sirvan lo que
// deben, con la metadata y los ficheros de GEO en su sitio.
import { expect, test } from '@playwright/test'

test('la landing carga y presenta los proyectos como casos de estudio', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Adri/i)
  // El h1 existe y es único: es la primera cosa que rompe un rediseño.
  await expect(page.locator('h1')).toHaveCount(1)
})

test('el login ofrece entrar con Google y nada más', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  // Sin formulario de usuario/contraseña: la allowlist es por correo de Google.
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
})

test('la política de privacidad es accesible sin sesión', async ({ page }) => {
  await page.goto('/privacidad')
  await expect(page.locator('h1')).toBeVisible()
})

test('robots, sitemap, llms.txt y el manifest se sirven', async ({ request }) => {
  for (const ruta of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/manifest.webmanifest']) {
    const res = await request.get(ruta)
    expect(res.status(), `${ruta} debería servirse`).toBe(200)
  }
})

test('el manifest declara la PWA instalable', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBeTruthy()
  expect(manifest.icons.length).toBeGreaterThan(0)
})
