import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { HoldRepeater } from './navigation'
import { ControlIcon, actionIcon } from './ControlIcon'
import type { Direction } from './world'

type Props = {
  context: string
  onDirection: (direction: Direction) => void
  onDirectionStart?: (direction: Direction) => boolean
  onDirectionEnd?: () => void
  onAction: () => void
  onActionStart?: () => boolean
  onActionEnd?: () => void
  onMenu: () => void
  onBack?: () => void
  backDisabled?: boolean
  onUtilityStart?: () => void
  onUtilityEnd?: () => void
  utilityHeld?: boolean
  utilityDisabled?: boolean
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
  const utilityPointer = useRef<number | null>(null)
  const [held, setHeld] = useState<Direction | null>(null)
  const backMode = props.context !== 'world'
  function stopDirection(event?: PointerEvent<HTMLButtonElement>) {
    if (event && pointer.current !== event.pointerId) return
    pointer.current = null
    repeater.current.stop()
    latest.current.onDirectionEnd?.()
    setHeld(null)
  }
  function stop() {
    stopDirection()
    actionPointer.current = null
    latest.current.onActionEnd?.()
    utilityPointer.current = null
    latest.current.onUtilityEnd?.()
  }
  function startUtility(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || props.disabled) return
    if (backMode) {
      event.preventDefault()
      if (!props.backDisabled) latest.current.onBack?.()
      return
    }
    if (utilityPointer.current !== null || props.utilityDisabled || !props.onUtilityStart) return
    event.preventDefault()
    utilityPointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    latest.current.onUtilityStart?.()
  }
  function stopUtility(event?: PointerEvent<HTMLButtonElement>) {
    if (event && utilityPointer.current !== event.pointerId) return
    utilityPointer.current = null
    latest.current.onUtilityEnd?.()
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
      stop()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
    }
  }, [props.context, props.disabled])
  useEffect(() => { if (props.utilityDisabled) stopUtility() }, [props.utilityDisabled])
  function start(event: PointerEvent<HTMLButtonElement>, direction: Direction) {
    if (event.button !== 0 || pointer.current !== null || props.disabled) return
    event.preventDefault() // Keep the selected menu item focused.
    pointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setHeld(direction)
    if (!latest.current.onDirectionStart?.(direction)) repeater.current.start(() => latest.current.onDirection(direction))
  }
  const directions: [Direction, string, string][] = [['up', 'Opp', '▲'], ['left', 'Venstre', '◀'], ['down', 'Ned', '▼'], ['right', 'Høyre', '▶']]
  return <div className="handheld-controls" aria-label="Spillkontroller" onContextMenu={e => e.preventDefault()}>
    <div className="handheld-brand" aria-hidden="true"><i /> GODT<span>HAILL</span></div>
    <div className="dpad" role="group" aria-label="Styrekryss">
      {directions.map(([direction, label, symbol]) => <button key={direction} aria-label={label} className={`dpad-${direction}`} data-held={held === direction} disabled={props.disabled}
        onPointerDown={e => start(e, direction)} onPointerUp={stopDirection} onPointerCancel={stopDirection} onLostPointerCapture={stopDirection}
        onClick={e => { if (e.detail === 0) latest.current.onDirection(direction) }}>{symbol}</button>)}
      <span className="dpad-center" aria-hidden="true" />
    </div>
    <div className="handheld-buttons">
      <div className="handheld-key"><button className="pocket-menu" aria-label="Meny" disabled={props.disabled}
        onPointerDown={e => e.preventDefault()} onClick={props.onMenu}><ControlIcon name="menu" /></button></div>
      <div className="handheld-key"><button className="pocket-utility" aria-label={backMode ? 'B: tilbake' : 'Utility: hold for å løpe'} aria-pressed={backMode ? undefined : Boolean(props.utilityHeld)} data-held={!backMode && Boolean(props.utilityHeld)}
        disabled={props.disabled || (backMode ? props.backDisabled || !props.onBack : props.utilityDisabled || !props.onUtilityStart)}
        onPointerDown={startUtility} onPointerUp={stopUtility} onPointerCancel={stopUtility} onLostPointerCapture={stopUtility}
        onClick={e => { if (e.detail === 0 && latest.current.context !== 'world' && !latest.current.backDisabled) latest.current.onBack?.() }}
        onKeyDown={e => { if ([' ', 'Enter'].includes(e.key)) { if (backMode) { if (e.repeat) e.preventDefault(); return }; e.preventDefault(); if (!e.repeat) latest.current.onUtilityStart?.() } }}
        onKeyUp={e => { if (!backMode && [' ', 'Enter'].includes(e.key)) { e.preventDefault(); latest.current.onUtilityEnd?.() } }}
        onBlur={() => { if (utilityPointer.current === null) latest.current.onUtilityEnd?.() }}><ControlIcon name={backMode ? 'back' : 'shoes'} /></button></div>
      <div className="handheld-key"><button className="pocket-action" aria-label={props.actionLabel || 'A'} disabled={props.actionDisabled}
        onPointerDown={startAction} onPointerUp={stopAction} onPointerCancel={stopAction} onLostPointerCapture={stopAction} onClick={props.onAction}><ControlIcon name={actionIcon(props.actionLabel)} /></button></div>
    </div>
    <div className="speaker-grille" aria-hidden="true"><i /><i /><i /><i /><i /></div>
  </div>
}
