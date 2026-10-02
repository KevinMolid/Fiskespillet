import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const requireTest=createRequire(resolve(process.env.FIREBASE_TEST_RUNTIME||'.','package.json'))
const {initializeTestEnvironment,assertFails,assertSucceeds}=await import(pathToFileURL(requireTest.resolve('@firebase/rules-unit-testing')).href)
const firestoreUrl=pathToFileURL(requireTest.resolve('firebase/firestore')).href
const {doc,setDoc,getDoc,serverTimestamp}=await import(firestoreUrl)
const env=await initializeTestEnvironment({projectId:'demo-fiskespillet',firestore:{host:'127.0.0.1',port:8188,rules:readFileSync('firestore.rules','utf8')}})
const bundle=await build({stdin:{contents:"export * from './src/game/persistence'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'empty'},plugins:[{name:'emulator',setup(b){b.onResolve({filter:/^firebase\/firestore$/},()=>({path:firestoreUrl,external:true}));b.onResolve({filter:/\/lib\/firebase$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const db=globalThis.__characterEmulatorDb'}))}}]})
try {
  await env.clearFirestore()
  const db=env.authenticatedContext('character-a').firestore();globalThis.__characterEmulatorDb=db
  const service=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  assert.deepEqual(await service.loadAppearance('character-a'),{shirt:0,hair:0,skin:0})
  await service.saveAppearance('character-a',{shirt:2,hair:3,skin:1})
  const old=await service.loadAppearance('character-a');assert.equal(old.shirt,2);assert.equal(old.outfit,undefined)
  for(const outfit of ['fisher','casual','sport']) for(const hairstyle of ['playerHair','shortHair','longHair','bald']) {
    await service.saveAppearance('character-a',{shirt:4,hair:4,skin:3,outfit,hairstyle})
    const saved=await service.loadAppearance('character-a');assert.equal(saved.outfit,outfit);assert.equal(saved.hairstyle,hairstyle)
  }
  await assertSucceeds(setDoc(doc(db,'characterLooks/character-a'),{shirt:0,hair:0,skin:0,updatedAt:serverTimestamp()}))
  await assertFails(setDoc(doc(db,'characterLooks/character-a'),{shirt:0,hair:0,skin:0,outfit:'invalid',updatedAt:serverTimestamp()}))
  await assertFails(setDoc(doc(db,'characterLooks/character-a'),{shirt:0,hair:0,skin:0,hairstyle:'invalid',updatedAt:serverTimestamp()}))
  await assertFails(setDoc(doc(env.authenticatedContext('other').firestore(),'characterLooks/character-a'),{shirt:0,hair:0,skin:0,updatedAt:serverTimestamp()}))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'characterLooks/character-a')))
  console.log('Real Firestore emulator: legacy saves, 12 outfits/hairstyles round-trip, valid old-client writes and invalid/foreign/anonymous access rejection passed.')
} finally {await env.cleanup()}
