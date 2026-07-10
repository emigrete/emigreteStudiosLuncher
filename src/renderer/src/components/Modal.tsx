import { useEffect, useState, type JSX } from 'react'
import { IconClose } from './icons'

export type ModalState = { tag: string; title: string; body: string }

export default function Modal({
  state,
  onClose
}: {
  state: ModalState | null
  onClose: () => void
}): JSX.Element {
  const [content, setContent] = useState<ModalState | null>(null)
  const open = state !== null

  useEffect(() => {
    if (state) setContent(state)
  }, [state])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={`modal${open ? ' is-open' : ''}`}
      aria-hidden={!open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal__dialog panel" role="dialog" aria-modal="true">
        <div className="modal__bar">
          <span className="modal__tag">{content?.tag}</span>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <IconClose />
          </button>
        </div>
        <h3 className="modal__title">{content?.title}</h3>
        <p className="modal__body">{content?.body}</p>
        <p className="modal__soon">✦ Disponible en un próximo hito ✦</p>
      </div>
    </div>
  )
}
