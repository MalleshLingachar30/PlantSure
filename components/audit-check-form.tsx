'use client'

import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera, Crosshair, RefreshCcw } from 'lucide-react'
import type { AdminAuditWindow, AdminBatchSpecies } from '@/lib/admin-data'

type AuditCheckFormProps = {
  siteId: string
  species: AdminBatchSpecies[]
  window: AdminAuditWindow
  returnTo: 'console' | 'public'
  locationId?: string
}

export function AuditCheckForm({
  siteId,
  species,
  window,
  returnTo,
  locationId,
}: AuditCheckFormProps) {
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoSelected, setPhotoSelected] = useState(false)
  const [gpsState, setGpsState] = useState<{
    status: 'idle' | 'capturing' | 'captured' | 'error'
    latitude: string
    longitude: string
    accuracy: string
    message: string
  }>({
    status: 'idle',
    latitude: '',
    longitude: '',
    accuracy: '',
    message: 'Capture current coordinates at the plantation before submitting.',
  })
  const auditedAt = useMemo(() => localDateTimeValue(new Date()), [])
  const readyForSubmit = Boolean((photoDataUrl || photoSelected) && gpsState.latitude && gpsState.longitude)

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setPhotoError('')

    if (!file) {
      setPhotoDataUrl('')
      setPhotoName('')
      setPhotoSelected(false)
      return
    }

    setPhotoSelected(true)

    if (!file.type.startsWith('image/')) {
      setPhotoError('Use the phone camera to capture an image.')
      setPhotoDataUrl('')
      setPhotoName('')
      setPhotoSelected(false)
      return
    }

    try {
      const compressed = await compressImage(file)
      setPhotoDataUrl(compressed)
      setPhotoName(file.name || 'Captured field photo')
    } catch {
      setPhotoError('Preview is unavailable, but the captured photo can still be submitted.')
      setPhotoDataUrl('')
      setPhotoName(file.name || 'Captured field photo')
    }
  }

  function captureLocation() {
    if (!('geolocation' in navigator)) {
      setGpsState({
        status: 'error',
        latitude: '',
        longitude: '',
        accuracy: '',
        message: 'GPS is not available on this device.',
      })
      return
    }

    setGpsState((current) => ({
      ...current,
      status: 'capturing',
      message: 'Requesting GPS permission and current coordinates...',
    }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsState({
          status: 'captured',
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          accuracy: position.coords.accuracy.toFixed(2),
          message: 'Coordinates captured from this device.',
        })
      },
      () => {
        setGpsState({
          status: 'error',
          latitude: '',
          longitude: '',
          accuracy: '',
          message: 'GPS permission was denied or coordinates were unavailable.',
        })
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    )
  }

  return (
    <form action={`/sites/${siteId}/checks`} method="post" className="grid gap-5">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="windowId" value={window.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {locationId && <input type="hidden" name="locationId" value={locationId} />}
      <input type="hidden" name="auditPhotoUrls" value={photoDataUrl} />
      <input type="hidden" name="auditedAt" value={auditedAt} />
      <input type="hidden" name="auditLatitude" value={gpsState.latitude} />
      <input type="hidden" name="auditLongitude" value={gpsState.longitude} />
      <input type="hidden" name="auditGpsAccuracy" value={gpsState.accuracy} />
      <input type="hidden" name="gpsStatus" value={gpsState.status === 'captured' ? 'confirmed' : 'unavailable'} />

      <div className="form-section-line">
        <div>
          <p className="eyebrow">Open window</p>
          <h3 className="section-title mt-1">
            {window.cycleLabel}: due {window.dueDate}
          </h3>
        </div>
        <span className="public-status-pill">{statusText(window.status)}</span>
      </div>

      <div className="repeat-list">
        {species.map((row) => (
          <div key={row.speciesName} className="repeat-row audit-species-row">
            <input type="hidden" name="auditSpeciesName" value={row.speciesName} />
            <div>
              <p className="font-medium">{row.speciesName}</p>
              <p className="body-copy text-[13px]">
                Baseline {row.plantedCount.toLocaleString()}
              </p>
            </div>
            <label className="field">
              <span>Alive now</span>
              <input
                className="input"
                name="auditSurvivingCount"
                type="number"
                min={0}
                max={row.plantedCount}
                required
              />
            </label>
          </div>
        ))}
      </div>

      <section className="field-capture-grid" aria-label="Field evidence capture">
        <div className="field-capture-card">
          <div className="form-section-line">
            <div>
              <p className="eyebrow">Live photo</p>
              <h3 className="section-title mt-1">Capture plantation evidence</h3>
            </div>
            <Camera size={22} aria-hidden="true" style={{ color: 'var(--alive)' }} />
          </div>

          <label className="capture-photo-input mt-4">
            <Camera size={17} aria-hidden="true" />
            <span>{photoDataUrl ? 'Retake photo' : 'Take live photo'}</span>
            <input
              name="auditPhotoFile"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              required={!photoDataUrl}
            />
          </label>

          {photoDataUrl ? (
            <figure className="capture-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl} alt="Captured audit evidence preview" />
              <figcaption>{photoName || 'Field photo captured'}</figcaption>
            </figure>
          ) : (
            <p className="capture-status mt-3">
              A live field photo is required before the audit can be submitted.
            </p>
          )}

          {photoError && <p className="capture-error mt-3">{photoError}</p>}
        </div>

        <div className="field-capture-card">
          <div className="form-section-line">
            <div>
              <p className="eyebrow">Coordinates</p>
              <h3 className="section-title mt-1">Capture device GPS</h3>
            </div>
            <Crosshair size={22} aria-hidden="true" style={{ color: 'var(--alive)' }} />
          </div>

          <button
            className="secondary-button mt-4"
            type="button"
            onClick={captureLocation}
            disabled={gpsState.status === 'capturing'}
          >
            {gpsState.status === 'capturing' ? (
              <RefreshCcw size={16} aria-hidden="true" />
            ) : (
              <Crosshair size={16} aria-hidden="true" />
            )}
            <span>{gpsState.status === 'captured' ? 'Refresh GPS' : 'Capture GPS'}</span>
          </button>

          <p
            className={gpsState.status === 'error' ? 'capture-error mt-3' : 'capture-status mt-3'}
            role={gpsState.status === 'error' ? 'alert' : 'status'}
          >
            {gpsState.message}
          </p>

          {gpsState.status === 'captured' && (
            <dl className="capture-facts mt-4">
              <div>
                <dt>Latitude</dt>
                <dd>{gpsState.latitude}</dd>
              </div>
              <div>
                <dt>Longitude</dt>
                <dd>{gpsState.longitude}</dd>
              </div>
              <div>
                <dt>Accuracy</dt>
                <dd>{gpsState.accuracy}m</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <label className="field">
        <span>Remarks</span>
        <textarea name="remarks" rows={3} className="input resize-none" />
      </label>

      <button className="command-button justify-self-start" type="submit" disabled={!readyForSubmit}>
        {readyForSubmit ? 'Record QR check' : 'Complete photo and GPS first'}
      </button>
    </form>
  )
}

function localDateTimeValue(value: Date): string {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  const hours = `${value.getHours()}`.padStart(2, '0')
  const minutes = `${value.getMinutes()}`.padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

async function compressImage(file: File): Promise<string> {
  const image = await loadImage(file)
  const maxSide = 1280
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas is unavailable')
  }

  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', 0.78)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image could not be loaded'))
    }
    image.src = url
  })
}

function statusText(status: string): string {
  if (status === 'completed') {
    return 'Checked'
  }

  if (status === 'missed') {
    return 'Missed'
  }

  if (status === 'waived') {
    return 'Waived'
  }

  return 'Scheduled'
}
