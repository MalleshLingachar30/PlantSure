export type KarnatakaTaluk = {
  name: string
  code: string
}

export type KarnatakaDistrict = {
  name: string
  code: string
  taluks: readonly KarnatakaTaluk[]
}

export type KarnatakaGeography = {
  key: string
  state: string
  stateCode: 'KA'
  district: string
  districtCode: string
  taluk: string
  talukCode: string
}

export const DEFAULT_KARNATAKA_GEOGRAPHY_KEY = 'KA-TMK-GUB'

export const KARNATAKA_DISTRICTS = [
  {
    "name": "Bagalkote",
    "code": "BAG",
    "taluks": [
      {
        "name": "Bagalkote",
        "code": "BAG"
      },
      {
        "name": "Jamkhandi",
        "code": "JAM"
      },
      {
        "name": "Mudhola",
        "code": "MUD"
      },
      {
        "name": "Badami",
        "code": "BAD"
      },
      {
        "name": "Bilagi",
        "code": "BIL"
      },
      {
        "name": "Hunagunda",
        "code": "HUN"
      },
      {
        "name": "Ilkal",
        "code": "ILK"
      },
      {
        "name": "Rabkavi Banhatti",
        "code": "RBA"
      },
      {
        "name": "Guledgudda",
        "code": "GUL"
      }
    ]
  },
  {
    "name": "Ballari",
    "code": "BAL",
    "taluks": [
      {
        "name": "Ballari",
        "code": "BAL"
      },
      {
        "name": "Kurugodu",
        "code": "KUR"
      },
      {
        "name": "Kampli",
        "code": "KAM"
      },
      {
        "name": "Sanduru",
        "code": "SAN"
      },
      {
        "name": "Siraguppa",
        "code": "SIR"
      }
    ]
  },
  {
    "name": "Belagavi",
    "code": "BLG",
    "taluks": [
      {
        "name": "Belagavi",
        "code": "BEL"
      },
      {
        "name": "Athani",
        "code": "ATH"
      },
      {
        "name": "Bailhongal",
        "code": "BAI"
      },
      {
        "name": "Chikkodi",
        "code": "CHI"
      },
      {
        "name": "Gokak",
        "code": "GOK"
      },
      {
        "name": "Khanapura",
        "code": "KHA"
      },
      {
        "name": "Mudalgi",
        "code": "MUD"
      },
      {
        "name": "Nippani",
        "code": "NIP"
      },
      {
        "name": "Rayabaga",
        "code": "RAY"
      },
      {
        "name": "Savadatti",
        "code": "SAV"
      },
      {
        "name": "Ramadurga",
        "code": "RAM"
      },
      {
        "name": "Kagawada",
        "code": "KAG"
      },
      {
        "name": "Hukkeri",
        "code": "HUK"
      },
      {
        "name": "Kitturu",
        "code": "KIT"
      },
      {
        "name": "Yargatti",
        "code": "YAR"
      }
    ]
  },
  {
    "name": "Bengaluru Urban",
    "code": "BNU",
    "taluks": [
      {
        "name": "Bengaluru",
        "code": "BEN"
      },
      {
        "name": "Kengeri",
        "code": "KEN"
      },
      {
        "name": "Krishnarajapura",
        "code": "KRI"
      },
      {
        "name": "Anekal",
        "code": "ANE"
      },
      {
        "name": "Yelahanka",
        "code": "YEL"
      }
    ]
  },
  {
    "name": "Bengaluru Rural",
    "code": "BNR",
    "taluks": [
      {
        "name": "Nelamangala",
        "code": "NLM"
      },
      {
        "name": "Doddaballapura",
        "code": "DBP"
      },
      {
        "name": "Devanahalli",
        "code": "DVN"
      },
      {
        "name": "Hosakote",
        "code": "HKT"
      }
    ]
  },
  {
    "name": "Bidar",
    "code": "BID",
    "taluks": [
      {
        "name": "Aurad",
        "code": "AUR"
      },
      {
        "name": "Basavakalyana",
        "code": "BAS"
      },
      {
        "name": "Bhalki",
        "code": "BHA"
      },
      {
        "name": "Bidar",
        "code": "BID"
      },
      {
        "name": "Chitgoppa",
        "code": "CHI"
      },
      {
        "name": "Hulsuru",
        "code": "HUL"
      },
      {
        "name": "Humnabad",
        "code": "HUM"
      },
      {
        "name": "Kamalanagara",
        "code": "KAM"
      }
    ]
  },
  {
    "name": "Chamarajanagara",
    "code": "CMR",
    "taluks": [
      {
        "name": "Chamarajanagara",
        "code": "CHA"
      },
      {
        "name": "Gundlupete",
        "code": "GUN"
      },
      {
        "name": "Kollegala",
        "code": "KOL"
      },
      {
        "name": "Yelanduru",
        "code": "YEL"
      },
      {
        "name": "Hanuru",
        "code": "HAN"
      }
    ]
  },
  {
    "name": "Chikkaballapura",
    "code": "CKB",
    "taluks": [
      {
        "name": "Chikkaballapura",
        "code": "CHI"
      },
      {
        "name": "Bagepalli",
        "code": "BAG"
      },
      {
        "name": "Chintamani",
        "code": "CII"
      },
      {
        "name": "Gauribidanuru",
        "code": "GAU"
      },
      {
        "name": "Gudibanda",
        "code": "GUD"
      },
      {
        "name": "Sidlaghatta",
        "code": "SID"
      },
      {
        "name": "Cheluru",
        "code": "CHE"
      },
      {
        "name": "Manchenahalli",
        "code": "MAN"
      }
    ]
  },
  {
    "name": "Chikkmagaluru",
    "code": "CKM",
    "taluks": [
      {
        "name": "Chikkamagaluru",
        "code": "CHI"
      },
      {
        "name": "Kaduru",
        "code": "KAD"
      },
      {
        "name": "Koppa",
        "code": "KOP"
      },
      {
        "name": "Mudigere",
        "code": "MUD"
      },
      {
        "name": "Narasimharajapura",
        "code": "NAR"
      },
      {
        "name": "Sringeri",
        "code": "SRI"
      },
      {
        "name": "Tarikere",
        "code": "TAR"
      },
      {
        "name": "Ajjampura",
        "code": "AJJ"
      },
      {
        "name": "Kalasa",
        "code": "KAL"
      }
    ]
  },
  {
    "name": "Chitradurga",
    "code": "CTD",
    "taluks": [
      {
        "name": "Chitradurga",
        "code": "CHI"
      },
      {
        "name": "Challakere",
        "code": "CHA"
      },
      {
        "name": "Hiriyur",
        "code": "HIR"
      },
      {
        "name": "Holalkere",
        "code": "HOL"
      },
      {
        "name": "Hosadurga",
        "code": "HOS"
      },
      {
        "name": "Molakalmuru",
        "code": "MOL"
      }
    ]
  },
  {
    "name": "Dakshina Kannada",
    "code": "DKN",
    "taluks": [
      {
        "name": "Mangaluru",
        "code": "MAN"
      },
      {
        "name": "Ullal",
        "code": "ULL"
      },
      {
        "name": "Mulki",
        "code": "MUL"
      },
      {
        "name": "Moodbidri",
        "code": "MOO"
      },
      {
        "name": "Bantwala",
        "code": "BAN"
      },
      {
        "name": "Belathangadi",
        "code": "BEL"
      },
      {
        "name": "Putturu",
        "code": "PUT"
      },
      {
        "name": "Sulya",
        "code": "SUL"
      },
      {
        "name": "Kadaba",
        "code": "KAD"
      }
    ]
  },
  {
    "name": "Davanagere",
    "code": "DVG",
    "taluks": [
      {
        "name": "Davanagere",
        "code": "DAV"
      },
      {
        "name": "Harihara",
        "code": "HAR"
      },
      {
        "name": "Channagiri",
        "code": "CHA"
      },
      {
        "name": "Honnali",
        "code": "HON"
      },
      {
        "name": "Nyamathi",
        "code": "NYA"
      },
      {
        "name": "Jagaluru",
        "code": "JAG"
      }
    ]
  },
  {
    "name": "Dharwad",
    "code": "DHW",
    "taluks": [
      {
        "name": "Kalghatgi",
        "code": "KAL"
      },
      {
        "name": "Dharwad",
        "code": "DHA"
      },
      {
        "name": "Hubballi (Rural)",
        "code": "HUB"
      },
      {
        "name": "Hubballi (Urban)",
        "code": "HUN"
      },
      {
        "name": "Kundagolu",
        "code": "KUN"
      },
      {
        "name": "Navalgunda",
        "code": "NAV"
      },
      {
        "name": "Alnavara",
        "code": "ALN"
      },
      {
        "name": "Annigeri",
        "code": "ANN"
      }
    ]
  },
  {
    "name": "Gadag",
    "code": "GAD",
    "taluks": [
      {
        "name": "Gadag",
        "code": "GAD"
      },
      {
        "name": "Naragunda",
        "code": "NAR"
      },
      {
        "name": "Mundaragi",
        "code": "MUN"
      },
      {
        "name": "Rona",
        "code": "RON"
      },
      {
        "name": "Gajendragada",
        "code": "GAJ"
      },
      {
        "name": "Lakshmeshwara",
        "code": "LAK"
      },
      {
        "name": "Shirahatti",
        "code": "SHI"
      }
    ]
  },
  {
    "name": "Hassan",
    "code": "HAS",
    "taluks": [
      {
        "name": "Hassan",
        "code": "HAS"
      },
      {
        "name": "Arasikere",
        "code": "ARA"
      },
      {
        "name": "Channarayapattana",
        "code": "CHA"
      },
      {
        "name": "Holenarsipura",
        "code": "HOL"
      },
      {
        "name": "Sakleshpura",
        "code": "SAK"
      },
      {
        "name": "Aluru",
        "code": "ALU"
      },
      {
        "name": "Arakalagudu",
        "code": "ARU"
      },
      {
        "name": "Beluru",
        "code": "BEL"
      }
    ]
  },
  {
    "name": "Haveri",
    "code": "HAV",
    "taluks": [
      {
        "name": "Ranibennur",
        "code": "RAN"
      },
      {
        "name": "Byadgi",
        "code": "BYA"
      },
      {
        "name": "Hangala",
        "code": "HAN"
      },
      {
        "name": "Haveri",
        "code": "HAV"
      },
      {
        "name": "Savanuru",
        "code": "SAV"
      },
      {
        "name": "Hirekeruru",
        "code": "HIR"
      },
      {
        "name": "Shiggavi",
        "code": "SHI"
      },
      {
        "name": "Rattihalli",
        "code": "RAT"
      }
    ]
  },
  {
    "name": "Kalaburagi",
    "code": "KLB",
    "taluks": [
      {
        "name": "Kalaburagi",
        "code": "KAL"
      },
      {
        "name": "Afzalpura",
        "code": "AFZ"
      },
      {
        "name": "Alanda",
        "code": "ALA"
      },
      {
        "name": "Chincholi",
        "code": "CHI"
      },
      {
        "name": "Chitapura",
        "code": "CHA"
      },
      {
        "name": "Jevargi",
        "code": "JEV"
      },
      {
        "name": "Sedam",
        "code": "SED"
      },
      {
        "name": "Kamalapura",
        "code": "KAM"
      },
      {
        "name": "Shahabad",
        "code": "SHA"
      },
      {
        "name": "Kalgi",
        "code": "KAI"
      },
      {
        "name": "Yedrami",
        "code": "YED"
      }
    ]
  },
  {
    "name": "Kodagu",
    "code": "KDG",
    "taluks": [
      {
        "name": "Madikeri",
        "code": "MAD"
      },
      {
        "name": "Somawarapete",
        "code": "SOM"
      },
      {
        "name": "Virajapete",
        "code": "VIR"
      },
      {
        "name": "Ponnammapete",
        "code": "PON"
      },
      {
        "name": "Kushalnagara",
        "code": "KUS"
      }
    ]
  },
  {
    "name": "Kolar",
    "code": "KLR",
    "taluks": [
      {
        "name": "Kolar",
        "code": "KOL"
      },
      {
        "name": "Bangarapete",
        "code": "BAN"
      },
      {
        "name": "Maluru",
        "code": "MAL"
      },
      {
        "name": "Mulabagilu",
        "code": "MUL"
      },
      {
        "name": "Srinivasapura",
        "code": "SRI"
      },
      {
        "name": "Kolar Gold Fields (Robertsonpete)",
        "code": "KGF"
      }
    ]
  },
  {
    "name": "Koppala",
    "code": "KPL",
    "taluks": [
      {
        "name": "Koppala",
        "code": "KOP"
      },
      {
        "name": "Gangavathi",
        "code": "GAN"
      },
      {
        "name": "Kushtagi",
        "code": "KUS"
      },
      {
        "name": "Yelaburga",
        "code": "YEL"
      },
      {
        "name": "Kanakagiri",
        "code": "KAN"
      },
      {
        "name": "Karatagi",
        "code": "KAR"
      },
      {
        "name": "Kukanuru",
        "code": "KUK"
      }
    ]
  },
  {
    "name": "Mandya",
    "code": "MAN",
    "taluks": [
      {
        "name": "Mandya",
        "code": "MAN"
      },
      {
        "name": "Madduru",
        "code": "MAD"
      },
      {
        "name": "Malavalli",
        "code": "MAL"
      },
      {
        "name": "Srirangapattana",
        "code": "SRI"
      },
      {
        "name": "Krishnarajapete",
        "code": "KRI"
      },
      {
        "name": "Nagamangala",
        "code": "NAG"
      },
      {
        "name": "Pandavapura",
        "code": "PAN"
      }
    ]
  },
  {
    "name": "Mysuru",
    "code": "MYS",
    "taluks": [
      {
        "name": "Mysuru",
        "code": "MYS"
      },
      {
        "name": "Hunasuru",
        "code": "HUN"
      },
      {
        "name": "Krishnarajanagara",
        "code": "KRI"
      },
      {
        "name": "Nanjanagodu",
        "code": "NAN"
      },
      {
        "name": "Heggadadevanakote",
        "code": "HEG"
      },
      {
        "name": "Piriyapattana",
        "code": "PIR"
      },
      {
        "name": "Tirumakudalu Narasipura",
        "code": "TNA"
      },
      {
        "name": "Saraguru",
        "code": "SAR"
      },
      {
        "name": "Saligrama",
        "code": "SAL"
      }
    ]
  },
  {
    "name": "Raichuru",
    "code": "RCU",
    "taluks": [
      {
        "name": "Raichuru",
        "code": "RAI"
      },
      {
        "name": "Sindhanuru",
        "code": "SIN"
      },
      {
        "name": "Manvi",
        "code": "MAN"
      },
      {
        "name": "Devadurga",
        "code": "DEV"
      },
      {
        "name": "Lingasaguru",
        "code": "LIN"
      },
      {
        "name": "Mudgal",
        "code": "MUD"
      },
      {
        "name": "Maski",
        "code": "MAS"
      },
      {
        "name": "Sirawara",
        "code": "SIR"
      }
    ]
  },
  {
    "name": "Ramanagara",
    "code": "RAM",
    "taluks": [
      {
        "name": "Ramanagara",
        "code": "RAM"
      },
      {
        "name": "Magadi",
        "code": "MAG"
      },
      {
        "name": "Kanakapura",
        "code": "KAN"
      },
      {
        "name": "Channapattana",
        "code": "CHA"
      },
      {
        "name": "Harohalli",
        "code": "HAR"
      }
    ]
  },
  {
    "name": "Shivamogga",
    "code": "SMG",
    "taluks": [
      {
        "name": "Shivamogga",
        "code": "SHI"
      },
      {
        "name": "Sagara",
        "code": "SAG"
      },
      {
        "name": "Bhadravathi",
        "code": "BHA"
      },
      {
        "name": "Hosanagara",
        "code": "HOS"
      },
      {
        "name": "Shikaripura",
        "code": "SHA"
      },
      {
        "name": "Soraba",
        "code": "SOR"
      },
      {
        "name": "Tirthahalli",
        "code": "TIR"
      }
    ]
  },
  {
    "name": "Tumakuru",
    "code": "TMK",
    "taluks": [
      {
        "name": "Tumakuru",
        "code": "TUM"
      },
      {
        "name": "Chikkanayakanahalli",
        "code": "CHI"
      },
      {
        "name": "Kunigal",
        "code": "KUN"
      },
      {
        "name": "Madhugiri",
        "code": "MAD"
      },
      {
        "name": "Sira",
        "code": "SIR"
      },
      {
        "name": "Tipturu",
        "code": "TIP"
      },
      {
        "name": "Gubbi",
        "code": "GUB"
      },
      {
        "name": "Koratagere",
        "code": "KOR"
      },
      {
        "name": "Pavagada",
        "code": "PAV"
      },
      {
        "name": "Turuvekere",
        "code": "TUR"
      }
    ]
  },
  {
    "name": "Udupi",
    "code": "UDP",
    "taluks": [
      {
        "name": "Udupi",
        "code": "UDU"
      },
      {
        "name": "Kapu",
        "code": "KAP"
      },
      {
        "name": "Bynduru",
        "code": "BYN"
      },
      {
        "name": "Karkala",
        "code": "KAR"
      },
      {
        "name": "Kundapura",
        "code": "KUN"
      },
      {
        "name": "Hebri",
        "code": "HEB"
      },
      {
        "name": "Brahmavara",
        "code": "BRA"
      }
    ]
  },
  {
    "name": "Uttara Kannada",
    "code": "UKN",
    "taluks": [
      {
        "name": "Karwara",
        "code": "KAR"
      },
      {
        "name": "Sirsi",
        "code": "SIR"
      },
      {
        "name": "Joida",
        "code": "JOI"
      },
      {
        "name": "Dandeli",
        "code": "DAN"
      },
      {
        "name": "Bhatkal",
        "code": "BHA"
      },
      {
        "name": "Kumta",
        "code": "KUM"
      },
      {
        "name": "Ankola",
        "code": "ANK"
      },
      {
        "name": "Haliyal",
        "code": "HAL"
      },
      {
        "name": "Honnavara",
        "code": "HON"
      },
      {
        "name": "Mundagodu",
        "code": "MUN"
      },
      {
        "name": "Siddapura",
        "code": "SID"
      },
      {
        "name": "Yellapura",
        "code": "YEL"
      }
    ]
  },
  {
    "name": "Vijayapura",
    "code": "VJP",
    "taluks": [
      {
        "name": "Vijayapura",
        "code": "VIJ"
      },
      {
        "name": "Indi",
        "code": "IND"
      },
      {
        "name": "Basavana Bagewadi",
        "code": "BBA"
      },
      {
        "name": "Sindgi",
        "code": "SIN"
      },
      {
        "name": "Muddebihala",
        "code": "MUD"
      },
      {
        "name": "Talikote",
        "code": "TAL"
      },
      {
        "name": "Devara Hipparagi",
        "code": "DHI"
      },
      {
        "name": "Chadchana",
        "code": "CHA"
      },
      {
        "name": "Tikote",
        "code": "TIK"
      },
      {
        "name": "Babaleshwara",
        "code": "BAB"
      },
      {
        "name": "Kolhara",
        "code": "KOL"
      },
      {
        "name": "Nidagundi",
        "code": "NID"
      },
      {
        "name": "Alamela",
        "code": "ALA"
      }
    ]
  },
  {
    "name": "Yadagiri",
    "code": "YDG",
    "taluks": [
      {
        "name": "Yadagiri",
        "code": "YAD"
      },
      {
        "name": "Shahapura",
        "code": "SHA"
      },
      {
        "name": "Surapura",
        "code": "SUR"
      },
      {
        "name": "Gurmitkala",
        "code": "GUR"
      },
      {
        "name": "Vadagera",
        "code": "VAD"
      },
      {
        "name": "Hunsagi",
        "code": "HUN"
      }
    ]
  },
  {
    "name": "Vijayanagara",
    "code": "VJN",
    "taluks": [
      {
        "name": "Hosapete",
        "code": "HOS"
      },
      {
        "name": "Hagaribommanahalli",
        "code": "HAG"
      },
      {
        "name": "Harapanahalli",
        "code": "HAR"
      },
      {
        "name": "Hoovina Hadagali",
        "code": "HHA"
      },
      {
        "name": "Kudligi",
        "code": "KUD"
      },
      {
        "name": "Kotturu",
        "code": "KOT"
      }
    ]
  }
] as const satisfies readonly KarnatakaDistrict[]

export const KARNATAKA_GEOGRAPHIES: readonly KarnatakaGeography[] = KARNATAKA_DISTRICTS.flatMap((district) =>
  district.taluks.map((taluk) => ({
    key: `KA-${district.code}-${taluk.code}`,
    state: 'Karnataka',
    stateCode: 'KA',
    district: district.name,
    districtCode: district.code,
    taluk: taluk.name,
    talukCode: taluk.code,
  })),
)

export function getKarnatakaGeographyByKey(key: string): KarnatakaGeography | null {
  const normalizedKey = key.trim().toUpperCase()

  return KARNATAKA_GEOGRAPHIES.find((geography) => geography.key === normalizedKey) ?? null
}

export function locationPrefixForGeography(geography: KarnatakaGeography): string {
  return `${geography.stateCode}-${geography.districtCode}-${geography.talukCode}`
}
