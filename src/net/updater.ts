import { DownloadTask, File, Paths } from 'expo-file-system';
import * as Application from 'expo-application';
import { startActivityAsync } from 'expo-intent-launcher';
import { checkForUpdate, fetchLatestFromGitHub, LatestRelease, UpdateCache, UpdateResult } from '../core/updates';

const FLAG_GRANT_READ_URI_PERMISSION = 1;
const APK_MIME = 'application/vnd.android.package-archive';

/** Versione installata (versionName dell'APK). */
export function installedVersion(): string {
  return Application.nativeApplicationVersion ?? '0.0.0';
}

/** Ultima Release vista, in un file: serve per bloccare anche quando non c'è internet. */
function fileUpdateCache(): UpdateCache {
  const file = new File(Paths.document, 'ultima-release.json');
  return {
    load: async () => (file.exists ? (JSON.parse(await file.text()) as LatestRelease) : null),
    save: async (r) => {
      if (!file.exists) file.create();
      await file.write(JSON.stringify(r));
    },
  };
}

/** Da chiamare all'avvio, prima di collegarsi alla camera (dopo, il Wi-Fi della camera non ha internet). */
export function checkAppUpdate(): Promise<UpdateResult> {
  return checkForUpdate({ current: installedVersion(), fetchLatest: () => fetchLatestFromGitHub(), cache: fileUpdateCache() });
}

/** Scarica l'APK della Release e apre l'installer di Android (l'utente conferma con "Installa"). */
export async function downloadAndInstall(release: LatestRelease, onProgress: (fraction: number) => void): Promise<void> {
  const target = new File(Paths.cache, `ControllaMI-${release.version}.apk`);
  if (target.exists) target.delete();
  const task = new DownloadTask(release.apkUrl, target);
  const sub = task.addListener('progress', (p) => {
    const total = p.totalBytes > 0 ? p.totalBytes : release.apkSize;
    if (total > 0) onProgress(Math.min(1, p.bytesWritten / total));
  });
  try {
    const apk = await task.downloadAsync();
    if (!apk || !apk.exists || apk.size === 0) throw new Error('Download dell’aggiornamento non riuscito');
    await startActivityAsync('android.intent.action.VIEW', {
      data: apk.contentUri,
      type: APK_MIME,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  } finally {
    sub.remove();
    task.release();
  }
}
