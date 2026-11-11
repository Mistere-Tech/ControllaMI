import { t } from './i18n';
import type { Status } from './CameraController';
import type { LivePhase } from './liveView';

export type Health = 'stable' | 'unstable' | 'lost';

export function healthLabel(h: Health): string {
  return t(`health.${h}`);
}

/** Oltre questo tempo di risposta (ms) la connessione è considerata lenta. */
export const SLOW_MS = 1500;

/** Quanti battiti recenti guardare. */
export const HEALTH_WINDOW = 3;

export interface HealthInput {
  status: Status;
  /** Tempi di risposta dei battiti in ms, dal più vecchio; null = nessuna risposta. */
  heartbeats: (number | null)[];
  /** Stato della live view, null se non è in uso (es. Galleria o demo). */
  live: LivePhase | null;
}

export function computeHealth({ status, heartbeats, live }: HealthInput): Health {
  if (status !== 'connected') return 'lost';
  const recent = heartbeats.slice(-HEALTH_WINDOW);
  if (recent.some((h) => h === null || h > SLOW_MS)) return 'unstable';
  if (live === 'retrying' || live === 'error') return 'unstable';
  return 'stable';
}
