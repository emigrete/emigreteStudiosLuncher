import { useEffect, useState, type JSX } from 'react'
import HeroBackground from './components/HeroBackground'
import TitleBar from './components/TitleBar'
import UpdaterPill from './components/UpdaterPill'
import Menu from './components/Menu'
import Splash from './components/Splash'
import Modal, { type ModalState } from './components/Modal'
import { useAuth } from './hooks/useAuth'
import { MusicProvider } from './hooks/useMusic'

// La barra de carga anima 2s; damos un beat extra antes del fade al menú.
const SPLASH_MS = 2400

export default function App(): JSX.Element {
  const [booted, setBooted] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const auth = useAuth()

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), SPLASH_MS)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <MusicProvider>
      <HeroBackground />
      <TitleBar />
      <UpdaterPill />
      <Menu onOpenModal={setModal} auth={auth} />
      <Modal state={modal} onClose={() => setModal(null)} />
      <Splash gone={booted} />
    </MusicProvider>
  )
}
