import type { JSX } from 'react'
import { IconGear, IconUser, IconSkull, IconLogout } from './icons'
import type { UseAuth } from '../hooks/useAuth'

interface ProfilePlaqueProps {
  auth: UseAuth
  onOpenSettings: () => void
}

/** Plaqueta de perfil: invitado, conectando, o cuenta de Microsoft con su skin. */
export default function ProfilePlaque({ auth, onOpenSettings }: ProfilePlaqueProps): JSX.Element {
  const { status, profile } = auth

  return (
    <div className="profile panel">
      <div className="profile__rows">
        <div className="profile__row">
          {status === 'authed' && profile?.avatar ? (
            <img className="profile__avatar" src={profile.avatar} alt="" width={26} height={26} />
          ) : (
            <span className="profile__ico">
              <IconUser />
            </span>
          )}
          <span className="profile__k">PERFIL:</span>
          <span className="profile__v">
            {status === 'loading' ? 'CONECTANDO...' : status === 'authed' ? profile?.name : 'INVITADO'}
          </span>
          {status === 'authed' && (
            <button
              className="profile__logout"
              onClick={() => void auth.logout()}
              disabled={auth.busy}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <IconLogout />
            </button>
          )}
        </div>

        <div className="profile__row">
          <span className="profile__ico profile__ico--skull">
            <IconSkull />
          </span>
          <span className="profile__k">DIFICULTAD:</span>
          <span className="profile__v profile__v--danger">HARDCORE</span>
        </div>
      </div>

      <button className="gear" onClick={onOpenSettings} aria-label="Settings" title="Settings">
        <IconGear />
      </button>
    </div>
  )
}
