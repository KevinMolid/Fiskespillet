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
export type CastLength = 'short' | 'medium' | 'long'
export type FishingFeature = 'reeds' | 'rocky' | 'dock' | 'open'
export type FishingDepth = 'surface' | 'midwater' | 'bottom'
export type RetrieveSpeed = 'slow' | 'steady' | 'fast'
export type FishingConditions = { bait: BaitId; castLength: CastLength; feature: FishingFeature; depth: FishingDepth; retrieve: RetrieveSpeed }
export type FishingProfile = {
  features?: Partial<Record<FishingFeature, number>>
  depths?: Partial<Record<FishingDepth, number>>
  retrieves?: Partial<Record<RetrieveSpeed, number>>
  castLengths?: Partial<Record<CastLength, number>>
  biteChance: number
  strikeWindowMs: number
  fightStrength: number
}
export type FishSpecies = {
  id: string; name: string; icon: string; scientificName: string | null; description: string; image?: string
  minGrams: number; maxGrams: number; plus: boolean
  rarity: Rarity; habitats: Habitat[]; methods: Method[]; sellPrice: number
  /** Relative bite strength for the player's currently available bait; 1 is neutral. */
  baitAffinity: Partial<Record<BaitId, number>>
  fishingProfile: FishingProfile
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
const fishingProfile = (preferences: Pick<FishingProfile, 'features' | 'depths' | 'retrieves' | 'castLengths'>, biteChance: number, strikeWindowMs: number, fightStrength: number): FishingProfile => ({ ...preferences, biteChance, strikeWindowMs, fightStrength })
const FISHING_PROFILES: Record<string, FishingProfile> = {
  makrell: fishingProfile({ features: { open: 1.3 }, depths: { surface: 1.35, midwater: 1.1 }, retrieves: { fast: 1.35, steady: 1.1 }, castLengths: { medium: 1.15, long: 1.15 } }, .72, 2400, .72),
  sei: fishingProfile({ features: { open: 1.2 }, depths: { midwater: 1.2, bottom: 1.15 }, retrieves: { fast: 1.2, steady: 1.1 }, castLengths: { medium: 1.15, long: 1.2 } }, .62, 2200, 1.08),
  torsk: fishingProfile({ features: { rocky: 1.3, dock: 1.1 }, depths: { bottom: 1.4, midwater: .8 }, retrieves: { slow: 1.3 }, castLengths: { long: 1.2 } }, .67, 2900, 1.02),
  orret: fishingProfile({ features: { rocky: 1.2, reeds: 1.15 }, depths: { surface: 1.1, midwater: 1.2 }, retrieves: { slow: 1.2, steady: 1.1 }, castLengths: { short: 1.1, medium: 1.15 } }, .65, 2800, .9),
  abbor: fishingProfile({ features: { reeds: 1.45, rocky: 1.15, open: .8 }, depths: { midwater: 1.3, surface: 1.05, bottom: .8 }, retrieves: { slow: 1.2, steady: 1.1 }, castLengths: { short: 1.2, medium: 1.1 } }, .67, 2900, .82),
  lyr: fishingProfile({ features: { rocky: 1.25, open: 1.1 }, depths: { midwater: 1.2, bottom: 1.1 }, retrieves: { fast: 1.25, steady: 1.1 }, castLengths: { medium: 1.1, long: 1.2 } }, .58, 2300, 1.12),
  sjoorret: fishingProfile({ features: { reeds: 1.2, rocky: 1.15 }, depths: { surface: 1.35, midwater: 1.1, bottom: .75 }, retrieves: { steady: 1.2, slow: 1.1 }, castLengths: { short: 1.1, medium: 1.15 } }, .62, 2800, 1),
  gjedde: fishingProfile({ features: { reeds: 1.5, rocky: .9 }, depths: { midwater: 1.3, surface: 1.05, bottom: .8 }, retrieves: { slow: 1.35, steady: 1.05 }, castLengths: { short: 1.2, medium: 1.15 } }, .61, 2300, 1.35),
  roye: fishingProfile({ features: { rocky: 1.25, open: 1.05 }, depths: { bottom: 1.25, midwater: 1.15, surface: .8 }, retrieves: { slow: 1.2, steady: 1.05 }, castLengths: { medium: 1.15 } }, .58, 2300, 1.05),
  sild: fishingProfile({ features: { open: 1.3 }, depths: { midwater: 1.25, surface: 1.1 }, retrieves: { fast: 1.25, steady: 1.1 }, castLengths: { medium: 1.1, long: 1.2 } }, .6, 1900, .62),
  hvitting: fishingProfile({ features: { open: 1.1, rocky: 1.1 }, depths: { bottom: 1.35, midwater: 1.05, surface: .7 }, retrieves: { slow: 1.25 }, castLengths: { medium: 1.1, long: 1.15 } }, .56, 2600, .76),
  rodspette: fishingProfile({ features: { rocky: 1.15, open: 1.1 }, depths: { bottom: 1.5, surface: .6, midwater: .8 }, retrieves: { slow: 1.3 }, castLengths: { medium: 1.1, long: 1.15 } }, .54, 2700, .82),
  harr: fishingProfile({ features: { rocky: 1.2, open: 1.1 }, depths: { surface: 1.15, midwater: 1.25, bottom: .75 }, retrieves: { steady: 1.2, slow: 1.1 }, castLengths: { short: 1.1, medium: 1.1 } }, .62, 2500, .82),
  sik: fishingProfile({ features: { open: 1.2, reeds: 1.05 }, depths: { midwater: 1.3, surface: 1.05, bottom: .8 }, retrieves: { slow: 1.15, steady: 1.15 }, castLengths: { medium: 1.1 } }, .55, 2200, .7),
  laks: fishingProfile({ features: { open: 1.15, rocky: 1.1 }, depths: { midwater: 1.15, bottom: 1.15, surface: .9 }, retrieves: { steady: 1.2, fast: 1.1 }, castLengths: { long: 1.3, medium: 1.05 } }, .58, 2100, 1.42),
  brosme: fishingProfile({ features: { rocky: 1.3, open: 1.05 }, depths: { bottom: 1.5, midwater: .8, surface: .5 }, retrieves: { slow: 1.3 }, castLengths: { long: 1.35 } }, .52, 2600, 1.32),
  lange: fishingProfile({ features: { rocky: 1.25, open: 1.1 }, depths: { bottom: 1.55, midwater: .75, surface: .5 }, retrieves: { slow: 1.3 }, castLengths: { long: 1.4 } }, .5, 2200, 1.5),
  gjors: fishingProfile({ features: { rocky: 1.25, open: 1.1 }, depths: { midwater: 1.25, bottom: 1.15, surface: .65 }, retrieves: { slow: 1.15, steady: 1.2 }, castLengths: { medium: 1.15, long: 1.2 } }, .56, 2200, 1.18),
  kveite: fishingProfile({ features: { rocky: 1.2, open: 1.15 }, depths: { bottom: 1.6, midwater: .7, surface: .4 }, retrieves: { slow: 1.3 }, castLengths: { long: 1.45 } }, .48, 2100, 1.6),
  steinbit: fishingProfile({ features: { rocky: 1.5, dock: 1.15 }, depths: { bottom: 1.5, midwater: .8, surface: .5 }, retrieves: { slow: 1.3 }, castLengths: { medium: 1.1, long: 1.2 } }, .52, 2600, 1.4),
  mort: fishingProfile({ features: { reeds: 1.45, open: .8 }, depths: { surface: 1.2, midwater: 1.1, bottom: .75 }, retrieves: { slow: 1.25, steady: 1.05 }, castLengths: { short: 1.35, medium: 1.05, long: .7 } }, .73, 3400, .54),
}
function species(id: string, name: string, minGrams: number, maxGrams: number, rarity: Rarity, methods: Method[], habitats: Habitat[], sellPrice: number, plus = false, baitAffinity: Partial<Record<BaitId, number>> = {}): FishSpecies {
  return { id, name, minGrams, maxGrams, rarity, methods, habitats, sellPrice, plus, baitAffinity, fishingProfile: FISHING_PROFILES[id], icon: '🐟', ...FIELD_GUIDE[id] }
}
export const FISH: FishSpecies[] = [
  { ...species('makrell','Makrell',100,3500,'Svært vanlig',['sluk','hekle','dorging'],sea,8,false,{spinner:1.4}), image: mackerelImage },
  { ...species('sei','Sei',100,20000,'Svært vanlig',['sluk','pilk','hekle'],sea,10,true,{spinner:1.1}), image: saitheImage },
  { ...species('torsk','Torsk',200,30000,'Svært vanlig',['pilk','jigg','agn'],sea,12,true,{worm:1.3}), image: codImage },
  { ...species('orret','Ørret',50,20000,'Svært vanlig',['sluk','spinner','mark','flue'],['bekk','elv','innsjø'],12,false,{worm:1.1,spinner:1.2}), image: troutImage },
  { ...species('abbor','Abbor',50,3000,'Svært vanlig',['spinner','jigg','mark','isfiske'],fresh,10,false,{worm:1.1,spinner:1.25}), image: perchIllustration },
  { ...species('lyr','Lyr',200,13000,'Vanlig',['sluk','jigg','flue'],sea,16,false,{spinner:1.25}), image: pollackImage },
  { ...species('sjoorret','Sjøørret',200,12000,'Vanlig',['sluk','flue','wobbler'],['kyst','fjord','elv'],20,false,{spinner:1.25}), image: seaTroutImage },
  { ...species('gjedde','Gjedde',200,17000,'Vanlig',['wobbler','jerkbait','jigg'],fresh,22,true), image: pikeImage },
  { ...species('roye','Røye',50,10000,'Vanlig',['isfiske','mark','flue','sluk'],fresh,18,true,{worm:1.1,spinner:1.1}), image: charImage },
  { ...species('sild','Sild',50,700,'Vanlig',['hekle','små sluker'],sea,8), image: herringImage },
  { ...species('hvitting','Hvitting',100,3000,'Vanlig',['agn','pilk'],sea,14,false,{worm:1.2}), image: whitingImage },
  { ...species('rodspette','Rødspette',200,5000,'Vanlig',['bunnmeite'],['kyst','fjord'],18), image: plaiceImage },
  { ...species('harr','Harr',100,3000,'Vanlig',['flue','mark','spinner'],['elv','innsjø'],16), image: graylingImage },
  { ...species('sik','Sik',100,4000,'Vanlig',['mark','maggot','flue'],fresh,16,false,{worm:1.1}), image: whitefishImage },
  { ...species('laks','Laks',1000,30000,'Mindre vanlig',['flue','sluk','mark'],['elv','fjord','kyst','hav'],35,true,{worm:1.1,spinner:1.2}), image: salmonImage },
  { ...species('brosme','Brosme',500,20000,'Mindre vanlig',['dypt agnfiske'],['fjord','hav'],30), image: tuskImage },
  { ...species('lange','Lange',500,30000,'Mindre vanlig',['dypt agnfiske'],['fjord','hav'],32,true), image: lingImage },
  { ...species('gjors','Gjørs',200,12000,'Sjelden/lokal',['jigg','vertikalfiske','agnfisk'],fresh,40), image: zanderImage },
  { ...species('kveite','Kveite',1000,200000,'Sjelden',['jigg','agnfisk'],sea,80,true), image: halibutImage },
  { ...species('steinbit','Steinbit',500,20000,'Sjelden',['agn','jigg'],sea,55,true,{worm:1.1}), image: wolffishImage },
  { ...species('mort','Mort',80,650,'Svært vanlig',['mark','brød','mais'],fresh,6,false,{worm:0.85,bread:1.7,corn:1.25}), image: roachImage },
]
export const FISH_BY_ID = Object.fromEntries(FISH.map(fish => [fish.id,fish])) as Record<string,FishSpecies>
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
export function fishingOptions(zoneId: string, bait: BaitId | null, conditions?: FishingConditions) {
  if (!FISHING_ZONES[zoneId]) throw new Error('Ukjent fiskeområde.')
  if (!bait) return []
  return FISH.filter(fish=>livesInZone(fish,zoneId) && compatibleBaits(fish).includes(bait)).map(species=>({
    species,
    weight:Math.max(1,Math.round(RARITY_WEIGHT[species.rarity]
      *(species.baitAffinity[bait] ?? 1)
      *(conditions ? species.fishingProfile.features?.[conditions.feature] ?? 1 : 1)
      *(conditions ? species.fishingProfile.depths?.[conditions.depth] ?? 1 : 1)
      *(conditions ? species.fishingProfile.retrieves?.[conditions.retrieve] ?? 1 : 1)
      *(conditions ? species.fishingProfile.castLengths?.[conditions.castLength] ?? 1 : 1))),
  }))
}
export function availableZones(fish: FishSpecies) { return Object.entries(FISHING_ZONES).filter(([id])=>livesInZone(fish,id)).map(([,zone])=>zone.name) }
export function biteProbability(fish: FishSpecies, conditions: FishingConditions) {
  const profile = fish.fishingProfile
  const fit = (profile.features?.[conditions.feature] ?? 1)
    *(profile.depths?.[conditions.depth] ?? 1)
    *(profile.retrieves?.[conditions.retrieve] ?? 1)
    *(profile.castLengths?.[conditions.castLength] ?? 1)
    *(fish.baitAffinity[conditions.bait] ?? 1)
  return Math.min(.92, Math.max(.25, profile.biteChance * Math.sqrt(Math.min(2.5, Math.max(.35, fit)))))
}
// The plus sign permits rare record fish up to 20% over the listed size. Most fish are small.
export function weightCeiling(fish: FishSpecies) { return Math.round(fish.maxGrams*(fish.plus?1.2:1)) }
export function rollFish(zoneId: string, bait: BaitId | null = null, random: () => number = Math.random, conditions?: FishingConditions) {
  const options = fishingOptions(zoneId,bait,conditions)
  if (!options.length) return null
  const total = options.reduce((sum,o)=>sum+o.weight,0)
  let roll = random()*total
  const species = (options.find(o=>(roll-=o.weight)<0) ?? options[options.length-1]).species
  const grams = Math.round(species.minGrams+Math.pow(random(),3)*(weightCeiling(species)-species.minGrams))
  const bites = conditions ? random() < biteProbability(species,conditions) : random() < .68
  return {species,grams,bites}
}
export function weightRange(fish: FishSpecies) {
  const format=(grams:number)=>grams<1000
    ? `${grams.toLocaleString('nb-NO')} g`
    : `${(grams/1000).toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:2})} kg`
  return `${format(fish.minGrams)} – ${format(fish.maxGrams)}${fish.plus?'+':''}`
}
