'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Smartphone, Wifi, WifiOff } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function AuditorPwaPanel() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [online, setOnline] = useState(true)
  const [installState, setInstallState] = useState<'idle' | 'installing' | 'dismissed'>('idle')

  useEffect(() => {
    setOnline(navigator.onLine)
    setInstalled(isStandalone())

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setInstalled(true)
      setInstallPrompt(null)
      setInstallState('idle')
    }

    function handleOnline() {
      setOnline(true)
    }

    function handleOffline() {
      setOnline(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const platformText = useMemo(() => {
    if (installed) {
      return 'Installed'
    }

    if (installPrompt) {
      return 'Ready to install'
    }

    return 'Use browser menu'
  }, [installPrompt, installed])

  async function installApp() {
    if (!installPrompt) {
      return
    }

    setInstallState('installing')
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setInstalled(true)
      setInstallPrompt(null)
      setInstallState('idle')
      return
    }

    setInstallState('dismissed')
  }

  return (
    <section className="pwa-panel mt-7" aria-labelledby="pwa-panel-heading">
      <div className="pwa-panel-main">
        <span className="pwa-panel-icon">
          <Smartphone size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Field app</p>
          <h2 id="pwa-panel-heading" className="section-title mt-1">
            Phone-ready auditor console
          </h2>
        </div>
      </div>

      <dl className="pwa-status-grid">
        <div>
          <dt>Connection</dt>
          <dd data-state={online ? 'ready' : 'blocked'}>
            {online ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
            <span>{online ? 'Online' : 'Offline'}</span>
          </dd>
        </div>
        <div>
          <dt>Install</dt>
          <dd data-state={installed || installPrompt ? 'ready' : 'waiting'}>
            <Smartphone size={14} aria-hidden="true" />
            <span>{platformText}</span>
          </dd>
        </div>
      </dl>

      <div className="pwa-actions">
        {installPrompt && !installed ? (
          <button
            className="command-button"
            type="button"
            onClick={installApp}
            disabled={installState === 'installing'}
          >
            <Download size={16} aria-hidden="true" />
            <span>{installState === 'installing' ? 'Installing...' : 'Install app'}</span>
          </button>
        ) : (
          <div className="pwa-ios-note">
            <p>
              On iPhone, open Share and choose Add to Home Screen. On Android,
              use the browser Install app option if no button appears here.
            </p>
          </div>
        )}
        {installState === 'dismissed' && (
          <p className="pwa-inline-status">Install was dismissed. Use the browser menu to install later.</p>
        )}
      </div>
    </section>
  )
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)
  )
}
