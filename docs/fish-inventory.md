# Fisk i sekken og salg

Vellykket fangst legger én fisk i sekken under «Fisk». Navnet kommer fra artsregisteret, og like arter stables med antall, for eksempel «Makrell ×3». Fangst gir ingen mynter. Fisk kan legges i kisten med eksisterende inventarkontroller, men må ligge i sekken for å selges.

Butikken har fanene «Kjøp agn» og «Selg fisk». Spilleren kan selge én fisk eller hele bunken av en art. Salgsprisen per fisk er den tidligere fangstbelønningen. Vekt påvirker ikke prisen. Salg fjerner fisk og legger til mynter i én Firestore-transaksjon. Mislykket lagring endrer ingen av delene, og kontroller låses mens en oppdatering pågår. B og Meny bruker eksisterende navigasjon.

`fish.ts` har `sellPrice`. `items.ts` oppretter ett item per art med ID `fish_<speciesId>`, kategori `fish` og pris i `FISH_SELL_PRICES`. `persistence.recordEncounter` oppdaterer fiskeboken og fiskebunken samlet; `sellFish` skriver bare inventaret. Rekorder, totalfangst og oppdagelser påvirkes aldri av salg. Gjenstandsgrensen er fortsatt 999 per bunke; myntgrensen er 1 000 000.

Eksisterende myntsaldo beholdes. Tidligere fangster blir ikke lagt til som salgbare fisk retroaktivt, siden disse allerede ga mynter. Ingen nye dokumenter eller obligatoriske felter er nødvendig: fiskebunker er nye nøkler i eksisterende `bag`/`storage`.

Firestore-reglene tillater kun de 21 registrerte fiskegjenstandene, med heltallsantall 0–999, og beholder kontoisolasjon og eksisterende validering. Bare endrede fiskemengder må valideres på nytt; tidligere verdier ble validert ved lagring. Dette holder full sekk og kiste innen Firestores grense på 1000 regeluttrykk. Reglene må publiseres sammen med klientendringen.

Fiskemeldinger forteller ikke at sluk eller agn er brukt/mistet. Forbruket av agn følger samme regler som før.

Tester:

- `tools/check-fishbook.mjs`: fangst uten mynter, stabling, salg, kisteflytting, ugyldige antall, full bunke/myntsaldo, kjøp med salgsmynter og bevarte rekorder.
- `tools/check-fishbook-firestore.mjs`: ekte transaksjoner og regler mot isolert demoemulator; samtidige salg, eierskap, all fisk i både sekk og kiste, ugyldige verdier og lagring. `FIREBASE_TEST_RUNTIME` velger testavhengigheter, `FIRESTORE_EMULATOR_PORT` velger lokal port (standard 8188).
- `tools/check-fish-sales-browser.mjs`: faktiske spillmenyer på desktop, mobil, smal mobil og liggende mobil; fangstmeldinger, fiskefane, sider, én/alle-salg, ventende/feilede skriver og agnkjøp.
- `tools/check-fishing-browser.mjs`: eksisterende kast, dybde, sveiving og fangstsekvens på desktop/mobil og Canvas-fallback.
