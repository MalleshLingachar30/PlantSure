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
  return (
    <form action={`/sites/${siteId}/checks`} method="post" className="grid gap-5">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="windowId" value={window.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {locationId && <input type="hidden" name="locationId" value={locationId} />}

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

      <label className="field">
        <span>Photo URLs</span>
        <textarea
          name="auditPhotoUrls"
          rows={3}
          className="input resize-none"
          placeholder="One photo URL per line"
          required
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Checked at</span>
          <input
            className="input"
            name="auditedAt"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
            required
          />
        </label>
        <label className="field">
          <span>GPS status</span>
          <select className="input" name="gpsStatus" defaultValue="confirmed" required>
            <option value="confirmed">Confirmed</option>
            <option value="plausible">Plausible</option>
            <option value="questionable">Questionable</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label className="field">
          <span>Latitude</span>
          <input
            className="input"
            name="auditLatitude"
            type="number"
            min="-90"
            max="90"
            step="0.000001"
            inputMode="decimal"
          />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input
            className="input"
            name="auditLongitude"
            type="number"
            min="-180"
            max="180"
            step="0.000001"
            inputMode="decimal"
          />
        </label>
        <label className="field">
          <span>GPS accuracy (m)</span>
          <input
            className="input"
            name="auditGpsAccuracy"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
          />
        </label>
      </div>

      <label className="field">
        <span>Remarks</span>
        <textarea name="remarks" rows={3} className="input resize-none" />
      </label>

      <button className="command-button justify-self-start" type="submit">
        Record QR check
      </button>
    </form>
  )
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
