import { FISH } from './fish'

export type ItemCategory = 'equipment' | 'consumable' | 'fish' | 'key' | 'clothing'
export type BaitId = 'worm' | 'bread' | 'corn' | 'spinner'
export type FishItemId = `fish_${string}`
export type ItemId = 'rod' | 'shovel' | 'sneakers' | BaitId | FishItemId
export type Item = { id: ItemId; name: string; icon: string; category: ItemCategory; description: string; bait?: boolean }

export const CATEGORIES: { id: ItemCategory; name: string }[] = [
  { id: 'equipment', name: 'Utstyr' },
  { id: 'consumable', name: 'Forbruksutstyr' },
  { id: 'fish', name: 'Fisk' },
  { id: 'key', name: 'Nøkkelgjenstander' },
  { id: 'clothing', name: 'Klær' },
]

export const ITEMS: Item[] = [
  { id: 'rod', name: 'Fiskestang', icon: '🎣', category: 'equipment', description: 'Nødvendig for å fiske.' },
  { id: 'shovel', name: 'Spade', icon: '🪏', category: 'equipment', description: 'Grav etter mark på jordflekker.' },
  { id: 'sneakers', name: 'Joggesko', icon: '👟', category: 'key', description: 'Maritas rå joggesko. Hold B på skjermen eller Shift på tastaturet mens du beveger deg for å løpe.' },
  { id: 'worm', name: 'Mark', icon: '🪱', category: 'consumable', description: 'Godt agn for mort og abbor.', bait: true },
  { id: 'bread', name: 'Brød', icon: '🍞', category: 'consumable', description: 'Tiltrekker særlig mort.', bait: true },
  { id: 'corn', name: 'Mais', icon: '🌽', category: 'consumable', description: 'Et mildt agn som særlig lokker småfisk.', bait: true },
  { id: 'spinner', name: 'Sluk', icon: '✨', category: 'consumable', description: 'Tiltrekker særlig rovfisk.', bait: true },
  ...FISH.map((fish): Item => ({ id: fishItemId(fish.id), name: fish.name, icon: fish.icon, category: 'fish', description: 'Kan selges i butikken.' })),
]

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(item => [item.id, item])) as Record<ItemId, Item>
export function hasRunningShoes(inventory: { bag: Partial<Record<ItemId, number>> } | null): boolean {
  return (inventory?.bag.sneakers ?? 0) > 0
}
export const SHOP_PRICES: Record<BaitId, number> = { worm: 4, bread: 3, corn: 5, spinner: 12 }
export function fishItemId(speciesId: string): FishItemId { return `fish_${speciesId}` }
export const FISH_SELL_PRICES = Object.fromEntries(FISH.map(fish => [fishItemId(fish.id), fish.sellPrice])) as Record<FishItemId, number>
