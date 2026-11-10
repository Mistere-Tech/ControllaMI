# ControllaMI – contesto per Claude Code

App Android 64 bit (React Native 0.88 + Expo SDK 58, New Architecture, development build) per controllare la **YI Action Camera prima serie** (Xiaomi). Nata in una chat di Claude il 9–10/11/2026; questo file riassume dove siamo arrivati.

## Stato
- Protocollo e logica in `src/core/`: puro TypeScript, testati. `npm test` → 42 test verdi (node:test + tsx).
- Schermate in `app/` (expo-router): connessione, poi tab Controllo / Galleria / Impostazioni. Scritte ma **mai compilate né provate su un telefono**.
- Modulo nativo `modules/yi-native/` (Kotlin): `bindToWifi` (requestNetwork Wi-Fi senza internet + bindProcessToNetwork) e vista RTSP con Media3 1.11.1.
- CI in `.github/workflows/android.yml`: test → expo prebuild → APK release arm64 → artifact `ControllaMI-apk`; su tag `v*` crea anche una Release con l'APK.
- Open source, licenza MIT. Repo privato finché l'app non è provata, poi va reso pubblico (README già scritto per il pubblico).
- Repo: https://github.com/Mistere-Tech/ControllaMI (privato, branch main). GitHub CLI autenticata su questo PC (`C:/Program Files/GitHub CLI/gh.exe`).

## Prossimi passi
1. Far passare la build della CI (o in locale: `npm install`, `npx expo install --fix`, `npx expo run:android`) e correggere gli eventuali errori di compilazione, soprattutto nel Kotlin.
2. Provare con la camera vera: msg_id, latenza della live view, Wi-Fi senza internet su Android 10+.

## Regole di lavoro scelte dall'utente
- TDD: prima i test rossi, poi l'implementazione, poi i test verdi.
- UI secondo il design: https://claude.ai/artifact/NWct9uawRk6p88WLMqiArp (tema scuro, arancio #FF8A3D per le azioni, rosso #FF5C5C solo per REC).
- Avanzamento tracciato su Trello: https://trello.com/b/XxFlhs2k/controllami-app-yi-action-cam-android-64-bit
- Testi dell'app in italiano.
- Restare sulle ultime versioni stabili (Expo SDK, React Native, Media3, Node LTS, JDK LTS) per non accumulare debito tecnico. Ultimo aggiornamento 10/11/2026: Expo 58, RN 0.88.1, React 19.3, TS 6, Node 24, Java 21.

## Protocollo YI (TCP 192.168.42.1:7878, JSON senza separatori)
257/258 sessione (token) · 3 tutte le impostazioni · 9 opzioni · 2 modifica · 13 batteria · 513/514 REC · 769 foto · 259 avvio stream (`rtsp://192.168.42.1/live`) · 1283 cd · 1282 ls · 1281 elimina · 7 notifiche. Errore -4 = token scaduto (il client rifà la sessione e ripete il comando). File via HTTP: `http://192.168.42.1/DCIM/100MEDIA/<nome>`.

Il mock (`npm run mock`) usa la stessa `FakeCamera` dei test e della modalità demo.
