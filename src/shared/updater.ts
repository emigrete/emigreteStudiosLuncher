/** Estado del auto-updater, empujado del main al renderer por 'updater:status'. */
export type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'none' }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export const IDLE_UPDATER: UpdaterStatus = { state: 'idle' }
