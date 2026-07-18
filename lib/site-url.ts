export function siteUrl(path = ''): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://plantsure-kappa.vercel.app'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return new URL(normalizedPath, baseUrl).toString()
}

export function displayDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
