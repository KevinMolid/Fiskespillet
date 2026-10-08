import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Exercise the real repository functions with an atomic, offline Firestore adapter.
// This is not a replacement for running the security rules in the emulator.
const documents = new Map()
const clone = value => structuredClone(value)
let reads = 0
let lists = 0
let rejectBatch = false
globalThis.__fishBookTestDb = {
  doc: (_db, ...parts) => parts.join('/'),
  collection: (_db, ...parts) => parts.join('/'),
  serverTimestamp: () => ({ seconds: 100, nanoseconds: 0 }),
  Timestamp: { now: () => ({ seconds: 100, nanoseconds: 0 }) },
  getDocs: async path => {
    lists++
    const docs = [...documents].filter(([key]) => key.startsWith(path + '/')).map(([key, value]) => ({ id: key.split('/').at(-1), ref: key, data: () => clone(value) }))
    return { docs, empty: docs.length === 0 }
  },
  getDoc: async path => ({ ref: path, exists: () => documents.has(path), data: () => clone(documents.get(path)) }),
  setDoc: async (path, value) => documents.set(path, clone(value)),
  writeBatch: () => {
    const deletes = []
    const writes = new Map()
    return { delete: path => deletes.push(path), set: (path, value) => writes.set(path, clone(value)), commit: async () => {
      if (rejectBatch) throw new Error('Offline batch failure')
      deletes.forEach(path => documents.delete(path))
      for (const [path, value] of writes) documents.set(path, value)
    } }
  },
  runTransaction: async (_db, run) => {
    const writes = new Map()
    const result = await run({
      get: async path => { reads++; return { exists: () => documents.has(path), data: () => clone(documents.get(path)) } },
      set: (path, value) => writes.set(path, clone(value)),
    })
    for (const [path, value] of writes) documents.set(path, value)
    return result
  },
}
const bundle = await build({
  stdin: { contents: "export * from './src/game/persistence'; export * from './src/game/fishBook'; export * from './src/game/fish'; export * from './src/game/FishBookDialog'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.png': 'dataurl' },
  plugins: [{ name: 'offline-firestore', setup(b) {
    b.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: import.meta.resolve(args.path), external: true }))
    b.onResolve({ filter: /^firebase\/firestore$|\/lib\/firebase$/ }, args => ({ path: args.path, namespace: 'fake' }))
    b.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path === 'firebase/firestore'
      ? 'export const {doc,collection,serverTimestamp,Timestamp,getDocs,getDoc,setDoc,writeBatch,runTransaction}=globalThis.__fishBookTestDb'
      : 'export const db = {}' }))
  } }],
})
const { FISH, FISH_BY_ID, weightRange, catchMilestone, normalizeFishBookEntry, recordEncounter, loadFishBook, loadAppearance, saveAppearance, hasExistingGame, resetGameData, FishDetails, FishBookDialog } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
// Fixture only: exercise the future multi-location case without changing game habitats.
FISH_BY_ID.laks.habitats = [...FISH_BY_ID.laks.habitats, 'innsjø']
const inventory = () => ({ bag: { rod: 1, worm: 30 }, storage: {}, coins: 60, equippedBait: 'worm' })
const uid = 'test-player'
documents.set('playerInventories/' + uid, inventory())
const catchFish = (grams, caught = true, location = 'havn') => recordEncounter(uid, 'laks', grams, caught, 'worm', location)
let result = await catchFish(2000, false)
assert.equal(result.milestone, null, 'An escaped fish cannot set a catch milestone')
assert.equal(result.entry.hasCaught, false)
assert.deepEqual(result.entry.discoveredLocationIds, [])
assert.deepEqual(result.entry.seenLocationIds, ['havn'], 'an uncaught encounter records only the place the player visited')
assert.equal(result.entry.smallestGrams, null)
assert.equal(result.inventory.coins, 60)
let detailHtml = renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.laks, entry: result.entry }))
assert(detailHtml.includes('Sett · ikke fanget') && detailHtml.includes('Salmo salar') && detailHtml.includes('data:image/png;base64,'))
assert(detailHtml.includes('Bryggehavn') && detailHtml.includes('Sett her'), 'seen locations are shown with their observed status')
assert(!detailHtml.includes('Dine fangster') && !detailHtml.includes(FISH_BY_ID.laks.description), 'a seen fish reveals no catch journal or full facts')
detailHtml = renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.abbor }))
assert(detailHtml.includes('Ukjent art') && detailHtml.includes('fish-question') && !detailHtml.includes('Perca fluviatilis'), 'unknown fish keeps its name but conceals details')
result = await catchFish(5000)
assert.deepEqual(result.milestone, { type: 'new-species' }, 'Seen but never landed is still a first catch')
assert.equal(result.entry.caughtCount, 1)
assert.equal(result.entry.hasCaught, true)
assert.deepEqual(result.entry.discoveredLocationIds, ['havn'])
assert.equal(result.inventory.coins, 95)
assert.deepEqual((await catchFish(2000)).milestone, { type: 'smallest', previousGrams: 5000 })
assert.deepEqual((await catchFish(10000)).milestone, { type: 'largest', previousGrams: 5000 })
assert.equal((await catchFish(30000, false, 'skogstjern')).milestone, null)
let entry = (await loadFishBook(uid))[0]
assert.equal(entry.caughtCount, 3)
assert.equal(entry.seenCount, 5)
assert.equal(entry.smallestGrams, 2000)
assert.equal(entry.largestGrams, 10000)
assert.deepEqual(entry.discoveredLocationIds, ['havn'])
assert.deepEqual(entry.seenLocationIds, ['havn', 'skogstjern'])
let html = renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.laks, entry }))
assert(html.includes('Bryggehavn') && html.includes('Skogstjernet') && html.includes('Sett her') && !html.includes('Sjeldenhet'))
assert.equal((await catchFish(8000, true, 'skogstjern')).milestone, null)
assert.equal((await catchFish(6000, true, 'skogstjern')).milestone, null)
entry = (await loadFishBook(uid))[0]
assert.deepEqual(entry.discoveredLocationIds, ['havn', 'skogstjern'])
assert.equal(entry.caughtCount, 5)
assert.equal(catchMilestone(entry, 2000), null, 'Tying the minimum does not celebrate')
assert.equal(catchMilestone(entry, 10000), null, 'Tying the maximum does not celebrate')
assert.deepEqual(catchMilestone(null, 3000), { type: 'new-species' })
assert.equal(reads, 14, 'two transactional reads per encounter')
assert.equal(lists, 2, 'recordEncounter never rereads the collection')
const before = JSON.stringify([...documents])
await assert.rejects(recordEncounter(uid, 'kveite', 2000, true, 'worm', 'havn'))
await assert.rejects(catchFish(-1))
assert.equal(JSON.stringify([...documents]), before, 'failed transaction changes neither inventory nor book')
documents.set('playerInventories/another-player', inventory())
assert.deepEqual(await loadFishBook('another-player'), [])
await recordEncounter('another-player', 'laks', 3000, true, 'worm', 'skogstjern')
assert.deepEqual((await loadFishBook('another-player'))[0].discoveredLocationIds, ['skogstjern'])
assert.deepEqual((await loadFishBook(uid))[0], entry, 'reloading or switching back reads the saved owner record')

const legacy = { ...entry }
delete legacy.hasCaught; delete legacy.discoveredLocationIds
assert.equal(normalizeFishBookEntry(legacy).caughtCount, 5)
assert.deepEqual(normalizeFishBookEntry(legacy).discoveredLocationIds, [], 'never invent historical locations')
assert.deepEqual(normalizeFishBookEntry(legacy).seenLocationIds, ['havn', 'skogstjern'], 'legacy caught places also count as seen')
const legacyWithCaughtPlace = { ...legacy, discoveredLocationIds: ['havn'] }
delete legacyWithCaughtPlace.seenLocationIds
assert.deepEqual(normalizeFishBookEntry(legacyWithCaughtPlace).seenLocationIds, ['havn'], 'old caught locations remain visible as both seen and caught')
documents.set('fishBooks/' + uid + '/entries/laks', legacy)
await catchFish(7000, false)
assert.deepEqual((await loadFishBook(uid))[0].discoveredLocationIds, [])
await catchFish(4000)
assert.deepEqual((await loadFishBook(uid))[0].discoveredLocationIds, ['havn'])

for (const fish of FISH) {
  assert(fish.description.length > 20)
  assert(fish.scientificName)
  const unknown = renderToStaticMarkup(createElement(FishDetails, { fish }))
  assert(unknown.includes('<h3>' + fish.name + '</h3>') && unknown.includes('fish-question'))
  assert(!unknown.includes(fish.scientificName) && !unknown.includes(fish.description))
}
html = renderToStaticMarkup(createElement(FishBookDialog, { book: [], onClose() {} }))
for (const fish of FISH) {
  assert(html.includes(fish.name))
  assert(!html.includes(fish.description))
  assert(!html.includes(fish.scientificName))
}
assert(!html.includes('<img') && !html.includes('Bryggehavn') && !html.includes('Sjeldenhet'))
assert(html.includes('0 av 21 fanget') && html.includes('21 ukjent') && html.includes('fish-list-question'))
const perchEntry = { fishId: 'abbor', caughtCount: 1, seenCount: 1, smallestGrams: 120, largestGrams: 120, discoveredLocationIds: ['skogstjern'] }
html = renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.abbor, entry: perchEntry }))
assert(html.includes('alt="Abbor"') && html.includes('data:image/png;base64,') && html.includes('Perca fluviatilis'))
assert(html.includes('fish-weight-range') && html.includes('Dine fangster') && html.includes('Minste') && !html.includes('Sjeldenhet'))
assert(html.includes('Rekord') && html.includes('fish-record-icon'))
assert.equal(weightRange(FISH_BY_ID.abbor), '50 g – 3,0 kg')
assert.equal(weightRange(FISH_BY_ID.lange), '500 g – 30,0 kg+')
const invalidPlace = renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.laks, entry: { ...result.entry, seenLocationIds: ['havn', 'private-location'] } }))
assert(invalidPlace.includes('Bryggehavn') && !invalidPlace.includes('private-location'), 'unknown places never leak into the field guide')
const roachEntry = { fishId: 'mort', caughtCount: 1, seenCount: 1, smallestGrams: 100, largestGrams: 100, discoveredLocationIds: ['skogstjern'] }
html = renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.mort, entry: roachEntry }))
assert(html.includes('alt="Mort"') && html.includes('data:image/png;base64,') && html.includes('Rutilus rutilus'))
assert.equal(FISH_BY_ID.gullorret, undefined, 'gold trout is absent from fish data')
documents.set('profiles/' + uid, { username: 'Bevares' })
documents.set('gameSaves/' + uid, { mapId: 'havn', x: 12, y: 16, facing: 'down' })
documents.set('characterLooks/' + uid, { shirt: 0, hair: 0, skin: 0 })
documents.set('digSpots/' + uid + '/entries/havn_3_17', { lastDugAt: { seconds: 100 } })
assert.equal(await hasExistingGame(uid), true, 'the start screen detects saved game data')
await resetGameData(uid)
assert.equal(await hasExistingGame(uid), false, 'a reset removes all saved game progress')
assert.equal(documents.get('profiles/' + uid).username, 'Bevares', 'a reset preserves the player profile')
for (const playerVariant of ['male', 'female']) {
  await saveAppearance(uid, { shirt: 0, hair: 0, skin: 0, playerVariant })
  assert.equal((await loadAppearance(uid)).playerVariant, playerVariant, 'Character choice persists per account')
}
documents.set('characterLooks/legacy', { shirt: 2, hair: 1, skin: 3 })
assert.equal((await loadAppearance('legacy')).playerVariant, undefined, 'Old saves still load and can choose without a reset')
await assert.rejects(saveAppearance(uid, { shirt: 0, hair: 0, skin: 0, playerVariant: 'invalid' }))
documents.set('playerInventories/' + uid, inventory())
const beforeReset = JSON.stringify([...documents])
rejectBatch = true
await assert.rejects(resetGameData(uid, { shirt: 0, hair: 0, skin: 0, playerVariant: 'female' }))
assert.equal(JSON.stringify([...documents]), beforeReset, 'A failed new game cannot erase progress or change character')
rejectBatch = false
await resetGameData(uid, { shirt: 0, hair: 0, skin: 0, playerVariant: 'female' })
assert.equal(documents.has('playerInventories/' + uid), false)
assert.equal((await loadAppearance(uid)).playerVariant, 'female', 'Reset and new choice commit together')
assert.equal(documents.get('profiles/' + uid).username, 'Bevares')
console.log('Fish book: first catch, min/max milestones, ties, escaped fish, atomic writes, persistence, legacy upgrade, locations, image import, locked UI and game reset passed.')
delete globalThis.__fishBookTestDb
