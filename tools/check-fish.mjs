import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const bundle=await build({stdin:{contents:"export * from './src/game/fish'; export { ITEMS } from './src/game/items'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'dataurl'}})
const {FISH,FISH_BY_ID,FISHING_ZONES,BAIT_METHODS,ITEMS,fishingOptions,biteProbability,compatibleBaits,livesInZone,rollFish,weightCeiling}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
assert.equal(FISH.length,21)
assert.equal(new Set(FISH.map(f=>f.id)).size,21)
assert.equal(ITEMS.filter(item=>item.category==='equipment').length,2,'No new equipment')
assert.equal(ITEMS.filter(item=>item.category==='fish').length,FISH.length,'Every species has a stackable fish item')
assert.deepEqual(Object.keys(FISHING_ZONES),['havn','skogstjern'])
const rules=readFileSync('firestore.rules','utf8')
for(const fish of FISH){
 assert(fish.minGrams>0&&fish.maxGrams>fish.minGrams)
 assert(fish.methods.length&&fish.habitats.length)
 assert(fish.sellPrice>0)
 assert(rules.includes("'fish_"+fish.id+"'"),'Fish item allowed in inventory rules: '+fish.id)
 assert(rules.includes("'"+fish.id+"'"),'Species allowed in fish book rules: '+fish.id)
 assert(weightCeiling(fish)<=240000)
 for(const affinity of Object.values(fish.baitAffinity)) assert(affinity>0&&affinity<=2,'positive, bounded bait affinity: '+fish.name)
}
assert.equal(FISH_BY_ID.abbor.minGrams,50)
assert.match(FISH_BY_ID.abbor.image,/^data:image\/png;base64,/)
assert.equal(FISH_BY_ID.gjedde.maxGrams,17000)
assert.equal(weightCeiling(FISH_BY_ID.kveite),240000)
assert.equal(rollFish('havn','bread'),null)
assert.equal(rollFish('havn',null),null)
assert.throws(()=>rollFish('missing','worm'))
const lakeWorm = fishingOptions('skogstjern','worm')
const lakeBread = fishingOptions('skogstjern','bread')
assert(lakeBread.find(o=>o.species.id==='mort').weight > lakeWorm.find(o=>o.species.id==='mort').weight, 'bread should favor roach more than worms do')
const harborSpinner = fishingOptions('havn','spinner')
assert(harborSpinner.find(o=>o.species.id==='makrell').weight > harborSpinner.find(o=>o.species.id==='sei').weight, 'spinner affinity should alter the sea species mix')
const perch = FISH_BY_ID.abbor
const reedsMidSlow = { bait:'spinner', castLength:'short', feature:'reeds', depth:'midwater', retrieve:'slow' }
const openBottomFast = { bait:'spinner', castLength:'long', feature:'open', depth:'bottom', retrieve:'fast' }
assert(biteProbability(perch,reedsMidSlow) > biteProbability(perch,openBottomFast), 'species-specific cast/depth/retrieve choices should affect bites')
for(const id of ['gjedde','sild','rodspette','brosme','lange','gjors','kveite']) assert.equal(compatibleBaits(FISH_BY_ID[id]).length,0,id+' needs future equipment')
assert(!livesInZone(FISH_BY_ID.gjors,'skogstjern'))
let seed=2026
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
for(const zone of Object.keys(FISHING_ZONES)) for(const bait of Object.keys(BAIT_METHODS)) {
 const options=fishingOptions(zone,bait)
 const counts={}
 for(let i=0;i<12000;i++){
  const result=rollFish(zone,bait,random)
  if(!options.length){assert.equal(result,null);continue}
  assert(result&&options.some(o=>o.species.id===result.species.id))
  assert(Number.isInteger(result.grams)&&result.grams>=result.species.minGrams&&result.grams<=weightCeiling(result.species))
  counts[result.species.id]=(counts[result.species.id]??0)+1
 }
 if(zone==='havn'&&bait==='worm') assert(counts.torsk>counts.hvitting&&counts.hvitting>counts.steinbit)
 console.log(zone+' / '+bait+': '+(options.map(o=>o.species.name).join(', ')||'no match; no encounter'))
 if(options.length){
  const low=rollFish(zone,bait,()=>0);assert.equal(low.grams,low.species.minGrams);assert.equal(low.bites,true)
  const high=rollFish(zone,bait,()=>0.999999999);assert.equal(high.grams,weightCeiling(high.species));assert.equal(high.bites,false)
 }
}
console.log('21 species; 96,000 rolls; habitat/method gates, bait and fishing-profile affinities, bite rolls, weights, sell prices and rules OK')
