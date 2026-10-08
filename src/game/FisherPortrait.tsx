import { fisherPixels } from './fisherSprite'
import maleDown from '../assets/characters/player/down.png'
import maleRight from '../assets/characters/player/right.png'
import maleUp from '../assets/characters/player/up.png'
import maleLeft from '../assets/characters/player/left.png'
import femaleDown from '../assets/characters/player-female/down.png'
import femaleRight from '../assets/characters/player-female/right.png'
import femaleUp from '../assets/characters/player-female/up.png'
import femaleLeft from '../assets/characters/player-female/left.png'
import type { Appearance, Direction } from './world'

const portraits = {
  male: { down: maleDown, right: maleRight, up: maleUp, left: maleLeft },
  female: { down: femaleDown, right: femaleRight, up: femaleUp, left: femaleLeft },
}
export function FisherPortrait({ appearance, direction = 'down' }: { appearance: Appearance; direction?: Direction }) {
  if (appearance.playerVariant) return <img src={portraits[appearance.playerVariant][direction]} alt="Fisker med valgt utseende" className="fisher-portrait" style={{ objectFit: 'contain', imageRendering: 'pixelated' }} />
  return <svg viewBox="-2 -2 22 26" role="img" aria-label="Fisker med valgt utseende" className="fisher-portrait" shapeRendering="crispEdges">
    <path d="M3 20h12v2H3z" fill="#183a3633" />
    {fisherPixels(appearance, direction).map((p, i) => <rect key={i} x={p.x} y={p.y} width="1" height="1" fill={`#${p.color.toString(16).padStart(6, '0')}`} />)}
  </svg>
}
