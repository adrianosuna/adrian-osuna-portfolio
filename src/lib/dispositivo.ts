// User-agent resumido a "Navegador · Sistema" (lista de sesiones activas).
export function dispositivoDe(ua: string | null): string {
  if (!ua) return 'Dispositivo desconocido'
  const navegador = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Navegador'
  const so = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'SO desconocido'
  return `${navegador} · ${so}`
}
