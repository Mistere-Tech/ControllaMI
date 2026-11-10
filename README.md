# ControllaMI

**App Android open source e gratuita per controllare la Xiaomi YI Action Camera di prima generazione** (la prima YI uscita sul mercato nel 2015, modello YDXJ01XY).

L'app ufficiale non è più aggiornata e sui telefoni recenti spesso non funziona: ControllaMI la sostituisce con un'app moderna, a 64 bit, che parla direttamente con la camera via Wi-Fi.

> *English: free, open source Android app to control the first-generation Xiaomi YI Action Camera (2015, model YDXJ01XY). Download the APK from [Releases](https://github.com/Mistere-Tech/ControllaMI/releases/latest).*

## Scarica l'app

👉 **[Scarica l'ultima versione (APK)](https://github.com/Mistere-Tech/ControllaMI/releases/latest)**

1. Apri il link dal telefono e scarica il file `ControllaMI-vX.Y.Z-arm64.apk`.
2. Aprilo: Android ti chiede di consentire "installa app sconosciute" per il browser, conferma.
3. Accendi il Wi-Fi della camera, collegati alla sua rete e apri ControllaMI.

Requisiti: telefono Android a 64 bit (arm64, cioè quasi tutti quelli degli ultimi anni). L'APK non è sul Play Store.

## Cosa fa

- Connessione al Wi-Fi della camera con riconnessione automatica
- REC e foto, timer di registrazione, livello batteria
- Live view dalla camera
- Impostazioni lette dalla camera e modificabili
- Galleria: elenco dei file, download nella galleria del telefono, eliminazione
- Modalità demo con una camera simulata, per provare l'app senza camera

## Camere compatibili

| Camera | Supportata |
|---|---|
| Xiaomi YI Action Camera, prima generazione (YDXJ01XY) | ✅ è quella per cui è fatta l'app |
| YI 4K, YI 4K+, YI Lite, YI Discovery e successive | ❌ non supportate |

## Stato del progetto

🚧 **Versione iniziale, in sviluppo.** Il protocollo è coperto da test automatici, ma l'app non è ancora stata provata su tutte le versioni di firmware. Se qualcosa non funziona con la tua camera, apri una [segnalazione](https://github.com/Mistere-Tech/ControllaMI/issues) indicando modello di telefono, versione di Android e firmware della camera.

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

L'app è fatta con React Native + Expo SDK 54 (development build, non Expo Go) e un piccolo modulo nativo in Kotlin.

### Come nasce un APK

La GitHub Action [`android.yml`](.github/workflows/android.yml) compila l'app a ogni push su `main` (APK scaricabile come artifact dell'esecuzione). Quando si crea un tag `v*`, per esempio:

```bash
git tag v0.1.0
git push origin v0.1.0
```

la stessa Action pubblica una **Release** con l'APK allegato, ed è quella che trova chi scarica l'app.

L'APK è firmato con la chiave di debug di Expo: si installa a mano senza problemi, ma non è adatto al Play Store.

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

La camera espone un server TCP su `192.168.42.1:7878` che parla JSON; i file si scaricano via HTTP da `http://192.168.42.1/DCIM/100MEDIA/` e la live view è su `rtsp://192.168.42.1/live`.

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
