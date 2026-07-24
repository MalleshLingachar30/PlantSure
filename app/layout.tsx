import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from 'next/font/google'
import { PwaServiceWorker } from '@/components/pwa-service-worker'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  applicationName: 'PlantSure Field',
  title: {
    default: 'PlantSure',
    template: '%s · PlantSure',
  },
  description: 'Plantation monitoring that records missed checks.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'PlantSure',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#3b6d11',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${serif.variable} ${mono.variable}`}
    >
      <body>
        <ClerkProvider dynamic>{children}</ClerkProvider>
        <PwaServiceWorker />
      </body>
    </html>
  )
}
