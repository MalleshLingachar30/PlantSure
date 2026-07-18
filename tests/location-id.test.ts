import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLocationIds, formatLocationId, nextLocationSequence } from '../lib/location-id'

test('formats Location IDs with uppercase three-letter codes and a six-digit sequence', () => {
  assert.equal(
    formatLocationId({
      stateCode: 'ka',
      districtCode: 'tmk',
      villageCode: 'gub',
      sequence: 123,
    }),
    'KA-TMK-GUB-000123',
  )
})

test('increments Location ID sequences without skipping or reusing numbers', () => {
  assert.equal(nextLocationSequence(1), 2)
  assert.equal(nextLocationSequence(123), 124)
  assert.equal(nextLocationSequence(999998), 999999)
  assert.throws(() => nextLocationSequence(999999), /sequence exhausted/)
})

test('generates unique Location IDs for a locked prefix sequence range', () => {
  const ids = buildLocationIds(
    {
      stateCode: 'KA',
      districtCode: 'TMK',
      villageCode: 'GUB',
    },
    123,
    20,
  )

  assert.equal(ids.length, 20)
  assert.equal(new Set(ids).size, 20)
  assert.equal(ids.at(0), 'KA-TMK-GUB-000123')
  assert.equal(ids.at(-1), 'KA-TMK-GUB-000142')
})
