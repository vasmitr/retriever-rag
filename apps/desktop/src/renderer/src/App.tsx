import { Button } from '@renderer/components/ui/button'

function App(): JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <>
      <Button target="_blank" rel="noreferrer" onClick={ipcHandle}>
        Send IPC
      </Button>
    </>
  )
}

export default App
