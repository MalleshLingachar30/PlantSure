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
  assert.equal(locationPrefixForGeography(geography), 'KA-TMK-GUB')
})

test('seeded geography does not offer the impossible Bengaluru Rural and Gubbi prefix', () => {
  const prefixes = KARNATAKA_GEOGRAPHIES.map(locationPrefixForGeography)

  assert.equal(prefixes.includes('KA-BNR-GUB'), false)
})

test('Karnataka geography seed includes all districts and taluks from the source table', () => {
  const districts = new Set(KARNATAKA_GEOGRAPHIES.map((geography) => geography.district))

  assert.equal(districts.size, 31)
  assert.equal(KARNATAKA_GEOGRAPHIES.length, 239)
})

test('each seeded geography has one stable Location ID prefix', () => {
  const prefixes = KARNATAKA_GEOGRAPHIES.map(locationPrefixForGeography)
  const uniquePrefixes = new Set(prefixes)

  assert.equal(uniquePrefixes.size, prefixes.length)
})
