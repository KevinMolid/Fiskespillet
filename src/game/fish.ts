import type { BaitId } from './items'

export type Habitat = 'kyst' | 'fjord' | 'hav' | 'bekk' | 'elv' | 'innsjø'
export type Rarity = 'Svært vanlig' | 'Vanlig' | 'Mindre vanlig' | 'Sjelden/lokal' | 'Sjelden'
export type Method = 'sluk' | 'små sluker' | 'spinner' | 'hekle' | 'dorging' | 'pilk' | 'jigg' | 'agn' | 'mark' | 'flue' | 'isfiske' | 'wobbler' | 'jerkbait' | 'bunnmeite' | 'maggot' | 'dypt agnfiske' | 'vertikalfiske' | 'agnfisk' | 'brød' | 'mais'
export type FishSpecies = {
  id: string; name: string; icon: string; description: string
  minGrams: number; maxGrams: number; plus: boolean
  rarity: Rarity; habitats: Habitat[]; methods: Method[]; reward: number
}
const sea: Habitat[] = ['kyst','fjord','hav'], fresh: Habitat[] = ['innsjø','elv']
function species(id: string, name: string, minGrams: number, maxGrams: number, rarity: Rarity, methods: Method[], habitats: Habitat[], reward: number, plus = false): FishSpecies {
  return { id, name, minGrams, maxGrams, rarity, methods, habitats, reward, plus, icon: '🐟', description: name + ' finnes i ' + habitats.join(', ') + '.' }
}
export const FISH: FishSpecies[] = [
  species('makrell','Makrell',100,3500,'Svært vanlig',['sluk','hekle','dorging'],sea,8),
  species('sei','Sei',100,20000,'Svært vanlig',['sluk','pilk','hekle'],sea,10,true),
  species('torsk','Torsk',200,30000,'Svært vanlig',['pilk','jigg','agn'],sea,12,true),
  species('orret','Ørret',50,20000,'Svært vanlig',['sluk','spinner','mark','flue'],['bekk','elv','innsjø'],12),
  species('abbor','Abbor',50,3000,'Svært vanlig',['spinner','jigg','mark','isfiske'],fresh,10),
  species('lyr','Lyr',200,13000,'Vanlig',['sluk','jigg','flue'],sea,16),
  species('sjoorret','Sjøørret',200,12000,'Vanlig',['sluk','flue','wobbler'],['kyst','fjord','elv'],20),
  species('gjedde','Gjedde',200,17000,'Vanlig',['wobbler','jerkbait','jigg'],fresh,22,true),
  species('roye','Røye',50,10000,'Vanlig',['isfiske','mark','flue','sluk'],fresh,18,true),
  species('sild','Sild',50,700,'Vanlig',['hekle','små sluker'],sea,8),
  species('hvitting','Hvitting',100,3000,'Vanlig',['agn','pilk'],sea,14),
  species('rodspette','Rødspette',200,5000,'Vanlig',['bunnmeite'],['kyst','fjord'],18),
  species('harr','Harr',100,3000,'Vanlig',['flue','mark','spinner'],['elv','innsjø'],16),
  species('sik','Sik',100,4000,'Vanlig',['mark','maggot','flue'],fresh,16),
  species('laks','Laks',1000,30000,'Mindre vanlig',['flue','sluk','mark'],['elv','fjord','kyst','hav'],35,true),
  species('brosme','Brosme',500,20000,'Mindre vanlig',['dypt agnfiske'],['fjord','hav'],30),
  species('lange','Lange',500,30000,'Mindre vanlig',['dypt agnfiske'],['fjord','hav'],32,true),
  species('gjors','Gjørs',200,12000,'Sjelden/lokal',['jigg','vertikalfiske','agnfisk'],fresh,40),
  species('kveite','Kveite',1000,200000,'Sjelden',['jigg','agnfisk'],sea,80,true),
  species('steinbit','Steinbit',500,20000,'Sjelden',['agn','jigg'],sea,55,true),
  { ...species('mort','Mort',80,650,'Svært vanlig',['mark','brød','mais'],fresh,6), description: 'En liten, sølvblank stimfisk som trives ved bredden.' },
  { ...species('gullorret','Gullørret',300,2800,'Sjelden',['mark','sluk'],['innsjø'],65), icon: '✨', description: 'Spillets sjeldne fantasifisk, bevart fra Skogstjernet.' },
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
