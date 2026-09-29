export type ItemCategory = 'equipment' | 'consumable' | 'key' | 'clothing'
export type BaitId = 'worm' | 'bread' | 'spinner'
export type ItemId = 'rod' | 'shovel' | BaitId
export type Item = { id: ItemId; name: string; icon: string; category: ItemCategory; description: string; bait?: boolean }

export const CATEGORIES: { id: ItemCategory; name: string }[] = [
  { id: 'equipment', name: 'Utstyr' },
  { id: 'consumable', name: 'Forbruksutstyr' },
  { id: 'key', name: 'Nøkkelgjenstander' },
  { id: 'clothing', name: 'Klær' },
]

export const ITEMS: Item[] = [
  { id: 'rod', name: 'Fiskestang', icon: '🎣', category: 'equipment', description: 'Nødvendig for å fiske.' },
  { id: 'shovel', name: 'Spade', icon: '🪏', category: 'equipment', description: 'Grav etter mark på jordflekker.' },
  { id: 'worm', name: 'Mark', icon: '🪱', category: 'consumable', description: 'Godt agn for mort og abbor.', bait: true },
  { id: 'bread', name: 'Brød', icon: '🍞', category: 'consumable', description: 'Tiltrekker særlig mort.', bait: true },
  { id: 'spinner', name: 'Sluk', icon: '✨', category: 'consumable', description: 'Tiltrekker rovfisk. Kan skaffes senere.', bait: true },
]

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(item => [item.id, item])) as Record<ItemId, Item>
export const BAIT_WEIGHTS: Record<BaitId, Record<string, number>> = {
  worm: { mort: 1.5, abbor: 1.3, gjedde: 0.7, gullorret: 1 },
  bread: { mort: 2, abbor: 0.5, gjedde: 0.2, gullorret: 0.3 },
  spinner: { mort: 0.3, abbor: 1.3, gjedde: 2, gullorret: 1.8 },
}
