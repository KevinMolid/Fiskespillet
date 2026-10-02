import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
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
  registerReelControl: (control: { start: () => boolean; stop: () => void } | null) => void
}
type Phase = 'aim' | 'casting' | 'depth' | 'sinking' | 'retrieve' | 'waiting' | 'hook' | 'fight' | 'resolving'

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

export function FishingDialog({ position, zoneId, bait, onCommit, onFinish, registerReelControl }: Props) {
  const targets = useMemo(() => castTargets(position), [position])
  const [targetStep, setTargetStep] = useState(targets[0]?.steps ?? 1)
  const target = targets.find(value => value.steps === targetStep) ?? targets[0]
  const [meterStep, setMeterStep] = useState(target?.steps ?? 1)
  const meterStepRef = useRef(target?.steps ?? 1)
  const meterDirection = useRef(1)
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
    if (phase !== 'aim' || targets.length < 2) return
    const timer = window.setInterval(() => {
      setMeterStep(current => {
        let next = current + meterDirection.current
        if (next >= targets[targets.length - 1].steps) { next = targets[targets.length - 1].steps; meterDirection.current = -1 }
        else if (next <= targets[0].steps) { next = targets[0].steps; meterDirection.current = 1 }
        meterStepRef.current = next
        return next
      })
    }, 210)
    return () => window.clearInterval(timer)
  }, [phase, targets])
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
    const selected = targets.find(value => value.steps === meterStepRef.current)
    if (!selected || phase !== 'aim') return
    setTargetStep(selected.steps)
    onCommit()
    setPhase('casting')
  }

  function aimAtPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!targets.length) return
    const rect = event.currentTarget.querySelector('.cast-meter-track')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    const step = Math.round(targets[0].steps + (targets[targets.length - 1].steps - targets[0].steps) * (1 - ratio))
    const nearest = targets.reduce((best, value) => Math.abs(value.steps - step) < Math.abs(best.steps - step) ? value : best, targets[0])
    meterStepRef.current = nearest.steps
    setMeterStep(nearest.steps)
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
    if (phase === 'casting') {
      const timer = window.setTimeout(() => setPhase('depth'), 1300)
      return () => window.clearTimeout(timer)
    }
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

  const castMeter = <div className="cast-aim-layout">
    <button className="cast-meter" data-autofocus disabled={!target} aria-label={`Kast ${meterStep} rute${meterStep === 1 ? '' : 'r'} fram. Trykk for å kaste.`} onPointerDown={aimAtPointer} onClick={cast}>
      <span className="cast-meter-caption">LANGT</span>
      <span className="cast-meter-track">
        {Array.from({ length: 5 }, (_, index) => 5 - index).map(step => <i key={step} className={`cast-meter-tick ${targets.some(value => value.steps === step) ? 'is-available' : 'is-unavailable'} ${meterStep === step ? 'is-current' : ''}`} style={{ top: `${(5 - step) * 25}%` }}><b>{step}</b></i>)}
        <i className="cast-meter-pointer" style={{ top: `${(5 - meterStep) * 25}%` }} aria-hidden="true"><b /></i>
      </span>
      <span className="cast-meter-caption">KORT</span>
    </button>
    <div className="cast-meter-readout"><span>KASTELENGDE</span><strong>{target?.label ?? 'Kort'} · {meterStep} {meterStep === 1 ? 'rute' : 'ruter'}</strong><small>{target?.featureName ?? 'Vannkanten'}</small></div>
  </div>

  if (phase === 'aim') return <section className="fishing-dialog cast-meter-overlay" role="dialog" aria-modal="true" aria-label="Kastelengde">
    {castMeter}
  </section>

  return <section className="fishing-dialog" role="dialog" aria-modal="true" aria-labelledby="fishing-title">
    <header className="fishing-heading">
      <div><span>FISKE · {FISHING_ZONE_NAMES[zoneId] ?? 'VANNKANTEN'}</span><h2 id="fishing-title">{phase === 'casting' ? 'Kastet flyr' : phase === 'hook' ? 'Napp!' : phase === 'fight' ? 'Kjør fisken' : phase === 'resolving' ? 'Fisketuren' : 'Fisking'}</h2></div>
    </header>

    {phase === 'casting' && <div className="cast-animation" role="status" aria-label={`Agnet lander ${targetStep} ruter ut i vannet`}>
      <p className="fishing-prompt">Du kaster {target?.label.toLowerCase()} · {targetStep} {targetStep === 1 ? 'rute' : 'ruter'} fram</p>
      <div className="cast-scene" style={{ '--cast-end': `${25 + 72 * ((targetStep - .5) / 5)}%`, '--cast-mid': `${25 + 72 * ((targetStep - .5) / 5) * .55}%` } as CSSProperties}>
        <div className="cast-fisher" aria-hidden="true"><i /><b /><span /></div>
        <div className="cast-water-lane" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index + 1 === targetStep ? 'is-landing' : ''} />)}</div>
        <i className="cast-flying-lure" aria-hidden="true" />
        <i className="cast-splash" aria-hidden="true" />
      </div>
      <p className="fishing-tip">Plask! Agnet landet ved {target?.featureName}.</p>
    </div>}

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
