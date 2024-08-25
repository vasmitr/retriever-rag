import { exec } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import Handlebars from 'handlebars'
import yaml from 'js-yaml'
import { StorageService } from './storage-service'

interface DockerConfig {
  NODE_ENV: string
  QDRANT_URL: string
  OLLAMA_URL: string
}

interface DockerComposeConfig extends Record<string, unknown> {
  services: Record<string, Record<string, unknown>>
}

export class DockerService {
  private readonly monorepoRoot: string
  private readonly composeFilePath: string
  private readonly dataDirectoryPath: string
  private composeTemplateSource: string
  private storageService: StorageService

  constructor(monorepoRoot: string, storageService: StorageService) {
    this.monorepoRoot = monorepoRoot
    this.composeFilePath = path.join(this.monorepoRoot, 'docker-compose.yml')
    this.dataDirectoryPath = path.join(this.monorepoRoot, 'data')
    this.composeTemplateSource = ''
    this.storageService = storageService
  }

  async initialize(): Promise<void> {
    try {
      const composeContent = await fs.readFile(this.composeFilePath, 'utf8')
      const composeData = yaml.load(composeContent) as DockerComposeConfig

      console.log(composeData)
      // Convert the YAML structure to a Handlebars template
      this.composeTemplateSource = await this.convertToHandlebarsTemplate(composeData)
      console.log('Template source created successfully')

      // Ensure data directory exists
      await fs.mkdir(this.dataDirectoryPath, { recursive: true })
    } catch (error) {
      console.error('Failed to initialize DockerService:', error)
      throw error
    }
  }

  private async convertToHandlebarsTemplate(data: DockerComposeConfig): Promise<string> {
    const config = await this.storageService.loadConfig()
    const projects = await this.storageService.loadProjects()
    const servicesWithEnv = ['server', 'worker']
    servicesWithEnv.forEach((service) => {
      if (data.services[service]) {
        data.services[service].environment = [
          `NODE_ENV=${config.NODE_ENV || 'production'}`,
          `QDRANT_URL=${config.QDRANT_URL || 'http://host.docker.internal:6333/'}`,
          `OLLAMA_URL=${config.OLLAMA_URL || 'http://host.docker.internal:11434/'}`
        ]
        if (projects.length > 0) {
          data.services[service].volumes = [
            ...(data.services[service].volumes || []),
            ...projects.map((project) => {
              const path = project.split('/')
              const projectName = path[path.length - 1]
              return {
                type: 'bind',
                source: project,
                target: `/data/${projectName}`
              }
            })
          ]
        }
      }
    })

    return yaml.dump(data)
  }

  async updateConfig(config: DockerConfig): Promise<void> {
    const oldConfig = await this.storageService.loadConfig()
    await this.storageService.saveConfig(config)
    console.log('Config updated successfully')
    await this.restartAffectedServices(oldConfig, config)
  }

  async updateProjects(projects: string[]): Promise<void> {
    const oldProjects = await this.storageService.loadProjects()
    await this.storageService.saveProjects(projects)
    console.log('Projects updated successfully')
    await this.restartAffectedServices(undefined, undefined, oldProjects, projects)
  }

  async getConfig(): Promise<DockerConfig> {
    return this.storageService.loadConfig()
  }

  async getProjects(): Promise<string[]> {
    return this.storageService.loadProjects()
  }

  private async restartAffectedServices(
    oldConfig?: DockerConfig,
    newConfig?: DockerConfig,
    oldProjects?: string[],
    newProjects?: string[]
  ): Promise<void> {
    const affectedServices: Set<string> = new Set()

    if (oldConfig && newConfig) {
      if (
        oldConfig.NODE_ENV !== newConfig.NODE_ENV ||
        oldConfig.QDRANT_URL !== newConfig.QDRANT_URL ||
        oldConfig.OLLAMA_URL !== newConfig.OLLAMA_URL
      ) {
        affectedServices.add('server')
        affectedServices.add('worker')
      }
    }

    if (oldProjects && newProjects) {
      if (JSON.stringify(oldProjects) !== JSON.stringify(newProjects)) {
        affectedServices.add('server')
        affectedServices.add('worker')
      }
    }

    for (const service of affectedServices) {
      try {
        await this.restartComposeService(service)
        console.log(`Service ${service} restarted successfully`)
      } catch (error) {
        console.error(`Failed to restart service ${service}:`, error)
      }
    }
  }

  async restartComposeService(service: string): Promise<string> {
    try {
      await this.updateComposeFile()
      return new Promise((resolve, reject) => {
        exec(
          `docker-compose -f temp-docker-compose.yml restart ${service}`,
          { cwd: this.monorepoRoot },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`)
              reject(error)
              return
            }
            console.log(`stdout: ${stdout}`)
            console.error(`stderr: ${stderr}`)
            resolve('Docker Compose service restarted successfully')
          }
        )
      })
    } catch (error) {
      console.error('Failed to restart Docker Compose service:', error)
      throw error
    }
  }

  async startCompose(): Promise<string> {
    try {
      await this.updateComposeFile()
      return new Promise((resolve, reject) => {
        exec(
          'docker-compose -f temp-docker-compose.yml up -d',
          { cwd: this.monorepoRoot },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`)
              reject(error)
              return
            }
            console.log(`stdout: ${stdout}`)
            console.error(`stderr: ${stderr}`)
            resolve('Docker Compose started successfully')
          }
        )
      })
    } catch (error) {
      console.error('Failed to start Docker Compose:', error)
      throw error
    }
  }

  async stopCompose(): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(
        'docker-compose -f temp-docker-compose.yml down',
        { cwd: this.monorepoRoot },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`)
            reject(error)
            return
          }
          console.log(`stdout: ${stdout}`)
          console.error(`stderr: ${stderr}`)
          resolve('Docker Compose stopped successfully')
        }
      )
    })
  }

  private async updateComposeFile(): Promise<string> {
    try {
      if (!this.composeTemplateSource) {
        throw new Error('Template source is not initialized. Did you call initialize()?')
      }

      console.log('Compiling template...')
      const template = Handlebars.compile(this.composeTemplateSource)

      console.log('Applying template...')
      const config = await this.storageService.loadConfig()
      const projects = await this.storageService.loadProjects()
      const projectsObject = Object.fromEntries(
        projects.map((project) => [path.basename(project), project])
      )
      const updatedCompose = template({
        ...config,
        projects: projectsObject
      })

      console.log('Writing updated compose file...')
      await fs.writeFile(`${this.monorepoRoot}/temp-docker-compose.yml`, updatedCompose, 'utf8')

      return new Promise((resolve, reject) => {
        exec(
          'docker-compose -f temp-docker-compose.yml build',
          { cwd: this.monorepoRoot },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`)
              reject(error)
              return
            }
            console.log(`stdout: ${stdout}`)
            console.error(`stderr: ${stderr}`)
            resolve('docker-compose.yml updated successfully')
          }
        )
      })
    } catch (error) {
      console.error('Failed to update docker-compose.yml:', error)
      throw error
    }
  }
}
