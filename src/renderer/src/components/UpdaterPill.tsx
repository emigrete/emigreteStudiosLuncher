import type { JSX } from 'react'
import { useUpdater } from '../hooks/useUpdater'

/**
 * Aviso de actualización en la HUD. No molesta: solo aparece cuando hay algo que
 * mostrar (disponible / bajando / lista / error). autoDownload OFF => pregunta.
 */
export default function UpdaterPill(): JSX.Element | null {
  const { status, download, install } = useUpdater()

  switch (status.state) {
    case 'available':
      return (
        <div className="updater" role="status">
          <span className="updater__label">Actualización v{status.version}</span>
          <button className="updater__btn" onClick={download}>
            Descargar
          </button>
        </div>
      )
    case 'downloading':
      return (
        <div className="updater" role="status">
          <span className="updater__label">Bajando actualización… {status.percent}%</span>
          <div className="updater__bar" aria-hidden="true">
            <div className="updater__bar-fill" style={{ width: `${status.percent}%` }} />
          </div>
        </div>
      )
    case 'ready':
      return (
        <div className="updater updater--ready" role="status">
          <span className="updater__label">Listo v{status.version}</span>
          <button className="updater__btn" onClick={install}>
            Reiniciar para actualizar
          </button>
        </div>
      )
    case 'error':
      return (
        <div className="updater updater--error" role="status">
          <span className="updater__label">Update falló: {status.message}</span>
        </div>
      )
    default:
      return null // idle / checking / none: nada que mostrar
  }
}
