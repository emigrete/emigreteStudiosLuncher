import type { JSX } from 'react'
import logo from '../assets/emigrete_logo.png'

/**
 * Pantalla de carga / splash de apertura.
 * Marca EMIGRETE (fría: cyan + blanco sobre #141018), con la misma gramática
 * pixel del launcher (biseles duros, barra de carga tipo Minecraft).
 */
export default function Splash({ gone }: { gone: boolean }): JSX.Element {
  return (
    <div className={`splash${gone ? ' splash--gone' : ''}`} aria-hidden={gone}>
      <div className="splash__grain" />
      <div className="splash__glow" />

      <div className="splash__stack">
        <img className="splash__logo" src={logo} alt="Emigrete Studios" width={190} height={223} />
        <p className="splash__studio">EMIGRETE STUDIOS</p>
        <p className="splash__presenta">presenta</p>

        <div className="splash__bar" role="progressbar" aria-label="Cargando">
          <span className="splash__bar-fill" />
        </div>
        <p className="splash__loading">
          CARGANDO<span className="splash__dot">.</span>
          <span className="splash__dot">.</span>
          <span className="splash__dot">.</span>
        </p>
      </div>

      <p className="splash__ver">v0.1.0</p>
    </div>
  )
}
