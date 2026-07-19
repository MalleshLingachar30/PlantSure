'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { LandOwnership, PlantationType } from '@/lib/plantation-registration'

type SpeciesRow = {
  id: string
  name: string
  count: string
  placement: string
}

type BoundaryRow = {
  id: string
  latitude: string
  longitude: string
}

type RegistrationDetailsProps = {
  disabled?: boolean
}

const initialSpecies: SpeciesRow[] = [
  { id: 'species-1', name: 'Mixed native', count: '600', placement: '' },
  { id: 'species-2', name: '', count: '', placement: '' },
  { id: 'species-3', name: '', count: '', placement: '' },
  { id: 'species-4', name: '', count: '', placement: '' },
  { id: 'species-5', name: '', count: '', placement: '' },
]

const initialBoundary: BoundaryRow[] = [
  { id: 'boundary-1', latitude: '', longitude: '' },
  { id: 'boundary-2', latitude: '', longitude: '' },
  { id: 'boundary-3', latitude: '', longitude: '' },
  { id: 'boundary-4', latitude: '', longitude: '' },
]

export function RegistrationDetails({ disabled = false }: RegistrationDetailsProps) {
  const [landOwnership, setLandOwnership] = useState<LandOwnership>('institutional')
  const [plantationType, setPlantationType] = useState<PlantationType>('block')
  const [speciesRows, setSpeciesRows] = useState(initialSpecies)
  const [boundaryRows, setBoundaryRows] = useState(initialBoundary)

  const plantedTotal = useMemo(() => {
    return speciesRows.reduce((total, row) => {
      const count = Number(row.count)

      return Number.isFinite(count) ? total + count : total
    }, 0)
  }, [speciesRows])

  return (
    <>
      <fieldset className="form-grid" disabled={disabled}>
        <legend className="form-legend">Land</legend>

        <label className="field">
          <span>Ownership</span>
          <select
            className="input"
            name="landOwnership"
            value={landOwnership}
            onChange={(event) => setLandOwnership(event.target.value as LandOwnership)}
            disabled={disabled}
            required
          >
            <option value="government">Government</option>
            <option value="private">Private</option>
            <option value="institutional">Institutional</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="field">
          <span>Planting type</span>
          <select
            className="input"
            name="plantationType"
            value={plantationType}
            onChange={(event) => setPlantationType(event.target.value as PlantationType)}
            disabled={disabled}
            required
          >
            <option value="block">Block</option>
            <option value="bund_only">Bund only</option>
            <option value="bund_and_block">Bund and block</option>
          </select>
        </label>

        <label className="field">
          <span>Land custodian</span>
          <input className="input" name="landCustodian" disabled={disabled} />
        </label>

        <label className="field">
          <span>Approval reference</span>
          <input className="input" name="approvalReference" disabled={disabled} />
        </label>

        <label className="check-field">
          <input type="checkbox" name="isSharedParcel" disabled={disabled} defaultChecked />
          <span>Shared parcel</span>
        </label>

        <label className="check-field">
          <input type="checkbox" name="watchAndWard" disabled={disabled} />
          <span>Watch and ward assigned</span>
        </label>
      </fieldset>

      <fieldset className="grid gap-4" disabled={disabled}>
        <legend className="form-legend">Species</legend>
        <div className="form-section-line">
          <output className="derived-total" aria-live="polite">
            <span className="eyebrow">Total</span>
            <strong>{plantedTotal.toLocaleString()}</strong>
          </output>
        </div>

        <div className="repeat-list">
          {speciesRows.map((row, index) => (
            <div className="repeat-row species-repeat-row" key={row.id}>
              <label className="field">
                <span>Species {index + 1}</span>
                <input
                  className="input"
                  name="speciesName"
                  value={row.name}
                  onChange={(event) => updateSpecies(row.id, { name: event.target.value })}
                  disabled={disabled}
                  required={index === 0}
                />
              </label>
              <label className="field">
                <span>Quantity</span>
                <input
                  className="input"
                  name="speciesCount"
                  type="number"
                  min={1}
                  value={row.count}
                  onChange={(event) => updateSpecies(row.id, { count: event.target.value })}
                  disabled={disabled}
                  required={index === 0}
                />
              </label>
              <label className="field">
                <span>Placement</span>
                <input
                  className="input"
                  name="speciesPlacement"
                  value={row.placement}
                  onChange={(event) => updateSpecies(row.id, { placement: event.target.value })}
                  disabled={disabled}
                />
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove species row ${index + 1}`}
                title={`Remove species row ${index + 1}`}
                disabled={disabled || speciesRows.length === 1}
                onClick={() => setSpeciesRows((rows) => rows.filter((item) => item.id !== row.id))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <button
          className="secondary-button justify-self-start"
          type="button"
          disabled={disabled}
          onClick={() =>
            setSpeciesRows((rows) => [
              ...rows,
              { id: crypto.randomUUID(), name: '', count: '', placement: '' },
            ])
          }
        >
          <Plus size={16} aria-hidden="true" />
          Add species
        </button>
      </fieldset>

      <fieldset className="grid gap-4" disabled={disabled}>
        <legend className="form-legend">Boundary</legend>
        <div className="form-section-line">
          <p className="field-hint">Enter at least three walked corner points.</p>
        </div>

        <div className="repeat-list">
          {boundaryRows.map((row, index) => (
            <div className="repeat-row boundary-repeat-row" key={row.id}>
              <span className="repeat-index tnum">{index + 1}</span>
              <label className="field">
                <span>Latitude</span>
                <input
                  className="input"
                  name="boundaryLatitude"
                  inputMode="decimal"
                  value={row.latitude}
                  onChange={(event) => updateBoundary(row.id, { latitude: event.target.value })}
                  disabled={disabled}
                  required={index < 3}
                />
              </label>
              <label className="field">
                <span>Longitude</span>
                <input
                  className="input"
                  name="boundaryLongitude"
                  inputMode="decimal"
                  value={row.longitude}
                  onChange={(event) => updateBoundary(row.id, { longitude: event.target.value })}
                  disabled={disabled}
                  required={index < 3}
                />
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove boundary point ${index + 1}`}
                title={`Remove boundary point ${index + 1}`}
                disabled={disabled || boundaryRows.length <= 3}
                onClick={() => setBoundaryRows((rows) => rows.filter((item) => item.id !== row.id))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <button
          className="secondary-button justify-self-start"
          type="button"
          disabled={disabled}
          onClick={() =>
            setBoundaryRows((rows) => [
              ...rows,
              { id: crypto.randomUUID(), latitude: '', longitude: '' },
            ])
          }
        >
          <Plus size={16} aria-hidden="true" />
          Add point
        </button>
      </fieldset>
    </>
  )

  function updateSpecies(id: string, patch: Partial<SpeciesRow>) {
    setSpeciesRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }

  function updateBoundary(id: string, patch: Partial<BoundaryRow>) {
    setBoundaryRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }
}
