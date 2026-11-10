import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { CamFile } from '../core/gallery';

/** Scarica un file dalla camera e lo salva nella galleria del telefono. */
export async function downloadToGallery(file: CamFile, onProgress: (fraction: number) => void): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) throw new Error('Serve il permesso per salvare in galleria');

  const target = `${FileSystem.cacheDirectory}${file.name}`;
  const task = FileSystem.createDownloadResumable(file.url, target, {}, (p) => {
    const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : file.size;
    if (total > 0) onProgress(Math.min(1, p.totalBytesWritten / total));
  });
  const res = await task.downloadAsync();
  if (!res || res.status >= 400) throw new Error(`Download non riuscito (${res?.status ?? 'nessuna risposta'})`);
  try {
    await MediaLibrary.saveToLibraryAsync(res.uri);
  } finally {
    await FileSystem.deleteAsync(res.uri, { idempotent: true });
  }
}
