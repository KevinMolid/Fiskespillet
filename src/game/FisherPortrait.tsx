import { fisherPixels } from './fisherSprite'
import type { Appearance, Direction } from './world'

export function FisherPortrait({ appearance, direction = 'down' }: { appearance: Appearance; direction?: Direction }) {
  return <svg viewBox="-2 -2 22 26" role="img" aria-label="Fisker med valgt utseende" className="fisher-portrait" shapeRendering="crispEdges">
    <path d="M3 20h12v2H3z" fill="#183a3633" />
    {fisherPixels(appearance, direction).map((p, i) => <rect key={i} x={p.x} y={p.y} width="1" height="1" fill={`#${p.color.toString(16).padStart(6, '0')}`} />)}
  </svg>
}
