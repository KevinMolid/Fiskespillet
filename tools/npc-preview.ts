import { NPCS } from '../src/game/npcs'
import { npcPixels } from '../src/game/npcSprite'
import type { Direction } from '../src/game/world'
const main = document.querySelector('main')!
for (const npc of NPCS) {
 const article = document.createElement('article')
 article.innerHTML = '<h2>'+npc.name+'</h2>' + (['down','right','up'] as Direction[]).map(direction => '<svg viewBox="0 -3 18 26" role="img" aria-label="'+npc.name+' '+direction+'">'+npcPixels(npc,direction).map(p => '<rect x="'+p.x+'" y="'+p.y+'" width="1" height="1" fill="#'+p.color.toString(16).padStart(6,'0')+'"/>').join('')+'</svg>').join('')+'<p>'+(npc.mapId==='havn'?'Bryggehavn':npc.mapId==='butikk'?'Agnbutikken':'Skogstjernet')+' · '+(npc.route.length>1?'Kort vandrerute':'Står i ro')+'</p>'
 main.append(article)
}
