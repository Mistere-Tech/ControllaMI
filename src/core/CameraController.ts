import { t } from './i18n';
import { Transport } from './transport';
import { YiClient, YiNotification } from './YiClient';
import { CamFile } from './gallery';
import { SdMissingError, SdState, sdStateFrom, sdStateFromNotification } from './errors';

export type Status = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type Mode = 'video' | 'photo';

export interface CameraState {
  status: Status;
  error: string | null;
  mode: Mode;
  recording: boolean;
  recordStartedAt: number | null;
  battery: number | null;
  charging: boolean;
  settings: Record<string, string>;
  files: CamFile[];
  lastFile: string | null;
  /** Tempi di risposta degli ultimi battiti (ms), dal più vecchio; null = nessuna risposta. */
  heartbeats: (number | null)[];
  /** Scheda SD: ok, assente, da formattare o sconosciuto (firmware che non lo dice). */
  sd: SdState;
}

export interface ControllerOptions {
  createTransport: () => Promise<Transport>;
  timeoutMs?: number;
  /** Tempo massimo per un intero tentativo di connessione (Wi-Fi + TCP + sessione), ms. */
  connectTimeoutMs?: number;
  reconnectDelayMs?: number;
  maxReconnects?: number;
  /** Ogni quanto controllare che la camera risponda (ms); 0 = mai. */
  heartbeatMs?: number;
  now?: () => number;
}


/** Tentativo di connessione superato da un altro, annullato o scaduto. */
class AbandonedError extends Error {}

function connectError(e: Error): string {
  // di solito il telefono non è sul Wi-Fi della camera
  if (/timeout/i.test(e.message)) return t('connect.notFound');
  return `${t('connect.notFound')} (${e.message})`;
}

/** Quanti battiti tenere in memoria. */
const HEARTBEAT_HISTORY = 10;

export function formatElapsed(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const initial: CameraState = {
  status: 'disconnected',
  error: null,
  mode: 'video',
  recording: false,
  recordStartedAt: null,
  battery: null,
  charging: false,
  settings: {},
  files: [],
  lastFile: null,
  heartbeats: [],
  sd: 'unknown',
};

/** Stato dell'app intorno al client: connessione, riconnessione, REC, impostazioni, file. */
export class CameraController {
  state: CameraState = { ...initial };
  client: YiClient | null = null;

  private listeners = new Set<(s: CameraState) => void>();
  private notificationListeners = new Set<(n: YiNotification) => void>();
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Numero del tentativo in corso: un tentativo con numero vecchio non deve più toccare lo stato. */
  private openId = 0;
  private cancelOpen: ((e: Error) => void) | null = null;
  private now: () => number;

  constructor(private opts: ControllerOptions) {
    this.now = opts.now ?? Date.now;
  }

  subscribe(l: (s: CameraState) => void): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  /** Notifiche della camera (vf_start, sd_card_status, …) per chi sta sopra al controller. */
  onNotification(l: (n: YiNotification) => void): () => void {
    this.notificationListeners.add(l);
    return () => {
      this.notificationListeners.delete(l);
    };
  }

  private set(patch: Partial<CameraState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  async connect(): Promise<void> {
    this.manualClose = false;
    this.attempts = 0;
    this.set({ status: 'connecting', error: null });
    try {
      await this.openWithDeadline();
    } catch (e) {
      if (!this.manualClose) this.set({ status: 'error', error: connectError(e as Error) });
      throw e;
    }
  }

  disconnect() {
    this.manualClose = true;
    this.openId++;
    this.cancelOpen?.(new AbandonedError('Connessione annullata'));
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const c = this.client;
    this.client = null;
    this.stopHeartbeat();
    c?.close();
    this.set({ status: 'disconnected', recording: false, recordStartedAt: null, heartbeats: [] });
  }

  /**
   * Un tentativo di connessione con tempo massimo: se il Wi-Fi, il TCP o la camera non
   * rispondono mai, dopo `connectTimeoutMs` si arrende (prima restava in caricamento per sempre).
   * Anche disconnect() lo interrompe subito (pulsante Annulla).
   */
  private openWithDeadline(): Promise<void> {
    const id = ++this.openId;
    const ms = this.opts.connectTimeoutMs ?? 15_000;
    let abandon!: (e: Error) => void;
    const abandoned = new Promise<never>((_, reject) => (abandon = reject));
    abandoned.catch(() => {});
    const timer = setTimeout(() => abandon(new Error('Timeout connessione')), ms);
    this.cancelOpen = abandon;
    return Promise.race([this.open(id, abandoned), abandoned])
      .catch((e) => {
        if (this.openId === id) this.openId++; // il tentativo rimasto appeso, se torna, si chiude da solo
        abandon(e);
        throw e;
      })
      .finally(() => {
        clearTimeout(timer);
        if (this.cancelOpen === abandon) this.cancelOpen = null;
      });
  }

  private async open(id: number, abandoned: Promise<never>) {
    const stale = () => id !== this.openId;
    const transport = await this.opts.createTransport();
    if (stale()) {
      transport.close();
      throw new AbandonedError('Tentativo di connessione scaduto');
    }
    const client = new YiClient(transport, { timeoutMs: this.opts.timeoutMs });
    client.onNotification((n) => this.handleNotification(n));
    try {
      await Promise.race([client.connect(), abandoned]);
      if (stale()) throw new AbandonedError('Tentativo di connessione scaduto');
    } catch (e) {
      client.close();
      throw e;
    }
    client.onDisconnect(() => this.onLost(client));
    this.client = client;
    this.attempts = 0;
    const [battery, settings] = await Promise.all([
      client.getBattery().catch(() => null),
      client.getAllSettings().catch(() => ({} as Record<string, string>)),
    ]);
    if (stale()) {
      if (this.client === client) this.client = null;
      client.close();
      throw new AbandonedError('Tentativo di connessione scaduto');
    }
    this.set({
      status: 'connected',
      error: null,
      battery: battery?.level ?? null,
      charging: battery?.charging ?? false,
      settings,
      sd: sdStateFrom(settings),
      heartbeats: [],
    });
    this.startHeartbeat(client);
  }

  private startHeartbeat(client: YiClient) {
    this.stopHeartbeat();
    const every = this.opts.heartbeatMs ?? 3000;
    if (every <= 0) return;
    const beat = () => {
      this.heartbeatTimer = setTimeout(async () => {
        if (client !== this.client || this.manualClose) return;
        const t0 = this.now();
        let sample: number | null;
        try {
          const b = await client.getBattery();
          sample = this.now() - t0;
          if (client === this.client) this.set({ battery: b.level, charging: b.charging });
        } catch {
          sample = null;
        }
        if (client !== this.client) return;
        this.set({ heartbeats: [...this.state.heartbeats, sample].slice(-HEARTBEAT_HISTORY) });
        beat();
      }, every);
      // nei test (Node) il battito non deve tenere vivo il processo
      (this.heartbeatTimer as { unref?: () => void }).unref?.();
    };
    beat();
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private onLost(client: YiClient) {
    if (this.manualClose || client !== this.client) return;
    this.client = null;
    this.stopHeartbeat();
    this.set({ status: 'reconnecting' });
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    const max = this.opts.maxReconnects ?? 5;
    if (this.attempts >= max) {
      this.set({ status: 'error', error: t('connect.lost') });
      return;
    }
    this.attempts++;
    const delay = (this.opts.reconnectDelayMs ?? 1500) * this.attempts;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.manualClose) return;
      try {
        await this.openWithDeadline();
      } catch {
        if (!this.manualClose) this.scheduleReconnect();
      }
    }, delay);
  }

  private handleNotification(n: YiNotification) {
    this.notificationListeners.forEach((l) => l(n));
    switch (n.type) {
      case 'start_video_record':
        if (!this.state.recording) this.set({ recording: true, recordStartedAt: this.now() });
        break;
      case 'video_record_complete':
        this.set({ recording: false, recordStartedAt: null, lastFile: String(n.param ?? '') || this.state.lastFile });
        break;
      case 'photo_taken':
        this.set({ lastFile: String(n.param ?? '') || this.state.lastFile });
        break;
      case 'battery':
      case 'battery_status': {
        const level = parseInt(String(n.param), 10);
        if (!Number.isNaN(level)) this.set({ battery: level });
        break;
      }
      case 'adapter':
        this.set({ charging: true });
        break;
      case 'setting_changed':
        // un'impostazione è cambiata (anche dai tasti): ricarica in background
        this.client?.getAllSettings().then((settings) => this.set({ settings, sd: sdStateFrom(settings) })).catch(() => {});
        break;
      case 'sd_card_status': {
        const sd = sdStateFromNotification(n.param);
        if (sd) this.set({ sd });
        // rilegge le impostazioni per sapere anche se la nuova SD va formattata
        this.client?.getAllSettings().then((settings) => {
          const fromSettings = sdStateFrom(settings);
          this.set({ settings, sd: fromSettings === 'unknown' ? this.state.sd : fromSettings });
        }).catch(() => {});
        break;
      }
    }
  }

  private need(): YiClient {
    if (!this.client || this.state.status !== 'connected') throw new Error('Camera non connessa');
    return this.client;
  }

  /** Per i comandi che scrivono o leggono la SD: se sappiamo che manca, non disturbiamo la camera. */
  private needSd(): YiClient {
    const c = this.need();
    if (this.state.sd === 'missing') throw new SdMissingError();
    return c;
  }

  setMode(mode: Mode) {
    if (this.state.recording) return;
    this.set({ mode });
  }

  async shutter() {
    if (this.state.mode === 'photo') await this.needSd().takePhoto();
    else await this.toggleRecord();
  }

  async toggleRecord() {
    const c = this.state.recording ? this.need() : this.needSd();
    if (this.state.recording) {
      await c.stopRecord();
      this.set({ recording: false, recordStartedAt: null });
    } else {
      await c.startRecord();
      this.set({ recording: true, recordStartedAt: this.state.recordStartedAt ?? this.now() });
    }
  }

  /** Avvia lo scatto continuo (timelapse foto): con capture_mode "cont." il 769 parte e non si ferma. */
  async startPhotoCapture() {
    await this.needSd().takePhoto();
  }

  async stopPhotoCapture() {
    await this.need().stopPhoto();
  }

  elapsedSeconds(): number {
    if (!this.state.recordStartedAt) return 0;
    return Math.floor((this.now() - this.state.recordStartedAt) / 1000);
  }

  async refreshSettings() {
    const settings = await this.need().getAllSettings();
    this.set({ settings, sd: sdStateFrom(settings) });
  }

  getOptions(key: string) {
    return this.need().getOptions(key);
  }

  async changeSetting(key: string, value: string) {
    await this.need().setSetting(key, value);
    this.set({ settings: { ...this.state.settings, [key]: value } });
  }

  async loadFiles() {
    this.set({ files: await this.needSd().listFiles() });
  }

  async deleteFiles(names: string[]) {
    const c = this.need();
    for (const n of names) {
      const f = this.state.files.find((x) => x.name === n);
      await c.deleteFile(n, f?.dir);
    }
    this.set({ files: this.state.files.filter((f) => !names.includes(f.name)) });
  }

  startLiveView() {
    return this.need().startLiveView();
  }
}
