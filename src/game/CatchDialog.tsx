import { FishImage } from './FishBookDialog'
import type { CatchMilestone } from './fishBook'
import type { FishSpecies } from './fish'
import { formatWeight } from './world'

export function CatchDialog({ fish, grams, coins, milestone, onClose }: {
  fish: FishSpecies; grams: number; coins: number; milestone: CatchMilestone; onClose: () => void
}) {
  const title = milestone.type === 'new-species' ? 'Ny fisketype!'
    : milestone.type === 'largest' ? 'Ny rekord: største fisk!' : 'Ny rekord: minste fisk!'
  const name = fish.name.toLocaleLowerCase('nb-NO')
  return <section role="dialog" aria-modal="true" aria-label={title} aria-describedby="catch-description" className="fishing-dialog catch-dialog">
    <header className="fishing-heading"><div><span>Fangstjournal</span><h2>{title}</h2></div></header>
    <div className="catch-content">
      <div className="fish-art-stage catch-art"><FishImage key={fish.id} fish={fish} /></div>
      <div className="catch-copy">
        <h3>{fish.name}</h3>
        <p id="catch-description">{milestone.type === 'new-species'
          ? `Du har fanget ${name} for første gang! En ny fisketype er lagt til i fiskeboken.`
          : `Dette er den ${milestone.type === 'largest' ? 'største' : 'minste'} ${name} du har fanget! Du har satt en ny personlig rekord.`}</p>
        <dl className="catch-weights">
          <div><dt>{milestone.type === 'new-species' ? 'Vekt' : 'Ny rekord'}</dt><dd>{formatWeight(grams)}</dd></div>
          {milestone.type !== 'new-species' && <div><dt>Forrige rekord</dt><dd>{formatWeight(milestone.previousGrams)}</dd></div>}
        </dl>
      </div>
    </div>
    <footer><span className="catch-reward">+{coins} mynter</span><button className="fishing-primary" data-autofocus onClick={onClose}>Videre</button></footer>
  </section>
}
