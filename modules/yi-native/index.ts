import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export type PlaybackState = 'idle' | 'buffering' | 'ready' | 'firstFrame' | 'ended' | 'error';

export interface RtspViewProps extends ViewProps {
  url: string | null;
  onPlaybackState?: (e: { nativeEvent: { state: PlaybackState; message?: string } }) => void;
}

interface YiNativeModuleType {
  /** Lega tutto il traffico dell'app alla rete Wi-Fi (quella della camera). */
  bindToWifi(): Promise<boolean>;
  /** Android 10+: collegamento guidato alle reti che iniziano per ssidPrefix ("ok" o "unavailable"). */
  connectToCamera(ssidPrefix: string, password: string): Promise<'ok' | 'unavailable'>;
  /** true se il traffico dell'app passa già dal Wi-Fi scelto. */
  isBound(): boolean;
  /** Torna alla rete predefinita di Android. */
  unbind(): void;
  /** true se il telefono è collegato a un Wi-Fi in questo momento. */
  isWifiConnected(): boolean;
}

let native: YiNativeModuleType | null = null;
try {
  native = requireNativeModule<YiNativeModuleType>('YiNative');
} catch {
  native = null; // es. in Expo Go: il modulo non c'è
}

export const YiNative: YiNativeModuleType = {
  bindToWifi: () => (native ? native.bindToWifi() : Promise.resolve(false)),
  connectToCamera: (ssidPrefix, password) => (native ? native.connectToCamera(ssidPrefix, password) : Promise.resolve('unavailable')),
  isBound: () => (native ? native.isBound() : false),
  unbind: () => native?.unbind(),
  isWifiConnected: () => (native ? native.isWifiConnected() : false),
};

export const isNativeAvailable = native !== null;

export const RtspView: ComponentType<RtspViewProps> | null = native
  ? requireNativeViewManager<RtspViewProps>('YiNative')
  : null;
