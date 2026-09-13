'use client'

// Pestaña "Servidor": salud del despliegue, recursos de la máquina en vivo (refresco
// cada 40 s, en pausa con la pestaña oculta) y la evolución de lo que va en serie.
import { useEffect, useState } from 'react'
import {
  Activity, Box, Cpu, Database, DatabaseBackup, Globe, HardDrive, Layers, MemoryStick,
  Rocket, Server, ShieldCheck, Table2, TrendingUp,
} from 'lucide-react'
import type { InfraSnapshot, ServidorSnapshot } from '@/lib/infra'
import { serieDe, tendencia, type MuestraInfra } from '@/lib/infra-series'
import { leerRecursos } from '@/app/app/panel/actions'
import { GraficaLinea } from '@/components/ui/charts/linea'
import { coloresTema } from '@/components/ui/charts/comun'
import { cn } from '@/lib/utils'
import {
  CheckCard, Refrescar, fmtBytes, fmtDuracion, fmtEdad, fmtFecha,
} from './ui'

const fmtCarga = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Bloque({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:mt-0">
      {children}
    </h2>
  )
}

export function ServidorTab({
  infra, maquina, historico,
}: {
  infra: InfraSnapshot
  maquina: ServidorSnapshot
  /** Muestras diarias del monitor (las apunta el cron). */
  historico: MuestraInfra[]
}) {
  const { ssl, db, almacenBD, web, backup, version, uptime } = infra

  // Recursos en vivo: parten del snapshot del servidor y se auto-refrescan.
  const [recursos, setRecursos] = useState(maquina)
  // Resincroniza con cada carga/refresco manual (patrón valor-previo en render).
  const [prevGen, setPrevGen] = useState(maquina.generadoEn)
  if (prevGen !== maquina.generadoEn) {
    setPrevGen(maquina.generadoEn)
    setRecursos(maquina)
  }
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const m = await leerRecursos()
      if (m) setRecursos(m)
    }, 40_000)
    return () => clearInterval(id)
  }, [])

  const { cpu, memoria, swap, disco, proceso, sistema } = recursos

  return (
    <div>
      <Refrescar generadoEn={infra.generadoEn} />

      <Bloque>Salud del despliegue</Bloque>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-6">
        <CheckCard
          icon={<ShieldCheck className="size-4" />}
          title="Certificado SSL"
          estado={ssl.estado}
          value={ssl.diasRestantes === null ? '—' : `${ssl.diasRestantes} días restantes`}
          lines={[
            ssl.caducaEl ? `${ssl.dominio} · caduca el ${fmtFecha(ssl.caducaEl)}` : ssl.dominio,
            ssl.detalle,
          ]}
        />
        <CheckCard
          icon={<Globe className="size-4" />}
          title="Latencia pública"
          estado={web.estado}
          value={web.ttfbMs === null ? '—' : `${web.ttfbMs} ms`}
          lines={[web.url.replace(/^https:\/\/|\/$/g, ''), web.detalle]}
        />
        <CheckCard
          icon={<Database className="size-4" />}
          title="Base de datos"
          estado={db.estado}
          value={db.latenciaMs === null ? '—' : `${db.latenciaMs} ms`}
          lines={[
            db.version
              ? `MySQL ${db.version}${db.motorUptimeSeg ? ` · motor en marcha ${fmtDuracion(db.motorUptimeSeg)}` : ''}`
              : 'Ping SELECT 1 desde la aplicación',
            db.conexiones
              ? `Conexiones: ${db.conexiones.actual} de ${db.conexiones.max} · ${db.detalle}`
              : db.detalle,
          ]}
        />
        <CheckCard
          icon={<Table2 className="size-4" />}
          title="Tamaño de la BD"
          value={almacenBD ? fmtBytes(almacenBD.totalBytes) : '—'}
          lines={
            almacenBD
              ? [
                  `${almacenBD.tablas} tablas (datos + índices)`,
                  `Mayores: ${almacenBD.top.map((t) => `${t.tabla} (${fmtBytes(t.bytes)})`).join(' · ')}`,
                ]
              : ['No se pudo leer information_schema']
          }
        />
        <CheckCard
          icon={<DatabaseBackup className="size-4" />}
          title="Último backup"
          estado={backup.estado ?? undefined}
          value={backup.ultimoTs ? fmtEdad(backup.ultimoTs, infra.generadoEn) : '—'}
          lines={[
            backup.ultimoTs
              ? `${backup.ficheros} copias en rotación · ${fmtBytes(backup.tamanoBytes ?? 0)} el último`
              : 'Dumps diarios de MySQL en el VPS',
            backup.detalle,
          ]}
        />
        <CheckCard
          icon={<Rocket className="size-4" />}
          title="Versión desplegada"
          value={`v${version.app}`}
          lines={[
            version.build ? `Build del ${fmtFecha(version.build, true)}` : 'Build sin fecha',
            `En marcha desde hace ${fmtDuracion(uptime.appSeg)} · ${version.entorno}`,
          ]}
        />
      </div>

      <Bloque>Recursos de la máquina · en vivo (se actualizan solos)</Bloque>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-6">
        <CheckCard
          icon={<Cpu className="size-4" />}
          title="CPU"
          estado={cpu.estado}
          value={`${cpu.usoPct} % de uso`}
          barPct={cpu.usoPct}
          lines={[
            `${cpu.nucleos} ${cpu.nucleos === 1 ? 'núcleo lógico' : 'núcleos lógicos'} · ${cpu.modelo}`,
            cpu.carga
              ? `Carga media: ${fmtCarga(cpu.carga[0])} · ${fmtCarga(cpu.carga[1])} · ${fmtCarga(cpu.carga[2])} (1/5/15 min)`
              : 'Carga media no disponible en Windows',
          ]}
        />
        <CheckCard
          icon={<MemoryStick className="size-4" />}
          title="Memoria"
          estado={memoria.estado}
          value={`${memoria.usadaPct} % usada`}
          barPct={memoria.usadaPct}
          lines={[
            `${fmtBytes(memoria.usadaBytes)} de ${fmtBytes(memoria.totalBytes)}`,
            `Disponibles: ${fmtBytes(memoria.disponiblesBytes)}`,
          ]}
        />
        {swap ? (
          <CheckCard
            icon={<Layers className="size-4" />}
            title="Swap"
            estado={swap.estado}
            value={`${swap.usadaPct} % usada`}
            barPct={swap.usadaPct}
            lines={[
              `${fmtBytes(swap.usadaBytes)} de ${fmtBytes(swap.totalBytes)}`,
              'Si se llena, el VPS va corto de memoria',
            ]}
          />
        ) : (
          <CheckCard
            icon={<Layers className="size-4" />}
            title="Swap"
            value="—"
            lines={['Sin swap configurada', 'O plataforma sin /proc (desarrollo)']}
          />
        )}
        <CheckCard
          icon={<HardDrive className="size-4" />}
          title="Disco"
          estado={disco.estado}
          value={disco.usadoPct === null ? '—' : `${disco.usadoPct} % usado`}
          barPct={disco.usadoPct ?? undefined}
          lines={[
            disco.libresBytes !== null && disco.totalBytes !== null
              ? `${fmtBytes(disco.libresBytes)} libres de ${fmtBytes(disco.totalBytes)}`
              : 'Capacidad no disponible',
            disco.detalle,
          ]}
        />
        <CheckCard
          icon={<Box className="size-4" />}
          title="Proceso Node"
          value={fmtBytes(proceso.rssBytes)}
          lines={[
            'Memoria residente de la aplicación (RSS)',
            `Heap: ${fmtBytes(proceso.heapUsadoBytes)} de ${fmtBytes(proceso.heapTotalBytes)} · Node ${proceso.node} · PID ${proceso.pid}`,
          ]}
        />
        <CheckCard
          icon={<Server className="size-4" />}
          title="Sistema"
          value={`${sistema.so} ${sistema.arch}`}
          lines={[
            `Kernel ${sistema.kernel}`,
            `Host ${sistema.host} · en marcha ${fmtDuracion(sistema.uptimeSeg)}`,
          ]}
        />
      </div>

      <Bloque>Evolución</Bloque>
      <Historico muestras={historico} />
    </div>
  )
}

// ─────────── histórico (una muestra al día, del cron) ───────────

/** Evolución de disco, tamaño de la BD y días del certificado: "¿va a seguir bien?".
 *  CPU y memoria no van aquí: la muestra es de un instante y su serie no dice nada. */
function Historico({ muestras }: { muestras: MuestraInfra[] }) {
  const c = coloresTema()
  // Con una sola muestra no hay línea que dibujar.
  if (muestras.length < 2) {
    return (
      <div className="superficie rounded-2xl p-6 text-center text-[13px] text-muted-foreground">
        {muestras.length === 0
          ? 'Todavía no hay muestras. El cron diario (8:00) apunta una cada día; en cuanto haya dos, aquí saldrá la evolución.'
          : 'Solo hay una muestra. Mañana, con la segunda, empezará la gráfica.'}
      </div>
    )
  }

  const labels = muestras.map((m) => m.fecha.slice(8, 10) + '/' + m.fecha.slice(5, 7))
  const tDisco = tendencia(muestras, 'discoPct')
  const tDb = tendencia(muestras, 'dbBytes')
  const tDbMs = tendencia(muestras, 'dbLatenciaMs')

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <TarjetaSerie
        icon={<HardDrive className="size-4" />}
        title="Ocupación del disco"
        // Un disco que sube es malo; que baje, bueno.
        pie={tDisco && frase(tDisco.delta, tDisco.dias, (v) => `${v} puntos`, true)}
        valor={tDisco ? `${tDisco.hasta} %` : '—'}>
        <GraficaLinea
          labels={labels}
          series={[{ label: 'Disco usado', data: serieDe(muestras, 'discoPct'), color: c.primary, _unidad: 'entero' }]}
          alto={160}
          scales={{ y: { min: 0, max: 100, ticks: { callback: (v) => `${v} %` } } }}
        />
      </TarjetaSerie>

      <TarjetaSerie
        icon={<Database className="size-4" />}
        title="Tamaño de la base de datos"
        pie={tDb && frase(tDb.delta, tDb.dias, (v) => fmtBytes(Math.abs(v)), true)}
        valor={tDb ? fmtBytes(tDb.hasta) : '—'}>
        <GraficaLinea
          labels={labels}
          series={[{ label: 'Tamaño', data: serieDe(muestras, 'dbBytes'), color: c.primary }]}
          alto={160}
          scales={{ y: { ticks: { callback: (v) => fmtBytes(Number(v)) } } }}
          formatoValor={(v) => fmtBytes(v)}
        />
      </TarjetaSerie>

      {/* El certificado se retiró de aquí: baja uno al día por definición y ya lo vigila
          la tarjeta con su umbral. Las latencias sí son una serie real. */}
      <TarjetaSerie
        icon={<Activity className="size-4" />}
        title="Latencias"
        // Subir es malo: más milisegundos.
        pie={tDbMs && frase(tDbMs.delta, tDbMs.dias, (v) => `${v} ms`, true)}
        valor={tDbMs ? `${tDbMs.hasta} ms a la BD` : '—'}>
        <GraficaLinea
          labels={labels}
          series={[
            { label: 'Base de datos', data: serieDe(muestras, 'dbLatenciaMs'), color: c.primary, _unidad: 'entero' },
            { label: 'Web (TTFB)', data: serieDe(muestras, 'webTtfbMs'), color: c.viajes, _unidad: 'entero' },
          ]}
          alto={160}
          scales={{ y: { min: 0, ticks: { callback: (v) => `${v} ms` } } }}
          formatoValor={(v) => `${v} ms`}
        />
      </TarjetaSerie>
    </div>
  )
}

/** Frase de tendencia ("+4 puntos en 90 días"), coloreada si subir es malo. */
function frase(
  delta: number,
  dias: number,
  fmtV: (v: number) => string,
  subirEsMalo: boolean,
): React.ReactNode {
  const ventana = `${dias} ${dias === 1 ? 'día' : 'días'}`
  if (delta === 0) return `sin cambios en ${ventana}`
  const sube = delta > 0
  return (
    <span className={cn(subirEsMalo && (sube ? 'text-warning' : 'text-success'))}>
      {sube ? '+' : '−'}
      {fmtV(Math.abs(delta))} en {ventana}
    </span>
  )
}

/** Tarjeta de una serie: título, cifra actual, gráfica y su frase de tendencia. */
function TarjetaSerie({
  icon, title, valor, pie, children,
}: {
  icon: React.ReactNode
  title: string
  valor: string
  pie: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 superficie rounded-2xl p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{title}</h3>
      </div>
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
      <p className="mb-2 flex items-center gap-1 text-[12px] text-muted-foreground">
        <TrendingUp className="size-3 shrink-0" />
        {pie ?? 'sin tendencia todavía'}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
