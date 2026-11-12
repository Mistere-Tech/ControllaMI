/**
 * Testi dell'app in italiano e in inglese.
 * La lingua si sceglie all'avvio da quella del telefono (app/_layout.tsx): italiano se il
 * telefono è in italiano, inglese per tutte le altre lingue. Si parte dall'italiano.
 */

export type Lang = 'it' | 'en';

/** La prima lingua conosciuta tra le preferite del telefono (es. ['de-DE', 'it-IT'] → it); altrimenti inglese. */
export function pickLang(tags: readonly (string | null | undefined)[]): Lang {
  for (const tag of tags) {
    const l = String(tag ?? '').toLowerCase().slice(0, 2);
    if (l === 'it' || l === 'en') return l;
  }
  return 'en';
}

let current: Lang = 'it';

export function setLang(l: Lang) {
  current = l;
}

export function getLang(): Lang {
  return current;
}

const it = {
  // connessione
  'connect.subtitle': 'YI Action Camera · prima serie',
  'connect.step1.title': 'Accendi il Wi-Fi della camera',
  'connect.step1.text': 'Tieni premuto il tasto Wi-Fi finché il LED diventa blu.',
  'connect.step2.title': 'Tocca Connetti e scegli la tua camera',
  'connect.step2.text': 'Android mostra le reti YDXJ_…: tocca la tua. Password predefinita: 1234567890',
  'connect.step3.title': 'Se la finestra non compare',
  'connect.step3.text': 'Collega il telefono a YDXJ_… dalle impostazioni Wi-Fi e tocca di nuovo Connetti.',
  'connect.status.connecting': 'Mi collego alla camera…',
  'connect.status.error': 'Errore di connessione',
  'connect.status.searching': 'Cerco la rete YDXJ_…',
  'connect.hint': 'Il telefono deve essere collegato al Wi-Fi della camera',
  'connect.hostLabel': 'Indirizzo camera (per il mock sul PC metti l’IP del PC)',
  'connect.hostA11y': 'Indirizzo camera',
  'connect.button': 'Connetti alla camera',
  'connect.buttonBusy': 'Connessione…',
  'connect.wifiSettings': 'Apri impostazioni Wi-Fi',
  'connect.demo': 'Usa la camera simulata (demo)',
  'connect.advanced': 'Avanzate',
  'connect.hide': 'Nascondi',
  'connect.passwordLabel': 'Password del Wi-Fi della camera (se l’hai cambiata)',
  'connect.passwordA11y': 'Password del Wi-Fi della camera',
  'connect.notFound': 'Non trovo la camera. Collega il telefono al Wi-Fi YDXJ_… e riprova.',
  'connect.lost': 'Connessione persa con la camera',

  // comuni
  'common.cancel': 'Annulla',
  'common.close': 'Chiudi',
  'common.retry': 'Riprova',

  // schede
  'tabs.control': 'Controllo',
  'tabs.gallery': 'Galleria',
  'tabs.settings': 'Impostazioni',

  // modalità
  'mode.video': 'Video',
  'mode.photo': 'Foto',
  'mode.timelapse': 'Timelapse',

  // controllo
  'control.reconnecting': 'Riconnessione in corso…',
  'control.preparing': 'Preparo la camera…',
  'control.timelapseRunning': 'Timelapse foto in corso',
  'control.recording': 'Registrazione in corso',
  'control.readyRecord': 'Pronta a registrare',
  'control.readyTimelapse': 'Pronta per il timelapse',
  'control.readyPhoto': 'Pronta a scattare',
  'control.every': 'ogni {value}',
  'control.disconnect': 'Disconnetti',
  'control.disconnectAsk': 'Disconnettere la camera?',
  'control.liveDemo': 'Live view non disponibile in demo',
  'control.liveRetrying': 'Live view interrotta · riprovo…',
  'control.liveStarting': 'Avvio live view…',
  'control.liveNoNetwork': 'Il video non arriva: Android non sta usando il Wi-Fi della camera. Riprovo…',
  'tip.wlanPlus': 'Su Honor e Huawei: Impostazioni → Wi-Fi → ⋮ → disattiva “WLAN+” (passaggio automatico ai dati mobili).',
  'tip.samsung': 'Su Samsung: Impostazioni → Connessioni → Wi-Fi → ⋮ → Avanzate → disattiva “Passa ai dati mobili”.',
  'tip.xiaomi': 'Su Xiaomi: Impostazioni → Wi-Fi → Assistente Wi-Fi → disattiva il passaggio automatico ai dati mobili.',
  'tip.generic': 'Se non passa: nelle impostazioni Wi-Fi disattiva il passaggio automatico ai dati mobili, oppure spegni i dati mobili mentre usi la camera.',
  'control.openGallery': 'Apri galleria',
  'control.startRec': 'Avvia registrazione',
  'control.stopRec': 'Ferma registrazione',
  'control.startTimelapse': 'Avvia timelapse',
  'control.stopTimelapse': 'Ferma timelapse',
  'control.takePhoto': 'Scatta foto',
  'control.lastFile': 'Ultimo file: {name}',

  // galleria
  'gallery.select': 'Seleziona',
  'gallery.filter.all': 'Tutti',
  'gallery.filter.video': 'Video',
  'gallery.filter.photo': 'Foto',
  'gallery.empty': 'Nessun file sulla scheda SD.',
  'gallery.downloading': 'Scarico {name}',
  'gallery.download': 'Scarica',
  'gallery.delete': 'Elimina',
  'gallery.demoTitle': 'Modalità demo',
  'gallery.demoMessage': 'Nella camera simulata non ci sono file veri da scaricare.',
  'gallery.savedTitle': 'Salvato',
  'gallery.savedOne': 'File salvato nella galleria del telefono.',
  'gallery.savedMany': '{n} file salvati nella galleria del telefono.',
  'gallery.deleteOne': 'Eliminare il file dalla camera?',
  'gallery.deleteMany': 'Eliminare {n} file dalla camera?',
  'gallery.cannotUndo': 'L’operazione non si può annullare.',
  'gallery.needPermission': 'Serve il permesso per salvare in galleria',
  'gallery.downloadFailed': 'Download non riuscito',

  // impostazioni
  'settings.readOnly': 'Questa impostazione non si può cambiare dall’app.',
  'settings.simple': 'Semplice',
  'settings.pro': 'Pro',
  'settings.modeA11y': 'Modalità {mode}',
  'settings.simpleHint': 'Video 1080p 60 fps e foto alla massima qualità, impostati dall’app. Le tue impostazioni Pro restano salvate.',
  'settings.proHint': 'Tutte le impostazioni della camera, a mano. Tornando in Semplice la camera torna ai valori migliori.',
  'settings.empty': 'Nessuna impostazione letta dalla camera. Trascina giù per riprovare.',
  'settings.clockSyncedTitle': 'Data e ora aggiornate',
  'settings.clockSynced': 'La camera ha di nuovo l’ora del telefono: {value}',
  'group.Video': 'Video',
  'group.Foto': 'Foto',
  'group.Timelapse': 'Timelapse',
  'group.Camera': 'Camera',
  'group.Info': 'Info',
  'group.Altro': 'Altro',

  // modalità semplice
  'simple.timelapseVideo': 'Timelapse video',
  'simple.timelapsePhoto': 'Timelapse foto',
  'simple.every': 'Ogni',
  'simple.intervalA11y': 'Intervallo {value}',
  'simple.exposure': 'Esposizione',
  'simple.exposureA11y': 'Esposizione {value}',
  'simple.meterA11y': 'Misurazione {value}',
  'simple.darker': 'Più scuro',
  'simple.brighter': 'Più chiaro',
  'meter.center': 'Centro',
  'meter.average': 'Media',
  'meter.spot': 'Spot',

  // scheda SD
  'sd.bannerMissing': 'Scheda SD assente: inserisci una SD per registrare, scattare e vedere i file.',
  'sd.bannerFormat': 'La scheda SD va formattata dal menu della camera.',

  // stato della connessione
  'health.stable': 'Connessione stabile',
  'health.unstable': 'Connessione instabile',
  'health.lost': 'Connessione persa',
  'health.simulated': 'Camera simulata',
  'health.reconnecting': 'Connessione persa · riconnessione…',

  // avvisi
  'problem.code': 'Codice {code}',
  'problem.dismiss': 'Chiudi avviso',
  'err.sdMissing.title': 'Scheda SD assente',
  'err.sdMissing.message': 'Inserisci una scheda SD nella camera per registrare, scattare e vedere la galleria.',
  'err.sdFormat.title': 'Scheda SD da formattare',
  'err.sdFormat.message': 'La camera chiede di formattare la scheda SD: fallo dal menu della camera, poi riprova.',
  'err.busy.title': 'Camera occupata',
  'err.busy.recording': 'Ferma la registrazione e riprova.',
  'err.busy.message': 'La camera sta finendo un’altra operazione. Riprova tra un attimo.',
  'err.badValue.title': 'Valore non accettato',
  'err.badValue.message': 'La camera non accetta questo valore in questa modalità.',
  'err.failed.title': 'Comando non riuscito',
  'err.failed.message': 'La camera ha rifiutato il comando. Riprova; se succede ancora, riavvia la camera.',
  'err.timeout.title': 'La camera non risponde',
  'err.timeout.message': 'Controlla di essere vicino alla camera e riprova.',
  'err.lost.title': 'Connessione persa',
  'err.lost.message': 'Sto provando a ricollegarmi alla camera…',
  'err.generic': 'Qualcosa è andato storto. Riprova.',

  // aggiornamenti
  'update.title': 'Aggiornamento obbligatorio',
  'update.subtitle': 'È disponibile la versione {latest} (hai la {current}). Per sicurezza l’app funziona solo all’ultima versione.',
  'update.notes': 'Novità',
  'update.downloading': 'Scarico l’aggiornamento… {pct}%',
  'update.downloadA11y': 'Download {pct} per cento',
  'update.button': 'Scarica e installa',
  'update.hint': 'Android ti chiederà di confermare con “Installa”. Se è la prima volta, consenti a ControllaMI di installare app.',
  'update.failed': 'Aggiornamento non riuscito',
  'update.downloadFailed': 'Download dell’aggiornamento non riuscito',

  // nomi delle impostazioni della camera
  'setting.video_resolution': 'Risoluzione',
  'setting.video_standard': 'Standard',
  'setting.video_quality': 'Qualità',
  'setting.video_stamp': 'Timestamp sul video',
  'setting.timelapse_video': 'Intervallo timelapse video',
  'setting.rec_mode': 'Modalità registrazione',
  'setting.loop_rec': 'Registrazione in loop',
  'setting.video_rotate': 'Capovolgi immagine',
  'setting.meter_mode': 'Misurazione esposizione',
  'setting.exposure': 'Esposizione (EV)',
  'setting.warp_enable': 'Correzione distorsione',
  'setting.photo_size': 'Dimensione',
  'setting.photo_quality': 'Qualità',
  'setting.photo_stamp': 'Timestamp sulla foto',
  'setting.capture_mode': 'Modalità scatto',
  'setting.precise_cont_time': 'Intervallo timelapse foto',
  'setting.burst_capture_number': 'Raffica',
  'setting.precise_selftime': 'Autoscatto',
  'setting.auto_power_off': 'Spegnimento automatico',
  'setting.led_mode': 'LED di stato',
  'setting.buzzer_volume': 'Volume segnali',
  'setting.buzzer_ring': 'Trova camera',
  'setting.start_wifi_while_booted': 'Wi-Fi all’accensione',
  'setting.auto_low_light': 'Luce scarsa automatica',
  'setting.camera_clock': 'Data e ora',
  'setting.system_default_mode': 'Modalità all’accensione',
  'setting.serial_number': 'Numero di serie',
  'setting.hw_version': 'Versione hardware',
  'setting.sw_version': 'Versione firmware',
  'setting.dev_functions': 'Funzioni',
  'setting.app_status': 'Stato',
  'setting.sd_card_status': 'Scheda SD',
  'setting.sdcard_need_format': 'SD da formattare',
  'setting.wifi_ssid': 'Nome Wi-Fi',
};

export type MsgKey = keyof typeof it;

const en: Record<MsgKey, string> = {
  'connect.subtitle': 'YI Action Camera · first generation',
  'connect.step1.title': 'Turn on the camera’s Wi-Fi',
  'connect.step1.text': 'Hold the Wi-Fi button until the LED turns blue.',
  'connect.step2.title': 'Tap Connect and pick your camera',
  'connect.step2.text': 'Android lists the YDXJ_… networks: tap yours. Default password: 1234567890',
  'connect.step3.title': 'If the window doesn’t appear',
  'connect.step3.text': 'Connect the phone to YDXJ_… from the Wi-Fi settings and tap Connect again.',
  'connect.status.connecting': 'Connecting to the camera…',
  'connect.status.error': 'Connection error',
  'connect.status.searching': 'Looking for the YDXJ_… network',
  'connect.hint': 'The phone must be connected to the camera’s Wi-Fi',
  'connect.hostLabel': 'Camera address (for the mock on a PC, enter the PC’s IP)',
  'connect.hostA11y': 'Camera address',
  'connect.button': 'Connect to camera',
  'connect.buttonBusy': 'Connecting…',
  'connect.wifiSettings': 'Open Wi-Fi settings',
  'connect.demo': 'Use the simulated camera (demo)',
  'connect.advanced': 'Advanced',
  'connect.hide': 'Hide',
  'connect.passwordLabel': 'Camera Wi-Fi password (if you changed it)',
  'connect.passwordA11y': 'Camera Wi-Fi password',
  'connect.notFound': 'Can\'t find the camera. Connect the phone to the YDXJ_… Wi-Fi and try again.',
  'connect.lost': 'Lost the connection to the camera',

  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.retry': 'Retry',

  'tabs.control': 'Control',
  'tabs.gallery': 'Gallery',
  'tabs.settings': 'Settings',

  'mode.video': 'Video',
  'mode.photo': 'Photo',
  'mode.timelapse': 'Timelapse',

  'control.reconnecting': 'Reconnecting…',
  'control.preparing': 'Setting up the camera…',
  'control.timelapseRunning': 'Photo timelapse running',
  'control.recording': 'Recording',
  'control.readyRecord': 'Ready to record',
  'control.readyTimelapse': 'Ready for timelapse',
  'control.readyPhoto': 'Ready to shoot',
  'control.every': 'every {value}',
  'control.disconnect': 'Disconnect',
  'control.disconnectAsk': 'Disconnect the camera?',
  'control.liveDemo': 'Live view not available in demo',
  'control.liveRetrying': 'Live view interrupted · retrying…',
  'control.liveStarting': 'Starting live view…',
  'control.liveNoNetwork': 'No video: Android isn’t using the camera’s Wi-Fi. Retrying…',
  'tip.wlanPlus': 'On Honor and Huawei: Settings → Wi-Fi → ⋮ → turn off “WLAN+” (automatic switch to mobile data).',
  'tip.samsung': 'On Samsung: Settings → Connections → Wi-Fi → ⋮ → Advanced → turn off “Switch to mobile data”.',
  'tip.xiaomi': 'On Xiaomi: Settings → Wi-Fi → Wi-Fi assistant → turn off the automatic switch to mobile data.',
  'tip.generic': 'If it still fails: turn off the automatic switch to mobile data in the Wi-Fi settings, or turn mobile data off while using the camera.',
  'control.openGallery': 'Open gallery',
  'control.startRec': 'Start recording',
  'control.stopRec': 'Stop recording',
  'control.startTimelapse': 'Start timelapse',
  'control.stopTimelapse': 'Stop timelapse',
  'control.takePhoto': 'Take photo',
  'control.lastFile': 'Last file: {name}',

  'gallery.select': 'Select',
  'gallery.filter.all': 'All',
  'gallery.filter.video': 'Video',
  'gallery.filter.photo': 'Photos',
  'gallery.empty': 'No files on the SD card.',
  'gallery.downloading': 'Downloading {name}',
  'gallery.download': 'Download',
  'gallery.delete': 'Delete',
  'gallery.demoTitle': 'Demo mode',
  'gallery.demoMessage': 'The simulated camera has no real files to download.',
  'gallery.savedTitle': 'Saved',
  'gallery.savedOne': 'File saved to the phone’s gallery.',
  'gallery.savedMany': '{n} files saved to the phone’s gallery.',
  'gallery.deleteOne': 'Delete the file from the camera?',
  'gallery.deleteMany': 'Delete {n} files from the camera?',
  'gallery.cannotUndo': 'This cannot be undone.',
  'gallery.needPermission': 'Permission is needed to save to the gallery',
  'gallery.downloadFailed': 'Download failed',

  'settings.readOnly': 'This setting can’t be changed from the app.',
  'settings.simple': 'Simple',
  'settings.pro': 'Pro',
  'settings.modeA11y': '{mode} mode',
  'settings.simpleHint': '1080p 60 fps video and photos at the highest quality, set by the app. Your Pro settings are kept.',
  'settings.proHint': 'Every camera setting, by hand. Going back to Simple puts the camera back on the best values.',
  'settings.empty': 'No settings read from the camera. Pull down to try again.',
  'settings.clockSyncedTitle': 'Date and time updated',
  'settings.clockSynced': 'The camera has the phone’s time again: {value}',
  'group.Video': 'Video',
  'group.Foto': 'Photo',
  'group.Timelapse': 'Timelapse',
  'group.Camera': 'Camera',
  'group.Info': 'Info',
  'group.Altro': 'Other',

  'simple.timelapseVideo': 'Video timelapse',
  'simple.timelapsePhoto': 'Photo timelapse',
  'simple.every': 'Every',
  'simple.intervalA11y': 'Interval {value}',
  'simple.exposure': 'Exposure',
  'simple.exposureA11y': 'Exposure {value}',
  'simple.meterA11y': 'Metering {value}',
  'simple.darker': 'Darker',
  'simple.brighter': 'Brighter',
  'meter.center': 'Center',
  'meter.average': 'Average',
  'meter.spot': 'Spot',

  'sd.bannerMissing': 'No SD card: insert one to record, shoot and see your files.',
  'sd.bannerFormat': 'The SD card must be formatted from the camera menu.',

  'health.stable': 'Connection stable',
  'health.unstable': 'Connection unstable',
  'health.lost': 'Connection lost',
  'health.simulated': 'Simulated camera',
  'health.reconnecting': 'Connection lost · reconnecting…',

  'problem.code': 'Code {code}',
  'problem.dismiss': 'Dismiss',
  'err.sdMissing.title': 'No SD card',
  'err.sdMissing.message': 'Insert an SD card in the camera to record, shoot and see the gallery.',
  'err.sdFormat.title': 'SD card needs formatting',
  'err.sdFormat.message': 'The camera asks to format the SD card: do it from the camera menu, then try again.',
  'err.busy.title': 'Camera busy',
  'err.busy.recording': 'Stop recording and try again.',
  'err.busy.message': 'The camera is finishing another operation. Try again in a moment.',
  'err.badValue.title': 'Value not accepted',
  'err.badValue.message': 'The camera doesn’t accept this value in this mode.',
  'err.failed.title': 'Command failed',
  'err.failed.message': 'The camera refused the command. Try again; if it keeps happening, restart the camera.',
  'err.timeout.title': 'The camera is not responding',
  'err.timeout.message': 'Make sure you are close to the camera and try again.',
  'err.lost.title': 'Connection lost',
  'err.lost.message': 'Trying to reconnect to the camera…',
  'err.generic': 'Something went wrong. Try again.',

  'update.title': 'Update required',
  'update.subtitle': 'Version {latest} is available (you have {current}). For security, the app only works on the latest version.',
  'update.notes': 'What’s new',
  'update.downloading': 'Downloading the update… {pct}%',
  'update.downloadA11y': 'Download {pct} percent',
  'update.button': 'Download and install',
  'update.hint': 'Android will ask you to confirm with “Install”. The first time, allow ControllaMI to install apps.',
  'update.failed': 'Update failed',
  'update.downloadFailed': 'The update download failed',

  'setting.video_resolution': 'Resolution',
  'setting.video_standard': 'Standard',
  'setting.video_quality': 'Quality',
  'setting.video_stamp': 'Timestamp on video',
  'setting.timelapse_video': 'Video timelapse interval',
  'setting.rec_mode': 'Recording mode',
  'setting.loop_rec': 'Loop recording',
  'setting.video_rotate': 'Flip image',
  'setting.meter_mode': 'Exposure metering',
  'setting.exposure': 'Exposure (EV)',
  'setting.warp_enable': 'Lens distortion correction',
  'setting.photo_size': 'Size',
  'setting.photo_quality': 'Quality',
  'setting.photo_stamp': 'Timestamp on photo',
  'setting.capture_mode': 'Shooting mode',
  'setting.precise_cont_time': 'Photo timelapse interval',
  'setting.burst_capture_number': 'Burst',
  'setting.precise_selftime': 'Self-timer',
  'setting.auto_power_off': 'Auto power off',
  'setting.led_mode': 'Status LED',
  'setting.buzzer_volume': 'Beep volume',
  'setting.buzzer_ring': 'Find camera',
  'setting.start_wifi_while_booted': 'Wi-Fi at power on',
  'setting.auto_low_light': 'Auto low light',
  'setting.camera_clock': 'Date and time',
  'setting.system_default_mode': 'Mode at power on',
  'setting.serial_number': 'Serial number',
  'setting.hw_version': 'Hardware version',
  'setting.sw_version': 'Firmware version',
  'setting.dev_functions': 'Functions',
  'setting.app_status': 'Status',
  'setting.sd_card_status': 'SD card',
  'setting.sdcard_need_format': 'SD needs formatting',
  'setting.wifi_ssid': 'Wi-Fi name',
};

export const MESSAGES: Record<Lang, Record<MsgKey, string>> = { it, en };

/** Il testo nella lingua scelta, con i {segnaposto} sostituiti. */
export function t(key: MsgKey, params?: Record<string, string | number>): string {
  const s = MESSAGES[current][key] ?? MESSAGES.it[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** true se esiste un testo con questa chiave (per le chiavi costruite al volo, es. setting.<nome>). */
export function hasKey(key: string): key is MsgKey {
  return key in it;
}
