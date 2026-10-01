# Fiskebokillustrasjoner: designstandard

Dette dokumentet fastsetter visuell og teknisk standard for artsbilder i Fiskeboken. Følg det ved senere arbeid; generer og integrer én art om gangen. Abbor i `src/assets/fish/abbor.png` er den visuelle masterreferansen. Bruk den som stilreferanse, aldri som anatomisk mal.

## Prosjektforankring

Spillet tegner karttiles på et 16×16-rutenett og figurer på omtrent 18×22 piksler. Kartgrafikken bruker få varme, dempede farger, tydelige mørke konturer og skarpe pikselflater (`docs/art-direction.md`). Fiskeboken har allerede et valgfritt `image`-felt på artsdefinisjonen og viser bildet bare i fangstdetaljer. Ikke lag en ny renderer, et nytt katalogregister eller et eget Fiskebok-grensesnitt for illustrasjonene.

## Fast standard

- **Stil:** Håndlaget utseende i ekte pikselkunst. Bruk klart adskilte piksler og bevisste fargeflater; ikke lever et stort, detaljert bilde med et pikselfilter. Ikke fotorealistisk eller 3D.
- **Lerret:** 96×64 piksler, RGBA PNG. Én bildepiksel er minste arbeidsenhet. Omtrent 8–12 velvalgte farger per fisk, med en felles dyp konturfarge og en liten, dempet skygge-/lyspalett i spillets varme grønne, sandfargede og jordnære familie. Artsfarger som orange finner skal beholde nok kontrast til å skille arten.
- **Perspektiv og retning:** Rett sideprofil, hodet mot venstre og halen mot høyre. Ingen trekvartsvinkel eller perspektivforvrengning. Hele fisken, inklusive finner, skal være synlig.
- **Komposisjon:** Sentrert på transparent 96×64-bakgrunn. Sikt mot 75–85 % bredde for motivets synlige silhuett, med litt luft til alle kanter; skaler motivet proporsjonalt. Ikke klipp av munn, halefinne eller rygg-/bukfinner.
- **Bakgrunn:** Ekte alpha-transparens. Ingen vann, bunn, planter, steiner, bobler, glød, skygge, ramme, tekst eller symboler. Hold bakgrunnspikslene alpha 0 og motivpikslene alpha 255; unngå halvtransparente glorier.
- **Kontur og lys:** Tydelig, sammenhengende mørk pikselkontur som holder ved 1× størrelse. Bruk få trinn per overflate og lys ovenfra/venstre, i tråd med tiles og spillfigurer. Unngå gradienter, airbrush og overdetaljert skala-/støytekstur.
- **Anatomi:** Før hver art lages, bygg illustrasjonen rundt artens reelle sideprofil: kroppslengde/-høyde, hode og munn, ryggfinner, bryst-/buk-/gattfinner, halefinne, mønster og artsfarger. Bevar kjennetegn som identifiserer arten, selv om detaljer må forenkles. Ikke gjenbruk abborens kroppsform på andre arter; flatfisk, ål-/langeformer, gjedde og makrell må beholde hver sin profil.
- **Relativ skala:** Normaliser synlig motivstørrelse per art slik at hver illustrasjon bruker canvaset effektivt. Maksvekt avgjør ikke bildepikslene. Bevar artens proporsjoner og kroppsbygning, ikke forholdet mellom faktiske kilo.
- **Visning:** Fiskeboken har en 96×64 CSS-bildeflate for valgt fisk og en kompakt miniatyr i listen. Bruk `object-fit: contain` og `image-rendering: pixelated` slik at desktop og mobil skalerer uten uskarp interpolering. Ikke la UI strekke eller beskjære bildeforholdet.

## Assets og kobling

- **Format:** optimalisert PNG med RGBA-transparens, 96×64. Ingen eksterne bilder eller runtime-generering.
- **Plassering:** `src/assets/fish/`.
- **Filnavn:** artens stabile interne arts-ID, små ASCII-bokstaver, `.png` (for eksempel `abbor.png`, `orret.png`, `rodspette.png`). Bruk ID-en fra `src/game/fish.ts`, ikke visningsnavnet eller vitenskapelig navn.
- **Import:** importer den statiske filen i `src/game/fish.ts` og sett `image` på den tilhørende artsposten. Fiskeboken bruker allerede `FishImage` og `fish.image`; ikke hardkod arts-ID-er eller asset-stier i UI-et.
- **Oppdagelse:** bevar eksisterende låsing. Ukjent/ikke fanget fisk viser ikke artens bilde, navn eller artsdetaljer. Test både låst og fanget tilstand når en illustrasjon kobles inn.

## Arbeidsflyt for neste art

1. Les artsposten og arts-ID-en i `src/game/fish.ts`. Undersøk troverdige anatomikilder ved behov, og noter profilform, munn, finner, mønster og karakterfarger for akkurat arten.
2. Generer kun den forespurte arten med transparent bakgrunn. Bruk Abbor-bildet som visuell stilreferanse; instruer modellen eksplisitt om artens egen anatomi, venstrevendt sideprofil og null miljøelementer. Ikke lag en batch eller ekstra varianter uten konkret kvalitetsgrunn.
3. Inspiser generert motiv og alpha før integrering. Fjern tomme marger, skaler med nearest-neighbor til målkomposisjonen på 96×64, begrens paletten ved behov, og behold binær transparens. Ikke legg inn halvtransparente skygger eller glød.
4. Se bildet på transparent og lys Fiskebokbakgrunn ved 1× og i kompakt listeformat. Kontroller at motivet fyller omtrent 75–85 % av bredden, ikke er beskåret, vender riktig vei, og fortsatt er gjenkjennelig ved mobilstørrelse.
5. Legg filen som `src/assets/fish/<arts-ID>.png`, sett `image` kun på artsposten i `src/game/fish.ts`, og behold Fiskebokas eksisterende oppdagelsesregel. Kjør typecheck, build og fiskebok-/artstester.
6. Stopp etter den avtalte prøvearten slik at bruker kan godkjenne stil og anatomisk lesbarhet før neste art genereres.

Abbor ble laget med den innebygde imagegen-modellen som original motivskisse, deretter beskåret til motivets alpha-grenser, skalert med nearest-neighbor og kvantisert til paletten over. Resten av serien er tegnet som egne 48×32 håndlagde pikselprofiler i `tools/render-fish-assets.mjs` og skalert 2× til 96×64. Profilpunkter og kjennetegn varierer per art, mens konturpalett, pikselstørrelse, transparens, presentasjon og komposisjon følger masteren. Renderer-skriptet lager de 19 planlagte PNG-filene på nytt ved behov. Ikke bruk en felles kroppsform som erstatning for de artsvise profilene.

## Samlingsstatus

Illustrasjonene er nå laget for hele den planlagte samlingen:

Makrell (Scomber scombrus), Sei (Pollachius virens), Torsk (Gadus morhua), Ørret (Salmo trutta), Lyr (Pollachius pollachius), Sjøørret (Salmo trutta), Gjedde (Esox lucius), Røye (Salvelinus alpinus), Sild (Clupea harengus), Hvitting (Merlangius merlangus), Rødspette (Pleuronectes platessa), Harr (Thymallus thymallus), Sik (Coregonus lavaretus), Laks (Salmo salar), Brosme (Brosme brosme), Lange (Molva molva), Gjørs (Sander lucioperca), Kveite (Hippoglossus hippoglossus) og Steinbit (Anarhichas lupus).
