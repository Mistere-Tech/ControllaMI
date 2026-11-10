import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CameraProblem, describeError } from '../core/errors';
import { useCameraCtx } from './CameraContext';

interface Shown {
  id: number;
  problem: CameraProblem;
  retry: (() => void) | null;
}

interface ProblemCtx {
  shown: Shown | null;
  /** Mostra un errore di un comando; `retry` rifà il comando se l'utente tocca "Riprova". */
  report: (e: unknown, opts?: { retry?: () => void }) => void;
  /** Mostra un messaggio già pronto (es. conferme o avvisi che non sono errori della camera). */
  notify: (problem: CameraProblem) => void;
  dismiss: () => void;
}

const Ctx = createContext<ProblemCtx | null>(null);

/** Quanto resta visibile un avviso (ms). */
const AUTO_HIDE_MS = 6000;

export function ProblemProvider({ children }: { children: React.ReactNode }) {
  const { controller } = useCameraCtx();
  const [shown, setShown] = useState<Shown | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback(() => setShown(null), []);

  const show = useCallback((problem: CameraProblem, retry: (() => void) | null) => {
    setShown({ id: nextId.current++, problem, retry });
  }, []);

  const report = useCallback(
    (e: unknown, opts: { retry?: () => void } = {}) => {
      const { recording, sd } = controller.state;
      const problem = describeError(e, { recording, sd });
      show(problem, problem.action === 'retry' ? opts.retry ?? null : null);
    },
    [controller, show],
  );

  const notify = useCallback((problem: CameraProblem) => show(problem, null), [show]);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown((s) => (s?.id === shown.id ? null : s)), AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [shown]);

  const value = useMemo(() => ({ shown, report, notify, dismiss }), [shown, report, notify, dismiss]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProblems(): ProblemCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('ProblemProvider mancante');
  return c;
}
