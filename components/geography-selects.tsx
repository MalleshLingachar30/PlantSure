'use client'

import { useMemo, useState } from 'react'
import {
  DEFAULT_KARNATAKA_GEOGRAPHY_KEY,
  locationPrefixForGeography,
  type KarnatakaGeography,
} from '@/lib/karnataka-geography'

type GeographySelectsProps = {
  disabled?: boolean
  options: readonly KarnatakaGeography[]
}

export function GeographySelects({ disabled = false, options }: GeographySelectsProps) {
  const fallbackKey = options[0]?.key ?? DEFAULT_KARNATAKA_GEOGRAPHY_KEY
  const [selectedKey, setSelectedKey] = useState(fallbackKey)
  const selected = options.find((option) => option.key === selectedKey) ?? options[0]

  const districts = useMemo(() => {
    return uniqueBy(options, (option) => option.districtCode)
  }, [options])
  const taluks = useMemo(() => {
    return uniqueBy(
      options.filter((option) => option.districtCode === selected?.districtCode),
      (option) => `${option.districtCode}:${option.taluk}`,
    )
  }, [options, selected?.districtCode])

  if (!selected) {
    return null
  }

  return (
    <div className="form-grid sm:col-span-2">
      <input type="hidden" name="geographyKey" value={selected.key} />

      <label className="field">
        <span>District</span>
        <select
          className="input"
          value={selected.districtCode}
          disabled={disabled}
          onChange={(event) => {
            const next = options.find(
              (option) => option.districtCode === event.target.value,
            )

            if (next) {
              setSelectedKey(next.key)
            }
          }}
        >
          {districts.map((district) => (
            <option key={district.districtCode} value={district.districtCode}>
              {district.district}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Taluk</span>
        <select
          className="input"
          value={`${selected.districtCode}:${selected.taluk}`}
          disabled={disabled}
          onChange={(event) => {
            const [districtCode, taluk] = event.target.value.split(':')
            const next = options.find(
              (option) =>
                option.districtCode === districtCode &&
                option.taluk === taluk,
            )

            if (next) {
              setSelectedKey(next.key)
            }
          }}
        >
          {taluks.map((taluk) => (
            <option
              key={`${taluk.districtCode}:${taluk.taluk}`}
              value={`${taluk.districtCode}:${taluk.taluk}`}
            >
              {taluk.taluk}
            </option>
          ))}
        </select>
      </label>

      <div className="derived-location sm:col-span-2" aria-live="polite">
        <span className="eyebrow">Location prefix</span>
        <strong>{locationPrefixForGeography(selected)}</strong>
        <span>
          Codes are derived from the selected district and taluk.
        </span>
      </div>
    </div>
  )
}

function uniqueBy<T>(items: readonly T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>()
  const unique: T[] = []

  for (const item of items) {
    const key = keyFor(item)

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  return unique
}
