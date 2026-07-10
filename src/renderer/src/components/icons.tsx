import type { JSX, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const svg = (size: number, children: JSX.Element, extra?: P): JSX.Element => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...extra}>
    {children}
  </svg>
)

export const IconMin = (p: P): JSX.Element =>
  svg(12, <rect x="3" y="11" width="18" height="2" fill="currentColor" />, { ...p, viewBox: '0 0 24 24' })

export const IconClose = (p: P): JSX.Element =>
  svg(12, <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />, p)

export const IconGear = (p: P): JSX.Element =>
  svg(
    20,
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 2.6v3.1M12 18.3v3.1M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2.6 12h3.1M18.3 12h3.1M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"
        strokeLinecap="round"
      />
    </g>,
    p
  )

export const IconPlay = (p: P): JSX.Element =>
  svg(24, <path d="M4 15 L14 3 L16 5 L9 13 L11 15 L20 12 L21 15 L11 21 L4 15Z" fill="currentColor" />, p)

export const IconCube = (p: P): JSX.Element =>
  svg(
    22,
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </g>,
    p
  )

export const IconSliders = (p: P): JSX.Element =>
  svg(
    22,
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 6h14M5 12h14M5 18h14" />
      <circle cx="9" cy="6" r="2" fill="var(--fondo)" />
      <circle cx="15" cy="12" r="2" fill="var(--fondo)" />
      <circle cx="8" cy="18" r="2" fill="var(--fondo)" />
    </g>,
    p
  )

export const IconDoor = (p: P): JSX.Element =>
  svg(
    22,
    <path
      d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 12H3M6 8l-4 4 4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    p
  )

export const IconUser = (p: P): JSX.Element =>
  svg(
    16,
    <g fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1-5 4.5-7 8-7s7 2 8 7z" />
    </g>,
    p
  )

export const IconSkull = (p: P): JSX.Element =>
  svg(
    16,
    <g fill="currentColor">
      <circle cx="12" cy="9" r="6" />
      <rect x="7" y="13" width="10" height="4" />
      <circle cx="9.5" cy="9" r="1.6" fill="var(--fondo)" />
      <circle cx="14.5" cy="9" r="1.6" fill="var(--fondo)" />
    </g>,
    p
  )

export const IconVoid = (p: P): JSX.Element =>
  svg(
    22,
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 4a8 8 0 1 1-7 4" />
      <path d="M12 8a4 4 0 1 0 3.5 2" />
    </g>,
    p
  )

export const IconMafiaSkull = (p: P): JSX.Element =>
  svg(
    22,
    <g fill="currentColor">
      <circle cx="12" cy="9" r="6" />
      <rect x="7" y="14" width="10" height="4" />
      <circle cx="9.5" cy="9" r="1.7" fill="var(--fondo)" />
      <circle cx="14.5" cy="9" r="1.7" fill="var(--fondo)" />
    </g>,
    p
  )

export const IconBoss = (p: P): JSX.Element =>
  svg(
    22,
    <g fill="currentColor">
      <path d="M4 16l1.5-8 4 4L12 6l2.5 6 4-4L20 16z" />
      <rect x="4" y="16" width="16" height="3" />
    </g>,
    p
  )

export const IconDiscord = (p: P): JSX.Element =>
  svg(
    18,
    <path
      fill="currentColor"
      d="M20.3 4.6A18 18 0 0 0 15.9 3.2l-.2.5a16.7 16.7 0 0 1 3.7 1.2 15.4 15.4 0 0 0-12.8 0A16.7 16.7 0 0 1 10.3 3.7l-.2-.5A18 18 0 0 0 5.7 4.6C2.9 8.7 2.1 12.7 2.5 16.6A18.3 18.3 0 0 0 8 19l.9-1.6a11.9 11.9 0 0 1-1.9-.9l.5-.3a12.9 12.9 0 0 0 11 0l.5.3a11.9 11.9 0 0 1-1.9.9L18 19a18.3 18.3 0 0 0 5.5-2.4c.5-4.6-.8-8.5-3.2-12ZM9.3 14.4c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.6 1.8c0 1-.7 1.8-1.6 1.8Zm5.4 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.6 1.8c0 1-.7 1.8-1.6 1.8Z"
    />,
    p
  )

export const IconYouTube = (p: P): JSX.Element =>
  svg(
    18,
    <path
      fill="currentColor"
      d="M23 8.2a3 3 0 0 0-2.1-2.1C19 5.6 12 5.6 12 5.6s-7 0-8.9.5A3 3 0 0 0 1 8.2 31 31 0 0 0 .6 12 31 31 0 0 0 1 15.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.4 12 31 31 0 0 0 23 8.2ZM9.8 15.3V8.7l5.7 3.3z"
    />,
    p
  )

export const IconTwitter = (p: P): JSX.Element =>
  svg(
    16,
    <path
      fill="currentColor"
      d="M18.2 3h3.3l-7.2 8.3L23 21h-6.6l-5.2-6.8L5.3 21H2l7.7-8.9L1.5 3h6.8l4.7 6.2zm-1.2 16h1.8L7.1 4.9H5.2z"
    />,
    p
  )

export const IconModrinth = (p: P): JSX.Element =>
  svg(
    18,
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 13.5a6 6 0 0 0 10.4 2.2M8.3 12l2.4-2.4 2 .5 1.6-1.6" />
    </g>,
    p
  )

export const IconMicrosoft = (p: P): JSX.Element =>
  svg(
    22,
    <g fill="currentColor">
      <rect x="3" y="3" width="8" height="8" />
      <rect x="13" y="3" width="8" height="8" />
      <rect x="3" y="13" width="8" height="8" />
      <rect x="13" y="13" width="8" height="8" />
    </g>,
    p
  )

export const IconLogout = (p: P): JSX.Element =>
  svg(
    16,
    <path
      d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M14 12h7M18 8l4 4-4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    p
  )

export const IconFilm = (p: P): JSX.Element =>
  svg(
    22,
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </g>,
    p
  )

export const IconSpeaker = (p: P): JSX.Element =>
  svg(
    18,
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h3l5 4V5L7 9H4z" fill="currentColor" stroke="none" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.7 6a8 8 0 0 1 0 12" />
    </g>,
    p
  )

export const IconSpeakerMute = (p: P): JSX.Element =>
  svg(
    18,
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h3l5 4V5L7 9H4z" fill="currentColor" stroke="none" />
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
    </g>,
    p
  )

export const SOCIAL_ICONS: Record<string, (p: P) => JSX.Element> = {
  discord: IconDiscord,
  youtube: IconYouTube,
  twitter: IconTwitter,
  modrinth: IconModrinth
}

export const ACT_ICONS: Record<string, (p: P) => JSX.Element> = {
  void: IconVoid,
  mafia: IconMafiaSkull,
  boss: IconBoss
}
