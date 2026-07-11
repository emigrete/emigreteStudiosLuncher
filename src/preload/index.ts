import { contextBridge, ipcRenderer } from 'electron'
import type { AuthResult, AuthState } from '../shared/types'
import type { SyncProgress, SyncResult } from '../shared/pack'
import type { LauncherConfig } from '../shared/config'
import type { PlayResult, PlayState } from '../shared/play'
import type { UpdaterStatus } from '../shared/updater'

/** Puente IPC seguro renderer <-> main. Se expone como window.api. */
const api = {
  minimize: (): void => ipcRenderer.send('win:minimize'),
  close: (): void => ipcRenderer.send('win:close'),
  quit: (): void => ipcRenderer.send('app:quit'),
  version: '0.1.2',

  // M1 — autenticación Microsoft. Todo el trabajo ocurre en el main.
  auth: {
    state: (): Promise<AuthState> => ipcRenderer.invoke('auth:state'),
    login: (): Promise<AuthResult> => ipcRenderer.invoke('auth:login'),
    logout: (): Promise<void> => ipcRenderer.invoke('auth:logout')
  },

  // M2 — sincronización del modpack.
  pack: {
    sync: (): Promise<SyncResult> => ipcRenderer.invoke('pack:sync'),
    cancel: (): Promise<void> => ipcRenderer.invoke('pack:cancel'),
    /** Devuelve la función para desuscribirse. */
    onProgress: (callback: (progress: SyncProgress) => void): (() => void) => {
      const listener = (_event: unknown, progress: SyncProgress): void => callback(progress)
      ipcRenderer.on('pack:progress', listener)
      return () => ipcRenderer.removeListener('pack:progress', listener)
    }
  },

  // Config persistida (URL del manifiesto, RAM).
  config: {
    get: (): Promise<LauncherConfig> => ipcRenderer.invoke('config:get'),
    set: (patch: Partial<LauncherConfig>): Promise<LauncherConfig> => ipcRenderer.invoke('config:set', patch)
  },

  // M3 — jugar (sincroniza + lanza).
  game: {
    play: (): Promise<PlayResult> => ipcRenderer.invoke('game:play'),
    cancel: (): Promise<void> => ipcRenderer.invoke('game:cancel'),
    onProgress: (callback: (state: PlayState) => void): (() => void) => {
      const listener = (_event: unknown, state: PlayState): void => callback(state)
      ipcRenderer.on('play:progress', listener)
      return () => ipcRenderer.removeListener('play:progress', listener)
    }
  },

  // M4 — auto-updater.
  updater: {
    check: (): Promise<unknown> => ipcRenderer.invoke('updater:check'),
    download: (): Promise<unknown> => ipcRenderer.invoke('updater:download'),
    install: (): Promise<unknown> => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (status: UpdaterStatus) => void): (() => void) => {
      const listener = (_event: unknown, status: UpdaterStatus): void => callback(status)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.removeListener('updater:status', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback sin contextIsolation)
  window.api = api
}
