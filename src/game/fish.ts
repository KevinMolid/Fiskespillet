import type { BaitId } from './items'
import mackerelImage from '../assets/fish/makrell.png'
import saitheImage from '../assets/fish/sei.png'
import codImage from '../assets/fish/torsk.png'
import troutImage from '../assets/fish/orret.png'
import perchIllustration from '../assets/fish/abbor.png'
import pollackImage from '../assets/fish/lyr.png'
import seaTroutImage from '../assets/fish/sjoorret.png'
import pikeImage from '../assets/fish/gjedde.png'
import charImage from '../assets/fish/roye.png'
import herringImage from '../assets/fish/sild.png'
import whitingImage from '../assets/fish/hvitting.png'
import plaiceImage from '../assets/fish/rodspette.png'
import graylingImage from '../assets/fish/harr.png'
import whitefishImage from '../assets/fish/sik.png'
import salmonImage from '../assets/fish/laks.png'
import tuskImage from '../assets/fish/brosme.png'
import lingImage from '../assets/fish/lange.png'
import zanderImage from '../assets/fish/gjors.png'
import halibutImage from '../assets/fish/kveite.png'
import wolffishImage from '../assets/fish/steinbit.png'
import roachImage from '../assets/fish/mort.png'

export type Habitat = 'kyst' | 'fjord' | 'hav' | 'bekk' | 'elv' | 'innsjø'
export type Rarity = 'Svært vanlig' | 'Vanlig' | 'Mindre vanlig' | 'Sjelden/lokal' | 'Sjelden'
export type Method = 'sluk' | 'små sluker' | 'spinner' | 'hekle' | 'dorging' | 'pilk' | 'jigg' | 'agn' | 'mark' | 'flue' | 'isfiske' | 'wobbler' | 'jerkbait' | 'bunnmeite' | 'maggot' | 'dypt agnfiske' | 'vertikalfiske' | 'agnfisk' | 'brød' | 'mais'
export type FishSpecies = {
  id: string; name: string; icon: string; scientificName: string | null; description: string; image?: string
  minGrams: number; maxGrams: number; plus: boolean
  rarity: Rarity; habitats: Habitat[]; methods: Method[]; reward: number
}
const FIELD_GUIDE: Record<string, { scientificName: string | null; description: string }> = {
  "makrell": {
    "scientificName": "Scomber scombrus",
    "description": "Makrellen mangler svømmeblære og må holde seg i bevegelse for ikke å synke."
  },
  "sei": {
    "scientificName": "Pollachius virens",
    "description": "Ung sei samler seg ofte i stimer. Seien kan vandre langt på jakt etter mat."
  },
  "torsk": {
    "scientificName": "Gadus morhua",
    "description": "Skrei er torsk som vandrer langt mellom oppvekstområder og gyteområder. Kysttorsk er vanligvis mer stedbunden."
  },
  "orret": {
    "scientificName": "Salmo trutta",
    "description": "Ørret hører til laksefamilien. Aure er et annet norsk navn på samme art."
  },
  "abbor": {
    "scientificName": "Perca fluviatilis",
    "description": "Abboren svømmer gjerne i stim, mens store individer ofte går alene eller i små grupper."
  },
  "lyr": {
    "scientificName": "Pollachius pollachius",
    "description": "Lyren ligner sei, men har tydelig underbitt og en mørk sidelinje som buer nedover."
  },
  "sjoorret": {
    "scientificName": "Salmo trutta",
    "description": "Sjøørret er samme art som ørret. Den vandrer ut i sjøen for å spise, men gyter i ferskvann."
  },
  "gjedde": {
    "scientificName": "Esox lucius",
    "description": "Voksne gjedder spiser først og fremst andre fisk. De kan også spise mindre gjedder."
  },
  "roye": {
    "scientificName": "Salvelinus alpinus",
    "description": "Røya er godt tilpasset kaldt vann og kan klare seg der det er lite næring."
  },
  "sild": {
    "scientificName": "Clupea harengus",
    "description": "Silda svømmer i stimer ute i vannmassene."
  },
  "hvitting": {
    "scientificName": "Merlangius merlangus",
    "description": "Unge hvittinger kan gjemme seg mellom trådene til brennmaneter. Voksne hvittinger mangler skjeggtråd."
  },
  "rodspette": {
    "scientificName": "Pleuronectes platessa",
    "description": "Rødspetta er en flatfisk med karakteristiske røde eller oransje flekker på oversiden."
  },
  "harr": {
    "scientificName": "Thymallus thymallus",
    "description": "Harren kjennes igjen på den store ryggfinnen. Den snapper gjerne opp mat som kommer drivende med strømmen."
  },
  "sik": {
    "scientificName": "Coregonus lavaretus",
    "description": "Siken er en sølvblank laksefisk med liten munn. Den har en liten fettfinne mellom ryggfinnen og halen."
  },
  "laks": {
    "scientificName": "Salmo salar",
    "description": "Laksen vokser opp i ferskvann før den vandrer ut i havet. Vanligvis vender den tilbake til elva der den ble født for å gyte."
  },
  "brosme": {
    "scientificName": "Brosme brosme",
    "description": "Brosma kan bli over 20 år gammel. Den spiser både fisk og krepsdyr."
  },
  "lange": {
    "scientificName": "Molva molva",
    "description": "Langen er en torskefisk med en uvanlig langstrakt kropp."
  },
  "gjors": {
    "scientificName": "Sander lucioperca",
    "description": "Gjørsen er en rovfisk som blant annet spiser småfisk som krøkle og mort."
  },
  "kveite": {
    "scientificName": "Hippoglossus hippoglossus",
    "description": "Kveita er en flatfisk med mørk overside og lys underside. Den er den største beinfisken i norske farvann."
  },
  "steinbit": {
    "scientificName": "Anarhichas lupus",
    "description": "Denne steinbiten kalles også gråsteinbit. Den kan leve i omtrent 20–25 år."
  },
  "mort": {
    "scientificName": "Rutilus rutilus",
    "description": "Unge mort spiser mye dyreplankton. Eldre mort spiser også bunndyr og plantedeler."
  },
}
const sea: Habitat[] = ['kyst','fjord','hav'], fresh: Habitat[] = ['innsjø','elv']
function species(id: string, name: string, minGrams: number, maxGrams: number, rarity: Rarity, methods: Method[], habitats: Habitat[], reward: number, plus = false): FishSpecies {
  return { id, name, minGrams, maxGrams, rarity, methods, habitats, reward, plus, icon: '🐟', ...FIELD_GUIDE[id] }
}
export const FISH: FishSpecies[] = [
  { ...species('makrell','Makrell',100,3500,'Svært vanlig',['sluk','hekle','dorging'],sea,8), image: mackerelImage },
  { ...species('sei','Sei',100,20000,'Svært vanlig',['sluk','pilk','hekle'],sea,10,true), image: saitheImage },
  { ...species('torsk','Torsk',200,30000,'Svært vanlig',['pilk','jigg','agn'],sea,12,true), image: codImage },
  { ...species('orret','Ørret',50,20000,'Svært vanlig',['sluk','spinner','mark','flue'],['bekk','elv','innsjø'],12), image: troutImage },
  { ...species('abbor','Abbor',50,3000,'Svært vanlig',['spinner','jigg','mark','isfiske'],fresh,10), image: perchIllustration },
  { ...species('lyr','Lyr',200,13000,'Vanlig',['sluk','jigg','flue'],sea,16), image: pollackImage },
  { ...species('sjoorret','Sjøørret',200,12000,'Vanlig',['sluk','flue','wobbler'],['kyst','fjord','elv'],20), image: seaTroutImage },
  { ...species('gjedde','Gjedde',200,17000,'Vanlig',['wobbler','jerkbait','jigg'],fresh,22,true), image: pikeImage },
  { ...species('roye','Røye',50,10000,'Vanlig',['isfiske','mark','flue','sluk'],fresh,18,true), image: charImage },
  { ...species('sild','Sild',50,700,'Vanlig',['hekle','små sluker'],sea,8), image: herringImage },
  { ...species('hvitting','Hvitting',100,3000,'Vanlig',['agn','pilk'],sea,14), image: whitingImage },
  { ...species('rodspette','Rødspette',200,5000,'Vanlig',['bunnmeite'],['kyst','fjord'],18), image: plaiceImage },
  { ...species('harr','Harr',100,3000,'Vanlig',['flue','mark','spinner'],['elv','innsjø'],16), image: graylingImage },
  { ...species('sik','Sik',100,4000,'Vanlig',['mark','maggot','flue'],fresh,16), image: whitefishImage },
  { ...species('laks','Laks',1000,30000,'Mindre vanlig',['flue','sluk','mark'],['elv','fjord','kyst','hav'],35,true), image: salmonImage },
  { ...species('brosme','Brosme',500,20000,'Mindre vanlig',['dypt agnfiske'],['fjord','hav'],30), image: tuskImage },
  { ...species('lange','Lange',500,30000,'Mindre vanlig',['dypt agnfiske'],['fjord','hav'],32,true), image: lingImage },
  { ...species('gjors','Gjørs',200,12000,'Sjelden/lokal',['jigg','vertikalfiske','agnfisk'],fresh,40), image: zanderImage },
  { ...species('kveite','Kveite',1000,200000,'Sjelden',['jigg','agnfisk'],sea,80,true), image: halibutImage },
  { ...species('steinbit','Steinbit',500,20000,'Sjelden',['agn','jigg'],sea,55,true), image: wolffishImage },
  { ...species('mort','Mort',80,650,'Svært vanlig',['mark','brød','mais'],fresh,6), image: roachImage },
]
export const FISH_BY_ID = Object.fromEntries(FISH.map(fish => [fish.id,fish])) as Record<string,FishSpecies>
export const FISH_REWARDS = Object.fromEntries(FISH.map(fish => [fish.id,fish.reward])) as Record<string,number>
export const RARITY_WEIGHT: Record<Rarity,number> = { 'Svært vanlig': 60, 'Vanlig': 25, 'Mindre vanlig': 8, 'Sjelden/lokal': 3, 'Sjelden': 1 }
// An item's internal legacy ID is not a method: spinner is the existing item named Sluk.
export const BAIT_METHODS: Record<BaitId,Method[]> = { worm: ['mark','agn'], bread: ['brød'], corn: ['mais'], spinner: ['sluk'] }
export const FISHING_ZONES: Record<string,{name:string; habitats: Habitat[]; excluded: string[]}> = {
  havn: {name:'Bryggehavn',habitats:['kyst'],excluded:[]},
  skogstjern: {name:'Skogstjernet',habitats:['innsjø'],excluded:['gjors']},
}
export function livesInZone(fish: FishSpecies, zoneId: string) {
  const zone = FISHING_ZONES[zoneId]
  return Boolean(zone && !zone.excluded.includes(fish.id) && fish.habitats.some(h=>zone.habitats.includes(h)))
}
export function compatibleBaits(fish: FishSpecies): BaitId[] {
  return (Object.keys(BAIT_METHODS) as BaitId[]).filter(bait=>BAIT_METHODS[bait].some(method=>fish.methods.includes(method)))
}
export function fishingOptions(zoneId: string, bait: BaitId | null) {
  if (!FISHING_ZONES[zoneId]) throw new Error('Ukjent fiskeområde.')
  if (!bait) return []
  return FISH.filter(fish=>livesInZone(fish,zoneId) && compatibleBaits(fish).includes(bait)).map(species=>({species,weight:RARITY_WEIGHT[species.rarity]}))
}
export function availableZones(fish: FishSpecies) { return Object.entries(FISHING_ZONES).filter(([id])=>livesInZone(fish,id)).map(([,zone])=>zone.name) }
// The plus sign permits rare record fish up to 20% over the listed size. Most fish are small.
export function weightCeiling(fish: FishSpecies) { return Math.round(fish.maxGrams*(fish.plus?1.2:1)) }
export function rollFish(zoneId: string, bait: BaitId | null = null, random: () => number = Math.random) {
  const options = fishingOptions(zoneId,bait)
  if (!options.length) return null
  const total = options.reduce((sum,o)=>sum+o.weight,0)
  let roll = random()*total
  const species = (options.find(o=>(roll-=o.weight)<0) ?? options[options.length-1]).species
  const grams = Math.round(species.minGrams+Math.pow(random(),3)*(weightCeiling(species)-species.minGrams))
  return {species,grams,caught:random()>=0.18}
}
export function weightRange(fish: FishSpecies) {
  const kg=(n:number)=>(n/1000).toLocaleString('nb-NO',{maximumFractionDigits:2})
  return kg(fish.minGrams)+'–'+kg(fish.maxGrams)+(fish.plus?'+':'')+' kg'
}
