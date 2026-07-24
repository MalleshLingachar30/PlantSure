'use client'

import { useEffect } from 'react'

export function PwaServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // PWA installation still works as a normal web app if registration fails.
      })
    })
  }, [])

  return null
}
