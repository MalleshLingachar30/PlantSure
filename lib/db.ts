import { Client } from 'pg'

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export async function withDatabase<TResult>(
  run: (client: Client) => Promise<TResult>,
): Promise<TResult> {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    return await run(client)
  } finally {
    await client.end()
  }
}
