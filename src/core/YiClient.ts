import { Transport } from './transport';
import { JsonStreamParser } from './jsonStream';
import { MSG } from './protocol';
import { settingsToMap } from './settings';
import { CamFile, MEDIA_DIR, parseListing, CAMERA_HOST } from './gallery';

export class YiError extends Error {
  constructor(public rval: number, public msgId: number) {
    super(`La camera ha risposto con errore ${rval} al comando ${msgId}`);
    this.name = 'YiError';
  }
}

export interface YiNotification {
  type: string;
  param?: unknown;
}

interface Pending {
  req: Record<string, unknown>;
  resolve: (r: any) => void;
  reject: (e: Error) => void;
  retried: boolean;
}

const RVAL_INVALID_TOKEN = -4;

/**
 * Client del protocollo JSON della YI Action Camera (porta 7878).
 * Un comando alla volta: la camera non ha id di richiesta, quindi la risposta
 * si riconosce dal msg_id; le notifiche (msg_id 7) arrivano in mezzo.
 */
export class YiClient {
  token = 0;
  connected = false;

  private parser = new JsonStreamParser();
  private queue: Pending[] = [];
  private current: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners: ((n: YiNotification) => void)[] = [];
  private closeListeners: (() => void)[] = [];
  private timeoutMs: number;

  constructor(private transport: Transport, opts: { timeoutMs?: number } = {}) {
    this.timeoutMs = opts.timeoutMs ?? 5000;
    transport.onData((chunk) => this.onChunk(chunk));
    transport.onClose(() => this.onClosed());
  }

  async connect(): Promise<void> {
    this.connected = true;
    await this.openSession();
  }

  close() {
    if (this.connected) {
      try {
        this.transport.write(JSON.stringify({ msg_id: MSG.STOP_SESSION, token: this.token }));
      } catch {
        /* ignorato */
      }
    }
    this.transport.close();
    this.onClosed();
  }

  onNotification(cb: (n: YiNotification) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  onDisconnect(cb: () => void): () => void {
    this.closeListeners.push(cb);
    return () => {
      this.closeListeners = this.closeListeners.filter((l) => l !== cb);
    };
  }

  // ---- comandi ----

  async startRecord() { await this.send({ msg_id: MSG.START_RECORD }); }
  async stopRecord() { await this.send({ msg_id: MSG.STOP_RECORD }); }
  async takePhoto() { await this.send({ msg_id: MSG.TAKE_PHOTO }); }

  async getAllSettings(): Promise<Record<string, string>> {
    const r = await this.send({ msg_id: MSG.GET_ALL_SETTINGS });
    return settingsToMap(Array.isArray(r.param) ? r.param : []);
  }

  async getOptions(key: string): Promise<{ options: string[]; settable: boolean }> {
    const r = await this.send({ msg_id: MSG.GET_OPTIONS, param: key });
    return {
      options: Array.isArray(r.options) ? r.options.map(String) : [],
      settable: r.permission !== 'readonly',
    };
  }

  async setSetting(key: string, value: string) {
    await this.send({ msg_id: MSG.SET_SETTING, type: key, param: value });
  }

  async getBattery(): Promise<{ level: number; charging: boolean }> {
    const r = await this.send({ msg_id: MSG.BATTERY });
    return { level: parseInt(String(r.param), 10) || 0, charging: r.type === 'adapter' };
  }

  async listFiles(): Promise<CamFile[]> {
    await this.send({ msg_id: MSG.CD, param: MEDIA_DIR });
    const r = await this.send({ msg_id: MSG.LS, param: ' -D -S' });
    return parseListing(Array.isArray(r.listing) ? r.listing : []);
  }

  async deleteFile(name: string) {
    await this.send({ msg_id: MSG.DELETE_FILE, param: `${MEDIA_DIR}/${name}` });
  }

  async startLiveView(): Promise<string> {
    await this.send({ msg_id: MSG.START_VF, param: 'none_force' });
    return `rtsp://${CAMERA_HOST}/live`;
  }

  async stopLiveView() { await this.send({ msg_id: MSG.STOP_VF }); }

  /** Invia un comando qualsiasi; utile per sperimentare con la camera vera. */
  send(req: Record<string, unknown>): Promise<any> {
    if (!this.connected) return Promise.reject(new Error('Connessione chiusa'));
    return new Promise((resolve, reject) => {
      this.queue.push({ req, resolve, reject, retried: false });
      this.pump();
    });
  }

  // ---- interno ----

  private async openSession() {
    // il token viene salvato in onMessage, prima che parta il comando successivo
    await this.sendRaw({ msg_id: MSG.START_SESSION, token: 0 });
  }

  private sendRaw(req: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      // la sessione passa davanti a tutto
      this.queue.unshift({ req: { ...req, __raw: true }, resolve, reject, retried: true });
      this.pump();
    });
  }

  private pump() {
    if (this.current || !this.connected) return;
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    const { __raw, ...req } = next.req as any;
    const payload = __raw ? req : { ...req, token: this.token };
    this.timer = setTimeout(() => this.finish(new Error(`Timeout: la camera non ha risposto (${req.msg_id})`)), this.timeoutMs);
    try {
      this.transport.write(JSON.stringify(payload));
    } catch (e) {
      this.finish(e as Error);
    }
  }

  private finish(err: Error | null, result?: any) {
    const cur = this.current;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current = null;
    if (cur) {
      if (err) cur.reject(err);
      else cur.resolve(result);
    }
    this.pump();
  }

  private onChunk(chunk: string) {
    for (const msg of this.parser.feed(chunk)) this.onMessage(msg);
  }

  private onMessage(msg: any) {
    if (msg.msg_id === MSG.NOTIFICATION && msg.rval === undefined) {
      const n: YiNotification = { type: String(msg.type ?? ''), param: msg.param };
      this.listeners.forEach((l) => l(n));
      return;
    }
    const cur = this.current;
    if (!cur || msg.msg_id !== (cur.req as any).msg_id) return; // risposta fuori tempo: ignorata
    const rval = typeof msg.rval === 'number' ? msg.rval : 0;
    if (rval === RVAL_INVALID_TOKEN && !cur.retried) {
      // token scaduto: rifai la sessione e ripeti il comando una volta
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.current = null;
      cur.retried = true;
      this.queue.unshift(cur);
      this.openSession().catch(() => {});
      return;
    }
    if (rval >= 0 && msg.msg_id === MSG.START_SESSION) this.token = Number(msg.param) || 0;
    if (rval < 0) this.finish(new YiError(rval, msg.msg_id));
    else this.finish(null, msg);
  }

  private onClosed() {
    if (!this.connected && !this.current && this.queue.length === 0) return;
    this.connected = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const all = [...(this.current ? [this.current] : []), ...this.queue];
    this.current = null;
    this.queue = [];
    this.parser.reset();
    all.forEach((p) => p.reject(new Error('Connessione chiusa')));
    this.closeListeners.forEach((l) => l());
  }
}
