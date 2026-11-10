import React, { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { CameraController, CameraState } from '../core/CameraController';
import { LiveViewState, LiveViewSupervisor } from '../core/liveView';
import { computeHealth, Health } from '../core/health';
import { ModeManager, ModeState } from '../core/modes';
import { filePrefsStorage } from '../net/prefsStorage';
import { FakeCamera } from '../core/fakeCamera';
import { createInMemoryTransport } from '../core/inMemoryTransport';
import { connectTcp } from '../net/tcpTransport';
import { YiNative } from '../../modules/yi-native';
import { CAMERA_HOST } from '../core/gallery';

interface Ctx {
  controller: CameraController;
  live: LiveViewSupervisor;
  modes: ModeManager;
  demo: boolean;
  connectReal: (host?: string) => Promise<void>;
  connectDemo: () => Promise<void>;
  disconnect: () => void;
}

const CameraCtx = createContext<Ctx | null>(null);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const modeRef = useRef<{ demo: boolean; host: string }>({ demo: false, host: CAMERA_HOST });
  const demoCam = useRef(new FakeCamera({ token: 12 }));

  const controller = useMemo(
    () =>
      new CameraController({
        createTransport: async () => {
          if (modeRef.current.demo) return createInMemoryTransport(demoCam.current, { delayMs: 40 });
          await YiNative.bindToWifi().catch(() => false);
          return connectTcp(modeRef.current.host, 7878);
        },
        timeoutMs: 5000,
        // Wi-Fi (fino a 5 s) + TCP + sessione: oltre, il telefono non è sul Wi-Fi della camera
        connectTimeoutMs: 12_000,
        reconnectDelayMs: 1500,
        maxReconnects: 5,
        heartbeatMs: 3000,
      }),
    [],
  );

  const live = useMemo(() => new LiveViewSupervisor(controller), [controller]);
  const modes = useMemo(() => new ModeManager(controller, filePrefsStorage()), [controller]);

  // preferenze salvate; a ogni (ri)connessione in Semplice la camera torna ai valori migliori
  useEffect(() => {
    modes.load();
    let last = controller.state.status;
    return controller.subscribe((s) => {
      if (s.status === 'connected' && last !== 'connected' && modes.state.uiMode === 'simple') {
        modes.applySimple().catch(() => {});
      }
      last = s.status;
    });
  }, [controller, modes]);

  const value = useMemo<Ctx>(
    () => ({
      controller,
      live,
      modes,
      get demo() {
        return modeRef.current.demo;
      },
      connectReal: async (host = CAMERA_HOST) => {
        modeRef.current = { demo: false, host };
        await controller.connect();
      },
      connectDemo: async () => {
        modeRef.current = { demo: true, host: CAMERA_HOST };
        await controller.connect();
      },
      disconnect: () => {
        controller.disconnect();
        if (!modeRef.current.demo) YiNative.unbind();
      },
    }),
    [controller, live, modes],
  );

  return <CameraCtx.Provider value={value}>{children}</CameraCtx.Provider>;
}

export function useCameraCtx(): Ctx {
  const c = useContext(CameraCtx);
  if (!c) throw new Error('CameraProvider mancante');
  return c;
}

export function useCameraState(): CameraState {
  const { controller } = useCameraCtx();
  return useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
  );
}

export function useLiveView(): LiveViewState {
  const { live } = useCameraCtx();
  return useSyncExternalStore(
    (cb) => live.subscribe(cb),
    () => live.state,
  );
}

/** Salute della connessione: battiti della camera + stato della live view (se in uso). */
export function useHealth(): Health {
  const st = useCameraState();
  const lv = useLiveView();
  return computeHealth({ status: st.status, heartbeats: st.heartbeats, live: lv.phase === 'off' ? null : lv.phase });
}

export function useModes(): ModeState {
  const { modes } = useCameraCtx();
  return useSyncExternalStore(
    (cb) => modes.subscribe(cb),
    () => modes.state,
  );
}
