import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addReleaseSigning } from '../plugins/withReleaseSigning';
import { versionFromRef } from '../src/core/appVersion';

const GRADLE = `
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

test('firma: aggiunge la configurazione release letta dalle variabili della CI', () => {
  const out = addReleaseSigning(GRADLE);
  assert.match(out, /release \{\s*if \(System\.getenv\("CONTROLLAMI_KEYSTORE"\)\)/);
  assert.match(out, /storePassword System\.getenv\("CONTROLLAMI_KEYSTORE_PASSWORD"\)/);
  assert.match(out, /keyAlias System\.getenv\("CONTROLLAMI_KEY_ALIAS"\)/);
});

test('firma: la build release usa la chiave vera se c\'è, altrimenti quella di debug', () => {
  const out = addReleaseSigning(GRADLE);
  const release = out.slice(out.indexOf('buildTypes'));
  assert.match(release, /signingConfig System\.getenv\("CONTROLLAMI_KEYSTORE"\) \? signingConfigs\.release : signingConfigs\.debug/);
  // la build debug resta com'era
  assert.match(release, /debug \{\s*signingConfig signingConfigs\.debug\s*\}/);
});

test('firma: applicata due volte non duplica niente', () => {
  const once = addReleaseSigning(GRADLE);
  assert.equal(addReleaseSigning(once), once);
});

test('firma: se il build.gradle cambia formato la build si ferma invece di uscire firmata male', () => {
  assert.throws(() => addReleaseSigning('android { }'), /signingConfigs/);
});

test('versione dal tag: v1.2.3 → 1.2.3, versionCode crescente', () => {
  assert.deepEqual(versionFromRef('refs/tags/v1.2.3', '0.1.0', 55), { version: '1.2.3', versionCode: 1_002_003 });
  assert.deepEqual(versionFromRef('refs/tags/v0.10.0', '0.1.0', 55), { version: '0.10.0', versionCode: 10_000 });
});

test('versionCode: ogni versione nuova ha un codice più alto (Android rifiuta i codici più bassi)', () => {
  const codes = ['v0.1.0', 'v0.1.1', 'v0.2.0', 'v0.10.0', 'v1.0.0'].map((t) => versionFromRef(`refs/tags/${t}`, '0', 1).versionCode);
  assert.deepEqual([...codes].sort((a, b) => a - b), codes);
});

test('build da main: versione di sviluppo con il numero della build', () => {
  assert.deepEqual(versionFromRef('refs/heads/main', '0.1.0', 55), { version: '0.1.0-dev.55', versionCode: 1_000 });
});

test('tag non valido → errore (meglio una build fallita che una Release con versione sbagliata)', () => {
  assert.throws(() => versionFromRef('refs/tags/prova', '0.1.0', 1));
});
