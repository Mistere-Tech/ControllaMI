import { Platform } from 'react-native';
import { YiNative } from '../../modules/yi-native';
import type { NetworkDeps } from '../core/network';
import { filePrefsStorage } from './prefsStorage';

/** Versione di Android (API level); 0 su altre piattaforme. */
export function androidSdk(): number {
  return Platform.OS === 'android' ? Number(Platform.Version) || 0 : 0;
}

/** Marca del telefono (es. "HONOR"), per il consiglio giusto quando il video non passa. */
export function phoneManufacturer(): string {
  const c = Platform.constants as { Manufacturer?: string; Brand?: string };
  return c.Manufacturer ?? c.Brand ?? '';
}

/** Il modulo nativo visto dalla logica di rete (src/core/network.ts). */
export function nativeNetworkDeps(): NetworkDeps {
  return {
    sdk: androidSdk(),
    isBound: () => YiNative.isBound(),
    bindToWifi: () => YiNative.bindToWifi(),
    connectToCamera: ({ ssidPrefix, password }) => YiNative.connectToCamera(ssidPrefix, password),
  };
}

/** Prima di avviare il video: il traffico deve passare dal Wi-Fi della camera. */
export async function cameraNetworkReady(): Promise<boolean> {
  if (YiNative.isBound()) return true;
  if (await YiNative.bindToWifi().catch(() => false)) return true;
  // senza legame esplicito va bene lo stesso se la rete predefinita è il Wi-Fi (telefono senza dati mobili)
  return YiNative.isWifiConnected();
}

/** Password del Wi-Fi della camera scelta dall'utente (vuota = quella predefinita). */
const cameraPrefs = filePrefsStorage('camera.json');

export async function loadCameraPassword(): Promise<string> {
  try {
    const raw = await cameraPrefs.load();
    return raw ? String(JSON.parse(raw).password ?? '') : '';
  } catch {
    return '';
  }
}

export async function saveCameraPassword(password: string): Promise<void> {
  await cameraPrefs.save(JSON.stringify({ password })).catch(() => {});
}
