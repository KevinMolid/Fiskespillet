import { useEffect, useRef, useState } from 'react'
import { Panel } from './GameDialogs'
import { FISH, FISHING_ZONES, weightRange, type FishSpecies } from './fish'
import type { FishBookEntry } from './fishBook'
import { formatWeight } from './world'

type DiscoveryState = 'unknown' | 'seen' | 'caught'
function discoveryState(entry?: FishBookEntry): DiscoveryState {
  if ((entry?.caughtCount ?? 0) > 0) return 'caught'
  if ((entry?.seenCount ?? 0) > 0) return 'seen'
  return 'unknown'
}

function EyeIcon() {
  return <svg viewBox="0 0 20 14" aria-hidden="true"><path d="M1 7s3-5 9-5 9 5 9 5-3 5-9 5S1 7 1 7Z" /><circle cx="10" cy="7" r="2.4" /></svg>
}
function HookIcon() {
  return <svg viewBox="0 0 16 18" aria-hidden="true"><path d="M8 1v10a4 4 0 1 1-4-4M5 4l3-3 3 3" /></svg>
}
function TrophyIcon() {
  return <svg className="fish-record-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2h8v4a4 4 0 0 1-8 0V2ZM5 4H2v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3M9 10v4m-3 2h6m-5 0v-2h4v2" /></svg>
}

export function FishImage({ fish, compact = false }: { fish: FishSpecies; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  return fish.image && !failed
    ? <img className={compact ? 'fish-image compact' : 'fish-image'} src={fish.image} alt={compact ? '' : fish.name} onError={() => setFailed(true)} />
    : <span className={compact ? 'fish-image-placeholder compact' : 'fish-image-placeholder'} aria-hidden={compact || undefined}>?</span>
}

function FishArtwork({ fish, reveal }: { fish: FishSpecies; reveal: boolean }) {
  return <div className={`fish-art-stage${reveal ? '' : ' undiscovered'}`}>
    {reveal ? <FishImage fish={fish} /> : <span className="fish-question" aria-label="Ukjent art">?</span>}
  </div>
}

function FishLocations({ entry }: { entry: FishBookEntry }) {
  const caughtLocations = new Set(entry.discoveredLocationIds ?? [])
  const locations = [...new Set([...(entry.seenLocationIds ?? []), ...caughtLocations])].filter(id => Object.hasOwn(FISHING_ZONES, id))
  return <section className="fish-journal-section fish-locations">
    <h4>Funnet ved</h4>
    {locations.length ? <ul>{locations.map(id => {
      const caughtHere = caughtLocations.has(id)
      return <li key={id}><span>{FISHING_ZONES[id].name}</span><span className="location-status" role="img" aria-label={caughtHere ? 'Sett og fanget her' : 'Sett her'} title={caughtHere ? 'Sett og fanget her' : 'Sett her'}><EyeIcon />{caughtHere && <HookIcon />}</span></li>
    })}</ul> : <p>Ingen steder registrert ennå.</p>}
  </section>
}

export function FishDetails({ fish, entry }: { fish: FishSpecies; entry?: FishBookEntry }) {
  const state = discoveryState(entry)
  if (state === 'unknown') return <div className="fish-detail-page unknown-fish">
    <header className="fish-detail-title"><div><h3>{fish.name}</h3><p>Ikke oppdaget</p></div><span className="fish-state-chip">Ukjent art</span></header>
    <FishArtwork fish={fish} reveal={false} />
    <p className="fish-locked-copy">Utforsk vannet og fisk for å oppdage denne arten.</p>
  </div>

  if (state === 'seen') return <div className="fish-detail-page seen-fish">
    <header className="fish-detail-title"><div><h3>{fish.name}</h3><p className="fish-scientific">{fish.scientificName}</p></div><span className="fish-state-chip">Sett · ikke fanget</span></header>
    <FishArtwork fish={fish} reveal />
    <p className="fish-locked-copy">Du har sett denne arten, men ikke fanget den ennå. Fang den for å åpne hele feltguiden og fangstjournalen.</p>
    {entry && <FishLocations entry={entry} />}
  </div>

  return <div className="fish-detail-page caught-fish">
    <header className="fish-detail-title"><div><h3>{fish.name}</h3><p className="fish-scientific">{fish.scientificName}</p></div><span className="fish-state-chip caught-chip"><HookIcon /> Fanget</span></header>
    <FishArtwork fish={fish} reveal />
    <p className="fish-weight-range">{weightRange(fish)}</p>
    <p className="fish-description">{fish.description}</p>
    <section className="fish-journal-section">
      <h4>Dine fangster</h4>
      <dl className="fish-catch-stats">
        <div><dd>{entry!.caughtCount}</dd><dt>Fanget</dt></div>
        <div><dd>{entry!.smallestGrams === null ? '—' : formatWeight(entry!.smallestGrams)}</dd><dt>Minste</dt></div>
        <div className="personal-record"><dd>{entry!.largestGrams === null ? '—' : formatWeight(entry!.largestGrams)}</dd><dt><TrophyIcon /> Rekord</dt></div>
      </dl>
    </section>
    <FishLocations entry={entry!} />
  </div>
}

export function FishBookDialog({ book, onClose, registerMenuBack }: { book: FishBookEntry[]; onClose: () => void; registerMenuBack?: (handler: (() => void) | null) => void }) {
  const [page, setPage] = useState(0)
  const [mobileDetail, setMobileDetail] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const entries = new Map(book.map(entry => [entry.speciesId, entry]))
  const caught = FISH.filter(fish => discoveryState(entries.get(fish.id)) === 'caught').length
  const seen = FISH.filter(fish => discoveryState(entries.get(fish.id)) !== 'unknown').length
  const unknown = FISH.length - seen
  const fish = FISH[page]
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mobileDetail) list.current?.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('.fish-mobile-back')?.focus({ preventScroll: true })
      else list.current?.querySelector<HTMLButtonElement>(`[data-fish-id="${fish.id}"]`)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [fish.id, mobileDetail])
  function select(index: number) {
    if (index !== page) setPage(index)
  }
  function returnToList() {
    setMobileDetail(false)
  }
  useEffect(() => {
    const back = () => mobileDetail ? returnToList() : onClose()
    registerMenuBack?.(back)
    return () => registerMenuBack?.(null)
  }, [mobileDetail, onClose, registerMenuBack])
  return <Panel className={`fish-book-dialog${mobileDetail ? ' is-mobile-detail' : ' is-mobile-list'}`} title="Fiskeboken"
    subtitle={`${caught} av ${FISH.length} fanget · ${seen} oppdaget · ${unknown} ukjent`}
    closeLabel="Lukk" onClose={onClose}>
    <div className="fish-book-progress" aria-label={`${caught} av ${FISH.length} arter fanget`}>
      <div className="fish-progress-labels"><span>Fanget <strong>{caught}/{FISH.length}</strong></span><span>Oppdaget <strong>{seen}/{FISH.length}</strong></span></div>
      <div className="fish-progress-track" role="progressbar" aria-label="Arter fanget" aria-valuemin={0} aria-valuemax={FISH.length} aria-valuenow={caught} aria-valuetext={`${caught} av ${FISH.length} fanget`}>
        <span className="fish-progress-caught" aria-hidden="true" style={{ width: `${caught / FISH.length * 100}%` }} />
      </div>
    </div>
    <div className="fish-book-layout">
      <article className="fish-details" aria-label={`${fish.name} – artsdetaljer`} tabIndex={0} data-nav-scroll>
        {mobileDetail && <button className="fish-mobile-back" type="button" onClick={returnToList}>← Fiskeboken</button>}
        <FishDetails fish={fish} entry={entries.get(fish.id)} />
      </article>
      <div ref={list} className="fish-list" role="listbox" aria-label="Artsliste" data-nav-list>
        {FISH.map((species, index) => {
          const state = discoveryState(entries.get(species.id))
          const stateLabel = state === 'caught' ? 'Fanget' : state === 'seen' ? 'Sett, ikke fanget' : 'Ukjent'
          return <button key={species.id} type="button" role="option" aria-selected={index === page} aria-label={`${species.name}, ${stateLabel}`}
            tabIndex={index === page ? 0 : -1} data-fish-id={species.id} data-autofocus={index === page ? '' : undefined}
            onFocus={() => { select(index); list.current?.querySelector(`[data-fish-id="${species.id}"]`)?.scrollIntoView({ block: 'nearest' }) }}
            onClick={() => { select(index); if (window.matchMedia('(max-width: 767px), (max-width: 1023px) and (max-height: 500px)').matches) setMobileDetail(true) }}>
            <span className="fish-list-art">{state === 'unknown' ? <span className="fish-list-question">?</span> : <FishImage key={species.id} fish={species} compact />}</span>
            <span className="fish-list-name">{species.name}<small className={state === 'unknown' ? '' : 'fish-scientific'}>{state === 'unknown' ? 'Ukjent' : `${state === 'seen' ? 'Sett' : 'Fanget'} · ${species.scientificName}`}</small></span>
            <span className={`fish-status-pair state-${state}`} aria-hidden="true">
              <span className="fish-status-mark"><EyeIcon /><small>Sett</small></span>
              <span className="fish-status-mark"><HookIcon /><small>Fanget</small></span>
            </span>
          </button>
        })}
      </div>
    </div>
    <footer className="fish-book-footer">
      <span className="fish-controls-desktop">↑ ↓ Bla · E / Mellomrom Åpne · Esc Tilbake</span>
      <span className="fish-controls-mobile">{mobileDetail ? 'A Fiskeboken · Meny Tilbake' : '↑ ↓ Bla · A Åpne · Meny Tilbake'}</span>
      <span>{page + 1} / {FISH.length}</span>
    </footer>
  </Panel>
}
