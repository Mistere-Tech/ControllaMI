import { Transport } from './transport';
import { YiClient, YiNotification } from './YiClient';
import { CamFile } from './gallery';

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
}

export interface ControllerOptions {
  createTransport: () => Promise<Transport>;
  timeoutMs?: number;
  reconnectDelayMs?: number;
  maxReconnects?: number;
  now?: () => number;
}

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
};

/** Stato dell'app intorno al client: connessione, riconnessione, REC, impostazioni, file. */
export class CameraController {
  state: CameraState = { ...initial };
  client: YiClient | null = null;

  private listeners = new Set<(s: CameraState) => void>();
  private manualClose = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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

  private set(patch: Partial<CameraState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  async connect(): Promise<void> {
    this.manualClose = false;
    this.attempts = 0;
    this.set({ status: 'connecting', error: null });
    try {
      await this.open();
    } catch (e) {
      this.set({ status: 'error', error: (e as Error).message });
      throw e;
    }
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const c = this.client;
    this.client = null;
    c?.close();
    this.set({ status: 'disconnected', recording: false, recordStartedAt: null });
  }

  private async open() {
    const transport = await this.opts.createTransport();
    const client = new YiClient(transport, { timeoutMs: this.opts.timeoutMs });
    client.onNotification((n) => this.onNotification(n));
    client.onDisconnect(() => this.onLost(client));
    try {
      await client.connect();
    } catch (e) {
      transport.close();
      throw e;
    }
    this.client = client;
    this.attempts = 0;
    const [battery, settings] = await Promise.all([
      client.getBattery().catch(() => null),
      client.getAllSettings().catch(() => ({} as Record<string, string>)),
    ]);
    this.set({
      status: 'connected',
      error: null,
      battery: battery?.level ?? null,
      charging: battery?.charging ?? false,
      settings,
    });
  }

  private onLost(client: YiClient) {
    if (this.manualClose || client !== this.client) return;
    this.client = null;
    this.set({ status: 'reconnecting' });
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    const max = this.opts.maxReconnects ?? 5;
    if (this.attempts >= max) {
      this.set({ status: 'error', error: 'Connessione persa con la camera' });
      return;
    }
    this.attempts++;
    const delay = (this.opts.reconnectDelayMs ?? 1500) * this.attempts;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.manualClose) return;
      try {
        await this.open();
      } catch {
        if (!this.manualClose) this.scheduleReconnect();
      }
    }, delay);
  }

  private onNotification(n: YiNotification) {
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
        this.client?.getAllSettings().then((settings) => this.set({ settings })).catch(() => {});
        break;
    }
  }

  private need(): YiClient {
    if (!this.client || this.state.status !== 'connected') throw new Error('Camera non connessa');
    return this.client;
  }

  setMode(mode: Mode) {
    if (this.state.recording) return;
    this.set({ mode });
  }

  async shutter() {
    if (this.state.mode === 'photo') await this.need().takePhoto();
    else await this.toggleRecord();
  }

  async toggleRecord() {
    const c = this.need();
    if (this.state.recording) {
      await c.stopRecord();
      this.set({ recording: false, recordStartedAt: null });
    } else {
      await c.startRecord();
      this.set({ recording: true, recordStartedAt: this.state.recordStartedAt ?? this.now() });
    }
  }

  elapsedSeconds(): number {
    if (!this.state.recordStartedAt) return 0;
    return Math.floor((this.now() - this.state.recordStartedAt) / 1000);
  }

  async refreshSettings() {
    this.set({ settings: await this.need().getAllSettings() });
  }

  getOptions(key: string) {
    return this.need().getOptions(key);
  }

  async changeSetting(key: string, value: string) {
    await this.need().setSetting(key, value);
    this.set({ settings: { ...this.state.settings, [key]: value } });
  }

  async loadFiles() {
    this.set({ files: await this.need().listFiles() });
  }

  async deleteFiles(names: string[]) {
    const c = this.need();
    for (const n of names) await c.deleteFile(n);
    this.set({ files: this.state.files.filter((f) => !names.includes(f.name)) });
  }

  startLiveView() {
    return this.need().startLiveView();
  }
}
