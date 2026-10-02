import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle=await build({entryPoints:['src/game/characterAnimation.ts'],bundle:true,write:false,platform:'node',format:'esm'})
const {characterPose}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
assert.deepEqual(characterPose('left',false,0),{direction:'left',state:'idle',frame:0})
assert.deepEqual([0,.25,.5,.75,1].map(p=>characterPose('down',true,p).frame),[0,1,2,3,3])
assert.equal(characterPose('right',true,.5).state,'walk')
assert.deepEqual(characterPose('up',false,1),{direction:'up',state:'idle',frame:0})
console.log('Central four-frame pose timing and idle reset passed; missing walk artwork falls back to idle in renderer.')
