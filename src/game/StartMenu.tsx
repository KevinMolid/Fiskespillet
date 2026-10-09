import { useEffect, useRef, useState } from 'react'
import { GameLogo } from '../GameLogo'
import { MenuIcon } from '../MenuIcon'
import { CharacterSelect } from './CharacterSelect'
import type { PlayerVariant } from './world'

type Props = {
  hasSave: boolean
  ready: boolean
  pending?: boolean
  error?: string
  onContinue: () => void
  onNewGame: (variant: PlayerVariant) => void
  onRetry: () => void
}

export function StartMenu({ hasSave, ready, pending = false, error = '', onContinue, onNewGame, onRetry }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [choosingCharacter, setChoosingCharacter] = useState(false)
  const newGameButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!confirmReset) return
    cancelButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['Escape', 'b', 'B'].includes(event.key) || pending || event.repeat) return
      event.preventDefault()
      setConfirmReset(false)
      newGameButton.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmReset, pending])

  function startNewGame() {
    if (hasSave) setConfirmReset(true)
    else setChoosingCharacter(true)
  }

  return <section className="start-screen" aria-label="Oppstartsmeny">
    <section className="start-card" aria-labelledby="start-title">
      <GameLogo className="start-logo" priority />
      <h1 id="start-title" className="sr-only">Godt Haill</h1>
      {pending ? <p role="status" className="start-status">Sjekker lagret spill …</p> : <div className="start-actions">
        <button className="start-button start-button-primary" onClick={onContinue} disabled={!ready || !hasSave} title={!hasSave ? 'Ingen lagring ennå' : undefined}>
          <MenuIcon name="arrow" /><span>Fortsett spill</span>
        </button>
        <button ref={newGameButton} className="start-button" onClick={startNewGame} disabled={!ready}><MenuIcon name="plus" /><span>Nytt spill</span></button>
      </div>}
      {error && !confirmReset && <p role="alert" className="start-error">{error}</p>}
      {!ready && !pending && <button className="start-retry" onClick={onRetry}>Prøv å sjekke lagringen igjen</button>}
      <p className="start-footnote"><MenuIcon name="save" /> Spillet lagres automatisk.</p>
    </section>

    {confirmReset && <div className="start-confirm-backdrop">
      <section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" className="start-confirm">
        <p className="start-kicker">START PÅ NYTT</p>
        <h2 id="reset-title">Slette den lagrede progresjonen?</h2>
        <p id="reset-description">Fangster, fiskebok, utstyr, mynter, posisjon og figurutseende slettes. Dette kan ikke angres.</p>
        {error && <p role="alert" className="start-error">{error}</p>}
        <div className="start-confirm-actions">
          <button ref={cancelButton} className="start-button controller-shortcut" aria-label="B: tilbake" onClick={() => setConfirmReset(false)} disabled={pending}>B</button>
          <button className="start-button controller-shortcut" aria-label="Meny" onClick={() => setConfirmReset(false)} disabled={pending}>≡</button>
          <button className="start-button start-button-danger" onClick={() => { setConfirmReset(false); setChoosingCharacter(true) }} disabled={pending}>
            {pending ? 'Starter på nytt …' : 'Slett alt og start'}
          </button>
        </div>
      </section>
    </div>}
    {choosingCharacter && <CharacterSelect pending={pending} error={error} onSelect={onNewGame} onBack={() => { setChoosingCharacter(false); newGameButton.current?.focus() }} />}
  </section>
}
