# Fiskespill

Startprosjekt for et online fiskespill med React, TypeScript, Vite, Tailwind CSS og Firebase Authentication/Cloud Firestore.

## Lokal oppstart

Krever Node.js 20.19+ eller 22.12+.

```bash
npm install
npm run dev
```

Åpne adressen Vite skriver ut. Firebase-konfigurasjonen for dette prosjektet ligger i `src/lib/firebase.ts`, så innloggingen fungerer uten en lokal `.env.local`.

## Koble til Firebase

1. Firebase-webappen er allerede konfigurert i `src/lib/firebase.ts`. Valgfrie `VITE_FIREBASE_*`-variabler kan overstyre verdiene, for eksempel for et annet prosjekt; se `.env.example`.
2. I Firebase Console: Authentication → Sign-in method → Email/Password → Enable → Save. Registrering, innlogging, utlogging og tilbakestilling av passord bruker denne metoden.
3. Opprett Cloud Firestore i Firebase Console: Build → Firestore Database → Create database. Velg standarddatabasen og en region som passer spillerne (regionen kan ikke enkelt endres senere). Velg produksjonsmodus.
4. Åpne Firestore Database → Rules, lim inn hele innholdet i `firestore.rules` og trykk Publish. Disse reglene gir innloggede spillere lesetilgang til offentlige profiler og lar bare profilens eier endre sin profil.

Uten Firestore-databasen og de publiserte reglene fungerer innlogging fortsatt, men appen kan ikke lagre eller vise profiler. Profilene ligger i `profiles/{uid}` med offentlig brukernavn, profiltekst og en liten komprimert avatar. E-post og passord lagres ikke i Firestore. Avatarer lagres i Firestore for å unngå behov for Firebase Storage og Blaze-abonnement. For større bilder eller mange spillere bør bildene senere flyttes til et eget bildelager.

Analytics-ID er inkludert i konfigurasjonen, men Analytics startes først når vi tar funksjonen i bruk.

`src/lib/firebase.ts` eksporterer `firebaseApp`, `auth` og `db`.

Firebase webkonfigurasjonen er klientkonfigurasjon, ikke en hemmelig servernøkkel. Tilgang til data må styres med Firebase Security Rules før ekte spillerdata lagres. Legg aldri tjenestekontonøkler eller private nøkler i `VITE_`-variabler.

## Neste steg

## Første spillbare versjon

Logg inn og bruk piltaster eller WASD for å gå rundt på kartet. Gå gjennom åpningen i østveggen i Bryggehavn for å komme inn fra vest i Skogstjernet. Mørke felt og vann blokkerer bevegelse. Gå til en farbar rute ved vannet, vend figuren mot vannet og trykk E, mellomrom eller Handling-knappen. I Bryggehavn kan du gå inn i huset ved å vende deg mot døren og trykke E eller mellomrom. Snakk med Mira utenfor på samme måte. Inne i huset kan du åpne garderoben og lagre figurens genser, hår og hudtone. På mobil finnes enkle retningsknapper. Skilt ved vannet leses ved å vende seg mot dem og bruke samme handlingsknapp. Kameraet følger figuren rundt på større kart. Meldinger vises ved hendelser nederst i spillvinduet, mens fiskeboken åpnes over hele spillflaten.

Kart, fiskearter og områdets fangstvekter er definert i `src/game/world.ts`. Firestore lagrer siste posisjon i `gameSaves/{uid}` og en post per oppdaget fiskeart i `fishBooks/{uid}/entries/{speciesId}`. Andre innloggede spillere kan lese fiskeboken gjennom Spillere-siden. Fangsttrekningen kjører foreløpig i nettleseren og er ment for enspillerversjonen, ikke konkurranse eller handel.

Ved endringer i `firestore.rules` publiserer GitHub Actions reglene automatisk når workflowens service account er konfigurert.
