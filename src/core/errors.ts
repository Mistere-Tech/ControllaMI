import { YiError } from './YiClient';
import { t } from './i18n';

export type SdState = 'ok' | 'missing' | 'needs_format' | 'unknown';

/** Il comando non parte perché manca la scheda SD (lo sappiamo prima di chiedere alla camera). */
export class SdMissingError extends Error {
  constructor() {
    super(t('err.sdMissing.title'));
    this.name = 'SdMissingError';
  }
}

export type ProblemAction = 'retry' | 'insert_sd' | null;

/** Un errore pronto da mostrare all'utente. */
export interface CameraProblem {
  title: string;
  message: string;
  /** Dettaglio tecnico (codice · comando), mostrato in piccolo; null se non serve. */
  code: string | null;
  action: ProblemAction;
  /** info = conferma di un'operazione riuscita (non un errore). */
  severity: 'error' | 'warning' | 'info';
}

export interface ErrorContext {
  recording?: boolean;
  sd?: SdState;
}

/** Stato della SD dalle impostazioni della camera (msg 3). */
export function sdStateFrom(settings: Record<string, string>): SdState {
  const status = settings.sd_card_status;
  const format = settings.sdcard_need_format;
  if (status === undefined && format === undefined) return 'unknown';
  if (status !== undefined && /remove|out|none|no_?card|absent/i.test(status)) return 'missing';
  if (format !== undefined && /need/i.test(format) && !/no.?need/i.test(format)) return 'needs_format';
  return 'ok';
}

/** Stato della SD dal parametro della notifica sd_card_status. */
export function sdStateFromNotification(param: unknown): SdState | null {
  const p = String(param ?? '');
  if (/remove|out/i.test(p)) return 'missing';
  if (/insert|in|ready/i.test(p)) return 'ok';
  return null;
}

const sdMissing = (code: string | null): CameraProblem => ({
  title: t('err.sdMissing.title'),
  message: t('err.sdMissing.message'),
  code,
  action: 'insert_sd',
  severity: 'warning',
});

const sdFormat = (code: string | null): CameraProblem => ({
  title: t('err.sdFormat.title'),
  message: t('err.sdFormat.message'),
  code,
  action: null,
  severity: 'warning',
});

/** Traduce qualsiasi errore di un comando in un messaggio chiaro, nella lingua dell'app. */
export function describeError(e: unknown, ctx: ErrorContext = {}): CameraProblem {
  if (e instanceof SdMissingError) return sdMissing(null);

  if (e instanceof YiError) {
    const code = `${e.rval} · ${e.msgId}`;
    // la camera rifiuta il comando e sappiamo che la SD manca o va formattata: è quasi certamente quello
    if (ctx.sd === 'missing') return sdMissing(code);
    if (ctx.sd === 'needs_format') return sdFormat(code);
    switch (e.rval) {
      case -14:
        return ctx.recording
          ? { title: t('err.busy.title'), message: t('err.busy.recording'), code, action: null, severity: 'warning' }
          : { title: t('err.busy.title'), message: t('err.busy.message'), code, action: 'retry', severity: 'warning' };
      case -9:
        return { title: t('err.badValue.title'), message: t('err.badValue.message'), code, action: null, severity: 'warning' };
      default:
        return { title: t('err.failed.title'), message: t('err.failed.message'), code, action: 'retry', severity: 'error' };
    }
  }

  const msg = e instanceof Error ? e.message : '';
  if (/^Timeout/i.test(msg)) {
    return { title: t('err.timeout.title'), message: t('err.timeout.message'), code: null, action: 'retry', severity: 'error' };
  }
  if (/Connessione chiusa|non connessa/i.test(msg)) {
    return { title: t('err.lost.title'), message: t('err.lost.message'), code: null, action: null, severity: 'warning' };
  }
  return {
    title: t('err.failed.title'),
    message: msg || t('err.generic'),
    code: null,
    action: 'retry',
    severity: 'error',
  };
}
