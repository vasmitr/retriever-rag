import React, { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'
import { ProjectList } from '@renderer/components/ProjectList'
import { ConfigForm } from '@renderer/components/ConfigForm'

declare global {
  interface Window {
    api: {
      getConfig: () => Promise<Record<string, unknown>>
      getProjects: () => Promise<string[]>
      startDockerCompose: () => Promise<string>
      stopDockerCompose: () => Promise<string>
      updateConfig: (config: any) => Promise<string>
      updateProjects: (projects: string[]) => Promise<string>
    }
  }
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<string[]>([])
  const [config, setConfig] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
    loadConfig()
  }, [])

  const loadProjects = async () => {
    const _projects = await window.api.getProjects()
    setProjects(_projects || [])
  }

  const loadConfig = async () => {
    const _config = await window.api.getConfig()
    setConfig(_config || {})
  }

  const handleProjectListChange = async (newProjects: string[]) => {
    setProjects(newProjects)
    try {
      await window.api.updateProjects(newProjects)
      console.log('Project links updated successfully')
    } catch (error) {
      console.error('Failed to update project links:', error)
      // Handle error (e.g., show an error message to the user)
    }
  }

  const handleAddProject = (projectPath: string) => {
    handleProjectListChange([...projects, projectPath])
    // TODO: Implement saving projects to storage
  }

  const handleRemoveProject = (projectPath: string) => {
    handleProjectListChange(projects.filter((p) => p !== projectPath))
    // TODO: Implement saving projects to storage
  }

  const handleConfigChange = (newConfig: typeof config) => {
    window.api.updateConfig(newConfig)
    setConfig(newConfig)
    // TODO: Implement saving config to storage
  }

  const handleStartDocker = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.startDockerCompose()
      console.log(result)
    } catch (error) {
      console.error('Failed to start Docker Compose:', error)
      setError('Failed to start Docker Compose. Please check the console for more details.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopDocker = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.stopDockerCompose()
      console.log(result)
    } catch (error) {
      console.error('Failed to stop Docker Compose:', error)
      setError('Failed to stop Docker Compose. Please check the console for more details.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Docker Compose Manager</h1>
      <ConfigForm config={config} onConfigChange={handleConfigChange} />
      <ProjectList
        projects={projects}
        onAddProject={handleAddProject}
        onRemoveProject={handleRemoveProject}
      />
      <div className="mt-4">
        <Button onClick={handleStartDocker} className="mr-2" disabled={isLoading}>
          {isLoading ? 'Starting...' : 'Start Docker Compose'}
        </Button>
        <Button onClick={handleStopDocker} variant="destructive" disabled={isLoading}>
          {isLoading ? 'Stopping...' : 'Stop Docker Compose'}
        </Button>
      </div>
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </div>
  )
}

export default App
