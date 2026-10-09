import { useEffect, useRef, useState } from 'react'
import male from '../assets/characters/player/down.png'
import female from '../assets/characters/player-female/down.png'
import type { PlayerVariant } from './world'

type Props = {
  pending?: boolean
  error?: string
  onSelect: (variant: PlayerVariant) => void
  onBack?: () => void
}

export function CharacterSelect({ pending = false, error = '', onSelect, onBack }: Props) {
  const [selected, setSelected] = useState<PlayerVariant>('male')
  const firstChoice = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => { firstChoice.current?.focus() }, [])
  return <div className="character-select-backdrop">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="character-select-title" className="character-select" onKeyDown={event => {
      if (['Escape', 'b', 'B'].includes(event.key) && onBack && !pending && !event.repeat) { event.preventDefault(); event.stopPropagation(); onBack() }
      if (event.key !== 'Tab') return
      const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      const next = event.shiftKey ? buttons.at(-1) : buttons[0]
      if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) { event.preventDefault(); next?.focus() }
    }}>
      <p className="start-kicker">DITT FISKEEVENTYR</p>
      <h2 id="character-select-title">Velg spillkarakter</h2>
      <p>Hvem tar det neste kastet?</p>
      <div className="character-choices" role="group" aria-label="Spillkarakter">
        {(['male', 'female'] as const).map((variant, index) => <button key={variant} ref={index === 0 ? firstChoice : undefined} type="button" aria-label={variant === 'male' ? 'Figur med blå detaljer' : 'Figur med røde detaljer'} aria-pressed={selected === variant} disabled={pending} onClick={() => setSelected(variant)}>
          <img src={variant === 'male' ? male : female} alt="" />
          <span aria-hidden="true">{selected === variant ? '✓ Valgt' : 'Velg'}</span>
        </button>)}
      </div>
      {error && <p className="start-error" role="alert">{error}</p>}
      <footer className="character-select-actions">
        {onBack && <><button className="start-button controller-shortcut" aria-label="B: tilbake" onClick={onBack} disabled={pending}>B</button><button className="start-button controller-shortcut" aria-label="Meny" onClick={onBack} disabled={pending}>≡</button></>}
        <button className="start-button start-button-primary" onClick={() => onSelect(selected)} disabled={pending}>{pending ? 'Lagrer …' : 'Start spillet'}</button>
      </footer>
    </section>
  </div>
}
