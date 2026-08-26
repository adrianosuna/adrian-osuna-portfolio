// Formateadores del Panel de control (ui.tsx) y resumen de user-agent:
// funciones puras con casos límite claros (unidades, singulares, cero).
import { describe, expect, it } from 'vitest'
import { fmtBytes, fmtDuracion, fmtEdad } from '@/components/dashboard/panel/ui'
import { dispositivoDe } from '@/lib/dispositivo'

describe('fmtBytes', () => {
  it('elige la unidad adecuada', () => {
    expect(fmtBytes(500)).toBe('1 KB') // mínimo 1 KB (nunca "0 KB" para algo que existe)
    expect(fmtBytes(140_000)).toBe('137 KB')
    expect(fmtBytes(1_048_576)).toBe('1 MB')
    expect(fmtBytes(1_073_741_824)).toBe('1 GB')
  })

  it('decimales con coma española', () => {
    expect(fmtBytes(1_610_612_736)).toBe('1,5 GB')
  })
})

describe('fmtDuracion', () => {
  it('minutos, horas con minutos, y días a partir de 48 h', () => {
    expect(fmtDuracion(59)).toBe('0 min')
    expect(fmtDuracion(60 * 25)).toBe('25 min')
    expect(fmtDuracion(3_600 * 5 + 60 * 12)).toBe('5 h 12 min')
    expect(fmtDuracion(86_400 * 3 + 3_600 * 4)).toBe('3 d 4 h')
  })

  it('47 h sigue en horas; 48 h ya son días', () => {
    expect(fmtDuracion(3_600 * 47)).toBe('47 h 0 min')
    expect(fmtDuracion(3_600 * 48)).toBe('2 d 0 h')
  })
})

describe('fmtEdad', () => {
  const ahora = '2026-08-25T12:00:00Z'
  it('minutos, horas y días relativos a la instantánea', () => {
    expect(fmtEdad('2026-08-25T11:35:00Z', ahora)).toBe('hace 25 min')
    expect(fmtEdad('2026-08-25T07:00:00Z', ahora)).toBe('hace 5 h')
    expect(fmtEdad('2026-08-22T12:00:00Z', ahora)).toBe('hace 3 días')
  })

  it('nunca es negativa aunque los relojes bailen', () => {
    expect(fmtEdad('2026-08-25T12:05:00Z', ahora)).toBe('hace 0 min')
  })
})

describe('dispositivoDe', () => {
  it('reconoce los navegadores y sistemas habituales', () => {
    expect(dispositivoDe('Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/128.0 Safari/537.36')).toBe('Chrome · Windows')
    // Edge y Opera incluyen "Chrome" en su UA: deben ganar sus marcas propias.
    expect(dispositivoDe('Mozilla/5.0 (Windows NT 10.0) Chrome/128.0 Safari/537.36 Edg/128.0')).toBe('Edge · Windows')
    expect(dispositivoDe('Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0 OPR/114.0')).toBe('Opera · Linux')
    expect(dispositivoDe('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1')).toBe('Safari · iOS')
    expect(dispositivoDe('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/128.0')).toBe('Chrome · Android')
    expect(dispositivoDe('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Firefox/130.0')).toBe('Firefox · macOS')
  })

  it('sin user-agent, dispositivo desconocido', () => {
    expect(dispositivoDe(null)).toBe('Dispositivo desconocido')
    expect(dispositivoDe('curl/8.0')).toBe('Navegador · SO desconocido')
  })
})
