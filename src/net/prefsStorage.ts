import { File, Paths } from 'expo-file-system';
import type { PrefsStorage } from '../core/modes';

/** Preferenze dell'app (modalità Semplice/Pro, intervalli, esposizione) in un file JSON sul telefono. */
export function filePrefsStorage(name = 'preferenze.json'): PrefsStorage {
  const file = new File(Paths.document, name);
  return {
    load: async () => (file.exists ? file.text() : null),
    save: async (data) => {
      if (!file.exists) file.create();
      await file.write(data);
    },
  };
}
