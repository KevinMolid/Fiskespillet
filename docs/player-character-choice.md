# Spillkaraktervalg

Den eksisterende mannlige spilleren beholdes. Den nye kvinnelige varianten har langt brunt hår, røde ermer/krage og rødt hattebånd, med samme fiskeklær, hatt, bukse, støvler og veske som referansen.

## Assets og mapping

- Mann: `src/assets/characters/player/` (uendret).
- Kvinne: `src/assets/characters/player-female/` (28 RGBA-bilder).
- Hver retning (`down`, `right`, `up`, `left`) har idle, `walk-1` (A), `walk-2` (B), `walk-3` (C), `cast-aim`, `cast-forward` og `fishing-idle`.
- `PLAYER_CHARACTERS` i `src/game/characters.ts` kobler `male` og `female` til samme `StandardCharacter`-format. Gangrytmen er uendret: A–C–B–C, ett bilde per rute.
- Begge bruker `pixel-player-standard.json`: 768 × 1184, fotanker (384, 1172), render scale 0,05 og nearest-neighbor. Kvinnens synlige idle-høyde forfra er 56,6 verdenspiksler (mannen 57,4).
- Fiskeposer bruker de eksisterende større canvasene og fotankrene: cast-aim 1536 × 1536 / (768, 1524); cast-forward og fishing-idle 2048 × 1536 / (1024, 1524). Kroppens render scale er fortsatt 0,05.
- `player-female-rod-tips.json` måler kvinnens faktiske stangtupper, slik at animasjonen av snøret begynner ved riktig punkt.
- `WorldScene` velger karakter fra lagret utseende; movement, kollisjon, dybde, NPC-er og kart er uendret.

## Preparering

Grafikken ble laget med den innebygde imagegen-funksjonen og et referanseark pakket fra de godkjente mannlige produksjonsbildene. `tools/prepare-female-player.py` deler arket i 28 sprites, bruker målt gutter mellom cellene, binær alpha (terskel 128) og kun nearest-neighbor ved skalering. Én felles normalisering, 7,2049689441, brukes for alle retninger og poser; plassering bestemmes av skosålene og hele støvelbåndet, også når én fot løftes. Alle sprites kontrolleres for clipping.

Referanse, generert kildeark, målinger og screenshots ligger lokalt i `output/female-player-review/`; de inngår ikke i runtime-bundlen. Produksjonsbilder ligger i character-mappen.

Prompten brukt i imagegen:

> Use case: style-transfer. Asset type: production pixel-art game character sprite sheet. Edit target: the provided male reference sprite sheet. Create a matching FEMALE playable fisher with long brown hair falling to her shoulders/back and RED details on her fishing clothes: red shirt sleeves/collar and red hat band instead of blue; keep the tan fishing vest, straw hat, olive trousers, substantial brown boots, shoulder bag, and fishing rod. Same crisp pixel art, dark outlines, proportions and visual body size as reference. Female face, adult readable game character, not infant/chibi redesign. CRITICAL sheet: preserve EXACT 7 columns by 4 rows layout, no rearrangement or extra sprites, transparent background, canvas 1792x768, each cell256x192 with feet baseline at cell y190 and center x128. Rows top to bottom: down/front, right/profile, up/back, left/profile. Columns left to right: idle, walking contact A, neutral passing C, opposite walking contact B, rod held BACK preparing cast, rod pointing FORWARD mid-cast, rod forward RELAXED waiting/reeling. Match EVERY reference pose and arm/leg silhouette precisely, shoulder/arms move with opposite foot, two legs/two feet per sprite, A and B have opposite lead foot, preserve rod tips/rod geometry positions. Only alter gender, long hair and blue clothing details to red. Keep all hats, shoes, bags and rods complete inside their cells. No text, no grid lines, no labels, no floor/shadows, true alpha transparency, no blur/smoothing.

## Oppstart og lagring

`CharacterSelect.tsx` viser de to karakterene med et eksplisitt valg og «Start spillet». «Nytt spill» i `StartMenu` åpner valget; eksisterende progresjon slettes først etter den vanlige reset-bekreftelsen og når spilleren starter med valgt karakter. Tilbake/Escape avbryter uten å slette.

`Appearance.playerVariant` er `male` eller `female`. Feltet er valgfritt for eldre lagringer. «Fortsett spill» åpner alltid lagringen uten karaktervalg. En eksisterende valgt figur beholdes; eldre lagringer uten feltet bruker den opprinnelige figuren. Ingen utseendeskriving eller reset gjøres ved fortsettelse. Valget vises bare ved «Nytt spill». Valgbildene har ingen kjønnsnavn; skjermleseretikettene beskriver de blå/røde detaljene.

`GamePage` initialiserer løperetten fra inventaret straks spillscenen opprettes, og oppdaterer den også når inventaret endres. Dette hindrer at en ny scene mister løperetten selv om det allerede lastede inventaret ikke har endret seg. Shift/B krever fortsatt joggesko.

«Gå ut av spillet» i spillmenyen lagrer den gjeldende logiske posisjonen før `App` går tilbake til startmenyen med «Fortsett spill» og «Nytt spill». Under lagring blokkeres menyinput; ved feil beholdes spillscenen og feilmeldingen gir mulighet for å prøve igjen. Ingen konto, inventar, fiskebok eller figurvalg slettes.

For eksisterende spill skriver `resetGameData(uid, appearance)` reset og nytt karaktervalg i samme Firestore-batch; ved feil slettes ikke progresjonen. Firebase-reglene tillater bare de to verdiene, og eldre utseendedokumenter fungerer fortsatt. Reglene må publiseres sammen med endringen; prosjektets eksisterende main-workflow håndterer `firestore.rules`.

## Kontroll

- Typecheck: `node node_modules/typescript/bin/tsc -b`.
- Build: `node node_modules/vite/bin/vite.js build`.
- `check-player-choice-browser.mjs`: valg bare ved nytt spill, avbrudd, reset-bekreftelse, fortsettelse av eldre lagring uten spørsmål, 28 textures, transparency, fotanker og fire retningsbestemte kaste-/sveivesekvenser på desktop, mobil DPR3 og liggende mobil DPR3.
- `check-continue-exit-browser.mjs`: lagret blå/rød/eldre figur med joggesko, Shift/B-løping, løpehastighet, avslutning/fortsettelse, lagringsfeil/retry, pending input, scene-cleanup og fortsatt låsing uten joggesko på desktop, mobil, liggende mobil og Canvas fallback.
- `PLAYER_VARIANT=female check-player-browser.mjs`: bevegelse/facing, nearest, dybde, fotlinje mot Kevin, kollisjon, interaksjon, alle kartoverganger, kamera og fishing entry, inkludert Canvas fallback.
- `check-menu-browser.mjs`: menyene på desktop, mobil, smal mobil og liggende mobil.
- `check-fishbook.mjs`: lagring og atomisk reset, inkludert feiltilfeller.
- `check-fishbook-firestore.mjs`: ekte SDK mot isolert demo-emulator, gamle utseender, begge karaktervalg, ugyldige verdier, kontoisolasjon og atomisk reset.
- Eksisterende tester for gangrytme og knappnavigasjon.

På denne Windows-maskinen har Java-emulatoren behov for en lang `jdk.net.unixdomain.tmpdir` i workspace slik at pipe-opprettelsen bruker TCP-fallback; dette er kun en lokal testinnstilling.
