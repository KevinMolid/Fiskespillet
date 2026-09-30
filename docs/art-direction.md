# Bryggehavn og Skogstjernet

## Referanse og egen utforming

Visuell referanse: [Pallet Town i Pokémon FireRed/LeafGreen](https://www.poketools.com/firered/pallet-town), særlig [kartbildet](https://www.poketools.com/maps/firered/PalletTown.png).

Studien fokuserer på sammenhengende tak, markerte takutstikk, lyse fasader, vinduer med mørke rammer, små avgrensede hager og vegetasjon langs kartgrensene. Gangveier knytter innganger til naturlige mål. Gjentakende tiles har få farger, tydelige silhuetter og lys fra øvre venstre hjørne.

Fiskespillets egne tegninger bruker varm sand, salviegrønt gress, turkist vann, teglrødt hustak og blågrått butikktak. Fiskeskilt, brygger, siv og tønner gir landsbyen en egen identitet. Ingen bilder eller sprites er hentet inn fra Pokémon.

## Oppbygning

- `src/game/outdoorTiles.ts`: gjenbrukbare pikseltegninger på et 16 × 16-grunnrutenett, tegnet ved 2× størrelse. Vann, stier, tak og fasader tilpasses naborutene; ingen mørk ruteramme over terrenget.
- `src/game/world.ts`: kartplassering og dekorasjoner. Solide rekvisitter, stein og gjerder har kollisjon. Blomster og siv er visuelle detaljer. Eksisterende dører, skilt, gravesteder og overganger beholder koordinatene.
- Interiørene beholder eksisterende grafikk. Endringen gjelder utendørsområdene og bygningenes eksteriør.
- `docs/art/fiskespillet-tiles.svg`: eksportert oversikt over grunntegningene. Nabovarianter genereres i spillet.

## Forhåndsvisning og kontroll

Start Vite og åpne `/tools/art-preview.html`. Her vises begge kartene og en lokal spillbar visning uten Firebase eller lagring. Forhåndsvisningen er et utviklingsverktøy og inngår ikke i produksjonsbygget.

Kjør `node tools/check-world.mjs` for å kontrollere at innganger, interaksjoner, gravesteder og fiskeplasser er tilgjengelige. Kjør `node tools/export-tiles.mjs` etter endringer i tegningene for å oppdatere SVG-oversikten.

På Windows kan `&` i prosjektstien forstyrre npm sine kommandofiler. Direkte kommandoer er `node node_modules/typescript/bin/tsc -b`, `node node_modules/vite/bin/vite.js build` og `node node_modules/vite/bin/vite.js --host 127.0.0.1`.
