import type { CameraController } from './CameraController';
import { describeSetting } from './settings';
import { findExposureKey, pickClosestInterval, pickPhotoSize, pickQuality, pickVideoResolution } from './presets';

export type UiMode = 'simple' | 'pro';
export type SimpleMode = 'video' | 'photo' | 'timelapse_video' | 'timelapse_photo';
export type TimelapseKind = 'timelapse_video' | 'timelapse_photo';

export interface ModeState {
  uiMode: UiMode;
  simpleMode: SimpleMode;
  /** Intervallo dei timelapse in secondi. */
  intervals: Record<TimelapseKind, number>;
  /** Esposizione scelta in Semplice (null = quella della camera). */
  exposure: string | null;
  /** Impostazioni Pro salvate al passaggio in Semplice, rimesse al ritorno in Pro. */
  proSnapshot: Record<string, string> | null;
  /** Timelapse foto / scatto continuo in corso. */
  capturing: boolean;
}

/** Dove salvare le preferenze (file sul telefono, memoria nei test). */
export interface PrefsStorage {
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
}

export function memoryStorage(): PrefsStorage {
  let data: string | null = null;
  return {
    load: async () => data,
    save: async (d) => {
      data = d;
    },
  };
}

export const SIMPLE_LABEL: Record<SimpleMode, string> = {
  video: 'Video',
  photo: 'Foto',
  timelapse_video: 'Timelapse video',
  timelapse_photo: 'Timelapse foto',
};

/** Intervalli proposti in Semplice (secondi). */
export const INTERVAL_CHOICES = [0.5, 1, 2, 5, 10, 30, 60];

const DEFAULTS: ModeState = {
  uiMode: 'simple',
  simpleMode: 'video',
  intervals: { timelapse_video: 1, timelapse_photo: 2 },
  exposure: null,
  proSnapshot: null,
  capturing: false,
};

/** Chiavi da rimettere per prime: cambiano le opzioni ammesse dalle altre. */
const RESTORE_FIRST = ['video_standard', 'rec_mode', 'record_mode', 'capture_mode'];
/** Chiavi da non salvare né ripristinare. */
const NOT_RESTORED = new Set(['camera_clock', 'buzzer_ring']);

/**
 * Modalità Semplice e Pro sopra al controller.
 * Semplice: pochi pulsanti, la camera viene messa sempre ai valori migliori.
 * Pro: tutte le impostazioni a mano; al ritorno in Pro si ritrovano i propri valori.
 */
export class ModeManager {
  state: ModeState = { ...DEFAULTS, intervals: { ...DEFAULTS.intervals } };

  /** Valori messi dall'ultima applicazione della modalità Semplice. */
  private applied: Record<string, string> = {};
  private listeners = new Set<(s: ModeState) => void>();

  constructor(private ctrl: CameraController, private storage: PrefsStorage) {}

  subscribe(l: (s: ModeState) => void): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  async load() {
    try {
      const raw = await this.storage.load();
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<ModeState>;
      this.set({
        uiMode: saved.uiMode === 'pro' ? 'pro' : 'simple',
        simpleMode: saved.simpleMode && saved.simpleMode in SIMPLE_LABEL ? saved.simpleMode : 'video',
        intervals: { ...DEFAULTS.intervals, ...(saved.intervals ?? {}) },
        exposure: saved.exposure ?? null,
        proSnapshot: saved.proSnapshot ?? null,
      });
    } catch {
      /* preferenze illeggibili: si riparte dai valori predefiniti */
    }
  }

  async setUiMode(mode: UiMode) {
    if (mode === this.state.uiMode) return;
    if (mode === 'simple') {
      this.set({ uiMode: 'simple', proSnapshot: this.snapshot() });
      await this.persist();
      await this.applySimple();
    } else {
      this.set({ uiMode: 'pro' });
      await this.persist();
      if (this.state.proSnapshot) await this.restore(this.state.proSnapshot);
    }
  }

  async selectSimple(mode: SimpleMode) {
    this.set({ simpleMode: mode });
    await this.persist();
    if (this.state.uiMode === 'simple') await this.applySimple();
  }

  async setInterval(kind: TimelapseKind, seconds: number) {
    this.set({ intervals: { ...this.state.intervals, [kind]: seconds } });
    await this.persist();
    if (this.state.uiMode === 'simple' && this.state.simpleMode === kind) await this.applySimple();
  }

  /** Il controllo di esposizione disponibile su questa camera (null se non c'è). */
  async exposureControl(): Promise<{ key: string; options: string[]; value: string | undefined } | null> {
    const key = findExposureKey(Object.keys(this.ctrl.state.settings));
    if (!key) return null;
    const o = await this.ctrl.getOptions(key).catch(() => null);
    if (!o || !o.settable || o.options.length === 0) return null;
    return { key, options: o.options, value: this.ctrl.state.settings[key] };
  }

  async setExposure(value: string) {
    const ctl = await this.exposureControl();
    if (!ctl) return;
    await this.ctrl.changeSetting(ctl.key, value);
    this.set({ exposure: value });
    await this.persist();
  }

  /** Il pulsante grande: in Semplice prima controlla che la camera sia ai valori giusti. */
  async shutter() {
    const st = this.ctrl.state;
    const starting = !st.recording && !this.state.capturing;
    if (starting && this.state.uiMode === 'simple' && this.drifted()) await this.applySimple();

    if (this.isContinuousPhoto()) {
      if (this.state.capturing) {
        await this.ctrl.stopPhotoCapture();
        this.set({ capturing: false });
      } else {
        await this.ctrl.startPhotoCapture();
        this.set({ capturing: true });
      }
      return;
    }
    await this.ctrl.shutter();
  }

  /** Applica i valori della modalità Semplice scelta. */
  async applySimple() {
    const mode = this.state.simpleMode;
    this.applied = {};
    // valori freschi: qualcuno può averli cambiati dai tasti della camera
    await this.ctrl.refreshSettings().catch(() => {});
    if (mode === 'video' || mode === 'timelapse_video') {
      this.ctrl.setMode('video');
      const timelapse = mode === 'timelapse_video';
      await this.setBest('video_standard', (o) => (o.includes('NTSC') ? 'NTSC' : null));
      for (const key of ['rec_mode', 'record_mode']) {
        await this.setBest(key, (o) =>
          timelapse
            ? o.find((x) => /timelapse/i.test(x)) ?? null
            : o.find((x) => x === 'record') ?? o.find((x) => !/timelapse|loop|photo|slow/i.test(x)) ?? null,
        );
      }
      await this.setBest('timelapse_video', (o) =>
        timelapse
          ? pickClosestInterval(o.filter((x) => !/off/i.test(x)), this.state.intervals.timelapse_video)
          : o.find((x) => /off/i.test(x)) ?? null,
      );
      await this.setBest('loop_rec', (o) => o.find((x) => /off/i.test(x)) ?? null);
      // dopo lo standard: le risoluzioni ammesse cambiano tra PAL e NTSC
      await this.setBest('video_resolution', pickVideoResolution);
      await this.setBest('video_quality', pickQuality);
    } else {
      this.ctrl.setMode('photo');
      const timelapse = mode === 'timelapse_photo';
      await this.setBest('capture_mode', (o) =>
        timelapse ? o.find((x) => /cont/i.test(x)) ?? null : o.find((x) => x === 'precise quality') ?? o[0] ?? null,
      );
      if (timelapse) {
        await this.setBest('precise_cont_time', (o) => pickClosestInterval(o, this.state.intervals.timelapse_photo));
      }
      await this.setBest('photo_size', pickPhotoSize);
      await this.setBest('photo_quality', pickQuality);
    }
    if (this.state.exposure) {
      const key = findExposureKey(Object.keys(this.ctrl.state.settings));
      if (key) await this.setBest(key, (o) => (o.includes(this.state.exposure!) ? this.state.exposure : null));
    }
  }

  // ---- interno ----

  private set(patch: Partial<ModeState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private async persist() {
    const { capturing, ...saved } = this.state;
    await this.storage.save(JSON.stringify(saved)).catch(() => {});
  }

  /** Imposta `key` al valore scelto tra le opzioni della camera; salta se la camera non ha quella chiave. */
  private async setBest(key: string, choose: (options: string[]) => string | null) {
    const o = await this.ctrl.getOptions(key).catch(() => null);
    if (!o || !o.settable || o.options.length === 0) return;
    const value = choose(o.options);
    if (!value) return;
    if (this.ctrl.state.settings[key] !== value) await this.ctrl.changeSetting(key, value);
    this.applied[key] = value;
  }

  private drifted(): boolean {
    const s = this.ctrl.state.settings;
    const keys = Object.keys(this.applied);
    return keys.length === 0 || keys.some((k) => s[k] !== this.applied[k]);
  }

  private isContinuousPhoto(): boolean {
    return this.ctrl.state.mode === 'photo' && /cont/i.test(this.ctrl.state.settings.capture_mode ?? '');
  }

  private snapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.ctrl.state.settings)) {
      if (NOT_RESTORED.has(k) || describeSetting(k).readOnly || k.startsWith('sd')) continue;
      out[k] = v;
    }
    return out;
  }

  private async restore(snap: Record<string, string>) {
    const keys = Object.keys(snap).sort((a, b) => {
      const ia = RESTORE_FIRST.indexOf(a);
      const ib = RESTORE_FIRST.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    for (const k of keys) {
      if (this.ctrl.state.settings[k] === snap[k]) continue;
      await this.ctrl.changeSetting(k, snap[k]).catch(() => {
        /* valore non più ammesso: si tiene quello attuale */
      });
    }
  }
}
