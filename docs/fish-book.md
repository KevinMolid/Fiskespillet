# Fiskeboken

## Oppførsel og filer

- `src/game/fish.ts`: samme 22 arter og fangsttabeller som før, nå med vitenskapelige navn, korte faktatekster og valgfritt `image`. Ørret og sjøørret beholder hver sin ID. Gullørret er tydelig merket som fantasi og har ikke et oppdiktet vitenskapelig navn.
- `src/game/fishBook.ts`: spillerspesifikke data, normalisering av gamle dokumenter og én ren oppdateringsfunksjon. Eksisterende navn beholdes: `caughtCount` tilsvarer totalCaught, `smallestGrams`/`largestGrams` tilsvarer minste/største fangstvekt. Vekter lagres i hele gram. `hasCaught` og `discoveredLocationIds` er nye.
- `src/game/persistence.ts`: samme dokumentsti `fishBooks/{uid}/entries/{speciesId}`. Eksisterende transaksjon oppdaterer inventar og fiskebok samlet. Sted, art, agn og vekt valideres. To dokumentlesinger per forsøk; ingen nye listeners. Transaksjonsresultatet oppdaterer UI direkte, uten ny samlingslesing.
- `src/game/FishBookDialog.tsx`: artsliste, detaljvisning og nøytral bildefallback. Kun navn for aldri fangede arter, også ved tidligere mislykkede napp. Ingen globale habitat-/metodedata vises. «Funnet ved» kommer bare fra spillerens lagrede steder.
- `src/game/GameDialogs.tsx`, `GamePage.tsx`, `useGameInput.ts`, `src/style.css`: eksisterende meny, kontroller og Game Boy-stil gjenbrukes. Piltaster velger automatisk. E/Space/Enter eller A fokuserer detaljene; opp/ned ruller teksten, venstre/høyre går tilbake til artslisten. Esc og menyknappen går tilbake. Liste og detaljer kan også rulles med touch.
- `src/App.tsx`: spillvisningen monteres på nytt ved bytte av bruker-ID, slik at forrige spillers tilstand ikke blir stående.
- `src/PlayersPage.tsx`: den eksisterende offentlige fiskebokoversikten viser navn på ukjente fisk og låser statistikk til vellykkede fangster. Eksisterende lesetilgang for innloggede spillere beholdes.
- `firestore.rules`: kontrollerer fangststatus, unike gyldige sted-ID-er, rekorder og progresjon. Mislykkede forsøk kan ikke endre fangstrekorder eller oppdage steder. Bare eieren kan skrive.
- `tools/game-preview.tsx`: lokal prøvefangst bruker samme oppdateringsfunksjon. Prøveboken lagres i nettleserens localStorage under en egen testnøkkel, aldri på en ekte konto.

Sjeldenhet og vektområde merkes som spillverdier. Det er ikke biologiske maksvekter eller en rødliste. Ingen nye områder, gjenstander, XP eller samlingsbelønninger; eksisterende fangstmynter beholdes.

## Eksisterende data og publisering

Ingen masseflytting eller migreringsjobb er nødvendig. Ved lesing normaliseres gamle oppføringer: positiv `caughtCount` betyr fanget; manglende steder blir en tom liste. Neste fangstforsøk skriver det nye formatet. Tidligere antall, rekorder og tidsstempler beholdes. Gamle fangststeder kan ikke rekonstrueres og blir ikke gjettet. Første nye vellykkede fangst registrerer det aktuelle stedet.

Firestore-reglene og klienten må publiseres koordinert: gamle regler avviser de nye feltene, mens gamle klienter mangler de nå påkrevde feltene. Publiser reglene før ny klient tas i bruk og be eksisterende åpne klienter laste siden på nytt. Den eksisterende GitHub-workflowen publiserer regler ved endring på main. Lokal testing publiserer ingenting.

## Verifisering

- `node node_modules/typescript/bin/tsc -b`
- `node node_modules/vite/bin/vite.js build`
- `node tools/check-fishbook.mjs`: faktiske repository-funksjoner med isolert Firestore-adapter, min/maks/antall, feil, ingen delvise skriver, per-spiller lagring, gamle data, sammenslåing av steder og serverrendret UI uten informasjonslekkasje.
- `node tools/check-fishbook-firestore.mjs`: faktisk Firestore-emulator på 127.0.0.1:8188, prosjekt `demo-fiskespillet`, ekte SDK-transaksjoner, nye autentiserte klientkontekster, samtidige skriver, oppgradering og avvisning av ulovlige skriver. Krever `@firebase/rules-unit-testing` og Firebase i testmiljøet; `FIREBASE_TEST_RUNTIME` kan peke på en separat midlertidig npm-mappe. Java 21 og Firebase CLI brukes til emulatoren. Testen laster inn prosjektets gjeldende regler. Alle data er isolerte demodata.
- Eksisterende `check-fish`, `check-controls`, `check-world`, `check-npcs` og `check-fisher`.

Ved samtidige forsøk kan emulatoren avvise et utdatert forsøk før SDK-retry. Testen kontrollerer at det da ikke trekkes agn eller lagres delvise rekorder, og at et nytt forsøk kan lagres. Fisket i vanlig spillvisning tillater ett aktivt kast av gangen.

Ingen nåværende art finnes i begge eksisterende fiskeområder. Testen av to steder bruker derfor en isolert habitat-fixture og en egen regeltest; den endrer ikke spillets fangsttabeller.

Manuell UI-kontroll: desktop 1280×850, mobil 320×568 og liggende 844×390; automatisk valg, detail-scrolling, tilbake, ukjente arter og lokal fangst/refresh. Produksjonskontoer brukes ikke til tester.
