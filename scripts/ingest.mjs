// Builds src/data/*.json from the ASTRA raw-data folder. Every real number gets a `source` string.
// Usage: node scripts/ingest.mjs [path-to-raw-folder]   (or set ASTRA_RAW)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const RAW = resolve(process.argv[2] ?? process.env.ASTRA_RAW ?? join(here, '../../nasa-space-apps-2026/data/raw'))
if (!existsSync(RAW)) throw new Error(`Raw data folder not found: ${RAW}`)
const OUT = join(here, '../src/data')

const read = (p) => readFileSync(join(RAW, p), 'utf8')
const csv = (p) => {
  const [head, ...rows] = read(p).trim().split(/\r?\n/)
  const cols = head.split(',')
  return rows.map((line) => {
    const cells = []
    let cur = ''
    let q = false
    for (const ch of line) {
      if (ch === '"') q = !q
      else if (ch === ',' && !q) { cells.push(cur); cur = '' }
      else cur += ch
    }
    cells.push(cur)
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']))
  })
}
const write = (name, data) => writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n')
const num = (s) => Number(String(s).replace(/,/g, ''))

// ---------- consumables (BVAD) ----------
const bvad = Object.fromEntries(csv('bvad/bvad_values.csv').map((r) => [r.key, r]))
const bv = (key, label) => ({
  value: num(bvad[key].value),
  source: `NASA BVAD Rev 2, ${bvad[key].table} (${label}; PDF page ${bvad[key].pdf_page}; raw/bvad/bvad_values.csv, key ${key})`,
})
write('consumables.json', {
  o2KgPerPersonDay: bv('o2_per_person', 'oxygen one astronaut breathes in a day'),
  foodKgPerPersonDay: bv('food_dry_per_person', 'food eaten in a day, dry mass'),
  waterKgPerPersonDay: bv('water_per_person', 'drinking and food water used in a day'),
  wheatO2GramsPerM2Day: bv('wheat_o2', 'oxygen made per square metre of wheat per day'),
  lettuceO2GramsPerM2Day: bv('lettuce_o2', 'oxygen made per square metre of lettuce per day'),
  lettuceDays: bv('lettuce_days', 'days for lettuce to grow'),
})

// ---------- landing regions (NASA map + LOLA) ----------
const regions = csv('artemis/regions.csv')
const lola = Object.fromEntries(csv('lola/regions_lola.csv').map((r) => [r.id, r]))
write(
  'sites.json',
  regions.map((r) => {
    const l = lola[r.id]
    return {
      id: `region-${r.id}`,
      name: r.name,
      kidLine: r.kid_line,
      latDeg: { value: num(r.lat_deg), source: `NASA 9-region map, approximate box centre (${r.coord_method}); raw/artemis/regions.csv` },
      lonDegEast: { value: num(r.lon_deg_east), source: 'NASA 9-region map, approximate box centre; raw/artemis/regions.csv' },
      sunShare: {
        value: num(l.sun_max_5km),
        source: 'LRO LOLA average sunlight map (PGDA product 69, 75°S, 120 m, 18.6-year average): the best-lit spot within ~5 km of the region centre, because mission planners pick the best spot near a region; raw/lola/regions_lola.csv, column sun_max_5km',
      },
      earthShare: {
        value: num(l.earth_max_5km),
        source: 'LRO LOLA average Earth-in-view map (PGDA product 69, 75°S, 120 m, 18.6-year average): the spot within ~5 km of the region centre where Earth is in view most; raw/lola/regions_lola.csv, column earth_max_5km',
      },
    }
  }),
)

// ---------- storms (STORMS.md + DONKI + NOAA GOES) ----------
const md = read('donki/STORMS.md').split(/\r?\n/)
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim())
const storyRows = md.filter((l) => /^\| \d /.test(l))
const tableA = storyRows.slice(0, 8).map(cells)
const tableB = storyRows.slice(8, 16).map(cells)
if (tableA.length !== 8 || tableB.length !== 8) throw new Error('STORMS.md tables not found')

const allOf = (type) => {
  const dir = join(RAW, 'donki', type)
  return readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'MANIFEST.json').flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
}
const FLR = allOf('FLR')
const SEP = allOf('SEP')
const linkId = (url) => url.match(/\/(\d+)\/-1$/)?.[1]
const flrByLinkId = new Map(FLR.map((e) => [linkId(e.link), e]))
const sepByLinkId = new Map(SEP.map((e) => [linkId(e.link), e]))
const isModel = (e) => e.instruments?.some((i) => /^MODEL/i.test(i.displayName))

const levelSize = (s) => (s === 'S1' || s === 'S2' ? 'small' : s === 'S3' ? 'big' : 'huge')
const links = (s) => [...s.matchAll(/\[(\d+)\]\((https:[^)]+)\)/g)].map((m) => ({ id: m[1], url: m[2] }))

// GOES curves: shape only. NOAA's official peak is the number we show.
const peaks = csv('goes/peaks.csv')
const pfuRows = read('goes/protons_10MeV_5min.csv').trim().split(/\r?\n/).slice(1).map((l) => l.split(','))

const storms = tableA.map((a, i) => {
  const b = tableB[i]
  const n = i + 1
  const title = a[1].replace(/\*\*/g, '').replace(/⭐/g, '').replace(/\*\(headline\)\*/g, '').trim()
  const sLevel = a[4].match(/S\d/)[0]
  const peakMatch = a[4].match(/([\d,]+) pfu \(([^)]+)\)/)
  const flareClass = a[5].match(/[XMC]\d+(\.\d+)?/)[0]
  const geo = a[6].match(/G\d/)?.[0] ?? null
  const kid = a[7].replace(/^"|"$/g, '')
  const flrLinks = links(b[1])
  const sepListed = links(b[2])
  const gstLinks = links(b[3])
  // The main flare's DONKI record, then the real-instrument SEP records linked to it (never a model run).
  const flare = flrByLinkId.get(flrLinks[0].id)
  let sepChosen = sepListed.filter((l) => sepByLinkId.has(l.id) && !isModel(sepByLinkId.get(l.id)))
  const linked = SEP.filter((e) => !isModel(e) && e.linkedEvents?.some((x) => x.activityID === flare?.flrID)).sort((x, y) =>
    x.eventTime.localeCompare(y.eventTime),
  )
  // NOAA's S-scale is defined on GOES >10 MeV, so that record matches the level we show.
  const goes10 = linked.find((e) => e.instruments?.some((i) => /^GOES.*>10 MeV/i.test(i.displayName)))
  const pick = goes10 ?? linked[0]
  if (pick) sepChosen = [{ id: linkId(pick.link), url: pick.link }]
  const sepModelListed = sepListed.filter((l) => sepByLinkId.has(l.id) && isModel(sepByLinkId.get(l.id))).map((l) => l.id)

  let curve = null
  const rows = peaks.filter((p) => p.storm === String(n))
  if (rows.length) {
    const best = rows.reduce((m, r) => (num(r.peak_pfu) > num(m.peak_pfu) ? r : m))
    const series = pfuRows.filter((r) => r[0] === String(n) && r[1] === best.satellite && r[2] === best.unit)
    const hourly = new Map()
    for (const [, , , t, v] of series) {
      const h = t.slice(0, 13)
      const x = Number(v)
      if (Number.isFinite(x)) hourly.set(h, Math.max(hourly.get(h) ?? 0, x))
    }
    const keys = [...hourly.keys()].sort()
    const max = Math.max(...hourly.values())
    curve = {
      satellite: best.satellite.toUpperCase().replace('GOES', 'GOES-'),
      startUtc: keys[0] + ':00Z',
      relative: keys.map((k) => Math.round((hourly.get(k) / max) * 1000) / 1000),
      source: `NOAA NCEI GOES-R SGPS 5-minute proton data, hourly maximum, shown relative to its own peak (shape only; official peak is ${a[4].match(/[\d,]+ pfu/)[0]}); raw/goes/protons_10MeV_5min.csv`,
    }
  }

  return {
    id: `storm-${n}`,
    number: n,
    title,
    dates: a[2],
    size: levelSize(sLevel),
    sLevel,
    peakPfu: {
      value: num(peakMatch[1]),
      source: `NOAA official peak, proton flux above 10 MeV (${peakMatch[2]}); raw/donki/STORMS.md, table "The 8 storms"`,
    },
    peakDate: peakMatch[2],
    flare: { value: flareClass, source: `NASA DONKI flare record FLR ${flrLinks[0].id}; raw/donki/STORMS.md` },
    geomagnetic: geo,
    kidSentence: kid,
    headline: n === 6,
    records: [
      ...flrLinks.map((l) => ({ label: `NASA flare record ${l.id}`, url: l.url })),
      ...sepChosen.map((l) => ({ label: `NASA radiation storm record ${l.id}`, url: l.url })),
      ...gstLinks.map((l) => ({ label: `NASA magnetic storm record ${l.id}`, url: l.url })),
    ],
    sepModelRecordsNotShown: sepModelListed,
    curve,
  }
})
write('storms.json', storms)

// ---------- Today's Sun: bundled snapshot of the last 30 days in the frozen archive ----------
const freezeEnd = new Date('2026-11-12T23:59:59Z')
const since = new Date(freezeEnd.getTime() - 30 * 86400000)
const t2d = (t) => new Date(t.length === 17 ? t.replace('Z', ':00Z') : t)
const flares = FLR.filter((e) => t2d(e.peakTime) >= since).map((e) => ({ class: e.classType, peakTime: e.peakTime, link: e.link }))
const seps = SEP.filter((e) => t2d(e.eventTime) >= since && !isModel(e)).map((e) => ({ time: e.eventTime, link: e.link }))
const cmes = allOf('CME').filter((e) => t2d(e.startTime) >= since).length
const gsts = allOf('GST')
  .filter((e) => t2d(e.startTime) >= since)
  .map((e) => ({ time: e.startTime, kp: Math.max(0, ...(e.allKpIndex ?? []).map((k) => k.kpIndex ?? 0)), link: e.link }))
write('snapshot.json', {
  savedThrough: '2026-11-12',
  source: 'NASA DONKI archive pulled 2026-11-12 (raw/donki/MANIFEST.json); flares, radiation storms (real-instrument records only), CMEs, magnetic storms (Kp from allKpIndex)',
  flares,
  radiationStorms: seps,
  cmes,
  magneticStorms: gsts,
})

// ---------- science facts (OSDR) ----------
write('science.json', [
  {
    id: 'osd-964',
    kidLine: 'In a lab, more space-like rays slowed tiny yeast.',
    learnMore: 'Scientists gave tiny yeast cells space-like rays in a lab. The more rays, the slower they grew. Yeast that could fix itself did better.',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-964',
    source: 'NASA OSDR OSD-964; Liddell et al. 2023, Astrobiology, doi:10.1089/ast.2022.0124; raw/osdr/README.md',
  },
  {
    id: 'osd-435',
    kidLine: 'Mouse hearts kept pumping well after proton rays.',
    learnMore: 'Mice got proton rays, the kind of particle solar storms send. Their hearts kept pumping normally, but scientists saw small changes inside.',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-435',
    source: 'NASA OSDR OSD-435; Seawright et al. 2019, Life Sciences in Space Research 20:72-84, doi:10.1016/j.lssr.2019.01.003; raw/osdr/README.md',
  },
])

// ---------- big flares and what followed them (the "flare watch" in the game) ----------
// RULE (written into the data file too): a flare is "followed by space rays" when a real-instrument (not model) DONKI
// radiation-storm record from a GOES >10 MeV detector starts within 72 hours after the flare's peak. DONKI's own links
// between records are kept as extra evidence (`linked`). Only flares of class M5 or bigger are used.
// The game shows a real flare and hides the outcome; the outcome is shown afterwards with its NASA record.
const WINDOW_H = 72
const classValue = (c) => ({ A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 })[c[0]] * Number(c.slice(1))
const goesRadiation = SEP.filter(
  (e) => !isModel(e) && e.instruments?.some((i) => /GOES/.test(i.displayName) && />10 MeV/.test(i.displayName)),
)
  .map((e) => ({
    id: e.sepID,
    t: Date.parse(e.eventTime),
    time: e.eventTime,
    link: e.link,
    instrument: e.instruments.map((i) => i.displayName).find((n) => /GOES/.test(n) && />10 MeV/.test(n)),
    flares: new Set((e.linkedEvents ?? []).map((x) => x.activityID)),
  }))
  .sort((a, b) => a.t - b.t)
const bucketOf = (v) => (v >= 5e-4 ? 'x5' : v >= 1e-4 ? 'x1' : 'm5')
const stormFlareIds = new Map(storms.map((s) => [/FLR (\d+)/.exec(s.flare.source)?.[1], s.id]))
const bigFlares = FLR.filter((e) => e.classType && e.peakTime && classValue(e.classType) >= 5e-5).sort((a, b) => Date.parse(a.peakTime) - Date.parse(b.peakTime))
const stats = { m5: { n: 0, followed: 0 }, x1: { n: 0, followed: 0 }, x5: { n: 0, followed: 0 } }
const flareEntries = []
let followedNotUsed = 0
// Clues the child can read on a flare: the size (class), a gas cloud (a CME linked to the flare in DONKI),
// and which side of the Sun it came from (east or west, from the flare's source location, e.g. S15E77).
const hasCloud = (e) => (e.linkedEvents ?? []).some((x) => /-CME-/.test(x.activityID))
const sideOf = (e) => {
  const m = /^[NS]\d+([EW])\d+$/.exec(e.sourceLocation ?? '')
  return m ? (m[1] === 'W' ? 'west' : 'east') : null
}
const clueStats = {}
const tally = (id, label, followed) => {
  clueStats[id] ??= { id, label, n: 0, followed: 0 }
  clueStats[id].n++
  if (followed) clueStats[id].followed++
}
for (const e of bigFlares) {
  const peak = Date.parse(e.peakTime)
  const sep = goesRadiation.find((r) => r.t >= peak && r.t <= peak + WINDOW_H * 3_600_000)
  const b = bucketOf(classValue(e.classType))
  stats[b].n++
  if (sep) stats[b].followed++
  const cloud = hasCloud(e)
  const side = sideOf(e)
  tally(cloud ? 'cloud-yes' : 'cloud-no', cloud ? 'A gas cloud was seen' : 'No gas cloud', Boolean(sep))
  if (side) tally(`side-${side}`, side === 'west' ? 'West side of the Sun' : 'East side of the Sun', Boolean(sep))
  if (side) tally(`${cloud ? 'cloud' : 'nocloud'}-${side}`, `${cloud ? 'Cloud' : 'No cloud'}, ${side} side`, Boolean(sep))
  const flareId = /FLR\/(\d+)\//.exec(e.link)?.[1]
  const stormId = stormFlareIds.get(flareId) ?? null
  // Every followed flare is used. Only our 8 real storms have a known size and curve (`stormId`); for the others the outcome is real
  // (NASA recorded a radiation storm) but its size is not in our data, so the game uses a small storm and says so (`sizeKnown: false`).
  if (sep && !stormId) followedNotUsed++
  const hours = sep ? Math.round(((sep.t - peak) / 3_600_000) * 10) / 10 : null
  flareEntries.push({
    id: `flr-${flareId}`,
    class: e.classType,
    peakTime: e.peakTime,
    link: e.link,
    followed: Boolean(sep),
    stormId: sep ? stormId : null,
    sizeKnown: Boolean(sep && stormId),
    cloud,
    side,
    location: e.sourceLocation ?? null,
    sep: sep ? { id: sep.id, time: sep.time, hoursAfterPeak: hours, delayDays: Math.max(1, Math.ceil(hours / 24)), link: sep.link, instrument: sep.instrument, linked: sep.flares.has(e.flrID) } : null,
  })
}
const share = (o) => Math.round((100 * o.followed) / o.n)
const total = { n: stats.m5.n + stats.x1.n + stats.x5.n, followed: stats.m5.followed + stats.x1.followed + stats.x5.followed }
const RULE = `A flare counts as "followed by space rays" when a real-instrument (not model) NASA DONKI radiation-storm record from a GOES >10 MeV detector starts within ${WINDOW_H} hours after the flare's peak. Only flares of class M5 or bigger are counted.`
write('flares.json', {
  rule: RULE,
  windowHours: WINDOW_H,
  source: 'NASA DONKI FLR and SEP records, archive pulled 2026-11-12 (raw/donki/MANIFEST.json); labelled by scripts/ingest.mjs',
  note: `All ${total.followed} flares followed by space rays and all ${total.n - total.followed} that were not are kept. Only 8 of the followed flares are our real storms with a known size and curve; for the other ${followedNotUsed} the outcome is real but the storm's size is not in our data, so the game uses a small storm and says so.`,
  flares: flareEntries,
})
write('flareStats.json', {
  rule: RULE,
  windowHours: WINDOW_H,
  source: 'NASA DONKI FLR and SEP records, archive pulled 2026-11-12; counted by scripts/ingest.mjs',
  buckets: [
    { id: 'm5', label: 'M5 to M9.9', n: stats.m5.n, followed: stats.m5.followed, percent: share(stats.m5) },
    { id: 'x1', label: 'X1 to X4.9', n: stats.x1.n, followed: stats.x1.followed, percent: share(stats.x1) },
    { id: 'x5', label: 'X5 and bigger', n: stats.x5.n, followed: stats.x5.followed, percent: share(stats.x5), note: 'Only a few flares this big, so this share is rough.' },
  ],
  total: { n: total.n, followed: total.followed, percent: share(total) },
  clues: Object.values(clueStats)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => ({ ...c, percent: share(c) })),
})

// ---------- dataset list for the "Where the data comes from" screen ----------
write('sources.json', [
  { id: 'donki', name: 'NASA DONKI', gives: 'Real solar flares, space-ray storms and magnetic storms. Storm cards and Today’s Sun.', url: 'https://ccmc.gsfc.nasa.gov/DONKI/', licence: 'US Government, public domain', note: 'Archive pulled 12 Nov 2026. One radiation-storm record exists per detector, so we count storms, not records.' },
  { id: 'noaa', name: 'NOAA SWPC + GOES', gives: 'How strong each storm’s space rays were (S1 to S5) and the shape of the storm.', url: 'https://www.swpc.noaa.gov/noaa-scales-explanation', licence: 'US Government, public domain', note: 'Measured at Earth’s distance from the Sun. The Moon is at about the same distance, so we use it as a stand-in for a Moon base.' },
  { id: 'bvad', name: 'NASA BVAD (2022)', gives: 'How much air, water and food one astronaut uses each day.', url: 'https://ntrs.nasa.gov/citations/20210024855', licence: 'US Government', note: 'We turn kilograms into bars a child can read.' },
  { id: 'regions', name: 'NASA’s 9 candidate landing regions', gives: 'The 9 places you can choose near the Moon’s South Pole.', url: 'https://ntrs.nasa.gov/citations/20250011660', licence: 'US Government', note: 'These are candidate regions, not a landing plan. Centres are read off NASA’s map, so they are approximate.' },
  { id: 'lola', name: 'LRO LOLA maps', gives: 'How sunny each region is, and how often Earth is in view.', url: 'https://pgda.gsfc.nasa.gov/products/69', licence: 'Cite Mazarico et al. 2011', note: 'These are long-term averages, not a calendar. The game spreads sunny days and Earth-view days evenly to match each region’s share.' },
  { id: 'osdr', name: 'NASA OSDR', gives: 'Real lab findings about what space rays do to living things.', url: 'https://osdr.nasa.gov', licence: 'NASA open data; cite each paper', note: 'Yeast and mice in a lab. Not results for people.' },
])

console.log('Wrote consumables, sites, storms, snapshot, science, sources to', OUT)
for (const s of storms) console.log(s.id, s.sLevel, s.peakPfu.value, s.records.map((r) => r.label.split(' ').pop()).join(','), s.sepModelRecordsNotShown.length ? `(model SEP ${s.sepModelRecordsNotShown})` : '', s.curve ? `curve ${s.curve.relative.length}h` : 'no curve')
