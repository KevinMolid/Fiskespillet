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
3. Opprett Cloud Firestore først når vi skal lagre spilldata. Analytics-ID er inkludert i konfigurasjonen, men Analytics startes først når vi tar funksjonen i bruk.

`src/lib/firebase.ts` eksporterer `firebaseApp`, `auth` og `db`.

Firebase webkonfigurasjonen er klientkonfigurasjon, ikke en hemmelig servernøkkel. Tilgang til data må styres med Firebase Security Rules før ekte spillerdata lagres. Legg aldri tjenestekontonøkler eller private nøkler i `VITE_`-variabler.

## Neste steg

Bestem spillmekanikk og datamodell. Skriv Firestore-regler før flerspillerdata tas i bruk.
