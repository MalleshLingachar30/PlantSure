import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getKarnatakaGeographyByKey,
  KARNATAKA_GEOGRAPHIES,
  locationPrefixForGeography,
} from '../lib/karnataka-geography'

test('Gubbi is seeded under Tumakuru, not Bengaluru Rural', () => {
  const geography = getKarnatakaGeographyByKey('ka-tmk-gub')

  assert.ok(geography)
  assert.equal(geography.district, 'Tumakuru')
  assert.equal(geography.taluk, 'Gubbi')
  assert.equal(geography.village, 'Gubbi')
  assert.equal(locationPrefixForGeography(geography), 'KA-TMK-GUB')
})

test('seeded geography does not offer the impossible Bengaluru Rural and Gubbi prefix', () => {
  const prefixes = KARNATAKA_GEOGRAPHIES.map(locationPrefixForGeography)

  assert.equal(prefixes.includes('KA-BNR-GUB'), false)
})

test('each seeded geography has one stable Location ID prefix', () => {
  const prefixes = KARNATAKA_GEOGRAPHIES.map(locationPrefixForGeography)
  const uniquePrefixes = new Set(prefixes)

  assert.equal(uniquePrefixes.size, prefixes.length)
})
