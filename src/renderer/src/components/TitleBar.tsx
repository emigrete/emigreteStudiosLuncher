import type { JSX } from 'react'
import { IconMin, IconClose } from './icons'

/** Barra frameless: zona de arrastre + controles de ventana (vía IPC). */
export default function TitleBar(): JSX.Element {
  return (
    <div className="titlebar">
      <div className="titlebar__drag" />
      <div className="winctl">
        <button className="winctl__btn" onClick={() => window.api?.minimize()} aria-label="Minimizar" title="Minimizar">
          <IconMin />
        </button>
        <button
          className="winctl__btn winctl__btn--danger"
          onClick={() => window.api?.close()}
          aria-label="Cerrar"
          title="Cerrar"
        >
          <IconClose />
        </button>
      </div>
    </div>
  )
}
