import { STANDARD_CHARACTERS, playerCharacter } from '../src/game/characters'
import { CHARACTER_DIRECTIONS, CHARACTER_STATES, type CharacterAppearance, type HairStyle, type CharacterState } from '../src/game/characterStandard'
import { composedCharacter } from '../src/game/characterCompositor'
import { CHARACTER_PALETTES } from '../src/game/characterPalettes'
const names: Record<string,string>={player:'Spiller',kevin:'Kevin',mor:'Mor',far:'Far',oda:'Oda',magnus:'Magnus – kraftig og skallet',bendik:'Bendik',nils:'Nils',morten:'Morten'}
const grid=document.querySelector<HTMLDivElement>('#grid')!, controls=document.querySelector('#controls')!
let look: CharacterAppearance={...playerCharacter().appearance}
let state: CharacterState='idle'
function select(label: string, choices: string[], current: string, change: (value:string)=>void) {
  const element=document.createElement('label');element.textContent=label
  const input=document.createElement('select');input.setAttribute('aria-label',label)
  for(const value of choices) { const option=document.createElement('option');option.value=value;option.textContent=value;option.selected=value===current;input.append(option) }
  input.addEventListener('change',()=>{change(input.value);draw()});element.append(input);controls.append(element)
}
select('Hud',['light','medium','dark','deepSkin'],look.skinPalette,v=>look={...look,skinPalette:v})
select('Hår',['playerHair','shortHair','longHair','bald'],look.hair!,v=>look={...look,hair:v as HairStyle})
select('Hårfarge',['blond','darkBlond','brown','darkBrown','black','red'],look.hairPalette,v=>look={...look,hairPalette:v})
select('Overdel',['shirt','tshirt','sport','hawaiian'],look.top,v=>look={...look,top:v as CharacterAppearance['top']})
select('Klesfarge',Object.keys(CHARACTER_PALETTES),look.topPalette,v=>look={...look,topPalette:v})
select('Vest',['fishingVest','none'],look.outerwear!,v=>look={...look,outerwear:v==='none'?undefined:'fishingVest'})
select('Bukser',['cargo','jeans'],look.bottom,v=>look={...look,bottom:v as CharacterAppearance['bottom']})
select('Sko',['boots','sneakers'],look.shoes,v=>look={...look,shoes:v as CharacterAppearance['shoes'],shoesPalette:v==='sneakers'?'white':'brown'})
select('Hatt',['strawHat','none'],look.headwear!,v=>look={...look,headwear:v==='none'?undefined:'strawHat'})
select('Veske',['fishingSatchel','none'],'fishingSatchel',v=>look={...look,accessories:v==='none'?undefined:['fishingSatchel']})
select('State', [...CHARACTER_STATES],'idle',v=>state=v as CharacterState)
function draw() {
  grid.replaceChildren()
  for(const definition of STANDARD_CHARACTERS) {
    const character=definition.id==='player'?{...definition,appearance:look}:definition
    const card=document.createElement('article');card.className='card';card.dataset.character=character.id
    const title=document.createElement('h2');title.textContent=names[character.id];card.append(title)
    const views=document.createElement('div');views.className='views'
    const sprites=composedCharacter(character.appearance,state)
    for(const direction of CHARACTER_DIRECTIONS) {
      const column=document.createElement('div'),frame=document.createElement('div'),canvas=document.createElement('canvas')
      frame.className='frame';canvas.width=48;canvas.height=48;canvas.dataset.direction=direction
      const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.putImageData(new ImageData(sprites[direction],48,48),0,0)
      frame.append(canvas);column.append(frame)
      const caption=document.createElement('small');caption.textContent=direction;column.append(caption);views.append(column)
    }
    card.append(views);grid.append(card)
  }
}
draw()
