/**
 * Aggiornamenti dell'app dalle Release di GitHub.
 * Regola (scelta per sicurezza): se esiste una versione più nuova l'app si blocca
 * finché non viene aggiornata, anche offline se lo sa già. Se non è mai riuscita a
 * controllare (nessuna rete), funziona normalmente.
 */

export const REPO = 'Mistere-Tech/ControllaMI';
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface Version {
  major: number;
  minor: number;
  patch: number;
  /** Build di sviluppo (es. 0.2.0-dev.17, dalle build su main). */
  dev: boolean;
}

export interface LatestRelease {
  version: string;
  apkUrl: string;
  apkSize: number;
  notes: string;
  publishedAt: string;
}

/** Dove ricordare l'ultima Release vista (file sul telefono, memoria nei test). */
export interface UpdateCache {
  load(): Promise<LatestRelease | null>;
  save(r: LatestRelease): Promise<void>;
}

export type UpdateStatus =
  | 'up_to_date'
  /** Versione nuova: l'app è bloccata finché non si aggiorna. */
  | 'required'
  /** Versione nuova ma build di sviluppo: solo avviso. */
  | 'available'
  /** Nessuna informazione (offline e mai controllato): l'app funziona. */
  | 'unknown';

export interface UpdateResult {
  status: UpdateStatus;
  latest: LatestRelease | null;
}

export function parseVersion(v: string): Version | null {
  const m = String(v).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], dev: !!m[4] };
}

/** true se `a` è una versione più nuova di `b` (solo numeri: major.minor.patch). */
export function isNewer(a: string, b: string): boolean {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return false;
  if (x.major !== y.major) return x.major > y.major;
  if (x.minor !== y.minor) return x.minor > y.minor;
  return x.patch > y.patch;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

/** Converte la risposta di api.github.com/…/releases/latest; null se non è una release valida. */
export function releaseFromGitHub(json: {
  tag_name?: string;
  body?: string | null;
  published_at?: string;
  assets?: GitHubAsset[];
}): LatestRelease | null {
  const v = parseVersion(json.tag_name ?? '');
  if (!v) return null;
  const apk =
    json.assets?.find((a) => /\.apk$/i.test(a.name) && /arm64/i.test(a.name)) ??
    json.assets?.find((a) => /\.apk$/i.test(a.name));
  if (!apk) return null;
  return {
    version: `${v.major}.${v.minor}.${v.patch}`,
    apkUrl: apk.browser_download_url,
    apkSize: apk.size,
    notes: json.body ?? '',
    publishedAt: json.published_at ?? '',
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout controllo aggiornamenti')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function checkForUpdate(opts: {
  current: string;
  fetchLatest: () => Promise<LatestRelease | null>;
  cache: UpdateCache;
  timeoutMs?: number;
}): Promise<UpdateResult> {
  const cached = await opts.cache.load().catch(() => null);
  let latest: LatestRelease | null = null;
  try {
    latest = await withTimeout(opts.fetchLatest(), opts.timeoutMs ?? 8000);
  } catch {
    latest = null;
  }

  // la più nuova tra quella appena letta e quella ricordata (una risposta vecchia non sblocca)
  let best = latest;
  if (cached && (!best || isNewer(cached.version, best.version))) best = cached;
  if (latest && (!cached || isNewer(latest.version, cached.version))) await opts.cache.save(latest).catch(() => {});

  if (!best) return { status: 'unknown', latest: null };
  if (!isNewer(best.version, opts.current)) return { status: 'up_to_date', latest: best };
  const dev = parseVersion(opts.current)?.dev ?? false;
  return { status: dev ? 'available' : 'required', latest: best };
}

/** Legge l'ultima Release da GitHub (senza login: il repo deve essere pubblico). */
export async function fetchLatestFromGitHub(fetchFn: typeof fetch = fetch): Promise<LatestRelease | null> {
  const res = await fetchFn(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) return null; // nessuna release (o repo ancora privato)
  if (!res.ok) throw new Error(`GitHub ha risposto ${res.status}`);
  return releaseFromGitHub(await res.json());
}
