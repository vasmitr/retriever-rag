import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export class StorageService {
  private configPath: string
  private projectsPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    const storagePath = path.join(userDataPath, 'retriever-rag')

    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true })
    }

    this.configPath = path.join(storagePath, 'config.json')
    this.projectsPath = path.join(storagePath, 'projects.json')
  }

  async saveConfig(config: any): Promise<void> {
    await fs.promises.writeFile(this.configPath, JSON.stringify(config, null, 2))
  }

  async loadConfig(): Promise<any> {
    try {
      const data = await fs.promises.readFile(this.configPath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {}
      }
      throw error
    }
  }

  async saveProjects(projects: any[]): Promise<void> {
    await fs.promises.writeFile(this.projectsPath, JSON.stringify(projects, null, 2))
  }

  async loadProjects(): Promise<any[]> {
    try {
      const data = await fs.promises.readFile(this.projectsPath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }
}
