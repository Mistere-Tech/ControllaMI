import { parseVersion } from './updates';

/**
 * Versione dell'APK dal ref della CI.
 * - tag vX.Y.Z → X.Y.Z (Release pubblica)
 * - altro (main) → <versione di app.json>-dev.<numero build> (build di sviluppo)
 * versionCode = X*1_000_000 + Y*1_000 + Z: cresce sempre con la versione.
 */
export function versionFromRef(ref: string, baseVersion: string, runNumber: number): { version: string; versionCode: number } {
  const tag = ref.match(/^refs\/tags\/(.+)$/)?.[1];
  const v = parseVersion(tag ?? baseVersion);
  if (!v || (tag && v.dev)) throw new Error(`Versione non valida: ${tag ?? baseVersion}`);
  const versionCode = v.major * 1_000_000 + v.minor * 1_000 + v.patch;
  const plain = `${v.major}.${v.minor}.${v.patch}`;
  return { version: tag ? plain : `${plain}-dev.${runNumber}`, versionCode };
}
