import React, { createContext, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import { CameraController, CameraState } from '../core/CameraController';
import { FakeCamera } from '../core/fakeCamera';
import { createInMemoryTransport } from '../core/inMemoryTransport';
import { connectTcp } from '../net/tcpTransport';
import { YiNative } from '../../modules/yi-native';
import { CAMERA_HOST } from '../core/gallery';

interface Ctx {
  controller: CameraController;
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
        reconnectDelayMs: 1500,
        maxReconnects: 5,
      }),
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      controller,
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
    [controller],
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
