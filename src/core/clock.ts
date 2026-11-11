/**
 * Data e ora della YI (impostazione camera_clock, formato "AAAA-MM-GG hh:mm:ss", ora locale).
 * Senza batteria la camera torna a una data vecchia: l'app la rimette uguale al telefono.
 */

/** Sotto questa differenza (secondi) l'ora della camera si considera giusta e non si riscrive. */
export const CLOCK_TOLERANCE_S = 60;

export function formatCameraClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function parseCameraClock(s: string | undefined | null): Date | null {
  const m = String(s ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d;
}

/** true se l'ora della camera è da rimettere (sbagliata di più della tolleranza o illeggibile). */
export function clockNeedsSync(cameraValue: string | undefined, now: number): boolean {
  const cam = parseCameraClock(cameraValue);
  return !cam || Math.abs(cam.getTime() - now) > CLOCK_TOLERANCE_S * 1000;
}
