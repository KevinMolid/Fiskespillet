# Fiskesystem

`src/game/fish.ts` er artsregisteret og fangstreglene. De 20 oppgitte artene er lagt inn med vekt, sjeldenhet, metoder og levesteder. Mort og fantasifisken gullørret beholdes med samme ID-er, slik at gamle fangster fortsatt vises. Abbor og gjedde beholder også ID-ene sine; deres vektintervaller er oppdatert.

## Regler

1. Bryggehavn er kyst, Skogstjernet er innsjø. Det finnes ingen nye kart. Gjørs er lokal og er ikke satt ut i det eksisterende tjernet.
2. Eksisterende Mark dekker metodene mark og agn. Eksisterende Sluk dekker sluk. Intern-ID-en `spinner` heter fortsatt Sluk i spillet; den gir ikke automatisk tilgang til spinner, små sluker, hekle, pilk, jigg eller andre nye metoder. Brød og mais brukes til mort i ferskvann.
3. Både områdets levested og en egnet metode må passe før en art kan trekkes. Feil agn gir beskjed uten kast, agnforbruk eller lagring av fangst.
4. Blant passende arter er relative sjeldenhetsvekter 60 / 25 / 8 / 3 / 1. Dette er spillbalanse, ikke faste prosenttall eller påstander om virkelige bestander.
5. Vekten trekkes med en kubisk kurve, slik at mindre fisk er vanligere enn rekordfisk. For arter merket med pluss tillates inntil 20 prosent over den oppgitte øvre vekten, som en eksplisitt spillregel. Maksimum er dermed 240 kg for kveite. Fangstsannsynligheten er fortsatt 82 prosent etter et napp.
6. Vellykket fangst gir ett fiskeitem i sekken, og ingen mynter. Arten har `sellPrice`, som brukes når fisken selges i butikken. Samme art samles i én bunke med antall. Fiskeboken og rekordene er uavhengige av fisken i sekken. Fiskemeldinger nevner ikke brukt eller mistet agn; eksisterende agnforbruk beholdes.

Med dagens utstyr kan gjedde, sild, rødspette, brosme, lange, gjørs og kveite ikke fanges. De vises likevel med navn i fiskeboken. De andre artene kan fanges på et passende eksisterende sted. Fiskeboken viser bare fakta om arter spilleren har fanget.

## Kontroll og publisering

- `node tools/check-fish.mjs`: 96 000 deterministiske kast, levested/metode, sjeldenhetsrekkefølge, vektgrenser, salgspriser, tomme utvalg og arts-/item-ID-er i Firestore-reglene.
- `node tools/check-world.mjs`: kart og tilgang til fiskeplasser.
- `/tools/game-preview.html`: faktiske kontroller med lokal agnbruk, fisk i sekken, salg og fangstbok, uten å skrive til en konto.
- `firestore.rules` er oppdatert med alle 22 arts-ID-er og vektgrensen på 240 000 gram. Reglene må publiseres før nye arter kan lagres mot Firebase. Prosjektets eksisterende GitHub-workflow publiserer reglene ved endring på main. Ingen regler er publisert ved lokal testing. Reglene er nå også testet i Firestore-emulatoren; se `fish-book.md`.

Fiskeboken viser nå informasjon og fangstrekorder til venstre og en rullbar artsliste til høyre. Fokus i artslisten velger fisken automatisk. Opp/ned flytter én art av gangen via tastatur eller mobilens styrekryss, og listen ruller markeringen inn i synsfeltet. Ekstra bekreftelse er ikke nødvendig.
