import { useEffect, useRef, type RefObject } from 'react'
import { nextControl } from './navigation'
import type { Direction } from './world'

type Options = {
  frame: RefObject<HTMLDivElement | null>
  context: string
  modal: boolean
  locked: boolean
  move: (direction: Direction) => void
  action: () => void
  tapAction?: () => boolean
  menu: () => void
  holdStart?: () => boolean
  holdEnd?: () => void
}

export function useGameInput(options: Options) {
  const latest = useRef(options)
  latest.current = options
  const selected = useRef<HTMLButtonElement | null>(null)
  const selectedPoint = useRef({ x: 0, y: 0 })
  const buttons = () => Array.from(latest.current.frame.current?.querySelectorAll<HTMLButtonElement>('[role="dialog"] button:not(:disabled)') ?? []).filter(b => b.getClientRects().length > 0)
  function select(button?: HTMLButtonElement) {
    if (!button) return
    selected.current?.removeAttribute('data-nav-active')
    selected.current = button
    const rect = button.getBoundingClientRect()
    selectedPoint.current = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    button.dataset.navActive = 'true'
    button.focus({ preventScroll: true })
  }
  function direction(value: Direction) {
    if (latest.current.locked) return
    if (!latest.current.modal) { latest.current.move(value); return }
    const scroller = document.activeElement instanceof HTMLElement && document.activeElement.hasAttribute('data-nav-scroll') ? document.activeElement : null
    if (scroller) {
      if (value === 'up' || value === 'down') scroller.scrollBy({ top: value === 'down' ? 64 : -64 })
      else select(selected.current ?? undefined)
      return
    }
    const list = selected.current?.closest('[data-nav-list]')
    if (list && (value === 'up' || value === 'down')) {
      const entries = Array.from(list.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const index = entries.indexOf(selected.current!)
      select(entries[Math.max(0, Math.min(entries.length - 1, index + (value === 'down' ? 1 : -1)))])
      return
    }
    const controls = buttons()
    const index = controls.indexOf(selected.current!)
    const points = controls.map(button => {
      const rect = button.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    })
    select(controls[nextControl(points, index, value)])
  }
  function action() {
    if (latest.current.locked) return
    if (latest.current.tapAction?.()) return
    if (!latest.current.modal) { latest.current.action(); return }
    const controls = buttons()
    const current = controls.includes(selected.current!) ? selected.current! : controls[0]
    current?.click()
  }
  useEffect(() => {
    if (options.modal) {
      const controls = buttons()
      select(controls.find(b => b.hasAttribute('data-autofocus')) ?? controls.find(b => b.getAttribute('aria-pressed') === 'true') ?? controls[0])
    } else {
      selected.current = null
    }
  }, [options.context, options.modal])
  useEffect(() => {
    function restoreSelection() {
      if (!latest.current.modal || latest.current.locked) return
      const controls = buttons()
      if (controls.includes(selected.current!)) return
      const distance = (button: HTMLButtonElement) => {
        const rect = button.getBoundingClientRect()
        return Math.hypot(rect.x + rect.width / 2 - selectedPoint.current.x, rect.y + rect.height / 2 - selectedPoint.current.y)
      }
      select(controls.sort((a, b) => distance(a) - distance(b))[0])
    }
    restoreSelection()
    const observer = new MutationObserver(restoreSelection)
    if (options.frame.current) observer.observe(options.frame.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] })
    return () => observer.disconnect()
  }, [options.modal, options.locked, options.frame])
  useEffect(() => {
    const arrows: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || target?.closest('input, textarea, select, .app-header') || event.ctrlKey || event.metaKey || event.altKey) return
      const current = latest.current
      const inFrame = target && current.frame.current?.contains(target)
      if (!current.modal && target?.closest('button, a') && !inFrame) return
      if (!arrows[event.key] && !['Enter', 'Escape', 'e', 'E', ' ', 'Tab'].includes(event.key)) return
      // Desktop walking remains in Phaser's continuous key state.
      if (arrows[event.key] && !current.modal) return
      if (event.key === 'Tab' && !current.modal) return
      event.preventDefault()
      event.stopPropagation()
      if (current.locked) return
      if (arrows[event.key]) { direction(arrows[event.key]); return }
      if (event.repeat) return
      if (event.key === 'Tab') {
        const controls = buttons()
        const index = controls.indexOf(selected.current!)
        select(controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length])
      } else if (event.key === 'Escape' || (event.key === 'Enter' && !current.modal)) current.menu()
      else if (['e', 'E', ' '].includes(event.key) && current.holdStart?.()) return
      else action()
    }
    function keyup(event: KeyboardEvent) {
      if (['e', 'E', ' '].includes(event.key)) latest.current.holdEnd?.()
    }
    function stopHold() { latest.current.holdEnd?.() }
    function focus(event: FocusEvent) {
      const target = event.target
      if (target instanceof HTMLButtonElement && latest.current.frame.current?.contains(target) && target.closest('[role="dialog"]')) {
        select(target)
      }
    }
    window.addEventListener('keydown', keydown, true)
    window.addEventListener('keyup', keyup, true)
    window.addEventListener('blur', stopHold)
    window.addEventListener('focusin', focus)
    return () => { window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup, true); window.removeEventListener('blur', stopHold); window.removeEventListener('focusin', focus) }
  }, [])
  return { direction, action, menu: () => { if (!latest.current.locked) latest.current.menu() } }
}
