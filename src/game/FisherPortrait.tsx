import { useEffect, useRef } from 'react'
import { composedCharacter } from './characterCompositor'
import { playerCharacter } from './characters'
import type { Appearance, Direction } from './world'

export function FisherPortrait({ appearance, direction='down' }: { appearance: Appearance; direction?: Direction }) {
  const canvas=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled=false
    ctx.putImageData(new ImageData(composedCharacter(playerCharacter(appearance).appearance)[direction],48,48),0,0)
  },[appearance,direction])
  return <canvas ref={canvas} width={48} height={48} role="img" aria-label="Fisker med valgt utseende" className="fisher-portrait" />
}
