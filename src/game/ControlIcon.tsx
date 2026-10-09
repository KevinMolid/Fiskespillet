import type { ReactNode } from 'react'

type IconName = 'menu' | 'back' | 'select' | 'next' | 'shovel' | 'chat' | 'glasses' | 'shoes' | 'rod' | 'reel' | 'strike' | 'chest' | 'clothes' | 'shop'

const ACTION_ICONS: Record<string, IconName> = {
  Grav: 'shovel', Snakk: 'chat', Les: 'glasses', Fisk: 'rod',
  Velg: 'select', Videre: 'next', Sveiv: 'reel', 'Gi tilslag': 'strike',
  'Åpne kiste': 'chest', 'Skift klær': 'clothes', Handle: 'shop',
}

export function actionIcon(label: string): IconName { return ACTION_ICONS[label] ?? 'select' }

const ICONS: Record<IconName, ReactNode> = {
  menu: <path d="M5 6h14M5 12h14M5 18h14" />,
  back: <path d="m10 5-7 7 7 7M3 12h11a6 6 0 0 1 6 6" />,
  select: <path d="m5 12 4 4L19 6" />,
  next: <path d="M4 12h16m-7-7 7 7-7 7" />,
  shovel: <><path d="M9 3h6v3a3 3 0 0 1-6 0V3Zm3 6v6M7 15h10v2c0 3-3 5-5 5s-5-2-5-5v-2Z" /></>,
  chat: <><path d="M20 14a3 3 0 0 1-3 3H9l-5 4v-5a3 3 0 0 1-2-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8Z" /><path d="M6 9h.01M11 9h.01M16 9h.01" strokeWidth="3" /></>,
  glasses: <><circle cx="6.5" cy="14" r="4.5" /><circle cx="17.5" cy="14" r="4.5" /><path d="M11 13a2 2 0 0 1 2 0M2 13l2-8h3m15 8-2-8h-3" /></>,
  shoes: <><path d="M3 7h5l1 5 4 3 6 1c2 0 3 1 3 3v2H3V7ZM3 17h5l2 4M10 10l-1 3m4-1-2 3" /></>,
  rod: <><path d="m3 21 4-5L19 3M6 17l3 2M19 3v13a3 3 0 0 1-6 0v-2" /><circle cx="8" cy="14" r="2" /></>,
  reel: <><circle cx="10" cy="12" r="7" /><circle cx="10" cy="12" r="2" /><path d="m10 12 8-6h3v4h-3V6M3 20l3-3M10 5V3m0 16v2" /></>,
  strike: <><path d="m4 21 5-7L16 5m-9 11 3 2M16 5v9a3 3 0 0 1-6 0v-1M19 2v4m-2-2h4" /></>,
  chest: <><path d="M3 10h18v11H3V10Zm0 0V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2M3 14h7m4 0h7M7 3v7m10-7v7" /><path d="M10 12h4v5h-4z" /></>,
  clothes: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z" />,
  shop: <><path d="M4 9h16l-1-6H5L4 9Zm1 0v12h14V9M2 21h20M9 21v-7h6v7" /><path d="M4 9v1a2 2 0 0 0 4 0V9m0 0v1a2 2 0 0 0 4 0V9m0 0v1a2 2 0 0 0 4 0V9m0 0v1a2 2 0 0 0 4 0V9" /></>,
}

export function ControlIcon({ name }: { name: IconName }) {
  return <svg className="control-icon" data-icon={name} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[name]}</svg>
}
