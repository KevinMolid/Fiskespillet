# Joggesko fra Marita

Spilleren starter uten `sneakers` og kan bare gå. Første samtale med Marita ved vannet i Skogstjern gir ett par **Joggesko**, en permanent nøkkelgjenstand i sekken. Marita forteller at skoene er helt rå og at hun sprang 60K med dem. Senere samtaler gir vanlig dialog uten en ny belønning.

`grantMaritaSneakers` i `src/game/persistence.ts` tildeler skoene med en Firestore-transaksjon. Den leser eksisterende inventar og skriver bare dersom skoene mangler. Samtidige samtaler gir høyst ett par. Feil ved lagring viser en feilmelding og lar spilleren prøve samtalen igjen. Ny innlogging laster eierskapet fra inventaret; «Nytt spill» nullstiller også denne belønningen.

`hasRunningShoes` i `src/game/items.ts` brukes av GamePage og inventarsystemet. GamePage låser opp mobilens **B** og tastaturets **Shift** etter at skoene er lagret. WorldScene har i tillegg `setCanRun` og avviser løping uten eierskap. Løping beholder eksisterende dobbelt hastighet og ingen snuforsinkelse; vanlig gange beholder 50 ms. Movement, collision, fishing og grafikk er uendret.

Nøkkelgjenstander kan ikke flyttes til kisten. Firestore-reglene tillater ett par i sekken, ingen i kisten, ingen ved opprettelse av et nytt inventar og ingen fjerning fra et eksisterende inventar. Reglene må publiseres før klienten tas i bruk; prosjektets eksisterende GitHub-workflow publiserer `firestore.rules` når endringen pushes til main. Lokal testing publiserer ingenting.

## Verifisering

- Typecheck og produksjonsbuild.
- `tools/check-sneakers-firestore.mjs`: ekte Firestore-emulator, startinventar, engangsbelønning, samtidighet, ny innlogging, andre inventaroperasjoner, kontoisolasjon, ugyldige skriver og nytt spill. Testavhengighetene kan finnes i en separat mappe via `FIREBASE_TEST_RUNTIME`; emulatoren kjører på 127.0.0.1:8188 med isolerte demodata.
- `tools/check-sneakers-browser.mjs`: desktop, mobil med DPR 3 og Canvas; B/Shift-lås, første samtale, lagringsfeil og nytt forsøk, ingen dobbeltbelønning, refresh, nøkkelgjenstand i sekken og ingen overføring til kiste. Bruker bare lokale preview-tjenester.
- `tools/check-utility-browser.mjs`: eksisterende løpe-/kontrolltester med skoene allerede mottatt, inkludert flere mobilstørrelser, kollisjon og kartoverganger.
- Eksisterende kontroll-, NPC-, snu-før-gå- og Firestore-fiskeboktester.

Den lokale game-previewen starter også uten sko. Preview-belønningen lagres separat i `localStorage` under `fiskespillet-preview-sneakers`, uten noen produksjonskonto eller Firestore-skriver.
