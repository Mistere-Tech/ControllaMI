# ControllaMI – contesto per Claude Code

App Android 64 bit (React Native 0.88 + Expo SDK 58, New Architecture, development build) per controllare la **YI Action Camera prima serie** (Xiaomi). Nata in una chat di Claude il 9–10/11/2026; questo file riassume dove siamo arrivati.

## Stato
- Logica in `src/core/`: puro TypeScript, testata. `npm test` → 167 test verdi (node:test + tsx). Nei test usare `waitFor` (tests/helpers.ts), mai attese fisse: su Windows i timer hanno ~15 ms di granularità e i file girano in parallelo.
- Schermate in `app/` (expo-router): connessione, poi tab Controllo / Galleria / Impostazioni. Provata sul telefono il 10/11 (build #5): parte e la live view si vede.
- Modulo nativo `modules/yi-native/` (Kotlin): `bindToWifi` (requestNetwork Wi-Fi senza internet + bindProcessToNetwork) e vista RTSP con Media3 1.11.1.
- Live view: la decide `LiveViewSupervisor` (src/core/liveView.ts), il player nativo esegue. Riavvio a ogni ritorno sulla schermata, vf_stop/vf_start, cambio impostazione, errore, buffering bloccato. "playing" solo col primo fotogramma vero (`onRenderedFirstFrame` → `firstFrame`), non con "ready": prima restava nero. Prima di avviare il video controlla la rete (`ensureNetwork`): se Android non usa il Wi-Fi della camera → fase `no_network` con consiglio per marca.
- Rete (src/core/network.ts + src/net/device.ts): da Android 10 collegamento guidato `WifiNetworkSpecifier` alle reti `YDXJ_` (password predefinita 1234567890, modificabile in Avanzate); se annullato o prima di Android 10 → `bindToWifi`. Fatto fuori dal tempo massimo della connessione. Segnalazione 12/11: Honor 200 Lite (MagicOS, Android 14), "WLAN+" passa ai dati mobili.
- Connessione: battito ogni 3 s (msg 13) → `computeHealth` stabile/instabile/persa → `ConnectionBadge`.
- Errori: `describeError` (src/core/errors.ts) + `ProblemBanner` al posto di Alert. Stato SD dal controller (`state.sd`), senza SD REC/foto/elenco file non partono.
- Modalità Semplice/Pro: `ModeManager` (src/core/modes.ts) + scelte in src/core/presets.ts. Semplice = video 1080p60 S.Fine NTSC, foto max, timelapse video/foto con intervallo, esposizione (EV se c'è, altrimenti meter_mode). Pro→Semplice salva i valori Pro e li rimette al ritorno.
- Aggiornamenti OTA obbligatori: src/core/updates.ts + `UpdateGate`. Legge `releases/latest` di GitHub (serve repo pubblico), blocca se c'è una versione più nuova anche offline se già nota; build `-dev` solo avviso.
- Firma: chiave di release nei GitHub Secrets (`CONTROLLAMI_*`), plugin `plugins/withReleaseSigning.js`. Backup locale in `.firma-release/` (ignorata da git): l'utente deve copiarla in un posto sicuro.
- CI `.github/workflows/android.yml`: test → versione (tag vX.Y.Z o X.Y.Z-dev.N) → prebuild → firma → APK arm64 → controllo certificato → artifact; su tag `v*` Release con l'APK.
- Open source, licenza MIT. Repo **pubblico** dal 10/11/2026.
- Prima Release: **v0.1.0** (10/11, versionCode 1000, firmata con la chiave di release); l'API `releases/latest` la vede senza login.
- Connessione: ogni tentativo ha un tempo massimo (`connectTimeoutMs`, 12 s nell'app) e si può annullare.
- Data e ora: a ogni connessione, se l'ora della camera (`camera_clock`, "AAAA-MM-GG hh:mm:ss") differisce di più di 60 s da quella del telefono, l'app la riscrive (src/core/clock.ts); da Impostazioni toccando "Data e ora" si rimette subito. Errori ignorati: non bloccano la connessione.
- Galleria: legge `DCIM` e ogni `xxxMEDIA`; cd in una cartella che non c'è → la YI risponde -1 (visto sul telefono) = nessun file.
- Repo: https://github.com/Mistere-Tech/ControllaMI (branch main). GitHub CLI autenticata su questo PC (`C:/Program Files/GitHub CLI/gh.exe`).

## Da verificare con la camera vera
- Firmware visto sul campo (12/11): YDXJv22L_1.5.12, hardware YDXJ_v22L.
- Collegamento guidato (finestra di Android con le reti YDXJ_) sul telefono vero, e che la live view parta senza schermo nero.
- Codice d'errore della YI senza SD (nella camera finta è -27, inventato), nome della notifica SD (`sd_card_status`?) e delle notifiche `vf_start`/`vf_stop`.
- msg 770 per fermare il timelapse foto; chiavi `rec_mode`, `timelapse_video`, `precise_cont_time`; chiave della compensazione EV (se esiste nel firmware).
- Che il ritorno da Impostazioni non perda più la live view.

## Prossimi passi
1. Provare la v0.1.0 sul telefono: connessione senza Wi-Fi della camera (errore dopo 12 s, Annulla), galleria e download.
1b. OTA provata e funzionante l'11/11: dalla v0.1.0 l'app ha chiesto l'aggiornamento e ha installato la v0.1.1 (italiano + inglese, versionCode 1001). Per le prossime versioni basta un tag `vX.Y.Z` su main.
1c. v0.1.3 pubblicata l'11/11 sera (data e ora della camera dal telefono + pacchetti Expo alle patch dell'11/11, versionCode 1003). Il tag v0.1.2 è rimasto senza Release: la sua build si è bloccata per un guasto di GitHub Actions, poi la CI ha fermato la ripartenza perché Expo aveva pubblicato patch nuove (`expo install --check`). Spostare un tag già pubblicato è bloccato: si fa un tag nuovo.
2. Build locale su Windows: serve abilitare i percorsi lunghi (limite 260 caratteri nel C++), altrimenti usare la CI.
3. Cronologia ripulita il 10/11 (file di build, zip APK, email personali → email anonima GitHub; force push fatto). Backup della storia vecchia in `.git/backup-prima-della-pulizia.bundle`. Vecchie esecuzioni delle Actions (#1–#11, sui commit di prima) cancellate il 10/11; restano #12 e #13. Repo reso pubblico e tag v0.1.0 fatti il 10/11.

## Regole di lavoro scelte dall'utente
- TDD: prima i test rossi, poi l'implementazione, poi i test verdi. Ogni bug ha un test di regressione.
- UI secondo il design: https://claude.ai/artifact/NWct9uawRk6p88WLMqiArp (tema scuro, arancio #FF8A3D per le azioni, rosso #FF5C5C solo per REC, giallo #F5C04A per "instabile"/avvisi).
- Avanzamento tracciato su Trello: https://trello.com/b/XxFlhs2k/controllami-app-yi-action-cam-android-64-bit
- Testi dell'app in italiano e inglese: tutti in `src/core/i18n.ts` (`t('chiave')`), lingua dal telefono (`expo-localization`, italiano se il telefono è in italiano, altrimenti inglese). Il test `tests/i18n.test.ts` blocca i testi scritti a mano nelle schermate. Si risponde all'utente in italiano.
- Restare sulle ultime versioni stabili (Expo SDK, React Native, Media3, Node LTS, JDK LTS, GitHub Actions) per non accumulare debito tecnico. Ultimo aggiornamento 10/11/2026: Expo 58, RN 0.88.1, React 19.3, TS 6, Node 24, Java 21.
- Aggiornamento dell'app sempre obbligatorio all'ultima versione (sicurezza); l'utente conferma solo "Installa".
- Commit: aggiungere i file uno per uno, non `git add -A` (sono già finiti nel repo file di build e uno zip).

## Protocollo YI (TCP 192.168.42.1:7878, JSON senza separatori)
257/258 sessione (token) · 3 tutte le impostazioni · 9 opzioni · 2 modifica · 13 batteria · 513/514 REC · 769 foto · 770 stop scatto continuo (da verificare) · 259 avvio stream (`rtsp://192.168.42.1/live`) · 1283 cd · 1282 ls · 1281 elimina · 7 notifiche. Errore -4 = token scaduto (il client rifà la sessione e ripete il comando). File via HTTP: `http://192.168.42.1/DCIM/<cartella>/<nome>` (100MEDIA, 101MEDIA…).

Il mock (`npm run mock`) usa la stessa `FakeCamera` dei test e della modalità demo.
