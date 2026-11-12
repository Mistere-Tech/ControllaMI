/**
 * Collegamento del telefono al Wi-Fi della camera.
 *
 * La rete della YI non ha internet: molti Android (MagicOS "WLAN+", Samsung "Passa ai dati
 * mobili", MIUI "Assistente Wi-Fi") spostano allora il traffico sui dati mobili e il video non
 * arriva. Da Android 10 l'app chiede direttamente ad Android un collegamento alla rete "YDXJ_…"
 * (finestra di sistema): quella rete resta all'app, senza avvisi, e i dati mobili restano alle
 * altre app. Prima di Android 10, o se l'utente annulla, si usa il Wi-Fi già collegato.
 */

import type { MsgKey } from './i18n';

export const CAMERA_SSID_PREFIX = 'YDXJ_';
export const DEFAULT_CAMERA_PASSWORD = '1234567890';
/** Primo Android con il collegamento guidato (WifiNetworkSpecifier): Android 10 = API 29. */
export const GUIDED_MIN_SDK = 29;

export type NetworkMethod = 'guided' | 'bind';
export type GuidedOutcome = 'ok' | 'cancelled' | 'unavailable';

/** Quello che serve dal modulo nativo (finto nei test). */
export interface NetworkDeps {
  /** Versione di Android (API level). */
  sdk: number;
  /** true se il traffico dell'app passa già dal Wi-Fi della camera. */
  isBound(): boolean;
  /** Lega l'app al Wi-Fi a cui il telefono è collegato. */
  bindToWifi(): Promise<boolean>;
  /** Collegamento guidato (Android 10+): finestra di sistema con le reti che iniziano per ssidPrefix. */
  connectToCamera(opts: { ssidPrefix: string; password: string }): Promise<GuidedOutcome>;
}

export interface NetworkResult {
  ok: boolean;
  method: NetworkMethod | 'already' | 'none';
  reason?: 'unavailable';
}

export function chooseNetworkMethod(sdk: number): NetworkMethod {
  return sdk >= GUIDED_MIN_SDK ? 'guided' : 'bind';
}

/** Prepara la rete prima di collegarsi alla camera. Non lancia mai: un passo che fallisce passa al successivo. */
export async function prepareNetwork(deps: NetworkDeps, opts: { password?: string } = {}): Promise<NetworkResult> {
  try {
    if (deps.isBound()) return { ok: true, method: 'already' };
  } catch {
    /* si prova comunque a collegarsi */
  }

  if (chooseNetworkMethod(deps.sdk) === 'guided') {
    try {
      const outcome = await deps.connectToCamera({ ssidPrefix: CAMERA_SSID_PREFIX, password: opts.password || DEFAULT_CAMERA_PASSWORD });
      if (outcome === 'ok') return { ok: true, method: 'guided' };
    } catch {
      /* API non disponibile su questo telefono: si passa al Wi-Fi già collegato */
    }
  }

  try {
    if (await deps.bindToWifi()) return { ok: true, method: 'bind' };
  } catch {
    /* niente da fare */
  }
  return { ok: false, method: 'none', reason: 'unavailable' };
}

/** Consiglio da mostrare quando il video non passa, secondo la marca del telefono. */
export function networkTip(manufacturer: string | undefined): MsgKey {
  const m = String(manufacturer ?? '').toLowerCase();
  if (m.includes('honor') || m.includes('huawei')) return 'tip.wlanPlus';
  if (m.includes('samsung')) return 'tip.samsung';
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) return 'tip.xiaomi';
  return 'tip.generic';
}
