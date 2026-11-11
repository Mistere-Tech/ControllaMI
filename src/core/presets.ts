import { hasKey, t } from './i18n';
/**
 * Scelta dei valori "migliori" tra le opzioni che la camera dichiara (msg 9).
 * Si lavora sulle opzioni reali e non su valori fissi, così funziona anche
 * con firmware che scrivono le opzioni in modo leggermente diverso.
 */

/** fps da un'opzione di risoluzione tipo "1920x1080 60P 16:9". */
function fps(opt: string): number {
  const m = opt.match(/(\d+)\s*P\b/i);
  return m ? parseInt(m[1], 10) : 0;
}

function is1080(opt: string): boolean {
  return /\b1920x1080\b/.test(opt);
}

/** 1080p a 60 fps; se non c'è, il 1080p con più fps; altrimenti la prima opzione. */
export function pickVideoResolution(options: string[]): string | null {
  const full = options.filter(is1080);
  const sixty = full.find((o) => fps(o) === 60);
  if (sixty) return sixty;
  if (full.length) return [...full].sort((a, b) => fps(b) - fps(a))[0];
  return options[0] ?? null;
}

/** S.Fine (bitrate massimo), poi Fine, poi la prima opzione. */
export function pickQuality(options: string[]): string | null {
  return (
    options.find((o) => /^s\.?\s*fine$/i.test(o.trim())) ??
    options.find((o) => /^fine$/i.test(o.trim())) ??
    options[0] ??
    null
  );
}

/** La risoluzione foto con più megapixel ("16M (4608x3456 4:3)"). */
export function pickPhotoSize(options: string[]): string | null {
  const mp = (o: string) => {
    const m = o.match(/(\d+(?:\.\d+)?)\s*M/i);
    return m ? parseFloat(m[1]) : 0;
  };
  return [...options].sort((a, b) => mp(b) - mp(a))[0] ?? null;
}

/** Secondi da un'opzione di intervallo ("2.0 sec", "0.5", "1 min"); null se non è un intervallo. */
export function intervalSeconds(opt: string): number | null {
  const m = opt.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return /min/i.test(opt) ? n * 60 : n;
}

/** L'intervallo più vicino a `seconds` (a parità, quello più lungo). */
export function pickClosestInterval(options: string[], seconds: number): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const o of options) {
    const s = intervalSeconds(o);
    if (s === null) continue;
    const d = Math.abs(s - seconds);
    if (d < bestDiff || (d === bestDiff && best !== null && s > (intervalSeconds(best) ?? 0))) {
      best = o;
      bestDiff = d;
    }
  }
  return best;
}

/** Chiavi che sulle varie versioni del firmware regolano la compensazione dell'esposizione. */
export const EV_KEYS = ['exposure_value', 'ev', 'ev_compensation', 'exposure'];

/** La chiave di esposizione disponibile: prima la compensazione EV, poi la misurazione. */
export function findExposureKey(keys: string[]): string | null {
  return EV_KEYS.find((k) => keys.includes(k)) ?? (keys.includes('meter_mode') ? 'meter_mode' : null);
}

/** Etichette leggibili per la misurazione dell'esposizione. */
/** Nome della modalità di misurazione nella lingua dell'app (valori sconosciuti: com'è). */
export function meterLabel(mode: string): string {
  const key = `meter.${mode}`;
  return hasKey(key) ? t(key) : mode;
}
