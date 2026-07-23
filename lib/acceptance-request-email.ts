import { displayDate, siteUrl } from '@/lib/site-url'
import type { AcceptanceRequestNotificationPayload } from '@/lib/plantation-registration'

type ResendEmailSuccess = {
  id: string
}

function resendApiKey(): string {
  const value = process.env.RESEND_API_KEY?.trim()

  if (!value) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  return value
}

function resendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || 'plantsure@notifications.feedbacknfc.com'
}

function resendFromName(): string {
  return process.env.RESEND_FROM_NAME?.trim() || 'PlantSure'
}

function resendReplyToEmail(): string | null {
  return process.env.RESEND_REPLY_TO_EMAIL?.trim() || null
}

export async function sendAcceptanceRequestEmail(
  payload: AcceptanceRequestNotificationPayload,
): Promise<{ provider: 'resend'; providerMessageId: string }> {
  const reviewLink = siteUrl(`/sites/${payload.siteId}`)
  const from = `${resendFromName()} <${resendFromEmail()}>`
  const body = {
    from,
    to: [payload.recipientEmail],
    subject: payload.subject,
    text: acceptanceRequestText(payload, reviewLink),
    html: acceptanceRequestHtml(payload, reviewLink),
    reply_to: resendReplyToEmail() ?? undefined,
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await response.json()) as
    | ResendEmailSuccess
    | { message?: string; error?: string; name?: string }

  if (!response.ok || !('id' in json) || !json.id) {
    const message =
      ('message' in json && json.message) ||
      ('error' in json && json.error) ||
      'Resend email request failed'
    throw new Error(message)
  }

  return {
    provider: 'resend',
    providerMessageId: json.id,
  }
}

function acceptanceRequestText(
  payload: AcceptanceRequestNotificationPayload,
  reviewLink: string,
): string {
  const species = payload.speciesSummary
    .map((row) => `- ${row.speciesName}: ${row.plantedCount}`)
    .join('\n')

  return [
    `PlantSure approval request for ${payload.locationId}`,
    '',
    `Programme: ${payload.programName}`,
    `Site: ${payload.siteName}`,
    `Location ID: ${payload.locationId}`,
    `Planting date: ${displayDate(payload.plantingDate)}`,
    `Planted saplings: ${payload.plantedCount}`,
    '',
    'Species summary:',
    species,
    '',
    'Please review the planted baseline and confirm it from your owner account:',
    reviewLink,
  ].join('\n')
}

function acceptanceRequestHtml(
  payload: AcceptanceRequestNotificationPayload,
  reviewLink: string,
): string {
  const species = payload.speciesSummary
    .map(
      (row) =>
        `<li style="margin:0 0 6px"><strong>${escapeHtml(row.speciesName)}</strong>: ${row.plantedCount.toLocaleString()}</li>`,
    )
    .join('')

  return `
    <div style="font-family: Inter, Arial, sans-serif; color: #1b1816; line-height: 1.5">
      <p style="margin:0 0 12px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#8b847a">PlantSure approval request</p>
      <h1 style="margin:0 0 12px; font-size:28px; font-weight:600">${escapeHtml(payload.locationId)}</h1>
      <p style="margin:0 0 18px; font-size:16px">
        ${escapeHtml(payload.siteName)} was submitted for owner approval. Please confirm the planted saplings from your separate owner account.
      </p>
      <table style="border-collapse:collapse; margin:0 0 20px; width:100%">
        <tbody>
          <tr><td style="padding:6px 0; color:#6b665e">Programme</td><td style="padding:6px 0">${escapeHtml(payload.programName)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b665e">Site</td><td style="padding:6px 0">${escapeHtml(payload.siteName)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b665e">Location ID</td><td style="padding:6px 0">${escapeHtml(payload.locationId)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b665e">Planting date</td><td style="padding:6px 0">${escapeHtml(displayDate(payload.plantingDate))}</td></tr>
          <tr><td style="padding:6px 0; color:#6b665e">Planted saplings</td><td style="padding:6px 0">${payload.plantedCount.toLocaleString()}</td></tr>
        </tbody>
      </table>
      <div style="margin:0 0 20px">
        <p style="margin:0 0 8px; color:#6b665e">Species summary</p>
        <ul style="margin:0; padding-left:18px">${species}</ul>
      </div>
      <p style="margin:0 0 18px">
        <a href="${reviewLink}" style="display:inline-block; padding:12px 18px; background:#1b1816; color:#ffffff; text-decoration:none; border-radius:6px">
          Review and confirm plantation baseline
        </a>
      </p>
      <p style="margin:0; color:#6b665e; font-size:14px">${escapeHtml(reviewLink)}</p>
    </div>
  `
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
