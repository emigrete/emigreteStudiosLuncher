import { useEffect, useState, useCallback } from 'react'
import type { UpdaterStatus } from '@shared/updater'

/** Estado del auto-updater. El trabajo real ocurre en el main; acá solo reflejamos. */
export function useUpdater(): {
  status: UpdaterStatus
  download: () => void
  install: () => void
} {
  const [status, setStatus] = useState<UpdaterStatus>({ state: 'idle' })

  useEffect(() => {
    const unsubscribe = window.api?.updater?.onStatus(setStatus)
    return () => unsubscribe?.()
  }, [])

  const download = useCallback((): void => {
    void window.api?.updater?.download()
  }, [])

  const install = useCallback((): void => {
    void window.api?.updater?.install()
  }, [])

  return { status, download, install }
}
