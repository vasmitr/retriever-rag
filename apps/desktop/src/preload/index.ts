import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  startDockerCompose: (config: any, projects: string[]) =>
    ipcRenderer.invoke('docker:start-compose', { config, projects }),
  stopDockerCompose: () => ipcRenderer.invoke('docker:stop-compose'),

  getConfig: () => ipcRenderer.invoke('docker:get-config'),
  getProjects: () => ipcRenderer.invoke('docker:get-projects'),
  updateProjects: (projects: string[]) => ipcRenderer.invoke('docker:update-projects', projects),
  updateConfig: (config: any) => ipcRenderer.invoke('docker:update-config', config)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
