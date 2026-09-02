// Tokens de la API (solo servidor): generación, verificación y listado.
//
// Para qué: apuntar un gasto o una nota desde un Atajo del iPhone, un widget o
// una automatización, sin sesión de Google. El Atajo manda
// `Authorization: Bearer <token>` y se acabó.
//
// Cómo se guarda: **solo el SHA-256 del token**, nunca el token. Quien lea la
// tabla no puede usarlo, y por eso el valor completo se muestra UNA vez al
// crearlo (si se pierde, se revoca y se crea otro). SHA-256 a secas y no bcrypt
// a propósito: un token es 256 bits aleatorios, no una contraseña que alguien
// pueda adivinar por fuerza bruta, y el hash tiene que ser rápido porque se
// comprueba en cada petición.
import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/log'

/** Prefijo del token, para reconocerlo de un vistazo (y en un `git grep`). */
const PREFIJO = 'ao_'
/** Bytes de aleatoriedad. 32 = 256 bits: no se adivina. */
const BYTES = 32

const hashear = (token: string) => createHash('sha256').update(token).digest('hex')

export interface TokenNuevo {
  /** El token completo. Se muestra UNA vez y no se puede recuperar. */
  token: string
  uuid: string
  name: string
  prefix: string
}

/** Crea un token para un usuario y devuelve el valor en claro (solo esta vez). */
export async function crearToken(userUuid: string, name: string): Promise<TokenNuevo> {
  const token = PREFIJO + randomBytes(BYTES).toString('base64url')
  const fila = await prisma.apiToken.create({
    data: {
      userUuid,
      name: name.trim().slice(0, 80),
      tokenHash: hashear(token),
      // Suficiente para distinguirlos en la lista, insuficiente para usarlo.
      prefix: token.slice(0, 10),
    },
  })
  return { token, uuid: fila.uuid, name: fila.name, prefix: fila.prefix }
}

export interface TokenRow {
  uuid: string
  name: string
  prefix: string
  lastUsed: string | null // ISO
  createTs: string // ISO
}

/** Tokens del usuario, del más reciente al más antiguo. */
export async function listarTokens(userUuid: string): Promise<TokenRow[]> {
  const filas = await prisma.apiToken.findMany({
    where: { userUuid },
    orderBy: { id: 'desc' },
  })
  return filas.map((t) => ({
    uuid: t.uuid,
    name: t.name,
    prefix: t.prefix,
    lastUsed: t.lastUsed ? t.lastUsed.toISOString() : null,
    createTs: t.createTs.toISOString(),
  }))
}

/** Revoca un token (borrarlo ES revocarlo: no hay estado intermedio). */
export async function revocarToken(uuid: string, userUuid: string): Promise<boolean> {
  const { count } = await prisma.apiToken.deleteMany({ where: { uuid, userUuid } })
  return count > 0
}

export interface Identidad {
  userUuid: string
  tokenUuid: string
}

/**
 * Resultado de comprobar un token. Tres estados y no dos, porque "el token
 * no vale" y "no he podido comprobarlo" NO son lo mismo: con la base de datos
 * caída, responder 401 le diría al Atajo que su token está mal —y lo primero
 * que haría su dueño es revocarlo y crear otro, que tampoco funcionaría—.
 * `indisponible` acaba en un 503, que es la verdad.
 *
 * Lo encontró un test e2e: contra una BD inalcanzable, esto devolvía un 500.
 */
export type Identificacion =
  | { estado: 'ok'; identidad: Identidad }
  | { estado: 'invalido' }
  | { estado: 'indisponible' }

/**
 * Comprueba la cabecera `Authorization` de una petición.
 *
 * Además de existir, el token tiene que pertenecer a un usuario **ACTIVE y
 * ADMIN**: si la cuenta se deshabilita, sus tokens dejan de valer al instante
 * (igual que la sesión del navegador, que el callback `jwt` reverifica en cada
 * petición).
 *
 * `lastUsed` se actualiza sin esperar (`void`): es telemetría para reconocer
 * tokens olvidados, no debe añadir latencia a la petición.
 */
export async function identificar(authorization: string | null): Promise<Identificacion> {
  const invalido = { estado: 'invalido' } as const

  // Lo que se puede descartar sin tocar la BD, se descarta antes.
  if (!authorization) return invalido
  const m = authorization.match(/^Bearer\s+(\S+)$/i)
  if (!m) return invalido
  const token = m[1]
  if (!token.startsWith(PREFIJO) || token.length > 200) return invalido

  const hash = hashear(token)

  try {
    const fila = await prisma.apiToken.findUnique({ where: { tokenHash: hash } })
    if (!fila) return invalido

    // Comparación en tiempo constante: la búsqueda por índice ya ha decidido,
    // pero comparar así no cuesta nada y no filtra por tiempo.
    const a = Buffer.from(fila.tokenHash, 'hex')
    const b = Buffer.from(hash, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return invalido

    const usuario = await prisma.user.findUnique({
      where: { uuid: fila.userUuid },
      select: { status: true, role: true },
    })
    if (!usuario || usuario.status !== 'ACTIVE' || usuario.role !== 'ADMIN') return invalido

    void prisma.apiToken
      .update({ where: { uuid: fila.uuid }, data: { lastUsed: new Date() } })
      .catch(() => {})

    return { estado: 'ok', identidad: { userUuid: fila.userUuid, tokenUuid: fila.uuid } }
  } catch (e) {
    log.error('api', 'no se pudo comprobar el token', { error: e })
    return { estado: 'indisponible' }
  }
}
