export type KarnatakaGeography = {
  key: string
  state: string
  stateCode: 'KA'
  district: string
  districtCode: string
  taluk: string
  village: string
  villageCode: string
}

export const DEFAULT_KARNATAKA_GEOGRAPHY_KEY = 'KA-TMK-GUB'

export const KARNATAKA_GEOGRAPHIES: readonly KarnatakaGeography[] = [
  {
    key: 'KA-TMK-GUB',
    state: 'Karnataka',
    stateCode: 'KA',
    district: 'Tumakuru',
    districtCode: 'TMK',
    taluk: 'Gubbi',
    village: 'Gubbi',
    villageCode: 'GUB',
  },
  {
    key: 'KA-BNR-DVN',
    state: 'Karnataka',
    stateCode: 'KA',
    district: 'Bengaluru Rural',
    districtCode: 'BNR',
    taluk: 'Devanahalli',
    village: 'Devanahalli',
    villageCode: 'DVN',
  },
  {
    key: 'KA-BNR-DBP',
    state: 'Karnataka',
    stateCode: 'KA',
    district: 'Bengaluru Rural',
    districtCode: 'BNR',
    taluk: 'Doddaballapura',
    village: 'Doddaballapura',
    villageCode: 'DBP',
  },
  {
    key: 'KA-BNR-HKT',
    state: 'Karnataka',
    stateCode: 'KA',
    district: 'Bengaluru Rural',
    districtCode: 'BNR',
    taluk: 'Hoskote',
    village: 'Hoskote',
    villageCode: 'HKT',
  },
  {
    key: 'KA-BNR-NLM',
    state: 'Karnataka',
    stateCode: 'KA',
    district: 'Bengaluru Rural',
    districtCode: 'BNR',
    taluk: 'Nelamangala',
    village: 'Nelamangala',
    villageCode: 'NLM',
  },
]

export function getKarnatakaGeographyByKey(key: string): KarnatakaGeography | null {
  const normalizedKey = key.trim().toUpperCase()

  return KARNATAKA_GEOGRAPHIES.find((geography) => geography.key === normalizedKey) ?? null
}

export function locationPrefixForGeography(geography: KarnatakaGeography): string {
  return `${geography.stateCode}-${geography.districtCode}-${geography.villageCode}`
}
