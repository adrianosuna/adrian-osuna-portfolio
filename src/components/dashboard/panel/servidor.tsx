'use client'

// Pestaña "Servidor" del Panel de control: todo lo del servidor en una vista.
// Dos bloques: salud del despliegue (SSL, latencia pública, BD, tamaño de BD,
// backup, versión) y recursos de la máquina EN VIVO (CPU, memoria, swap,
// disco, proceso, sistema — se auto-refrescan cada 40 s con una server action
// ligera, en pausa si la pestaña del navegador está oculta).
import { useEffect, useState } from 'react'
import {
  Box, Cpu, Database, DatabaseBackup, Globe, HardDrive, Layers, MemoryStick,
  Rocket, Server, ShieldCheck, Table2,
} from 'lucide-react'
import type { InfraSnapshot, ServidorSnapshot } from '@/lib/infra'
import { leerRecursos } from '@/app/app/panel/actions'
import {
  CheckCard, Refrescar, fmtBytes, fmtDuracion, fmtEdad, fmtFecha,
} from './ui'

const fmtCarga = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Bloque({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 text-[11.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground/70 first:mt-0">
      {children}
    </h2>
  )
}

export function ServidorTab({ infra, maquina }: { infra: InfraSnapshot; maquina: ServidorSnapshot }) {
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CheckCard
          icon={<Cpu className="size-4" />}
          title="CPU"
          estado={cpu.estado}
          value={`${cpu.usoPct} % de uso`}
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
          value={`${memoria.usadaPct} % usada`}
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
            value={`${swap.usadaPct} % usada`}
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
          value={disco.usadoPct === null ? '—' : `${disco.usadoPct} % usado`}
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
    </div>
  )
}
