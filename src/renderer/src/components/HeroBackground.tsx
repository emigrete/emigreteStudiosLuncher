import type { JSX } from 'react'
import heroVideo from '../assets/hero.mp4'
import heroPoster from '../assets/hero.jpg'

/** Fondo cinemático full-bleed (video en loop) + scrims para legibilidad del HUD. */
export default function HeroBackground(): JSX.Element {
  return (
    <div className="hero" aria-hidden="true">
      <video
        className="hero__img"
        src={heroVideo}
        poster={heroPoster}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="hero__scrim" />
    </div>
  )
}
