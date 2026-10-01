import { useEffect, useMemo, useRef, useState } from 'react'
import { rollFish, type FishingDepth, type FishSpecies, type RetrieveSpeed } from './fish'
import { advanceFight, castTargets, fishingConditions, FISHING_ZONE_NAMES, type FightState } from './fishing'
import type { BaitId } from './items'
import type { Position } from './world'

type EscapeReason = 'no-bite' | 'missed-hook' | 'line-broken'
export type FishingFinish =
  | { type: 'landed'; species: FishSpecies; grams: number; bait: BaitId }
  | { type: 'escaped'; reason: EscapeReason; bait: BaitId }
type Props = {
  position: Position
  zoneId: string
  bait: BaitId
  onCommit: () => void
  onFinish: (result: FishingFinish) => void
  onCancel: () => void
  registerReelControl: (control: { start: () => boolean; stop: () => void } | null) => void
}
type Phase = 'aim' | 'depth' | 'sinking' | 'retrieve' | 'waiting' | 'hook' | 'fight' | 'resolving'

const DEPTHS: { id: FishingDepth; name: string; wait: number; help: string }[] = [
  { id: 'surface', name: 'Overflaten', wait: 0, help: 'Sveiv inn med en gang' },
  { id: 'midwater', name: 'Mellomvann', wait: 800, help: 'La sluken synke litt' },
  { id: 'bottom', name: 'Bunnen', wait: 1600, help: 'La sluken synke dypt' },
]
const SPEEDS: { id: RetrieveSpeed; name: string; help: string }[] = [
  { id: 'slow', name: 'Sakte', help: 'Følg sluken rolig inn' },
  { id: 'steady', name: 'Jevnt', help: 'Hold en stødig fart' },
  { id: 'fast', name: 'Raskt', help: 'Sveiv sluken raskt inn' },
]

export function FishingDialog({ position, zoneId, bait, onCommit, onFinish, onCancel, registerReelControl }: Props) {
  const targets = useMemo(() => castTargets(position), [position])
  const [targetId, setTargetId] = useState(targets[0]?.id ?? 'short')
  const target = targets.find(value => value.id === targetId) ?? targets[0]
  const [phase, setPhase] = useState<Phase>('aim')
  const [depth, setDepth] = useState<FishingDepth>('surface')
  const [sinkMs, setSinkMs] = useState(0)
  const [fish, setFish] = useState<ReturnType<typeof rollFish> | null>(null)
  const [fight, setFight] = useState<FightState>({ tension: 36, progress: 0, elapsedMs: 0, pulling: false })
  const [reeling, setReeling] = useState(false)
  const reelingRef = useRef(false)
  const fightRef = useRef(fight)
  const completed = useRef(false)

  useEffect(() => { reelingRef.current = reeling }, [reeling])
  useEffect(() => { fightRef.current = fight }, [fight])
  useEffect(() => {
    const start = () => { if (phase !== 'fight') return false; reelingRef.current = true; setReeling(true); return true }
    const stop = () => { reelingRef.current = false; setReeling(false) }
    registerReelControl({ start, stop })
    return () => { stop(); registerReelControl(null) }
  }, [phase, registerReelControl])

  function finish(result: FishingFinish) {
    if (completed.current) return
    completed.current = true
    reelingRef.current = false
    setReeling(false)
    setPhase('resolving')
    onFinish(result)
  }

  function escape(reason: EscapeReason) {
    finish({ type: 'escaped', reason, bait })
  }

  function cast() {
    if (!target || phase !== 'aim') return
    onCommit()
    setPhase('depth')
  }

  function chooseDepth(value: typeof DEPTHS[number]) {
    setDepth(value.id)
    setSinkMs(value.wait)
    if (!value.wait) setPhase('retrieve')
    else setPhase('sinking')
  }

  function startRetrieve(speed: RetrieveSpeed) {
    if (!target) return
    const conditions = fishingConditions(bait, target, depth, speed)
    const rolled = rollFish(zoneId, bait, Math.random, conditions)
    setFish(rolled)
    if (!rolled) { escape('no-bite'); return }
    setPhase('waiting')
  }

  function hook() {
    if (phase !== 'hook') return
    setFight({ tension: 36, progress: 0, elapsedMs: 0, pulling: false })
    setPhase('fight')
  }

  useEffect(() => {
    if (phase === 'sinking') {
      const timer = window.setTimeout(() => setPhase('retrieve'), sinkMs)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'waiting') {
      const timer = window.setTimeout(() => {
        if (fish?.bites) setPhase('hook')
        else escape('no-bite')
      }, 1100)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'hook' && fish) {
      const timer = window.setTimeout(() => escape('missed-hook'), fish.species.fishingProfile.strikeWindowMs)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'fight' && fish) {
      const timer = window.setInterval(() => {
        const next = advanceFight(fightRef.current, reelingRef.current, fish.species.fishingProfile.fightStrength)
        fightRef.current = next.state
        setFight(next.state)
        if (next.outcome === 'landed') finish({ type: 'landed', species: fish.species, grams: fish.grams, bait })
        else if (next.outcome === 'escaped') escape('line-broken')
      }, 100)
      return () => window.clearInterval(timer)
    }
  }, [phase, fish, sinkMs])

  const progressWidth = phase === 'fight' ? `${Math.min(100, fight.progress)}%` : undefined

  return <section className="fishing-dialog" role="dialog" aria-modal="true" aria-labelledby="fishing-title">
    <header className="fishing-heading">
      <div><span>FISKE · {FISHING_ZONE_NAMES[zoneId] ?? 'VANNKANTEN'}</span><h2 id="fishing-title">{phase === 'aim' ? 'Finn kastestedet' : phase === 'hook' ? 'Napp!' : phase === 'fight' ? 'Kjør fisken' : phase === 'resolving' ? 'Fisketuren' : 'Fisking'}</h2></div>
      {phase === 'aim' && <button className="fishing-back" onClick={onCancel}>Avbryt</button>}
    </header>

    {phase === 'aim' && <>
      <p className="fishing-prompt">Du står vendt mot vannet. Velg hvor langt du vil kaste.</p>
      <div className="cast-options" role="group" aria-label="Kastelengde">
        {targets.map(option => <button key={option.id} aria-pressed={targetId === option.id} onFocus={() => setTargetId(option.id)} onClick={() => setTargetId(option.id)}>
          <strong>{option.label}</strong><span>{option.featureName}</span><small>{option.steps * 2}–{option.steps * 3} m</small>
        </button>)}
      </div>
      <p className="fishing-tip">{target?.description ?? 'Vannet er for grunt til å kaste her.'}</p>
      <button className="fishing-primary" data-autofocus onClick={cast} disabled={!target}>Kast ut <kbd>E</kbd></button>
    </>}

    {phase === 'depth' && <>
      <p className="fishing-prompt">La sluken synke til riktig dybde før du sveiver inn.</p>
      <div className="fishing-choice-list">
        {DEPTHS.map(option => <button key={option.id} data-autofocus={option.id === 'surface' || undefined} onClick={() => chooseDepth(option)}><strong>{option.name}</strong><span>{option.help}</span></button>)}
      </div>
    </>}

    {phase === 'sinking' && <div className="fishing-wait" role="status"><span className="fishing-lure" aria-hidden="true">◆</span><strong>Sluken synker mot {depth === 'bottom' ? 'bunnen' : 'mellomvannet'} …</strong><div className="fishing-meter"><i className="fishing-sink-meter" style={{ animationDuration: `${sinkMs}ms` }} /></div></div>}

    {phase === 'retrieve' && <>
      <p className="fishing-prompt">Hvordan vil du sveive inn?</p>
      <div className="fishing-choice-list">
        {SPEEDS.map(option => <button key={option.id} data-autofocus={option.id === 'steady' || undefined} onClick={() => startRetrieve(option.id)}><strong>{option.name}</strong><span>{option.help}</span></button>)}
      </div>
    </>}

    {phase === 'waiting' && <div className="fishing-wait" role="status"><span className="fishing-lure" aria-hidden="true">〰</span><strong>Du sveiver inn. Følg med på snøret …</strong><p>Sluken går {depth === 'surface' ? 'i overflaten' : depth === 'bottom' ? 'langs bunnen' : 'gjennom mellomvannet'}.</p></div>}

    {phase === 'hook' && <div className="fishing-hook" role="alert"><span className="fishing-bite-mark" aria-hidden="true">!</span><p>Det napper! Gi tilslag nå.</p><button className="fishing-primary" data-autofocus onClick={hook}>Gi tilslag <kbd>E</kbd></button><small>Nappet varer et øyeblikk.</small></div>}

    {phase === 'fight' && <div className="fishing-fight" aria-live="polite">
      <p className="fishing-prompt">{fight.pulling ? 'Fisken rykker! Slipp litt opp.' : 'Fisken roer seg. Sveiv inn.'}</p>
      <div className="fishing-gauge-label"><span>Fremdrift</span><strong>{Math.round(fight.progress)}%</strong></div>
      <div className="fishing-meter"><i style={{ width: progressWidth }} /></div>
      <div className="fishing-gauge-label"><span>Snørespenning</span><strong>{Math.round(fight.tension)}%</strong></div>
      <div className="fishing-meter tension-meter"><i style={{ width: `${fight.tension}%` }} /></div>
      <button className={`fishing-reel ${reeling ? 'is-reeling' : ''}`} data-autofocus aria-pressed={reeling} onClick={() => {}}>
        {reeling ? 'Sveiver …' : 'Hold inne for å sveive'} <kbd>E / A</kbd>
      </button>
      <small>Hold inne for å sveive når fisken roer seg. Slipp når den rykker.</small>
    </div>}

    {phase === 'resolving' && <p className="fishing-saving" role="status">Lagrer fisketuren …</p>}
  </section>
}
