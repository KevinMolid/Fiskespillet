import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { rollFish, type FishingDepth, type FishSpecies, type RetrieveSpeed } from './fish'
import { advanceFight, castTargets, fishingConditions, FISHING_ZONE_NAMES, SINK_DURATION_MS, sinkingState, type FightState } from './fishing'
import type { BaitId } from './items'
import type { Position } from './world'

type EscapeReason = 'no-bite' | 'missed-hook' | 'line-broken' | 'bottom-snag'
export type FishingFinish =
  | { type: 'landed'; species: FishSpecies; grams: number; bait: BaitId }
  | { type: 'escaped'; reason: EscapeReason; bait: BaitId }
type Props = {
  position: Position
  zoneId: string
  bait: BaitId
  onCommit: () => void
  onCast: (steps: number) => void
  onFinish: (result: FishingFinish) => void
  registerReelControl: (control: { start: () => boolean; stop: () => void } | null) => void
}
type Phase = 'aim' | 'depth' | 'retrieve' | 'waiting' | 'hook' | 'fight' | 'resolving'
const SPEEDS: { id: RetrieveSpeed; name: string; help: string }[] = [
  { id: 'slow', name: 'Sakte', help: 'Følg sluken rolig inn' },
  { id: 'steady', name: 'Jevnt', help: 'Hold en stødig fart' },
  { id: 'fast', name: 'Raskt', help: 'Sveiv sluken raskt inn' },
]

export function FishingDialog({ position, zoneId, bait, onCommit, onCast, onFinish, registerReelControl }: Props) {
  const targets = useMemo(() => castTargets(position), [position])
  const [targetStep, setTargetStep] = useState(targets[0]?.steps ?? 1)
  const target = targets.find(value => value.steps === targetStep) ?? targets[0]
  const [meterStep, setMeterStep] = useState(target?.steps ?? 1)
  const meterStepRef = useRef(target?.steps ?? 1)
  const meterDirection = useRef(1)
  const [phase, setPhase] = useState<Phase>('aim')
  const phaseRef = useRef<Phase>('aim')
  const [depth, setDepth] = useState<FishingDepth>('surface')
  const [sinkProgress, setSinkProgress] = useState(0)
  const sinkStarted = useRef(0)
  const [fish, setFish] = useState<ReturnType<typeof rollFish> | null>(null)
  const [fight, setFight] = useState<FightState>({ tension: 36, progress: 0, elapsedMs: 0, pulling: false })
  const [reeling, setReeling] = useState(false)
  const reelingRef = useRef(false)
  const fightRef = useRef(fight)
  const completed = useRef(false)

  function changePhase(value: Phase) { phaseRef.current = value; setPhase(value) }

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
    changePhase('resolving')
    onFinish(result)
  }

  function escape(reason: EscapeReason) {
    finish({ type: 'escaped', reason, bait })
  }

  function cast() {
    const selected = targets.find(value => value.steps === meterStepRef.current)
    if (!selected || phaseRef.current !== 'aim') return
    setTargetStep(selected.steps)
    sinkStarted.current = performance.now()
    setSinkProgress(0)
    changePhase('depth')
    onCommit()
    onCast(selected.steps)
  }

  function aimAtPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!targets.length) return
    const rect = event.currentTarget.querySelector('.cast-meter-track')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    // The track always displays 1..5, even where land limits available casts.
    const step = Math.round(1 + 4 * (1 - ratio))
    const nearest = targets.reduce((best, value) => Math.abs(value.steps - step) < Math.abs(best.steps - step) ? value : best, targets[0])
    meterStepRef.current = nearest.steps
    setMeterStep(nearest.steps)
  }

  function chooseDepth() {
    if (phaseRef.current !== 'depth' || completed.current) return
    const state = sinkingState(performance.now() - sinkStarted.current)
    if (state.snagged) { escape('bottom-snag'); return }
    setDepth(state.depth)
    changePhase('retrieve')
  }

  function startRetrieve(speed: RetrieveSpeed) {
    if (!target || phaseRef.current !== 'retrieve') return
    const conditions = fishingConditions(bait, target, depth, speed)
    const rolled = rollFish(zoneId, bait, Math.random, conditions)
    setFish(rolled)
    if (!rolled) { escape('no-bite'); return }
    changePhase('waiting')
  }

  function hook() {
    if (phaseRef.current !== 'hook') return
    setFight({ tension: 36, progress: 0, elapsedMs: 0, pulling: false })
    changePhase('fight')
  }

  useEffect(() => {
    if (phase === 'depth') {
      let frame = 0
      const tick = () => {
        if (phaseRef.current !== 'depth' || completed.current) return
        const state = sinkingState(performance.now() - sinkStarted.current)
        setSinkProgress(state.progress)
        if (state.snagged) escape('bottom-snag')
        else frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      const timer = window.setTimeout(() => {
        if (phaseRef.current === 'depth') escape('bottom-snag')
      }, Math.max(0, SINK_DURATION_MS - (performance.now() - sinkStarted.current)))
      return () => { cancelAnimationFrame(frame); window.clearTimeout(timer) }
    }
    if (phase === 'waiting') {
      const timer = window.setTimeout(() => {
        if (fish?.bites) changePhase('hook')
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
  }, [phase, fish])

  const progressWidth = phase === 'fight' ? `${Math.min(100, fight.progress)}%` : undefined

  if (phase === 'aim') return <section className="fishing-dialog cast-meter-overlay" role="dialog" aria-modal="true" aria-label="Kastelengde">
    <button className="cast-meter" data-autofocus disabled={!target} aria-label={`Kast ${meterStep} rute${meterStep === 1 ? '' : 'r'} fram. Trykk for å kaste.`} onPointerDown={aimAtPointer} onClick={cast}>
      <span className="cast-meter-caption">LANGT</span>
      <span className="cast-meter-track">
        {Array.from({ length: 5 }, (_, index) => 5 - index).map(step => <i key={step} className={`cast-meter-tick ${targets.some(value => value.steps === step) ? 'is-available' : 'is-unavailable'} ${meterStep === step ? 'is-current' : ''}`} style={{ top: `${(5 - step) * 25}%` }}><b>{step}</b></i>)}
        <i className="cast-meter-pointer" style={{ top: `${(5 - meterStep) * 25}%` }} aria-hidden="true"><b /></i>
      </span>
      <span className="cast-meter-caption">KORT</span>
    </button>
  </section>

  if (phase === 'depth') return <section className="fishing-dialog cast-meter-overlay" role="dialog" aria-modal="true" aria-label="Fiskedybde">
    <button className="cast-meter depth-meter" data-autofocus aria-label="Stopp synkingen og velg dybde" onClick={chooseDepth}>
      <span className="cast-meter-caption">GRUNT</span>
      <span className="cast-meter-track" role="meter" aria-label="Synkende agn" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sinkProgress * 100)}>
        {[1,2,3,4,5].map(step => <i key={step} className="cast-meter-tick is-available" style={{ top: `${(step - 1) * 25}%` }}><b>{step}</b></i>)}
        <i className="cast-meter-pointer" style={{ top: `${sinkProgress * 100}%` }} aria-hidden="true"><b /></i>
      </span>
      <span className="cast-meter-caption">DYPT</span>
    </button>
  </section>

  return <section className="fishing-dialog" role="dialog" aria-modal="true" aria-labelledby="fishing-title">
    <header className="fishing-heading">
      <div><span>FISKE · {FISHING_ZONE_NAMES[zoneId] ?? 'VANNKANTEN'}</span><h2 id="fishing-title">{phase === 'hook' ? 'Napp!' : phase === 'fight' ? 'Kjør fisken' : phase === 'resolving' ? 'Fisketuren' : 'Fisking'}</h2></div>
    </header>

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
