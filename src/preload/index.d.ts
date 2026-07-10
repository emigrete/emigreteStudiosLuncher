import type { AuthResult, AuthState } from '../shared/types'
import type { SyncProgress, SyncResult } from '../shared/pack'
import type { LauncherConfig } from '../shared/config'
import type { PlayResult, PlayState } from '../shared/play'
import type { UpdaterStatus } from '../shared/updater'

export {}

declare global {
  interface Window {
    api: {
      minimize: () => void
      close: () => void
      quit: () => void
      version: string
      auth: {
        state: () => Promise<AuthState>
        login: () => Promise<AuthResult>
        logout: () => Promise<void>
      }
      pack: {
        sync: () => Promise<SyncResult>
        cancel: () => Promise<void>
        onProgress: (callback: (progress: SyncProgress) => void) => () => void
      }
      config: {
        get: () => Promise<LauncherConfig>
        set: (patch: Partial<LauncherConfig>) => Promise<LauncherConfig>
      }
      game: {
        play: () => Promise<PlayResult>
        cancel: () => Promise<void>
        onProgress: (callback: (state: PlayState) => void) => () => void
      }
      updater: {
        check: () => Promise<unknown>
        download: () => Promise<unknown>
        install: () => Promise<unknown>
        onStatus: (callback: (status: UpdaterStatus) => void) => () => void
      }
    }
  }
}
