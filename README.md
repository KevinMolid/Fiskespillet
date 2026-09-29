# Fiskespill

Startprosjekt for et online fiskespill med React, TypeScript, Vite, Tailwind CSS og Firebase Authentication/Cloud Firestore.

## Lokal oppstart

Krever Node.js 20.19+ eller 22.12+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Åpne adressen Vite skriver ut. Firebase er valgfri for å vise startsiden.

## Koble til Firebase

1. Opprett et Firebase-prosjekt i Firebase Console og registrer en webapp.
2. Firebase-webappen er allerede lagt inn i `.env.example`. Kopier filen til `.env.local` (eller bruk den vedlagte konfigurasjonen) før oppstart.
3. I Firebase Console: Authentication → Sign-in method → Email/Password → Enable → Save. Registrering, innlogging, utlogging og tilbakestilling av passord bruker denne metoden.
4. Opprett Cloud Firestore først når vi skal lagre spilldata. Analytics-ID er inkludert i konfigurasjonen, men Analytics startes først når vi tar funksjonen i bruk.
4. Start utviklingsserveren på nytt etter endring av miljøvariabler.

`src/lib/firebase.ts` eksporterer `firebaseApp`, `auth` og `db`. Verdiene er `null` før appen er konfigurert; sjekk derfor at tjenesten finnes før bruk.

Firebase webkonfigurasjonen er klientkonfigurasjon, ikke en hemmelig servernøkkel. Tilgang til data må styres med Firebase Security Rules før ekte spillerdata lagres. Legg aldri tjenestekontonøkler eller private nøkler i `VITE_`-variabler.

## Neste steg

Bestem spillmekanikk og datamodell. Skriv Firestore-regler før flerspillerdata tas i bruk.
