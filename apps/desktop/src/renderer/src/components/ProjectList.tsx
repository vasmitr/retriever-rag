import React, { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

export const ProjectList = ({ projects, onAddProject, onRemoveProject }) => {
  const [newProject, setNewProject] = useState('')

  const handleAddProject = () => {
    if (newProject) {
      onAddProject(newProject)
      setNewProject('')
    }
  }

  return (
    <div className="mt-4">
      <h2 className="text-xl font-semibold mb-2">Projects</h2>
      <ul>
        {projects.map((project, index) => (
          <li key={index} className="flex justify-between items-center mb-2">
            <span>{project}</span>
            <Button onClick={() => onRemoveProject(project)} variant="destructive" size="sm">
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex mt-2">
        <Input
          type="text"
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          placeholder="Enter project path"
          className="mr-2"
        />
        <Button onClick={handleAddProject}>Add Project</Button>
      </div>
    </div>
  )
}
