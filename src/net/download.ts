import { DownloadTask, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { CamFile } from '../core/gallery';
import { t } from '../core/i18n';

/** Scarica un file dalla camera e lo salva nella galleria del telefono. */
export async function downloadToGallery(file: CamFile, onProgress: (fraction: number) => void): Promise<void> {
  const perm = await requestPermissionsAsync(true, ['photo', 'video']);
  if (!perm.granted) throw new Error(t('gallery.needPermission'));

  const target = new File(Paths.cache, file.name);
  if (target.exists) target.delete();

  const task = new DownloadTask(file.url, target);
  const sub = task.addListener('progress', (p) => {
    const total = p.totalBytes > 0 ? p.totalBytes : file.size;
    if (total > 0) onProgress(Math.min(1, p.bytesWritten / total));
  });

  let downloaded: File | null = null;
  try {
    downloaded = await task.downloadAsync();
    if (!downloaded || !downloaded.exists || downloaded.size === 0) {
      throw new Error(t('gallery.downloadFailed'));
    }
    await Asset.create(downloaded.uri);
  } finally {
    sub.remove();
    task.release();
    if (target.exists) target.delete();
  }
}
