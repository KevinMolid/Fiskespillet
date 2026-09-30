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

## Fiskerfigur og spillmeny

Figurreferanser: [Red i FireRed/LeafGreen](https://bulbapedia.bulbagarden.net/wiki/File:Red_FRLG_OD.png) og [Fisherman, sprites fra samme spill](https://bulbapedia.bulbagarden.net/wiki/Fisher#Sprites_and_models). Figurenes store hoder, mørke konturer, få skyggetoner og tydelige retninger gjør små sprites lesbare. Fiskespillets egen 18 × 22-tegning bruker disse prinsippene med bred fiskerhatt, lommer i vesten, støvler og skulderveske. Ingen referansesprites er kopiert inn i spillet.

`fisherSprite.ts` leverer samme pikseldata til spillfiguren og garderobens SVG-forhåndsvisning. Hattebånd og skjorte følger `shirt`, hår følger `hair`, og ansikt/hender følger `skin`. Lagringsformatet er uendret. To alternerende steg og en hvilepositur finnes i alle fire retninger.

Enter åpner spillmenyen. Utstyr står til venstre, Sekk/Fiskebok/Fortsett til høyre. Piltaster eller Tab flytter fokus, Enter/E/mellomrom velger, og Escape går tilbake. Sekk og Fiskebok lukkes tilbake til menyen. Kartet er blokkert mens en meny vises. Stedsnavn vises i 3,2 sekunder ved første innlasting og kartbytte; bevegelse eller åpning av menyen starter ikke varselet på nytt.

`/tools/game-preview.html` bruker den faktiske GamePage med lokale minnetjenester, uten kontolagring. Test menyflyt, agnvalg, garderobens lagre/avbryt og kartovergang. `node tools/check-fisher.mjs` kontrollerer alle fargekombinasjoner, retninger og gangposisjoner.

## Mobilkontroller

Mobilvisningen bruker hele bredden, med styrekryss til venstre og A / meny-tilbake til høyre. Hold en retning inne for gjentatt bevegelse; slipp, avbrutt berøring, vindusbytte og menybytte stopper gjentakelsen. Alle knapper har `user-select: none`. Menyene bruker samme retningsnavigasjon på mobil og tastatur; E, mellomrom eller A aktiverer markert valg. Samlinger er delt i sider slik at sekken, kisten, butikken og fiskeboken ikke trenger rulling.

`node tools/check-controls.mjs` tester gjentakelse, stopp og geografisk menyvalg. Mobiloppsettet er kontrollert i nettleser ved 320 × 568, 390 × 844 og 844 × 390; garderoben også ved 568 × 320. Forhåndsvisningens teststeder gir tilgang til garderobe, butikk og kiste med lokale minnedata. Berøring på fysisk telefon er ikke testet.
