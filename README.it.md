<p align="center">
  <img src="assets/icon.png" alt="ControllaMI" width="128">
</p>

<h1 align="center">ControllaMI</h1>

<p align="center">
  <b>Controlla la Xiaomi YI Action Camera di prima generazione da un telefono Android moderno.</b><br>
  Gratuita e open source, di <a href="https://github.com/Mistere-Tech">Mistere Tech</a>
</p>

<p align="center">
  <a href="https://github.com/Mistere-Tech/ControllaMI/releases/latest"><img src="https://img.shields.io/github/v/release/Mistere-Tech/ControllaMI?style=flat-square&label=scarica%20APK&color=FF8A3D" alt="Scarica l'APK"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licenza-MIT-2ea44f?style=flat-square" alt="Licenza MIT"></a>
  <img src="https://img.shields.io/badge/gratis-niente%20pubblicità%20·%20niente%20tracciamento-2ea44f?style=flat-square" alt="Gratis, niente pubblicità, niente tracciamento">
  <img src="https://img.shields.io/badge/Android-64%20bit-3DDC84?style=flat-square&logo=android&logoColor=white" alt="Android 64 bit">
  <img src="https://img.shields.io/badge/camera-YI%20YDXJ01XY%20(2015)-1A4752?style=flat-square" alt="YI Action Camera YDXJ01XY">
</p>

<p align="center"><a href="README.md">English</a> · <b>Italiano</b></p>

**App Android open source e gratuita per controllare la Xiaomi YI Action Camera di prima generazione** (la prima YI uscita sul mercato nel 2015, modello YDXJ01XY).

L'app ufficiale non è più aggiornata e sui telefoni recenti spesso non funziona: ControllaMI la sostituisce con un'app moderna, a 64 bit, che parla direttamente con la camera via Wi-Fi.

## Scarica l'app

👉 **[Scarica l'ultima versione (APK)](https://github.com/Mistere-Tech/ControllaMI/releases/latest)**

1. Apri il link dal telefono e scarica il file `ControllaMI-vX.Y.Z-arm64.apk`.
2. Aprilo: Android ti chiede di consentire "installa app sconosciute" per il browser, conferma.
3. Accendi il Wi-Fi della camera, collegati alla sua rete e apri ControllaMI.

**Aggiornamenti:** all'avvio l'app controlla se c'è una versione nuova e, se c'è, chiede di installarla prima di continuare (per sicurezza si usa sempre l'ultima versione). Basta toccare "Scarica e installa" e confermare con "Installa".

Requisiti: telefono Android a 64 bit (arm64, cioè quasi tutti quelli degli ultimi anni). L'APK non è sul Play Store.

## Cosa fa

- **Modalità Semplice**: video 1080p 60 fps al bitrate massimo, foto alla massima qualità, timelapse video o foto con l'intervallo che scegli, regolazione dell'esposizione. L'app imposta la camera da sola.
- **Modalità Pro**: tutte le impostazioni della camera, a mano. Passando da una modalità all'altra le tue impostazioni Pro restano salvate.
- Live view dalla camera, che si riprende da sola se si interrompe
- Indicatore della connessione: stabile, instabile o persa, con riconnessione automatica
- Galleria: elenco dei file, download nella galleria del telefono, eliminazione
- Avvisi chiari in italiano quando un comando non riesce (ad esempio scheda SD assente)
- Modalità demo con una camera simulata, per provare l'app senza camera

## Camere compatibili

| Camera | Supportata |
|---|---|
| Xiaomi YI Action Camera, prima generazione (YDXJ01XY) | ✅ è quella per cui è fatta l'app |
| YI 4K, YI 4K+, YI Lite, YI Discovery e successive | ❌ non supportate |

## Stato del progetto

🧪 **Prima versione pubblica (0.1.x).** Provata su una YI prima serie: live view, foto, video, timelapse, impostazioni e download dalla galleria funzionano. Il protocollo è coperto da test automatici, ma l'app non è ancora stata provata su tutte le versioni di firmware. Se qualcosa non funziona con la tua camera, apri una [segnalazione](https://github.com/Mistere-Tech/ControllaMI/issues) indicando modello di telefono, versione di Android e firmware della camera.

Problema noto su Android 10 e successivi: quando ti colleghi al Wi-Fi della camera Android può chiedere "Questa rete non ha accesso a internet, rimanere connessi?". Rispondi **sì**.

## Contribuire

Il codice è aperto e i contributi sono benvenuti: segnalazioni, test con la propria camera, pull request.

### Sviluppo in locale

```bash
npm install
npx expo install --fix
npm test              # test del protocollo e della logica
npm run mock          # finta YI sulla porta 7878
npx expo run:android  # compila e installa su telefono collegato via USB
```

Per provare l'app contro il mock: telefono e PC sulla stessa rete, nell'app tocca **Avanzate** e metti l'IP del PC.

L'app è fatta con React Native 0.88 + Expo SDK 58 (New Architecture, development build, non Expo Go) e un piccolo modulo nativo in Kotlin.

### Come nasce un APK

La GitHub Action [`android.yml`](.github/workflows/android.yml) compila l'app a ogni push su `main` (APK scaricabile come artifact dell'esecuzione). Quando si crea un tag `v*`, per esempio:

```bash
git tag v0.1.0
git push origin v0.1.0
```

la stessa Action pubblica una **Release** con l'APK allegato, ed è quella che trova chi scarica l'app.

Gli APK sono firmati con la chiave di release del progetto, custodita nei GitHub Secrets: è quella che permette agli aggiornamenti di installarsi sopra l'app esistente. Le build di fork e pull request, che non hanno accesso ai Secrets, escono firmate con la chiave di debug di Expo.

### Struttura

```
app/                  schermate (expo-router): connessione + tab Controllo / Galleria / Impostazioni
src/core/             protocollo YI, puro TypeScript e testato
  jsonStream.ts       parser dei JSON attaccati che arrivano dal TCP
  YiClient.ts         sessione/token, coda comandi, timeout, notifiche, token scaduto
  CameraController.ts stato dell'app, riconnessione, REC/foto, impostazioni, file
  fakeCamera.ts       camera simulata (test, mock server, demo)
src/net/              TCP (react-native-tcp-socket) e download in galleria
modules/yi-native/    modulo Expo nativo in Kotlin: bind al Wi-Fi e player RTSP
mock/mockServer.ts    finta camera via TCP
tests/                test node:test (npm test)
```

### Protocollo della camera

La camera espone un server TCP su `192.168.42.1:7878` che parla JSON; i file si scaricano via HTTP da `http://192.168.42.1/DCIM/<cartella>/` (`100MEDIA`, `101MEDIA`…) e la live view è su `rtsp://192.168.42.1/live`.

| msg_id | Cosa fa |
|---|---|
| 257 / 258 | apre / chiude la sessione (token) |
| 3 / 9 / 2 | tutte le impostazioni / opzioni ammesse / modifica |
| 13 | batteria |
| 513 / 514 | avvia / ferma registrazione |
| 769 | foto |
| 259 | avvia lo stream per la live view |
| 1283 / 1282 / 1281 | cd / elenco / elimina file |
| 7 | notifiche della camera (inizio/fine REC, foto scattata…) |

Questi codici vengono dalla documentazione della community e possono variare con il firmware.

## Licenza

[MIT](LICENSE): puoi usare, modificare e ridistribuire il codice liberamente.

ControllaMI è un progetto indipendente, non affiliato a Xiaomi né a YI Technology. I nomi Xiaomi e YI sono dei rispettivi proprietari.
