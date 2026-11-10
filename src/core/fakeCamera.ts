import { MSG } from './protocol';
import { MEDIA_DIR } from './gallery';

/**
 * Camera finta che risponde come la YI di prima serie.
 * La usano i test, il mock server TCP e la modalità demo dell'app.
 */
export class FakeCamera {
  lastRequest: any = null;
  recording = false;
  photosTaken = 0;
  mute = false;

  private token: number;
  private nextToken: number;
  private settings: Record<string, string> = {
    camera_clock: '2016-03-01 10:00:00',
    video_standard: 'PAL',
    video_resolution: '1920x1080 60P 16:9',
    video_quality: 'S.Fine',
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
    video_resolution: ['1920x1080 60P 16:9', '1920x1080 30P 16:9', '1280x720 120P 16:9', '1280x720 60P 16:9', '2304x1296 30P 16:9'],
    video_quality: ['S.Fine', 'Fine', 'Normal'],
    video_stamp: ['off', 'date', 'time', 'date/time'],
    photo_size: ['16M (4608x3456 4:3)', '13M (4128x3096 4:3)', '8M (3264x2448 4:3)'],
    capture_mode: ['precise quality', 'precise quality cont.', 'burst quality', 'precise self quality'],
    auto_power_off: ['off', '3 minutes', '5 minutes', '10 minutes'],
    led_mode: ['all enable', 'all disable', 'status enable'],
    meter_mode: ['center', 'average', 'spot'],
    warp_enable: ['on', 'off'],
  };
  private files: Record<string, string> = {
    'YDXJ0042.mp4': '52428800 bytes|2016-03-01 10:20:30',
    'YDXJ0042_thm.mp4': '20480 bytes|2016-03-01 10:20:30',
    'YDXJ0041.mp4': '12582912 bytes|2016-03-01 10:15:00',
    'YDXJ0040.jpg': '4194304 bytes|2016-03-01 10:10:00',
    'YDXJ0039.jpg': '4194304 bytes|2016-03-01 10:09:00',
  };
  /** Canali verso i client collegati (li registra il transport in memoria). */
  private sinks = new Map<object, (msgs: any[]) => void>();
  private cwd = '/';
  private counter = 43;

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

    if (id === MSG.START_SESSION) {
      this.token = this.nextToken;
      return [ok({ param: this.token })];
    }
    if (req.token !== this.token) return err(-4);

    switch (id) {
      case MSG.STOP_SESSION:
        return [ok()];
      case MSG.GET_ALL_SETTINGS:
        return [ok({ param: Object.entries(this.settings).map(([k, v]) => ({ [k]: v })) })];
      case MSG.GET_SETTING:
        return [ok({ type: req.type, param: this.settings[req.type] })];
      case MSG.GET_OPTIONS: {
        const opts = this.options[req.param];
        return [ok({ param: req.param, permission: opts ? 'settable' : 'readonly', options: opts ?? [] })];
      }
      case MSG.SET_SETTING: {
        const opts = this.options[req.type];
        if (!opts || !opts.includes(req.param)) return err(-9);
        if (this.recording) return err(-14);
        this.settings[req.type] = req.param;
        return [ok({ type: req.type, param: req.param }), { msg_id: MSG.NOTIFICATION, type: 'setting_changed', param: req.type }];
      }
      case MSG.BATTERY:
        return [ok({ type: 'battery', param: '85' })];
      case MSG.START_RECORD:
        if (this.recording) return err(-14);
        this.recording = true;
        return [ok(), { msg_id: MSG.NOTIFICATION, type: 'start_video_record' }];
      case MSG.STOP_RECORD: {
        if (!this.recording) return err(-14);
        this.recording = false;
        const name = `YDXJ${String(this.counter++).padStart(4, '0')}.mp4`;
        this.files[name] = `31457280 bytes|${this.now()}`;
        return [ok(), { msg_id: MSG.NOTIFICATION, type: 'video_record_complete', param: `${MEDIA_DIR}/${name}` }];
      }
      case MSG.TAKE_PHOTO: {
        this.photosTaken++;
        const name = `YDXJ${String(this.counter++).padStart(4, '0')}.jpg`;
        this.files[name] = `4194304 bytes|${this.now()}`;
        return [ok(), { msg_id: MSG.NOTIFICATION, type: 'photo_taken', param: `${MEDIA_DIR}/${name}` }];
      }
      case MSG.START_VF:
      case MSG.STOP_VF:
        return [ok()];
      case MSG.CD:
        this.cwd = req.param;
        return [ok({ pwd: this.cwd })];
      case MSG.LS:
        if (this.cwd !== MEDIA_DIR) return [ok({ listing: [] })];
        return [ok({ listing: Object.entries(this.files).map(([k, v]) => ({ [k]: v })) })];
      case MSG.DELETE_FILE: {
        const name = String(req.param).split('/').pop()!;
        if (!this.files[name]) return err(-26);
        delete this.files[name];
        return [ok()];
      }
      default:
        return err(-1);
    }
  }

  private now() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
