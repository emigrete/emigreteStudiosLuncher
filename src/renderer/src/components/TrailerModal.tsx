import { useEffect, useRef, type JSX } from 'react'
import trailer from '../assets/trailer.mp4'
import { IconClose } from './icons'

/**
 * Modal del tráiler. Al abrir "aduca" la música del launcher; al cerrar la reanuda,
 * frena el video y lo rebobina. Cierra con Escape o click afuera.
 */
export default function TrailerModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    window.dispatchEvent(new Event('launcher:music-duck'))
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const el = videoRef.current
      if (el) {
        el.pause()
        el.currentTime = 0
      }
      window.dispatchEvent(new Event('launcher:music-unduck'))
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="trailer"
      role="dialog"
      aria-modal="true"
      aria-label="Tráiler"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="trailer__frame panel">
        <button className="trailer__close" onClick={onClose} aria-label="Cerrar tráiler" title="Cerrar">
          <IconClose />
        </button>
        <video ref={videoRef} className="trailer__video" src={trailer} controls autoPlay playsInline />
      </div>
    </div>
  )
}
