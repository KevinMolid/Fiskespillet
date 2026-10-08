import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Optional test dependencies may live outside the project (no production changes).
const requireTest = createRequire(resolve(process.env.FIREBASE_TEST_RUNTIME || '.', 'package.json'))
const { initializeTestEnvironment, assertFails, assertSucceeds } = await import(pathToFileURL(requireTest.resolve('@firebase/rules-unit-testing')).href)
const firestoreUrl = pathToFileURL(requireTest.resolve('firebase/firestore')).href
const { doc, setDoc, getDoc, Timestamp, serverTimestamp } = await import(firestoreUrl)
const env = await initializeTestEnvironment({ projectId: 'demo-fiskespillet', firestore: { host: '127.0.0.1', port: 8188, rules: readFileSync('firestore.rules', 'utf8') } })
const bundle = await build({
  stdin: { contents: "export * from './src/game/persistence'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' },
  plugins: [{ name: 'emulator-database', setup(b) {
    b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: firestoreUrl, external: true }))
    b.onResolve({ filter: /\/lib\/firebase$/ }, () => ({ path: 'db', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const db = globalThis.__fishBookEmulatorDb' }))
  } }],
})
let instance = 0
async function login(uid) {
  globalThis.__fishBookEmulatorDb = env.authenticatedContext(uid).firestore()
  return import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64') + '#login' + instance++)
}
const seedInventory = { bag: { rod: 1, worm: 30 }, storage: {}, equippedBait: 'worm', coins: 60, updatedAt: Timestamp.now() }
const legacy = { speciesId: 'orret', seenCount: 5, caughtCount: 2, smallestGrams: 200, largestGrams: 2000, lastGrams: 2000, firstSeenAt: Timestamp.now(), firstCaughtAt: Timestamp.now(), updatedAt: Timestamp.now() }
try {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await setDoc(doc(db, 'playerInventories/a'), seedInventory)
    await setDoc(doc(db, 'playerInventories/b'), seedInventory)
    await setDoc(doc(db, 'fishBooks/a/entries/orret'), legacy)
  })
  let service = await login('a')
  assert.equal((await service.loadFishBook('a'))[0].caughtCount, 2)
  console.log('Testing escaped encounter')
  const first = await service.recordEncounter('a', 'mort', 180, false, 'worm', 'skogstjern')
  assert.equal(first.entry.hasCaught, false)
  assert.deepEqual(first.entry.discoveredLocationIds, [])
  assert.deepEqual(first.entry.seenLocationIds, ['skogstjern'])
  console.log('Testing first catch')
  await service.recordEncounter('a', 'mort', 200, true, 'worm', 'skogstjern')
  console.log('Testing concurrent catches')
  const weights = [100, 600]
  const simultaneous = await Promise.allSettled(weights.map(grams => service.recordEncounter('a', 'mort', grams, true, 'worm', 'skogstjern')))
  assert(simultaneous.some(result => result.status === 'fulfilled'))
  // Emulator may reject a stale transaction at rule evaluation instead of retrying.
  // Check that rejected attempts wrote neither bait consumption nor partial stats.
  const successes = simultaneous.filter(result => result.status === 'fulfilled').length
  const partial = (await service.loadFishBook('a')).find(e => e.speciesId === 'mort')
  assert.equal(partial.caughtCount, 1 + successes)
  assert.equal((await service.loadInventory('a')).bag.worm, 28 - successes)
  for (let index = 0; index < simultaneous.length; index++) {
    if (simultaneous[index].status === 'rejected') {
      assert.equal(simultaneous[index].reason.code, 'permission-denied')
      await service.recordEncounter('a', 'mort', weights[index], true, 'worm', 'skogstjern')
    }
  }
  let entry = (await service.loadFishBook('a')).find(e => e.speciesId === 'mort')
  assert.equal(entry.caughtCount, 3)
  assert.equal(entry.smallestGrams, 100)
  assert.equal(entry.largestGrams, 600)
  assert.deepEqual(entry.discoveredLocationIds, ['skogstjern'])
  await service.recordEncounter('a', 'orret', 1000, false, 'worm', 'skogstjern')
  let old = (await service.loadFishBook('a')).find(e => e.speciesId === 'orret')
  assert.deepEqual(old.discoveredLocationIds, [])
  assert.deepEqual(old.seenLocationIds, ['skogstjern'])
  assert.equal(old.largestGrams, 2000)
  await service.recordEncounter('a', 'orret', 3000, true, 'worm', 'skogstjern')
  old = (await service.loadFishBook('a')).find(e => e.speciesId === 'orret')
  assert.equal(old.caughtCount, 3)
  assert.deepEqual(old.discoveredLocationIds, ['skogstjern'])
  service = await login('b')
  assert.deepEqual(await service.loadFishBook('b'), [])
  await assertFails(service.recordEncounter('a', 'mort', 300, true, 'worm', 'skogstjern'))
  service = await login('a')
  assert.deepEqual((await service.loadFishBook('a')).find(e => e.speciesId === 'mort'), entry, 'fresh authenticated context restores persisted progress')
  const ownerDb = env.authenticatedContext('a').firestore()
  const ref = doc(ownerDb, 'fishBooks/a/entries/mort')
  const original = (await getDoc(ref)).data()
  const unchangedCatch = { ...original, seenCount: original.seenCount + 1, updatedAt: serverTimestamp() }
  await assertFails(setDoc(ref, { ...unchangedCatch, discoveredLocationIds: ['skogstjern', 'havn'] }))
  await assertFails(setDoc(ref, { ...unchangedCatch, largestGrams: 640 }))
  await assertFails(setDoc(ref, { ...unchangedCatch, hasCaught: false }))
  await assertFails(setDoc(ref, { ...unchangedCatch, discoveredLocationIds: ['skogstjern', 'skogstjern'] }))
  await assertFails(setDoc(ref, { ...unchangedCatch, discoveredLocationIds: ['unknown'] }))
  await assertFails(setDoc(ref, { ...unchangedCatch, seenLocationIds: ['skogstjern', 'skogstjern'] }))
  await assertFails(setDoc(ref, { ...unchangedCatch, seenLocationIds: ['unknown'] }))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'fishBooks/a/entries/mort')))
  // Exercise adding a second known location at rules level. Real fishing tables
  // currently put each species in only one of the two existing outdoor areas.
  const secondLocation = { ...unchangedCatch, caughtCount: original.caughtCount + 1, lastGrams: 300, discoveredLocationIds: ['skogstjern', 'havn'], seenLocationIds: ['skogstjern', 'havn'] }
  await assertSucceeds(setDoc(ref, secondLocation))
  entry = (await service.loadFishBook('a')).find(e => e.speciesId === 'mort')
  assert.deepEqual(entry.discoveredLocationIds, ['skogstjern', 'havn'])
  service = await login('choice')
  const choiceDb = env.authenticatedContext('choice').firestore()
  const choiceRef = doc(choiceDb, 'characterLooks/choice')
  const legacyLook = { shirt: 0, hair: 0, skin: 0, updatedAt: serverTimestamp() }
  await assertSucceeds(setDoc(choiceRef, legacyLook))
  assert.equal((await service.loadAppearance('choice')).playerVariant, undefined, 'Legacy appearance remains readable')
  for (const playerVariant of ['male', 'female']) {
    await service.saveAppearance('choice', { shirt: 0, hair: 0, skin: 0, playerVariant })
    assert.equal((await service.loadAppearance('choice')).playerVariant, playerVariant)
  }
  await assertFails(setDoc(choiceRef, { ...legacyLook, playerVariant: 'invalid' }))
  await assertFails(setDoc(choiceRef, { ...legacyLook, playerVariant: null }))
  await assertFails(setDoc(choiceRef, { ...legacyLook, extra: true }))
  await assertFails(setDoc(doc(env.authenticatedContext('other').firestore(), 'characterLooks/choice'), { ...legacyLook, playerVariant: 'male' }))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'characterLooks/choice')))
  await service.loadInventory('choice')
  await service.savePosition('choice', { mapId: 'havn', x: 12, y: 16, facing: 'down' })
  await service.resetGameData('choice', { shirt: 0, hair: 0, skin: 0, playerVariant: 'female' })
  assert.equal((await service.loadAppearance('choice')).playerVariant, 'female')
  assert.equal((await getDoc(doc(choiceDb, 'gameSaves/choice'))).exists(), false)
  assert.equal((await getDoc(doc(choiceDb, 'playerInventories/choice'))).exists(), false)
  console.log('Firestore emulator: catch transactions, legacy upgrade, owner isolation, character choice persistence, atomic reset and security-rule rejection tests passed.')
} finally {
  await env.cleanup()
  delete globalThis.__fishBookEmulatorDb
}
