# Fiskesystem

`src/game/fish.ts` er artsregisteret og fangstreglene. De 20 oppgitte artene er lagt inn med vekt, sjeldenhet, metoder og levesteder. Mort og fantasifisken gullørret beholdes med samme ID-er, slik at gamle fangster fortsatt vises. Abbor og gjedde beholder også ID-ene sine; deres vektintervaller er oppdatert.

## Regler

1. Bryggehavn er kyst, Skogstjernet er innsjø. Det finnes ingen nye kart. Gjørs er lokal og er ikke satt ut i det eksisterende tjernet.
2. Eksisterende Mark dekker metodene mark og agn. Eksisterende Sluk dekker sluk. Intern-ID-en `spinner` heter fortsatt Sluk i spillet; den gir ikke automatisk tilgang til spinner, små sluker, hekle, pilk, jigg eller andre nye metoder. Brød og mais brukes til mort i ferskvann.
3. Både områdets levested og en egnet metode må passe før en art kan trekkes. Feil agn gir beskjed uten kast, agnforbruk eller lagring av fangst.
4. Blant passende arter er relative sjeldenhetsvekter 60 / 25 / 8 / 3 / 1. Dette er spillbalanse, ikke faste prosenttall eller påstander om virkelige bestander.
5. Vekten trekkes med en kubisk kurve, slik at mindre fisk er vanligere enn rekordfisk. For arter merket med pluss tillates inntil 20 prosent over den oppgitte øvre vekten, som en eksplisitt spillregel. Maksimum er dermed 240 kg for kveite. Fangstsannsynligheten er fortsatt 82 prosent etter et napp.
6. Belønninger ligger på arten og brukes både i resultatvinduet og lagringen. Ingen nye gjenstander er opprettet.

Med dagens utstyr kan gjedde, sild, rødspette, brosme, lange, gjørs og kveite ikke fanges. De vises likevel i guiden med metodene sine. De andre artene kan fanges på et passende eksisterende sted. Fiskeboken har separate faner for «Finn fisken» og personlige fangster, én art per side.

## Kontroll og publisering

- `node tools/check-fish.mjs`: 96 000 deterministiske kast, levested/metode, sjeldenhetsrekkefølge, vektgrenser, belønninger, tomme utvalg og arts-ID-er i Firestore-reglene.
- `node tools/check-world.mjs`: kart og tilgang til fiskeplasser.
- `/tools/game-preview.html`: faktiske kontroller med lokal agnbruk, belønning og fangstbok, uten å skrive til en konto.
- `firestore.rules` er oppdatert med alle 22 arts-ID-er og vektgrensen på 240 000 gram. Reglene må publiseres før nye arter kan lagres mot Firebase. Prosjektets eksisterende GitHub-workflow publiserer reglene ved endring på main. Ingen regler er publisert ved lokal testing. Reglene er kontrollert som tekst, ikke kjørt i en Firestore-emulator.
