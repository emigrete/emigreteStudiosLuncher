import { useEffect, useState, type JSX } from 'react'
import { IconClose } from './icons'
import { isValidManifestUrl, type LauncherConfig } from '@shared/config'
import { formatBytes, syncPercent } from '@shared/progress'
import { usePackSync } from '../hooks/usePackSync'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

/** Ajustes: URL del modpack + prueba de sincronización (sin necesidad de login). */
export default function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element {
  const [config, setConfig] = useState<LauncherConfig | null>(null)
  const [url, setUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const pack = usePackSync()

  useEffect(() => {
    if (!open) return
    setSaved(false)
    void window.api.config.get().then((c) => {
      setConfig(c)
      setUrl(c.manifestUrl)
    })
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !pack.running) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pack.running])

  const trimmed = url.trim()
  const urlValid = isValidManifestUrl(trimmed)
  const dirty = config !== null && trimmed !== config.manifestUrl

  const save = async (): Promise<void> => {
    if (!urlValid) return
    const next = await window.api.config.set({ manifestUrl: trimmed })
    setConfig(next)
    setUrl(next.manifestUrl)
    setSaved(true)
  }

  const testSync = async (): Promise<void> => {
    if (dirty) await save()
    void pack.start()
  }

  return (
    <div
      className={`modal${open ? ' is-open' : ''}`}
      aria-hidden={!open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pack.running) onClose()
      }}
    >
      <div className="modal__dialog panel" role="dialog" aria-modal="true" aria-label="Ajustes">
        <div className="modal__bar">
          <span className="modal__tag">SETTINGS</span>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <IconClose />
          </button>
        </div>
        <h3 className="modal__title">Ajustes</h3>

        <label className="field">
          <span className="field__label">URL del manifiesto del modpack</span>
          <input
            className="field__input"
            type="url"
            inputMode="url"
            spellCheck={false}
            placeholder="https://tu-cdn/manifest.json"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setSaved(false)
            }}
          />
          {!urlValid && <span className="field__error">Tiene que ser una URL http(s).</span>}
          {saved && urlValid && <span className="field__ok">Guardado ✓</span>}
        </label>

        <div className="settings__actions">
          <button className="mini-btn" onClick={() => void save()} disabled={!dirty || !urlValid || pack.running}>
            GUARDAR
          </button>
          <button
            className="mini-btn mini-btn--accent"
            onClick={() => void testSync()}
            disabled={trimmed.length === 0 || !urlValid || pack.running}
          >
            {pack.running ? 'PROBANDO...' : 'PROBAR SYNC'}
          </button>
        </div>

        {/* Feedback de la prueba de sincronización */}
        <SyncFeedback pack={pack} />

        <p className="settings__hint">
          “Probar sync” baja y verifica el modpack en tu carpeta de datos, sin iniciar sesión.
        </p>
      </div>
    </div>
  )
}

function SyncFeedback({ pack }: { pack: ReturnType<typeof usePackSync> }): JSX.Element | null {
  if (pack.error) return <p className="settings__result settings__result--error">{pack.error}</p>

  if (pack.running) {
    const p = pack.progress
    const pct = Math.round(syncPercent(p))
    const detail =
      p.phase === 'downloading'
        ? `${formatBytes(p.bytesDone)}${p.bytesTotal > 0 ? ` / ${formatBytes(p.bytesTotal)}` : ''}`
        : p.phase === 'checking'
          ? `verificando ${p.filesDone}/${p.filesTotal}`
          : 'leyendo manifiesto'
    return (
      <div className="settings__result">
        <div className="settings__bar">
          <span className="settings__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="settings__result-text">
          {detail} · {pct}%
        </span>
      </div>
    )
  }

  if (pack.summary) {
    return (
      <p className="settings__result settings__result--ok">
        ✓ {pack.summary.downloaded} descargados, {pack.summary.skipped} ya estaban
        {pack.summary.external > 0 && ` (${pack.summary.external} externos)`}
      </p>
    )
  }
  return null
}
