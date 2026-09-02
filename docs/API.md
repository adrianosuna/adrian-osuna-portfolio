# API v1 — Atajos de iOS y automatizaciones

Una API mínima para apuntar cosas en el dashboard **sin abrir el navegador**:
el caso que la motivó es «Oye Siri, apunta un gasto» desde el iPhone.

No pretende ser una API pública ni completa. Hace cuatro cosas: apuntar un
movimiento, guardar una nota, leer el resumen del mes y listar las categorías.
Todo lo demás se hace en el dashboard.

## Autenticación

Cabecera `Authorization: Bearer ao_...`. Los tokens se crean en
**Panel de control → Usuarios → API**.

- El valor **se muestra una sola vez**: en la base de datos solo queda su
  SHA-256. Si se pierde, se revoca y se crea otro.
- Un token pertenece a un usuario y solo vale mientras esa cuenta esté
  **activa y sea administradora**: deshabilitarla invalida sus tokens al
  instante, igual que su sesión del navegador.
- Conviene **un token por sitio** que la use (los Atajos del iPhone, un script,
  lo que sea): así revocar uno no rompe los demás. La lista dice cuándo se usó
  cada uno por última vez, que es cómo se reconocen los olvidados.

## Contrato

| | |
|---|---|
| Respuesta | **Siempre JSON**: `{ "ok": true, ... }` o `{ "ok": false, "error": "..." }` |
| `200` | Lectura correcta |
| `201` | Se ha creado algo |
| `400` | Los datos no valen (el `error` lo explica) |
| `401` | Sin token o con un token que no vale |
| `405` | Método equivocado para esa ruta |
| `413` | Cuerpo demasiado grande (el tope es 8 KB) |
| `503` | No se pudo comprobar el token (base de datos caída) — **no** es que el token esté mal |

Todas las respuestas llevan `Cache-Control: no-store`. **No hay CORS**: la API
la consumen Atajos y scripts, no páginas de terceros, así que aunque alguien
robara el token no podría usarlo desde una web ajena.

Las escrituras devuelven además un campo **`mensaje`** ya redactado, para que el
Atajo lo lea en voz alta sin tener que componer nada.

---

## `POST /api/v1/movimientos`

Apunta un gasto o un ingreso en el control de gastos.

```json
{
  "concepto": "Mercadona",
  "importe": "12,50",
  "tipo": "gasto",
  "fecha": "2026-09-02",
  "categoria": "Supermercado",
  "nota": "la compra de la semana"
}
```

Solo **`concepto`** e **`importe`** son obligatorios:

- `importe` acepta **coma decimal** (`"12,50"`), que es lo que manda un Atajo
  de iOS, y también punto o número.
- `tipo` cae a `gasto` si no viene (es lo que se apunta casi siempre).
  El otro valor es `ingreso`.
- `fecha` cae a **hoy en horario de Madrid**. Formato `AAAA-MM-DD`.
- `categoria` admite **el nombre** (sin distinguir tildes ni mayúsculas: `cafe`
  encuentra `Café`) o el uuid. Si no cuadra con ninguna categoría **de ese
  tipo**, se devuelve un `400` en vez de guardarlo sin categoría en silencio.
  Omitirla es legítimo: queda «sin categoría».
- `nota` es texto plano (hasta 1000 caracteres).

Respuesta `201`:

```json
{
  "ok": true,
  "movimiento": {
    "uuid": "…", "concepto": "Mercadona", "importe": 12.5,
    "fecha": "2026-09-02", "tipo": "gasto", "categoria": "Supermercado"
  },
  "mensaje": "Gasto de 12.5 € apuntado: Mercadona"
}
```

Las claves también se aceptan en inglés (`concept`, `amount`, `type`,
`expenseDate`, `categoryUuid`, `note`), por si se llama desde código.

## `POST /api/v1/notas`

Guarda una nota en el Panel de control.

```json
{ "titulo": "Ideas", "texto": "Primera línea\nSegunda línea" }
```

`texto` es texto plano y cada línea se convierte en un párrafo — es el caso del
dictado. Quien quiera mandar HTML puede usar `contenidoHtml`, que pasa por el
**mismo saneador** que el editor visual del dashboard. El `titulo` es opcional.

## `GET /api/v1/resumen`

Las cifras del mes en curso, o de `?mes=2026-08`.

```json
{
  "ok": true, "mes": "2026-09",
  "ingresos": 1800, "gastos": 642.18, "balance": 1157.82,
  "gastoMedioDia": 21.4, "movimientos": 23,
  "frenteAlMesAnterior": -58.4,
  "topesPasados": [{ "categoria": "Ocio", "tope": 100, "gastado": 128.5 }],
  "avisos": ["2 seguimientos vencidos"]
}
```

Devuelve cifras, nunca la lista de movimientos: la idea es que quepa en una
frase. `frenteAlMesAnterior` es la diferencia de gasto con el mes anterior
(`null` si no había con qué comparar), y `avisos` son los mismos de la campana
del dashboard.

## `GET /api/v1/categorias`

La lista completa, para que un Atajo pueda ofrecer un menú en vez de pedir que
se teclee el nombre.

```json
{ "ok": true, "categorias": [{ "uuid": "…", "nombre": "Supermercado", "tipo": "gasto", "tope": 300 }] }
```

---

## Receta: el Atajo «Apuntar un gasto»

En la app **Atajos** del iPhone:

1. **Pedir entrada** → texto → «¿En qué?» → guardar como `Concepto`.
2. **Pedir entrada** → número → «¿Cuánto?» → guardar como `Importe`.
3. *(opcional)* **Obtener contenido de la URL** →
   `https://adrianosuna.com/api/v1/categorias`, cabecera `Authorization`, y
   **Elegir de la lista** para que salga un menú de categorías.
4. **Obtener contenido de la URL**:
   - URL: `https://adrianosuna.com/api/v1/movimientos`
   - Método: **POST**
   - Cabeceras: `Authorization` = `Bearer ao_...`
   - Cuerpo de la petición: **JSON**, con los campos `concepto`, `importe` y
     (si se hizo el paso 3) `categoria`.
5. **Obtener valor del diccionario** → clave `mensaje`.
6. **Decir** ese valor (o **Mostrar notificación**).

Con eso, «Oye Siri, apuntar un gasto» pregunta las dos cosas y confirma en voz
alta. Para el resumen basta un Atajo de un paso: `GET /api/v1/resumen`, coger
`gastos` del diccionario y decirlo.

### Comprobarlo desde el terminal

```bash
curl -s -X POST https://adrianosuna.com/api/v1/movimientos \
  -H "Authorization: Bearer ao_..." \
  -H "Content-Type: application/json" \
  -d '{"concepto":"Prueba","importe":"1,00"}'
```

## Dónde está el código

| Fichero | Qué hace |
|---|---|
| `src/app/api/v1/_comun.ts` | Autenticación, JSON, tope del cuerpo, coma decimal |
| `src/lib/api-token.ts` | Creación, listado y comprobación de los tokens |
| `src/lib/alta-movimiento.ts` | Validación e inserción del movimiento — **compartida** con la server action del dashboard |
| `src/lib/alta-nota.ts` | Lo mismo para las notas (incluido el saneado del HTML) |
| `src/app/api/v1/categorias/resolver.ts` | Traducir el nombre de una categoría a su uuid |

Que la validación sea **compartida** es lo que evita que las dos puertas de
entrada al mismo dato se separen: si mañana cambia el tope del importe, cambia
en los dos sitios porque es el mismo sitio.

## Lo que la API no hace, a propósito

- **No edita ni borra.** Apuntar desde el móvil es el caso; corregir se hace en
  el dashboard, donde se ve el contexto.
- **No tiene rate limit propio.** Es de un solo usuario y los tokens se revocan
  en un clic; delante hay un proxy inverso, que es donde iría si hiciera falta.
- **No expone el ahorro ni el pipeline.** Nada que no se necesite desde un
  Atajo: cada endpoint es superficie que hay que defender.
