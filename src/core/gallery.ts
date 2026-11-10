export const CAMERA_HOST = '192.168.42.1';
export const MEDIA_DIR = '/tmp/fuse_d/DCIM/100MEDIA';
export const MEDIA_HTTP = `http://${CAMERA_HOST}/DCIM/100MEDIA`;

export interface CamFile {
  name: string;
  size: number;
  date: string;
  kind: 'video' | 'photo';
  url: string;
}

const VIDEO = /\.(mp4|mov)$/i;
const PHOTO = /\.(jpg|jpeg|dng)$/i;

export function parseListing(listing: Record<string, string>[]): CamFile[] {
  const out: CamFile[] = [];
  for (const entry of listing ?? []) {
    for (const [name, info] of Object.entries(entry)) {
      if (/_thm\./i.test(name) || /\.(thm|sec)$/i.test(name)) continue;
      const kind = VIDEO.test(name) ? 'video' : PHOTO.test(name) ? 'photo' : null;
      if (!kind) continue;
      const [sizePart = '', date = ''] = String(info).split('|');
      out.push({
        name,
        size: parseInt(sizePart, 10) || 0,
        date: date.trim(),
        kind,
        url: `${MEDIA_HTTP}/${name}`,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.name.localeCompare(a.name)));
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
