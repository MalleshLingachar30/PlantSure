const STATE_CODE_PATTERN = /^[A-Z]{2}$/
const LOCATION_CODE_PATTERN = /^[A-Z]{3}$/
const MIN_SEQUENCE = 1
const MAX_SEQUENCE = 999999

export type LocationIdParts = {
  stateCode: string
  districtCode: string
  villageCode: string
  sequence: number
}

export type LocationIdPrefix = Omit<LocationIdParts, 'sequence'>

export function formatLocationId(parts: LocationIdParts): string {
  const stateCode = normalizeCode(parts.stateCode, 'stateCode')
  const districtCode = normalizeCode(parts.districtCode, 'districtCode')
  const villageCode = normalizeCode(parts.villageCode, 'villageCode')
  const sequence = normalizeSequence(parts.sequence)

  return `${stateCode}-${districtCode}-${villageCode}-${sequence.toString().padStart(6, '0')}`
}

export function nextLocationSequence(currentSequence: number): number {
  const sequence = normalizeSequence(currentSequence)

  if (sequence === MAX_SEQUENCE) {
    throw new Error('Location ID sequence exhausted')
  }

  return sequence + 1
}

export function buildLocationIds(prefix: LocationIdPrefix, startSequence: number, count: number): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be a positive integer')
  }

  const lastSequence = startSequence + count - 1
  normalizeSequence(startSequence)
  normalizeSequence(lastSequence)

  return Array.from({ length: count }, (_, index) =>
    formatLocationId({
      ...prefix,
      sequence: startSequence + index,
    }),
  )
}

function normalizeCode(value: string, label: keyof LocationIdPrefix): string {
  const code = value.trim().toUpperCase()
  const pattern = label === 'stateCode' ? STATE_CODE_PATTERN : LOCATION_CODE_PATTERN
  const description = label === 'stateCode' ? 'two-letter' : 'three-letter'

  if (!pattern.test(code)) {
    throw new Error(`${label} must be a ${description} uppercase code`)
  }

  return code
}

function normalizeSequence(sequence: number): number {
  if (!Number.isInteger(sequence) || sequence < MIN_SEQUENCE || sequence > MAX_SEQUENCE) {
    throw new Error('Location ID sequence must be an integer from 1 to 999999')
  }

  return sequence
}
