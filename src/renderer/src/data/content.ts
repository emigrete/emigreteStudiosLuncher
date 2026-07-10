export type Act = {
  key: 'void' | 'mafia' | 'boss'
  title: string
  desc: string
}

export const FAR_LANDS_ACTS: Act[] = [
  {
    key: 'void',
    title: 'CORRUPCIÓN DEL BORDE',
    desc: 'Nuevas dimensiones, biomas rotos y entidades anómalas.'
  },
  {
    key: 'mafia',
    title: 'EQUIPO CORRUPTO',
    desc: 'Armaduras, armas y reliquias infundidas con poder oscuro.'
  },
  {
    key: 'boss',
    title: 'JEFES',
    desc: 'Enfrenta a caballeros caídos y horrores del vacío.'
  }
]

export type Social = { key: string; label: string; href: string }

export const SOCIALS: Social[] = [
  { key: 'discord', label: 'Discord', href: '#' },
  { key: 'youtube', label: 'YouTube', href: '#' },
  { key: 'twitter', label: 'Twitter / X', href: '#' },
  { key: 'modrinth', label: 'Modrinth', href: '#' }
]
