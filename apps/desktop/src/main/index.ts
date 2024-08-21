import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { DockerService } from './docker-service'
import { StorageService } from './storage-service'

const monorepoRoot = path.resolve(__dirname, '../../../..')

let mainWindow: BrowserWindow | null = null
let dockerService: DockerService
let storageService: StorageService

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('ready', async () => {
  storageService = new StorageService()
  dockerService = new DockerService(monorepoRoot, storageService)

  try {
    await dockerService.initialize()
    console.log('DockerService initialized successfully')
  } catch (error) {
    console.error('Failed to initialize DockerService:', error)
  }

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

// IPC handlers

ipcMain.handle('docker:get-config', async () => {
  return dockerService.getConfig()
})

ipcMain.handle('docker:get-projects', async () => {
  return dockerService.getProjects()
})

ipcMain.handle('docker:update-config', async (_, config) => {
  try {
    await dockerService.updateConfig(config)
    return true
  } catch (error) {
    console.log('Failed to update Docker config:', error)
    return false
  }
})

ipcMain.handle('docker:update-projects', async (_, projects) => {
  try {
    await dockerService.updateProjects(projects)
    return true
  } catch (error) {
    console.log('Failed to update Docker projects:', error)
    return false
  }
})

ipcMain.handle('docker:start-compose', async () => {
  try {
    return await dockerService.startCompose()
  } catch (error) {
    console.error('Error in docker:start-compose:', error)
    throw error
  }
})

ipcMain.handle('docker:stop-compose', async () => {
  try {
    return await dockerService.stopCompose()
  } catch (error) {
    console.error('Error in docker:stop-compose:', error)
    throw error
  }
})

ipcMain.handle('docker:update-project-links', async (_, projects) => {
  try {
    await dockerService.updateProjects(projects)
    return 'Project links updated successfully'
  } catch (error) {
    console.error('Error in docker:update-project-links:', error)
    throw error
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
