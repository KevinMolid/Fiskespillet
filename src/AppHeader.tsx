import { useEffect, useId, useRef, useState } from 'react'
import { GameLogo } from './GameLogo'
import { MenuIcon } from './MenuIcon'

type Props = {
  account?: { name: string; avatar?: string }
  page?: 'home' | 'profile' | 'players'
  busy?: boolean
  onHome: () => void
  onProfile: () => void
  onPlayers: () => void
  onLogout: () => void
}

export function AppHeader({ account, page, busy = false, onHome, onProfile, onPlayers, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const disclosure = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOutside)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOutside)
    }
  }, [open])
  const choose = (action: () => void) => {
    setOpen(false)
    toggle.current?.focus()
    action()
  }
  return <header className="app-header" onKeyDownCapture={event => {
    // Header controls own their keys, independently of the world and pause menu.
    event.stopPropagation()
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      toggle.current?.focus()
    }
  }}>
    <button onClick={onHome} className="brand-home" aria-label="Godt Haill – spill"><GameLogo className="header-logo" variant="header" /></button>
    {account ? <div className="app-nav">
      <button onClick={onProfile} className="header-profile" aria-label="Åpne min profil" aria-current={page === 'profile' ? 'page' : undefined} title={account.name}>
        <span className="header-avatar">{account.avatar ? <img src={account.avatar} alt="" /> : '🎣'}</span>
        <span className="header-username">{account.name}</span>
      </button>
      <div className="header-disclosure" ref={disclosure}>
        <button ref={toggle} className="header-menu-toggle" aria-label="Hovedmeny" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}><MenuIcon name={open ? 'close' : 'menu'} /></button>
        {open && <nav id={menuId} className="header-dropdown" aria-label="Kontomeny">
          <button onClick={() => choose(onPlayers)} aria-current={page === 'players' ? 'page' : undefined}>Spillere</button>
          <button onClick={() => choose(onLogout)} disabled={busy}>Logg ut</button>
        </nav>}
      </div>
    </div> : <span className="header-note"><MenuIcon name="wave" /> Et fiskeeventyr</span>}
  </header>
}
