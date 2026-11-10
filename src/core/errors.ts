import { YiError } from './YiClient';

export type SdState = 'ok' | 'missing' | 'needs_format' | 'unknown';

/** Il comando non parte perché manca la scheda SD (lo sappiamo prima di chiedere alla camera). */
export class SdMissingError extends Error {
  constructor() {
    super('Scheda SD assente');
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

const SD_MISSING: Omit<CameraProblem, 'code'> = {
  title: 'Scheda SD assente',
  message: 'Inserisci una scheda SD nella camera per registrare, scattare e vedere la galleria.',
  action: 'insert_sd',
  severity: 'warning',
};

const SD_FORMAT: Omit<CameraProblem, 'code'> = {
  title: 'Scheda SD da formattare',
  message: 'La camera chiede di formattare la scheda SD: fallo dal menu della camera, poi riprova.',
  action: null,
  severity: 'warning',
};

/** Traduce qualsiasi errore di un comando in un messaggio chiaro, in italiano. */
export function describeError(e: unknown, ctx: ErrorContext = {}): CameraProblem {
  if (e instanceof SdMissingError) return { ...SD_MISSING, code: null };

  if (e instanceof YiError) {
    const code = `${e.rval} · ${e.msgId}`;
    // la camera rifiuta il comando e sappiamo che la SD manca o va formattata: è quasi certamente quello
    if (ctx.sd === 'missing') return { ...SD_MISSING, code };
    if (ctx.sd === 'needs_format') return { ...SD_FORMAT, code };
    switch (e.rval) {
      case -14:
        return ctx.recording
          ? { title: 'Camera occupata', message: 'Ferma la registrazione e riprova.', code, action: null, severity: 'warning' }
          : { title: 'Camera occupata', message: 'La camera sta finendo un’altra operazione. Riprova tra un attimo.', code, action: 'retry', severity: 'warning' };
      case -9:
        return { title: 'Valore non accettato', message: 'La camera non accetta questo valore in questa modalità.', code, action: null, severity: 'warning' };
      default:
        return { title: 'Comando non riuscito', message: 'La camera ha rifiutato il comando. Riprova; se succede ancora, riavvia la camera.', code, action: 'retry', severity: 'error' };
    }
  }

  const msg = e instanceof Error ? e.message : '';
  if (/^Timeout/i.test(msg)) {
    return { title: 'La camera non risponde', message: 'Controlla di essere vicino alla camera e riprova.', code: null, action: 'retry', severity: 'error' };
  }
  if (/Connessione chiusa|non connessa/i.test(msg)) {
    return { title: 'Connessione persa', message: 'Sto provando a ricollegarmi alla camera…', code: null, action: null, severity: 'warning' };
  }
  return {
    title: 'Comando non riuscito',
    message: msg || 'Qualcosa è andato storto. Riprova.',
    code: null,
    action: 'retry',
    severity: 'error',
  };
}
