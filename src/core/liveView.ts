import type { CameraController, CameraState } from './CameraController';
import type { YiNotification } from './YiClient';

/**
 * Stati del player che arrivano dal modulo nativo.
 * "ready" = stream agganciato; "firstFrame" = prima immagine davvero sullo schermo.
 */
export type PlayerState = 'idle' | 'buffering' | 'ready' | 'firstFrame' | 'ended' | 'error';

/** no_network = Android non fa passare il video dal Wi-Fi della camera (es. lo sposta sui dati mobili). */
export type LivePhase = 'off' | 'starting' | 'playing' | 'retrying' | 'no_network' | 'error';

export interface LiveViewState {
  /** URL da dare al player; null = nessun player. */
  url: string | null;
  /** Cambia a ogni (ri)avvio: la UI la usa come key per creare un player nuovo. */
  generation: number;
  phase: LivePhase;
  /** Tentativi falliti di fila. */
  attempts: number;
}

export interface LiveViewOptions {
  retryBaseMs?: number;
  retryMaxMs?: number;
  /** Buffering più lungo di così = immagine bloccata → riavvio. */
  stallMs?: number;
  /** Attesa prima di riavviare dopo un evento della camera (vf_start, impostazione cambiata). */
  restartDelayMs?: number;
  /** Stream agganciato ma nessuna immagine entro questo tempo → nuovo tentativo. */
  firstFrameMs?: number;
  /** Controlla (e se serve prepara) il Wi-Fi della camera prima di avviare il video; false = non c'è. */
  ensureNetwork?: () => Promise<boolean>;
}

/**
 * Decide quando avviare, fermare e riavviare la live view.
 * Tutta la logica sta qui (testata); il player nativo si limita a riprodurre l'URL.
 */
export class LiveViewSupervisor {
  state: LiveViewState = { url: null, generation: 0, phase: 'off', attempts: 0 };

  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: LiveViewState) => void>();
  private unsubs: (() => void)[] = [];
  private lastStatus: CameraState['status'];
  private startToken = 0;
  private opts: Required<Omit<LiveViewOptions, 'ensureNetwork'>>;
  private ensureNetwork: (() => Promise<boolean>) | null;

  constructor(private ctrl: CameraController, opts: LiveViewOptions = {}) {
    this.opts = {
      retryBaseMs: opts.retryBaseMs ?? 1000,
      retryMaxMs: opts.retryMaxMs ?? 8000,
      stallMs: opts.stallMs ?? 4000,
      restartDelayMs: opts.restartDelayMs ?? 500,
      firstFrameMs: opts.firstFrameMs ?? 8000,
    };
    this.ensureNetwork = opts.ensureNetwork ?? null;
    this.lastStatus = ctrl.state.status;
    this.unsubs.push(ctrl.subscribe((s) => this.onCameraState(s)));
    this.unsubs.push(ctrl.onNotification((n) => this.onNotification(n)));
  }

  subscribe(l: (s: LiveViewState) => void): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  /** La schermata con la live view è visibile (e il player nativo esiste). */
  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    if (active) this.start();
    else this.stop('off');
  }

  /** Eventi dal player nativo. */
  onPlayerState(p: PlayerState) {
    if (!this.active || !this.state.url) return;
    this.clearStall();
    switch (p) {
      case 'ready':
        // stream agganciato: l'immagine può arrivare anche qualche secondo dopo (serve un fotogramma
        // completo). Fino ad allora resta "Avvio live view…", non uno schermo nero.
        if (this.state.phase !== 'playing' && !this.frameTimer) {
          this.frameTimer = setTimeout(() => {
            this.frameTimer = null;
            this.retryLater();
          }, this.opts.firstFrameMs);
        }
        break;
      case 'firstFrame':
        this.clearFrame();
        this.set({ phase: 'playing', attempts: 0 });
        break;
      case 'buffering':
        this.stallTimer = setTimeout(() => this.restart(0), this.opts.stallMs);
        break;
      case 'error':
      case 'ended':
        this.retryLater();
        break;
      case 'idle':
        if (this.state.phase === 'playing') this.retryLater();
        break;
    }
  }

  dispose() {
    this.active = false;
    this.clearTimers();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.listeners.clear();
  }

  // ---- interno ----

  private set(patch: Partial<LiveViewState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private connected() {
    return this.ctrl.state.status === 'connected';
  }

  private start() {
    this.clearTimers();
    if (!this.active) return;
    if (!this.connected()) {
      this.set({ url: null, phase: 'retrying' });
      return; // ripartirà quando la camera torna connessa
    }
    const token = ++this.startToken;
    const phase = this.state.phase === 'no_network' ? 'no_network' : this.state.attempts > 0 ? 'retrying' : 'starting';
    this.set({ url: null, phase });
    const stale = () => token !== this.startToken || !this.active;
    (async () => {
      if (this.ensureNetwork) {
        let ok = false;
        try {
          ok = await this.ensureNetwork();
        } catch {
          ok = false;
        }
        if (stale()) return;
        if (!ok) {
          this.noNetwork();
          return;
        }
      }
      const url = await this.ctrl.startLiveView();
      if (stale()) return;
      this.set({ url, generation: this.state.generation + 1 });
    })().catch(() => {
      if (stale()) return;
      this.retryLater();
    });
  }

  /** Il Wi-Fi della camera non c'è per il video: lo dice e riprova con attesa crescente. */
  private noNetwork() {
    const attempts = this.state.attempts + 1;
    const delay = Math.min(this.opts.retryMaxMs, this.opts.retryBaseMs * 2 ** (attempts - 1));
    this.clearTimers();
    this.set({ url: null, phase: 'no_network', attempts });
    this.timer = setTimeout(() => this.start(), delay);
  }

  private restart(delayMs: number) {
    if (!this.active) return;
    this.clearTimers();
    this.startToken++; // annulla un avvio in corso
    this.set({ url: null, phase: 'retrying' });
    this.timer = setTimeout(() => this.start(), delayMs);
  }

  private retryLater() {
    const attempts = this.state.attempts + 1;
    const delay = Math.min(this.opts.retryMaxMs, this.opts.retryBaseMs * 2 ** (attempts - 1));
    this.set({ attempts });
    this.restart(delay);
  }

  private stop(phase: LivePhase) {
    this.clearTimers();
    this.startToken++;
    this.set({ url: null, phase, attempts: 0 });
  }

  private onCameraState(s: CameraState) {
    const was = this.lastStatus;
    this.lastStatus = s.status;
    if (!this.active || was === s.status) return;
    if (s.status === 'connected') this.start();
    else if (was === 'connected') {
      this.clearTimers();
      this.startToken++;
      this.set({ url: null, phase: 'retrying' });
    }
  }

  private onNotification(n: YiNotification) {
    if (!this.active) return;
    switch (n.type) {
      case 'vf_stop':
        this.clearTimers();
        this.startToken++;
        this.set({ url: null, phase: 'retrying' });
        break;
      case 'vf_start':
      case 'setting_changed':
        // la camera ha rimesso in piedi lo stream (o lo ha resettato cambiando un'impostazione)
        this.restart(this.opts.restartDelayMs);
        break;
    }
  }

  private clearStall() {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = null;
  }

  private clearFrame() {
    if (this.frameTimer) clearTimeout(this.frameTimer);
    this.frameTimer = null;
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.clearStall();
    this.clearFrame();
  }
}
