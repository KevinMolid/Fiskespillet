export type ItemCategory = 'equipment' | 'consumable' | 'key' | 'clothing'
export type BaitId = 'worm' | 'bread' | 'corn' | 'spinner'
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
  { id: 'corn', name: 'Mais', icon: '🌽', category: 'consumable', description: 'Et mildt agn som særlig lokker småfisk.', bait: true },
  { id: 'spinner', name: 'Sluk', icon: '✨', category: 'consumable', description: 'Tiltrekker særlig rovfisk.', bait: true },
]

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(item => [item.id, item])) as Record<ItemId, Item>
export const SHOP_PRICES: Record<BaitId, number> = { worm: 4, bread: 3, corn: 5, spinner: 12 }
export { FISH_REWARDS } from './fish'
