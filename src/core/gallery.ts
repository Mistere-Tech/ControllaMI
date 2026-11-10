export const CAMERA_HOST = '192.168.42.1';
/** Cartella DCIM della SD vista dalla camera. Dentro: 100MEDIA, 101MEDIA… (una nuova ogni 999 file). */
export const DCIM_DIR = '/tmp/fuse_d/DCIM';
/** Prima cartella dei file (quella che la camera crea al primo scatto). */
export const FIRST_MEDIA_DIR = '100MEDIA';
export const DCIM_HTTP = `http://${CAMERA_HOST}/DCIM`;

/** Percorso di un file sulla camera, per cd/elimina. */
export function mediaPath(dir: string, name?: string): string {
  return name ? `${DCIM_DIR}/${dir}/${name}` : `${DCIM_DIR}/${dir}`;
}

/** Nomi delle cartelle dei file (100MEDIA, 101MEDIA…) dal listato di DCIM, in ordine. */
export function parseMediaDirs(listing: Record<string, string>[]): string[] {
  const dirs = new Set<string>();
  for (const entry of listing ?? []) {
    for (const key of Object.keys(entry)) {
      const name = key.replace(/\/$/, '');
      if (/^\d{3}[A-Z0-9_]{5}$/i.test(name)) dirs.add(name);
    }
  }
  return [...dirs].sort();
}

export interface CamFile {
  name: string;
  /** Cartella dentro DCIM (100MEDIA, 101MEDIA…). */
  dir: string;
  size: number;
  date: string;
  kind: 'video' | 'photo';
  url: string;
}

const VIDEO = /\.(mp4|mov)$/i;
const PHOTO = /\.(jpg|jpeg|dng)$/i;

export function parseListing(listing: Record<string, string>[], dir: string = FIRST_MEDIA_DIR): CamFile[] {
  const out: CamFile[] = [];
  for (const entry of listing ?? []) {
    for (const [name, info] of Object.entries(entry)) {
      if (/_thm\./i.test(name) || /\.(thm|sec)$/i.test(name)) continue;
      const kind = VIDEO.test(name) ? 'video' : PHOTO.test(name) ? 'photo' : null;
      if (!kind) continue;
      const [sizePart = '', date = ''] = String(info).split('|');
      out.push({
        name,
        dir,
        size: parseInt(sizePart, 10) || 0,
        date: date.trim(),
        kind,
        url: `${DCIM_HTTP}/${dir}/${name}`,
      });
    }
  }
  return sortFiles(out);
}

/** Più recenti prima (a parità di data, nome più alto prima). */
export function sortFiles(out: CamFile[]): CamFile[] {
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.name.localeCompare(a.name)));
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
