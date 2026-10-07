// Real SDK transactions and security rules against an isolated demo emulator.
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const requireTest = createRequire(resolve(process.env.FIREBASE_TEST_RUNTIME || '.', 'package.json'))
const { initializeTestEnvironment, assertFails, assertSucceeds } = await import(pathToFileURL(requireTest.resolve('@firebase/rules-unit-testing')).href)
const firestoreUrl = pathToFileURL(requireTest.resolve('firebase/firestore')).href
const { doc, setDoc, getDoc, serverTimestamp } = await import(firestoreUrl)
const env = await initializeTestEnvironment({ projectId: 'demo-fiskespillet', firestore: { host: '127.0.0.1', port: 8188, rules: readFileSync('firestore.rules', 'utf8') } })
const bundle = await build({
  stdin: { contents: "export * from './src/game/persistence'; export { hasRunningShoes } from './src/game/items'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' },
  plugins: [{ name: 'emulator-database', setup(b) {
    b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: firestoreUrl, external: true }))
    b.onResolve({ filter: /\/lib\/firebase$/ }, () => ({ path: 'db', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const db = globalThis.__sneakersEmulatorDb' }))
  } }],
})
let instance = 0
async function login(uid) {
  globalThis.__sneakersEmulatorDb = env.authenticatedContext(uid).firestore()
  return import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64') + '#login' + instance++)
}
try {
  await env.clearFirestore()
  let service = await login('a')
  const starter = await service.loadInventory('a')
  assert.equal(service.hasRunningShoes(starter), false)
  const gifted = await service.grantMaritaSneakers('a')
  assert.equal(gifted.received, true)
  assert.deepEqual(gifted.inventory, { ...starter, bag: { ...starter.bag, sneakers: 1 } })
  assert.equal(service.hasRunningShoes(gifted.inventory), true)
  const again = await service.grantMaritaSneakers('a')
  assert.equal(again.received, false)
  assert.deepEqual(again.inventory, gifted.inventory)
  await assert.rejects(service.transferItem('a', 'sneakers', true), /Nøkkelgjenstander/)
  service = await login('a')
  assert.deepEqual(await service.loadInventory('a'), gifted.inventory, 'Fresh login retains the key item')
  // Other inventory transactions preserve the permanent reward.
  await service.setEquippedBait('a', 'bread')
  await service.buyBait('a', 'worm', 1)
  await service.transferItem('a', 'shovel', true)
  assert.equal((await service.loadInventory('a')).bag.sneakers, 1)
  const db = env.authenticatedContext('a').firestore(), ref = doc(db, 'playerInventories/a')
  const original = (await getDoc(ref)).data()
  const write = bag => setDoc(ref, { ...original, bag, updatedAt: serverTimestamp() })
  await assertFails(write({ ...original.bag, sneakers: 2 }))
  await assertFails(write({ ...original.bag, sneakers: -1 }))
  await assertFails(write({ ...original.bag, sneakers: 0.5 }))
  await assertFails(write({ ...original.bag, sneakers: 0 }))
  const withoutShoes = { ...original.bag }; delete withoutShoes.sneakers
  await assertFails(write(withoutShoes))
  await assertFails(setDoc(ref, { ...original, storage: { sneakers: 1 }, updatedAt: serverTimestamp() }))
  await assertSucceeds(write(original.bag))
  await assertFails(setDoc(doc(db, 'playerInventories/invalid-start'), { ...starter, bag: { sneakers: 1 }, updatedAt: serverTimestamp() }))
  const newOwnerDb = env.authenticatedContext('new-start').firestore()
  await assertFails(setDoc(doc(newOwnerDb, 'playerInventories/new-start'), { ...starter, bag: { ...starter.bag, sneakers: 1 }, updatedAt: serverTimestamp() }))
  service = await login('b')
  await assertFails(service.grantMaritaSneakers('a'))
  assert.equal(service.hasRunningShoes(await service.loadInventory('b')), false)
  const concurrent = await Promise.allSettled([service.grantMaritaSneakers('b'), service.grantMaritaSneakers('b')])
  assert.equal(concurrent.filter(result => result.status === 'fulfilled' && result.value.received).length, 1)
  assert.equal((await service.loadInventory('b')).bag.sneakers, 1)
  for (const result of concurrent) if (result.status === 'rejected') {
    assert.equal(result.reason.code, 'permission-denied')
    assert.equal((await service.grantMaritaSneakers('b')).received, false)
  }
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'playerInventories/b')))
  await service.resetGameData('b')
  assert.equal(service.hasRunningShoes(await service.loadInventory('b')), false, 'New game resets the reward')
  assert.equal((await service.grantMaritaSneakers('b')).received, true)
  console.log('Sneakers: starter, first/repeated/concurrent gift, fresh login, other inventory writes, permanent key, account isolation, invalid writes and new game passed with actual Firestore rules/transactions.')
} finally { await env.cleanup() }
