import { useEffect, useRef, useState } from 'react'
import { Panel } from './GameDialogs'
import { FISH, FISHING_ZONES, weightRange, type FishSpecies } from './fish'
import type { FishBookEntry } from './fishBook'
import { formatWeight } from './world'

export function FishImage({ fish, compact = false }: { fish: FishSpecies; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  return fish.image && !failed
    ? <img className={compact ? 'fish-image compact' : 'fish-image'} src={fish.image} alt={fish.name} onError={() => setFailed(true)} />
    : <span className={compact ? 'fish-image-placeholder compact' : 'fish-image-placeholder'} aria-hidden={compact || undefined}>{compact ? '—' : 'Illustrasjon kommer'}</span>
}

export function FishDetails({ fish, entry }: { fish: FishSpecies; entry?: FishBookEntry }) {
  if (!entry || entry.caughtCount === 0) return <h3>{fish.name}</h3>
  const locations = entry.discoveredLocationIds.filter(id => Object.hasOwn(FISHING_ZONES, id))
  return <>
    <header className="fish-details-heading"><FishImage key={fish.id} fish={fish} /><div><h3>{fish.name}</h3>{fish.scientificName && <p className="fish-scientific">{fish.scientificName}</p>}</div></header>
    <p className="fish-description">{fish.description}</p>
    <dl className="fish-facts">
      <div><dt>Sjeldenhet i spillet</dt><dd>{fish.rarity}</dd></div>
      <div><dt>Vektområde i spillet</dt><dd>{weightRange(fish)}</dd></div>
    </dl>
    <section className="fish-records"><h4>Dine fangster</h4><dl className="fish-facts">
      <div><dt>Antall</dt><dd>{entry.caughtCount}</dd></div>
      <div><dt>Minste</dt><dd>{entry.smallestGrams === null ? '—' : formatWeight(entry.smallestGrams)}</dd></div>
      <div><dt>Største</dt><dd>{entry.largestGrams === null ? '—' : formatWeight(entry.largestGrams)}</dd></div>
    </dl></section>
    <section className="fish-locations"><h4>Funnet ved</h4>{locations.length ? <ul>{locations.map(id => <li key={id}>{FISHING_ZONES[id].name}</li>)}</ul> : <p>Ingen fangststeder registrert ennå.</p>}</section>
  </>
}

export function FishBookDialog({ book, onClose }: { book: FishBookEntry[]; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const detail = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!list.current) return
    const observer = new ResizeObserver(() => {
      list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
    })
    observer.observe(list.current)
    return () => observer.disconnect()
  }, [])
  const entries = new Map(book.map(entry => [entry.speciesId, entry]))
  const caught = FISH.filter(fish => (entries.get(fish.id)?.caughtCount ?? 0) > 0).length
  const fish = FISH[page]
  function select(index: number) {
    if (index !== page) { setPage(index); detail.current?.scrollTo(0, 0) }
  }
  return <Panel className="fish-book-dialog" title="Fiskeboken" subtitle={caught + ' / ' + FISH.length + ' arter fanget'} onClose={onClose}>
    <progress className="fish-book-progress" value={caught} max={FISH.length} aria-label="Arter fanget" />
    <div className="fish-book-layout">
      <article ref={detail} className="fish-details" aria-label={fish.name} tabIndex={0} data-nav-scroll>
        <FishDetails fish={fish} entry={entries.get(fish.id)} />
      </article>
      <div ref={list} className="fish-list" role="listbox" aria-label="Fiskearter" data-nav-list>
        {FISH.map((species, index) => <button key={species.id} role="option" aria-selected={index === page} tabIndex={index === page ? 0 : -1} data-autofocus={index === page ? '' : undefined}
          onFocus={event => { select(index); event.currentTarget.scrollIntoView({ block: 'nearest' }) }} onClick={() => { select(index); detail.current?.focus({ preventScroll: true }) }}>
          {(entries.get(species.id)?.caughtCount ?? 0) > 0 ? <><FishImage fish={species} compact /><span>{species.name}{species.scientificName && <small className="fish-scientific">{species.scientificName}</small>}</span></> : <span>{species.name}</span>}
        </button>)}
      </div>
    </div>
    <footer className="fish-book-footer"><span>↑↓ Velg · E Les · ← Liste</span><span>{page + 1} / {FISH.length}</span></footer>
  </Panel>
}
