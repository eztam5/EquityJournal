import { useState, useEffect } from 'react'
import { Button, Card, FormGroup, InputGroup, Dialog } from '@blueprintjs/core'

interface DatabaseConfig {
  path: string
}

export function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<DatabaseConfig>({ path: '' })
  const [defaultConfig, setDefaultConfig] = useState<DatabaseConfig | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<DatabaseConfig>('get_database_config').then(setDefaultConfig).then(() => {
          invoke<DatabaseConfig>('get_database_config').then(setConfig)
        })
      })
    }
  }, [isOpen])

  const handleSave = async () => {
    if (!defaultConfig) return
    setIsSaving(true)
    try {
      if (config.path !== defaultConfig.path) {
        // Path changed, ask what to do
        const shouldCopy = confirm(
          `Database path changed from:\n${defaultConfig.path}\n\nto:\n${config.path}\n\nWould you like to copy the existing database to the new location?\n\n(Cancel will start with an empty database)`
        )
        if ('__TAURI_INTERNALS__' in window) {
          await import('@tauri-apps/api/core').then(({ invoke }) =>
            invoke('change_database_path', { newPath: config.path, copyExisting: shouldCopy })
          )
        }
      } else {
        if ('__TAURI_INTERNALS__' in window) {
          await import('@tauri-apps/api/core').then(({ invoke }) =>
            invoke('save_database_config', { config })
          )
        }
      }
      onClose()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Settings" style={{ width: '500px' }}>
      <div style={{ padding: '20px' }}>
        <Card style={{ marginBottom: '16px' }}>
          <h3>Database</h3>
          <FormGroup label="Database Path" labelFor="db-path">
            <InputGroup
              id="db-path"
              value={config.path}
              onChange={(e) => setConfig({ ...config, path: e.currentTarget.value })}
              placeholder={defaultConfig?.path || '/path/to/database.db'}
            />
          </FormGroup>
        </Card>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button intent="primary" onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
