import type { JSX } from 'react'
import { IconMin, IconClose, IconSpeaker, IconSpeakerMute } from './icons'
import { useMusic } from '../hooks/useMusic'

/** Barra frameless: zona de arrastre + controles de ventana + toggle de música. */
export default function TitleBar(): JSX.Element {
  const { muted, toggleMuted } = useMusic()
  return (
    <div className="titlebar">
      <div className="titlebar__drag" />
      <div className="winctl">
        <button
          className={`winctl__btn winctl__btn--music${muted ? ' is-muted' : ''}`}
          onClick={toggleMuted}
          aria-label={muted ? 'Activar música' : 'Silenciar música'}
          title={muted ? 'Activar música' : 'Silenciar música'}
          aria-pressed={muted}
        >
          {muted ? <IconSpeakerMute /> : <IconSpeaker />}
        </button>
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
