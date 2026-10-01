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
globalThis.__fishBookTestDb = {
  doc: (_db, ...parts) => parts.join('/'),
  collection: (_db, ...parts) => parts.join('/'),
  serverTimestamp: () => ({ seconds: 100, nanoseconds: 0 }),
  Timestamp: { now: () => ({ seconds: 100, nanoseconds: 0 }) },
  getDocs: async path => {
    lists++
    return { docs: [...documents].filter(([key]) => key.startsWith(path + '/')).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => clone(value) })) }
  },
  getDoc: async path => ({ exists: () => documents.has(path), data: () => clone(documents.get(path)) }),
  setDoc: async (path, value) => documents.set(path, clone(value)),
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
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
  plugins: [{ name: 'offline-firestore', setup(b) {
    b.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: import.meta.resolve(args.path), external: true }))
    b.onResolve({ filter: /^firebase\/firestore$|\/lib\/firebase$/ }, args => ({ path: args.path, namespace: 'fake' }))
    b.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path === 'firebase/firestore'
      ? 'export const {doc,collection,serverTimestamp,Timestamp,getDocs,getDoc,setDoc,runTransaction}=globalThis.__fishBookTestDb'
      : 'export const db = {}' }))
  } }],
})
const { FISH, FISH_BY_ID, normalizeFishBookEntry, recordEncounter, loadFishBook, FishDetails, FishBookDialog } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
// Fixture only: exercise the future multi-location case without changing game habitats.
FISH_BY_ID.laks.habitats = [...FISH_BY_ID.laks.habitats, 'innsjø']
const inventory = () => ({ bag: { rod: 1, worm: 30 }, storage: {}, coins: 60, equippedBait: 'worm' })
const uid = 'test-player'
documents.set('playerInventories/' + uid, inventory())
const catchFish = (grams, caught = true, location = 'havn') => recordEncounter(uid, 'laks', grams, caught, 'worm', location)
let result = await catchFish(2000, false)
assert.equal(result.entry.hasCaught, false)
assert.deepEqual(result.entry.discoveredLocationIds, [])
assert.equal(result.entry.smallestGrams, null)
assert.equal(result.inventory.coins, 60)
assert.equal(renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.laks, entry: result.entry })), '<h3>Laks</h3>')
result = await catchFish(5000)
assert.equal(result.entry.caughtCount, 1)
assert.equal(result.entry.hasCaught, true)
assert.deepEqual(result.entry.discoveredLocationIds, ['havn'])
assert.equal(result.inventory.coins, 95)
await catchFish(2000)
await catchFish(10000)
await catchFish(30000, false, 'skogstjern')
let entry = (await loadFishBook(uid))[0]
assert.equal(entry.caughtCount, 3)
assert.equal(entry.seenCount, 5)
assert.equal(entry.smallestGrams, 2000)
assert.equal(entry.largestGrams, 10000)
assert.deepEqual(entry.discoveredLocationIds, ['havn'])
let html = renderToStaticMarkup(createElement(FishDetails, { fish: FISH_BY_ID.laks, entry }))
assert(html.includes('Bryggehavn') && !html.includes('Skogstjernet'))
await catchFish(8000, true, 'skogstjern')
await catchFish(6000, true, 'skogstjern')
entry = (await loadFishBook(uid))[0]
assert.deepEqual(entry.discoveredLocationIds, ['havn', 'skogstjern'])
assert.equal(entry.caughtCount, 5)
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
documents.set('fishBooks/' + uid + '/entries/laks', legacy)
await catchFish(7000, false)
assert.deepEqual((await loadFishBook(uid))[0].discoveredLocationIds, [])
await catchFish(4000)
assert.deepEqual((await loadFishBook(uid))[0].discoveredLocationIds, ['havn'])

for (const fish of FISH) {
  assert(fish.description.length > 20)
  assert(fish.scientificName || fish.id === 'gullorret')
  assert.equal(renderToStaticMarkup(createElement(FishDetails, { fish })), '<h3>' + fish.name + '</h3>')
}
html = renderToStaticMarkup(createElement(FishBookDialog, { book: [], onClose() {} }))
for (const fish of FISH) {
  assert(html.includes(fish.name))
  assert(!html.includes(fish.description))
  if (fish.scientificName) assert(!html.includes(fish.scientificName))
}
assert(!html.includes('Illustrasjon kommer') && !html.includes('<img') && !html.includes('Bryggehavn'))
assert(html.includes('0 / 22 arter fanget'))
console.log('Fish book: statistics, failures, atomic writes, per-player persistence, legacy upgrade, locations and locked UI passed.')
delete globalThis.__fishBookTestDb
