import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { rollFish, type FishingDepth, type FishSpecies } from './fish'
import { advanceFight, advanceReel, tapReel, retrieveSpeed, retrieveBiteOpportunity, retrieveTarget, RETRIEVE_SHORE_DISTANCE, castTargets, fishingConditions, FISHING_ZONE_NAMES, SINK_DURATION_MS, sinkingState, type FightState, type ReelState } from './fishing'
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
  onCast: (steps: number) => Promise<boolean>
  onLureProgress: (steps: number, progress: number) => void
  onFinish: (result: FishingFinish) => void
  registerReelControl: (control: ReelControl | null) => void
}
export type ReelControl = { tap: () => boolean; label: string }
type Phase = 'aim' | 'casting' | 'depth' | 'retrieve' | 'hook' | 'fight' | 'resolving'

export function FishingDialog({ position, zoneId, bait, onCommit, onCast, onLureProgress, onFinish, registerReelControl }: Props) {
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
  const [reelSpeed, setReelSpeed] = useState(0)
  const reelRef = useRef<ReelState>({ speed: 0, remainingTiles: 0 })
  const biteElapsed = useRef(0)
  const biteProgress = useRef(0)
  const lureProgress = useRef(onLureProgress)
  lureProgress.current = onLureProgress
  const fightRef = useRef(fight)
  const completed = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  function changePhase(value: Phase) { phaseRef.current = value; setPhase(value) }

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
    registerReelControl({ tap: () => {
      if (phaseRef.current !== 'retrieve' && phaseRef.current !== 'fight') return false
      reelTap()
      return true
    }, label: phase === 'retrieve' || phase === 'fight' ? 'Sveiv' : phase === 'hook' ? 'Gi tilslag' : 'Velg' })
    return () => registerReelControl(null)
  }, [phase, registerReelControl])

  function finish(result: FishingFinish) {
    if (completed.current) return
    completed.current = true
    reelRef.current.speed = 0
    setReelSpeed(0)
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
    changePhase('casting')
    onCommit()
    void onCast(selected.steps).then(finished => {
      if (!finished || !mounted.current || completed.current || phaseRef.current !== 'casting') return
      // Start sinking only after both world animations have actually finished.
      sinkStarted.current = performance.now()
      setSinkProgress(0)
      changePhase('depth')
    })
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
    reelRef.current = { speed: 0, remainingTiles: target.steps - RETRIEVE_SHORE_DISTANCE }
    setReelSpeed(0)
    biteElapsed.current = 0
    biteProgress.current = 0
    lureProgress.current(target.steps, 0)
    changePhase('retrieve')
  }

  function reelTap() {
    if (completed.current || (phaseRef.current !== 'retrieve' && phaseRef.current !== 'fight')) return
    reelRef.current = tapReel(reelRef.current)
    setReelSpeed(reelRef.current.speed)
  }

  function hook() {
    if (phaseRef.current !== 'hook') return
    fightRef.current = { tension: 36, progress: 0, elapsedMs: 0, pulling: false }
    setFight(fightRef.current)
    reelRef.current.speed = 0
    setReelSpeed(0)
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
    if (phase === 'hook' && fish) {
      const timer = window.setTimeout(() => escape('missed-hook'), fish.species.fishingProfile.strikeWindowMs)
      return () => window.clearTimeout(timer)
    }
    if ((phase === 'retrieve' || phase === 'fight') && target) {
      let frame = 0, previous = performance.now()
      const tick = (now: number) => {
        if (completed.current || phaseRef.current !== phase) return
        const elapsed = Math.max(0, Math.min(100, now - previous))
        previous = now
        const reel = advanceReel(reelRef.current, elapsed)
        reelRef.current = reel.state
        setReelSpeed(reel.state.speed)
        if (phase === 'retrieve') {
          const progress = 1 - reel.state.remainingTiles / (target.steps - RETRIEVE_SHORE_DISTANCE)
          lureProgress.current(target.steps, progress)
          if (reel.state.remainingTiles <= 0) { escape('no-bite'); return }
          if (reel.state.speed > .03) biteElapsed.current += elapsed
          else biteElapsed.current = 0
          if (biteElapsed.current >= 250) {
            const opportunity = retrieveBiteOpportunity(biteElapsed.current, reel.state.speed)
            biteElapsed.current = 0
            if (Math.random() < opportunity) {
              const currentTarget = retrieveTarget(position, target, reel.state.remainingTiles)
              const conditions = fishingConditions(bait, currentTarget, depth, retrieveSpeed(reel.state.speed))
              const rolled = rollFish(zoneId, bait, Math.random, conditions)
              if (rolled?.bites) {
                biteProgress.current = progress
                setFish(rolled)
                changePhase('hook')
                return
              }
            }
          }
        } else if (fish) {
          const next = advanceFight(fightRef.current, reel.averageSpeed, fish.species.fishingProfile.fightStrength, elapsed)
          fightRef.current = next.state
          setFight(next.state)
          lureProgress.current(target.steps, biteProgress.current + (1 - biteProgress.current) * next.state.progress / 100)
          if (next.outcome === 'landed') { finish({ type: 'landed', species: fish.species, grams: fish.grams, bait }); return }
          if (next.outcome === 'escaped') { escape('line-broken'); return }
        }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(frame)
    }
  }, [phase, fish, target, depth])

  const progressWidth = phase === 'fight' ? `${Math.min(100, fight.progress)}%` : undefined

  // The cast lives in the world, with no animation panel or clickable choices.
  if (phase === 'casting') return <span className="sr-only" role="status">Kaster ut snøret …</span>

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

  const speedMeter = <section className="fishing-dialog cast-meter-overlay" role="dialog" aria-modal="true" aria-label="Innsveiving">
    <button className="cast-meter depth-meter reel-meter" data-autofocus aria-label="Sveiv inn" onClick={reelTap}>
      <span className="cast-meter-caption">RASKT</span>
      <span className="cast-meter-track" role="meter" aria-label="Sveivefart" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reelSpeed * 100)}>
        {[5,4,3,2,1].map((step, index) => <i key={step} className="cast-meter-tick is-available" style={{ top: `${index * 25}%` }}><b>{step}</b></i>)}
        <i className="cast-meter-pointer" style={{ top: `${(1 - reelSpeed) * 100}%` }} aria-hidden="true"><b /></i>
      </span>
      <span className="cast-meter-caption">STOPP</span>
      <span className="reel-tap-hint">SPACE / A</span>
    </button>
    <span className="sr-only">Trykk gjentatte ganger for å sveive. Raske trykk gir høyere fart.</span>
  </section>
  if (phase === 'retrieve') return speedMeter
  if (phase === 'fight') return <>{speedMeter}<section className="fishing-dialog fight-overlay" role="status">
    <p className="fishing-fight-status">{fight.pulling ? 'Fisken rykker! Ta en pause.' : 'Fisken roer seg. Sveiv inn.'}</p>
    <div className="fishing-gauge-label"><span>Fremdrift</span><strong>{Math.round(fight.progress)}%</strong></div>
    <div className="fishing-meter" role="meter" aria-label="Fangstfremdrift" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fight.progress)}><i style={{ width: progressWidth }} /></div>
    <div className="fishing-gauge-label"><span>Snørespenning</span><strong>{Math.round(fight.tension)}%</strong></div>
    <div className="fishing-meter tension-meter"><i style={{ width: `${fight.tension}%` }} /></div>
  </section></>

  return <section className="fishing-dialog" role="dialog" aria-modal="true" aria-labelledby="fishing-title">
    <header className="fishing-heading">
      <div><span>FISKE · {FISHING_ZONE_NAMES[zoneId] ?? 'VANNKANTEN'}</span><h2 id="fishing-title">{phase === 'hook' ? 'Napp!' : 'Fisketuren'}</h2></div>
    </header>

    {phase === 'hook' && <div className="fishing-hook" role="alert"><span className="fishing-bite-mark" aria-hidden="true">!</span><p>Det napper! Gi tilslag nå.</p><button className="fishing-primary" data-autofocus onClick={hook}>Gi tilslag <kbd>E</kbd></button><small>Nappet varer et øyeblikk.</small></div>}

    {phase === 'resolving' && <p className="fishing-saving" role="status">Lagrer fisketuren …</p>}
  </section>
}
