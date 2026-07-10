import type { JSX } from 'react'
import { IconPlay, IconMicrosoft } from './icons'
import type { AuthStatus } from '../hooks/useAuth'
import type { UsePlay } from '../hooks/usePlay'
import { isPlayBusy, playLabel, playPercent } from '@shared/play'

interface PlayButtonProps {
  status: AuthStatus
  /** true mientras la ventana de Microsoft está abierta. */
  authBusy: boolean
  onLogin: () => void
  play: UsePlay
}

/** Botón primario. Sin sesión invita a iniciarla; con sesión sincroniza y lanza. */
export default function PlayButton({ status, authBusy, onLogin, play }: PlayButtonProps): JSX.Element {
  const authed = status === 'authed'
  const active = isPlayBusy(play.state) || play.busy
  const disabled = status === 'loading' || authBusy || active

  const label = !authed ? (status === 'loading' ? 'CONECTANDO...' : 'INICIAR SESIÓN') : playLabel(play.state, true)
  const size = label === 'JUGAR' ? 'lg' : 'sm'

  const percent = playPercent(play.state)
  const indeterminate = active && percent === null

  return (
    <button
      className="btn btn--play"
      data-state={active ? 'loading' : 'idle'}
      data-size={size}
      onClick={authed ? () => void play.play() : onLogin}
      disabled={disabled}
      aria-busy={active || authBusy}
      aria-label={label}
    >
      <span className="btn__ico">{authed ? <IconPlay /> : <IconMicrosoft />}</span>
      <span className="btn__label">{label}</span>
      <span className="btn__progress" data-indeterminate={indeterminate} aria-hidden="true">
        <span className="btn__progress-fill" style={indeterminate ? undefined : { width: `${percent ?? 0}%` }} />
        <span className="btn__progress-text">{label}</span>
      </span>
    </button>
  )
}
