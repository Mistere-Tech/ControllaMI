import { MSG } from './protocol';
import { DCIM_DIR, FIRST_MEDIA_DIR, mediaPath } from './gallery';

/**
 * Camera finta che risponde come la YI di prima serie.
 * La usano i test, il mock server TCP e la modalità demo dell'app.
 */
export class FakeCamera {
  lastRequest: any = null;
  recording = false;
  photosTaken = 0;
  mute = false;
  /** Scheda SD inserita (senza, REC/foto/elenco file falliscono). */
  sdInserted = true;
  /** Alcuni firmware non riportano lo stato della SD nelle impostazioni. */
  reportsSdStatus = true;

  private token: number;
  private nextToken: number;
  private settings: Record<string, string> = {
    camera_clock: '2016-03-01 10:00:00',
    video_standard: 'PAL',
    video_resolution: '1920x1080 50P 16:9',
    video_quality: 'S.Fine',
    rec_mode: 'record',
    timelapse_video: 'off',
    loop_rec: 'off',
    precise_cont_time: '1.0 sec',
    video_stamp: 'off',
    photo_size: '16M (4608x3456 4:3)',
    capture_mode: 'precise quality',
    auto_power_off: '5 minutes',
    led_mode: 'all enable',
    meter_mode: 'center',
    warp_enable: 'off',
    serial_number: 'Z22L5281044',
    sw_version: 'YDXJv22_1.2.13_build-20151217',
    hw_version: 'YDXJ_v22',
  };
  private options: Record<string, string[]> = {
    video_standard: ['NTSC', 'PAL'],
    rec_mode: ['record', 'record_timelapse', 'record_loop', 'record_photo'],
    timelapse_video: ['off', '0.5', '1', '2', '5', '10', '30', '60'],
    loop_rec: ['off', 'on'],
    precise_cont_time: ['0.5 sec', '1.0 sec', '2.0 sec', '5.0 sec', '10.0 sec', '30.0 sec', '60.0 sec'],
    video_quality: ['S.Fine', 'Fine', 'Normal'],
    video_stamp: ['off', 'date', 'time', 'date/time'],
    photo_size: ['16M (4608x3456 4:3)', '13M (4128x3096 4:3)', '8M (3264x2448 4:3)'],
    capture_mode: ['precise quality', 'precise quality cont.', 'burst quality', 'precise self quality'],
    auto_power_off: ['off', '3 minutes', '5 minutes', '10 minutes'],
    led_mode: ['all enable', 'all disable', 'status enable'],
    meter_mode: ['center', 'average', 'spot'],
    warp_enable: ['on', 'off'],
  };
  /** Cartelle dentro DCIM (100MEDIA, 101MEDIA…) con i loro file; null = la SD non ha nemmeno DCIM. */
  private dcim: Record<string, Record<string, string>> | null = {
    [FIRST_MEDIA_DIR]: {
      'YDXJ0042.mp4': '52428800 bytes|2016-03-01 10:20:30',
      'YDXJ0042_thm.mp4': '20480 bytes|2016-03-01 10:20:30',
      'YDXJ0041.mp4': '12582912 bytes|2016-03-01 10:15:00',
      'YDXJ0040.jpg': '4194304 bytes|2016-03-01 10:10:00',
      'YDXJ0039.jpg': '4194304 bytes|2016-03-01 10:09:00',
    },
  };
  /** Errori da restituire una volta a un certo comando (msg_id → rval). */
  private failures = new Map<number, number>();
  /** Canali verso i client collegati (li registra il transport in memoria). */
  private sinks = new Map<object, (msgs: any[]) => void>();
  private cwd = '/';
  private counter = 43;

  /** Come la YI vera: le risoluzioni ammesse dipendono dallo standard (NTSC 60/30, PAL 50/25). */
  private static RESOLUTIONS: Record<string, string[]> = {
    NTSC: ['1920x1080 60P 16:9', '1920x1080 30P 16:9', '1280x720 120P 16:9', '1280x720 60P 16:9', '2304x1296 30P 16:9'],
    PAL: ['1920x1080 50P 16:9', '1920x1080 25P 16:9', '1280x720 100P 16:9', '1280x720 50P 16:9', '2304x1296 25P 16:9'],
  };

  private optionsFor(key: string): string[] | undefined {
    if (key === 'video_resolution') return FakeCamera.RESOLUTIONS[this.settings.video_standard] ?? FakeCamera.RESOLUTIONS.PAL;
    return this.options[key];
  }

  /** Valore attuale di un'impostazione (per i test). */
  /** SD appena formattata: DCIM c'è ma senza cartelle 100MEDIA… */
  formatSd() {
    this.dcim = {};
  }

  /** SD senza la cartella DCIM. */
  removeDcim() {
    this.dcim = null;
  }

  addFile(dir: string, name: string, info: string) {
    this.dcim ??= {};
    (this.dcim[dir] ??= {})[name] = info;
  }

  /** La prossima risposta a `msgId` sarà l'errore `rval`. */
  failNext(msgId: number, rval: number) {
    this.failures.set(msgId, rval);
  }

  /** Dove la camera scrive i file nuovi: l'ultima cartella, creata se manca. */
  private newFile(name: string, info: string): string {
    this.dcim ??= {};
    const dirs = Object.keys(this.dcim).sort();
    const dir = dirs[dirs.length - 1] ?? FIRST_MEDIA_DIR;
    (this.dcim[dir] ??= {})[name] = info;
    return mediaPath(dir, name);
  }

  get(key: string): string | undefined {
    return this.settings[key];
  }

  /** Cambia un'impostazione "dai tasti della camera" (senza passare dal protocollo). */
  set(key: string, value: string) {
    this.settings[key] = value;
  }

  /** Simula un firmware che non ha questa impostazione. */
  removeOption(key: string) {
    delete this.options[key];
    delete this.settings[key];
  }

  /** Simula un firmware con la compensazione dell'esposizione. */
  enableExposureValue() {
    this.options.exposure_value = ['-2.0', '-1.5', '-1.0', '-0.5', '0.0', '+0.5', '+1.0', '+1.5', '+2.0'];
    this.settings.exposure_value = '0.0';
  }

  /** Scatto continuo in corso (timelapse foto). */
  capturing = false;

  /** Codice inventato: quello vero della YI senza SD non è ancora noto (da verificare sulla camera). */
  static readonly NO_SD = -27;

  constructor(opts: { token?: number } = {}) {
    this.token = opts.token ?? 1;
    this.nextToken = this.token;
  }

  attach(channel: object, send: (msgs: any[]) => void) {
    this.sinks.set(channel, send);
  }

  detach(channel: object) {
    this.sinks.delete(channel);
  }

  /** Manda una notifica spontanea (msg_id 7) al client collegato su `channel`. */
  notify(channel: object, n: { type: string; param?: unknown }) {
    this.sinks.get(channel)?.([{ msg_id: MSG.NOTIFICATION, ...n }]);
  }

  /** Simula un token scaduto: la sessione successiva darà `next`. */
  invalidateToken(next: number) {
    this.token = -1;
    this.nextToken = next;
  }

  /** Riceve una richiesta (già decodificata) e restituisce i messaggi da inviare. */
  handle(req: any): any[] {
    this.lastRequest = req;
    if (this.mute) return [];
    const id = req.msg_id;
    const ok = (extra: Record<string, unknown> = {}) => ({ rval: 0, msg_id: id, ...extra });
    const err = (rval: number) => [{ rval, msg_id: id }];
    const forced = this.failures.get(id);
    if (forced !== undefined) {
      this.failures.delete(id);
      return err(forced);
    }

    if (id === MSG.START_SESSION) {
      this.token = this.nextToken;
      return [ok({ param: this.token })];
    }
    if (req.token !== this.token) return err(-4);

    switch (id) {
      case MSG.STOP_SESSION:
        return [ok()];
      case MSG.GET_ALL_SETTINGS: {
        const all: Record<string, string> = { ...this.settings };
        if (this.reportsSdStatus) all.sd_card_status = this.sdInserted ? 'insert' : 'remove';
        return [ok({ param: Object.entries(all).map(([k, v]) => ({ [k]: v })) })];
      }
      case MSG.GET_SETTING:
        return [ok({ type: req.type, param: this.settings[req.type] })];
      case MSG.GET_OPTIONS: {
        const opts = this.optionsFor(req.param);
        return [ok({ param: req.param, permission: opts ? 'settable' : 'readonly', options: opts ?? [] })];
      }
      case MSG.SET_SETTING: {
        const opts = this.optionsFor(req.type);
        if (!opts || !opts.includes(req.param)) return err(-9);
        if (this.recording) return err(-14);
        if (req.type === 'video_standard' && req.param !== this.settings.video_standard) {
          // la camera porta la risoluzione all'equivalente nel nuovo standard
          const from = FakeCamera.RESOLUTIONS[this.settings.video_standard] ?? [];
          const to = FakeCamera.RESOLUTIONS[req.param] ?? [];
          const i = Math.max(0, from.indexOf(this.settings.video_resolution));
          if (to[i]) this.settings.video_resolution = to[i];
        }
        this.settings[req.type] = req.param;
        return [ok({ type: req.type, param: req.param }), { msg_id: MSG.NOTIFICATION, type: 'setting_changed', param: req.type }];
      }
      case MSG.BATTERY:
        return [ok({ type: 'battery', param: '85' })];
      case MSG.START_RECORD:
        if (!this.sdInserted) return err(FakeCamera.NO_SD);
        if (this.recording) return err(-14);
        this.recording = true;
        return [ok(), { msg_id: MSG.NOTIFICATION, type: 'start_video_record' }];
      case MSG.STOP_RECORD: {
        if (!this.recording) return err(-14);
        this.recording = false;
        const name = `YDXJ${String(this.counter++).padStart(4, '0')}.mp4`;
        const path = this.newFile(name, `31457280 bytes|${this.now()}`);
        return [ok(), { msg_id: MSG.NOTIFICATION, type: 'video_record_complete', param: path }];
      }
      case MSG.STOP_PHOTO:
        if (!this.capturing) return err(-14);
        this.capturing = false;
        return [ok()];
      case MSG.TAKE_PHOTO: {
        if (!this.sdInserted) return err(FakeCamera.NO_SD);
        if (/cont/.test(this.settings.capture_mode ?? '')) {
          if (this.capturing) return err(-14);
          this.capturing = true;
          return [ok()];
        }
        this.photosTaken++;
        const name = `YDXJ${String(this.counter++).padStart(4, '0')}.jpg`;
        const path = this.newFile(name, `4194304 bytes|${this.now()}`);
        return [ok(), { msg_id: MSG.NOTIFICATION, type: 'photo_taken', param: path }];
      }
      case MSG.START_VF:
      case MSG.STOP_VF:
        return [ok()];
      case MSG.CD: {
        // come la YI vera: cd in una cartella che non esiste → -1
        const path = String(req.param).replace(/\/+$/, '');
        if (this.sdInserted && !this.dirExists(path)) return err(-1);
        this.cwd = path;
        return [ok({ pwd: this.cwd })];
      }
      case MSG.LS:
        if (!this.sdInserted) return err(FakeCamera.NO_SD);
        return [ok({ listing: this.listing(this.cwd) })];
      case MSG.DELETE_FILE: {
        const parts = String(req.param).split('/');
        const name = parts.pop()!;
        const dir = parts.pop()!;
        const files = this.dcim?.[dir];
        if (!files || !files[name]) return err(-26);
        delete files[name];
        return [ok()];
      }
      default:
        return err(-1);
    }
  }

  private dirExists(path: string): boolean {
    if (path === '' || path === '/' || path === '/tmp' || path === '/tmp/fuse_d') return true;
    if (!this.dcim) return false;
    if (path === DCIM_DIR) return true;
    const dir = path.startsWith(DCIM_DIR + '/') ? path.slice(DCIM_DIR.length + 1) : null;
    return dir !== null && dir in this.dcim;
  }

  private listing(path: string): Record<string, string>[] {
    if (!this.dcim) return [];
    if (path === DCIM_DIR) return Object.keys(this.dcim).sort().map((d) => ({ [`${d}/`]: `0 bytes|${this.now()}` }));
    const dir = path.startsWith(DCIM_DIR + '/') ? path.slice(DCIM_DIR.length + 1) : null;
    const files = dir ? this.dcim[dir] : undefined;
    return files ? Object.entries(files).map(([k, v]) => ({ [k]: v })) : [];
  }

  private now() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
