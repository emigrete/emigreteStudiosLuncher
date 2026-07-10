import type { JSX } from 'react'
import type { UsePlay } from '../hooks/usePlay'
import { formatBytes } from '@shared/progress'

/** Línea de estado bajo el botón JUGAR: qué está pasando + cancelar + errores. */
export default function PlayStatus({ play }: { play: UsePlay }): JSX.Element | null {
  const { state, error } = play

  if (error) {
    return (
      <p className="actions__error" role="alert">
        {error}
      </p>
    )
  }

  switch (state.phase) {
    case 'syncing': {
      const s = state.sync
      if (s.phase === 'checking') {
        return (
          <p className="actions__info">
            Verificando archivos ({s.filesDone}/{s.filesTotal})
          </p>
        )
      }
      if (s.phase === 'downloading') {
        const bytes =
          s.bytesTotal > 0 ? `${formatBytes(s.bytesDone)} / ${formatBytes(s.bytesTotal)}` : formatBytes(s.bytesDone)
        return (
          <p className="actions__info">
            <span className="actions__file">{s.currentFile ?? 'Descargando...'}</span>
            <span className="actions__bytes">{bytes}</span>
            <button className="actions__cancel" onClick={play.cancel} type="button">
              CANCELAR
            </button>
          </p>
        )
      }
      return <p className="actions__info">Leyendo el modpack...</p>
    }
    case 'preparing':
      return <p className="actions__info">Buscando Java 21...</p>
    case 'installing-loader':
      return (
        <p className="actions__info">
          <span className="actions__file">Instalando NeoForge (primera vez, puede tardar)</span>
          <button className="actions__cancel" onClick={play.cancel} type="button">
            CANCELAR
          </button>
        </p>
      )
    case 'launching':
      return <p className="actions__info">Iniciando Minecraft...</p>
    case 'running':
      return <p className="actions__ok">¡Jugando! Podés cerrar Minecraft cuando termines.</p>
    default:
      return null
  }
}
