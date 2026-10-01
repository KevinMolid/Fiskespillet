import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { HoldRepeater } from './navigation'
import type { Direction } from './world'

type Props = {
  context: string
  onDirection: (direction: Direction) => void
  onAction: () => void
  onActionStart?: () => boolean
  onActionEnd?: () => void
  onMenu: () => void
  actionLabel: string
  disabled: boolean
  actionDisabled: boolean
}

export function MobileControls(props: Props) {
  const latest = useRef(props)
  latest.current = props
  const repeater = useRef(new HoldRepeater())
  const pointer = useRef<number | null>(null)
  const actionPointer = useRef<number | null>(null)
  const [held, setHeld] = useState<Direction | null>(null)
  function stop() {
    pointer.current = null
    repeater.current.stop()
    setHeld(null)
    actionPointer.current = null
    latest.current.onActionEnd?.()
  }
  function startAction(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || actionPointer.current !== null || props.actionDisabled) return
    event.preventDefault()
    actionPointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!latest.current.onActionStart?.()) latest.current.onActionEnd?.()
  }
  function stopAction(event?: PointerEvent<HTMLButtonElement>) {
    if (event && actionPointer.current !== event.pointerId) return
    actionPointer.current = null
    latest.current.onActionEnd?.()
  }
  useEffect(() => {
    stop()
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      repeater.current.stop()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
    }
  }, [props.context, props.disabled])
  function start(event: PointerEvent<HTMLButtonElement>, direction: Direction) {
    if (event.button !== 0 || pointer.current !== null || props.disabled) return
    event.preventDefault() // Keep the selected menu item focused.
    pointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setHeld(direction)
    repeater.current.start(() => latest.current.onDirection(direction))
  }
  const directions: [Direction, string, string][] = [['up', 'Opp', '▲'], ['left', 'Venstre', '◀'], ['down', 'Ned', '▼'], ['right', 'Høyre', '▶']]
  return <div className="handheld-controls" aria-label="Spillkontroller" onContextMenu={e => e.preventDefault()}>
    <div className="handheld-brand" aria-hidden="true"><i /> FISKE<span>POCKET</span></div>
    <div className="dpad" role="group" aria-label="Styrekryss">
      {directions.map(([direction, label, symbol]) => <button key={direction} aria-label={label} className={`dpad-${direction}`} data-held={held === direction} disabled={props.disabled}
        onPointerDown={e => start(e, direction)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
        onClick={e => { if (e.detail === 0) latest.current.onDirection(direction) }}>{symbol}</button>)}
      <span className="dpad-center" aria-hidden="true" />
    </div>
    <div className="handheld-buttons">
      <div className="handheld-key"><button className="pocket-menu" aria-label="Meny eller tilbake" disabled={props.disabled}
        onPointerDown={e => e.preventDefault()} onClick={props.onMenu}>≡</button><span>MENY / TILBAKE</span></div>
      <div className="handheld-key"><button className="pocket-action" aria-label={props.actionLabel || 'A'} disabled={props.actionDisabled}
        onPointerDown={startAction} onPointerUp={stopAction} onPointerCancel={stopAction} onLostPointerCapture={stopAction} onClick={props.onAction}>A</button><span>{props.actionLabel}</span></div>
    </div>
    <div className="speaker-grille" aria-hidden="true"><i /><i /><i /><i /><i /></div>
  </div>
}
