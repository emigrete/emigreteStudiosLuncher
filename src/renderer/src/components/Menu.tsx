import { useState, type JSX } from 'react'
import logo from '../assets/emigrete_logo.png'
import banner from '../assets/banner_teammafia.png'
import titleArt from '../assets/title_netherite.png'
import { FAR_LANDS_ACTS, SOCIALS } from '../data/content'
import { ACT_ICONS, SOCIAL_ICONS, IconCube, IconSliders, IconDoor, IconFilm } from './icons'
import PlayButton from './PlayButton'
import ProfilePlaque from './ProfilePlaque'
import PlayStatus from './PlayStatus'
import SettingsModal from './SettingsModal'
import TrailerModal from './TrailerModal'
import type { ModalState } from './Modal'
import type { UseAuth } from '../hooks/useAuth'
import { usePlay } from '../hooks/usePlay'

const MODS_MODAL: ModalState = {
  tag: 'MODS',
  title: 'Gestor de mods',
  body: 'Activá, desactivá y revisá conflictos del modpack. Llega en un próximo hito.'
}
interface MenuProps {
  onOpenModal: (m: ModalState) => void
  auth: UseAuth
}

export default function Menu({ onOpenModal, auth }: MenuProps): JSX.Element {
  const play = usePlay()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [trailerOpen, setTrailerOpen] = useState(false)
  const openSettings = (): void => setSettingsOpen(true)

  return (
    <main className="hud">
      {/* Header izquierda: Team Mafia */}
      <header className="brand panel">
        <img className="brand__banner" src={banner} alt="Estandarte de Team Mafia" width={46} height={76} />
        <div className="brand__text">
          <p className="brand__title">TEAM MAFIA</p>
          <p className="brand__sub">ORDEN DE CABALLEROS</p>
          <p className="brand__tag">Unidos contra la corrupción</p>
        </div>
      </header>

      {/* Título (arte real) */}
      <div className="title">
        <img className="title__img" src={titleArt} alt="El Caballero de Netherite" />
        <span className="title__sub">Campaña hardcore-RPG hacia las Far Lands</span>
      </div>

      {/* Header derecha: perfil */}
      <ProfilePlaque auth={auth} onOpenSettings={openSettings} />

      {/* Acciones */}
      <nav className="actions" aria-label="Acciones principales">
        <PlayButton status={auth.status} authBusy={auth.busy} onLogin={() => void auth.login()} play={play} />
        {auth.error && (
          <p className="actions__error" role="alert">
            {auth.error}
          </p>
        )}
        {auth.profile?.demo && <p className="actions__warn">Cuenta demo: no podés jugar el modpack.</p>}
        <PlayStatus play={play} />
        <button className="btn btn--trailer" onClick={() => setTrailerOpen(true)}>
          <span className="btn__ico">
            <IconFilm />
          </span>
          <span className="btn__label">VER TRÁILER</span>
        </button>
        <button className="btn" onClick={() => onOpenModal(MODS_MODAL)}>
          <span className="btn__ico">
            <IconCube />
          </span>
          <span className="btn__label">MODS</span>
        </button>
        <button className="btn" onClick={openSettings}>
          <span className="btn__ico">
            <IconSliders />
          </span>
          <span className="btn__label">SETTINGS</span>
        </button>
        <button className="btn btn--exit" onClick={() => window.api?.quit()}>
          <span className="btn__ico">
            <IconDoor />
          </span>
          <span className="btn__label">SALIR</span>
        </button>
      </nav>

      {/* Panel Far Lands */}
      <aside className="lore panel" aria-label="Las Far Lands">
        <div className="lore__head">
          <h2 className="lore__title">LAS FAR LANDS</h2>
          <p className="lore__subtitle">MÁS ALLÁ DEL BORDE</p>
        </div>
        <p className="lore__eyebrow">✦ ACTOS Y AMENAZAS</p>
        <ul className="lore__list">
          {FAR_LANDS_ACTS.map((a) => {
            const Ico = ACT_ICONS[a.key]
            return (
              <li className="act" key={a.key}>
                <span className={`act__ico act__ico--${a.key}`}>
                  <Ico />
                </span>
                <span className="act__text">
                  <strong>{a.title}</strong>
                  <em>{a.desc}</em>
                </span>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Footer (firma Emigrete) */}
      <footer className="footer panel">
        <div className="footer__brand">
          <img className="footer__logo" src={logo} alt="Emigrete Studios" width={27} height={32} />
          <span className="footer__text">
            <strong>MODPACK BY TEAM MAFIA</strong>
            <span className="footer__sub">
              por Emigrete Studios · <span className="footer__ver">v{window.api?.version ?? '0.1.1'}</span>
            </span>
          </span>
        </div>
        <p className="footer__tag">
          <span className="rune">✦</span> SIN REGLAS. SIN LÍMITES. SOLO SUPERVIVENCIA. <span className="rune">✦</span>
        </p>
        <nav className="social" aria-label="Redes de Emigrete Studios">
          {SOCIALS.map((s) => {
            const Ico = SOCIAL_ICONS[s.key]
            return (
              <a className="social__btn" key={s.key} href={s.href} aria-label={s.label} title={s.label}>
                <Ico />
              </a>
            )
          })}
        </nav>
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TrailerModal open={trailerOpen} onClose={() => setTrailerOpen(false)} />
    </main>
  )
}
