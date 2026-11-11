import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pickLang, setLang, getLang, t, MESSAGES } from '../src/core/i18n';
import { describeError, SdMissingError } from '../src/core/errors';
import { healthLabel } from '../src/core/health';
import { describeSetting, groupLabel } from '../src/core/settings';
import { meterLabel } from '../src/core/presets';
import { notesFor } from '../src/core/updates';
import { CameraController } from '../src/core/CameraController';
import { YiError } from '../src/core/YiClient';
import { Transport } from '../src/core/transport';

/** App in due lingue: italiano e inglese, scelta dalla lingua del telefono. */

afterEach(() => setLang('it'));

test('lingua dal telefono: italiano se il telefono è in italiano', () => {
  assert.equal(pickLang(['it-IT']), 'it');
  assert.equal(pickLang(['it-CH', 'en-US']), 'it');
});

test('lingua dal telefono: inglese per l\'inglese e per tutte le altre lingue', () => {
  assert.equal(pickLang(['en-GB']), 'en');
  assert.equal(pickLang(['fr-FR']), 'en');
  assert.equal(pickLang([]), 'en');
  assert.equal(pickLang([null, undefined]), 'en');
});

test('lingua dal telefono: vale la prima lingua conosciuta nell\'elenco delle preferite', () => {
  assert.equal(pickLang(['de-DE', 'it-IT', 'en-US']), 'it');
  assert.equal(pickLang(['de-DE', 'en-US', 'it-IT']), 'en');
});

test('dizionari: ogni testo esiste in italiano e in inglese, mai vuoto, con gli stessi segnaposto', () => {
  const it = Object.keys(MESSAGES.it).sort();
  const en = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(en, it);
  const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const k of it) {
    const a = (MESSAGES.it as Record<string, string>)[k];
    const b = (MESSAGES.en as Record<string, string>)[k];
    assert.ok(a.trim() && b.trim(), `testo vuoto: ${k}`);
    assert.equal(holes(b), holes(a), `segnaposto diversi in ${k}`);
  }
});

test('t() inserisce i valori nei segnaposto', () => {
  setLang('en');
  assert.equal(t('control.lastFile', { name: 'YDXJ0042.mp4' }), 'Last file: YDXJ0042.mp4');
  setLang('it');
  assert.equal(t('control.lastFile', { name: 'YDXJ0042.mp4' }), 'Ultimo file: YDXJ0042.mp4');
});

test('l\'italiano resta la lingua di partenza (test e app prima di leggere il telefono)', () => {
  assert.equal(getLang(), 'it');
  assert.equal(describeError(new SdMissingError()).title, 'Scheda SD assente');
});

test('in inglese gli errori della camera sono in inglese', () => {
  setLang('en');
  assert.equal(describeError(new SdMissingError()).title, 'No SD card');
  assert.equal(describeError(new YiError(-14, 513)).title, 'Camera busy');
  assert.equal(describeError(new Error('Timeout comando 3')).title, 'The camera is not responding');
});

test('in inglese le etichette di connessione, impostazioni ed esposizione sono in inglese', () => {
  setLang('en');
  assert.equal(healthLabel('stable'), 'Connection stable');
  assert.equal(describeSetting('video_resolution').label, 'Resolution');
  assert.equal(groupLabel('Foto'), 'Photo');
  assert.equal(meterLabel('center'), 'Center');
});

test('in inglese il messaggio "camera non trovata" è in inglese', async () => {
  setLang('en');
  const ctrl = new CameraController({ createTransport: () => new Promise<Transport>(() => {}), connectTimeoutMs: 30, heartbeatMs: 0 });
  await assert.rejects(ctrl.connect());
  assert.match(ctrl.state.error ?? '', /Can't find the camera/);
});

test('note di rilascio: nella schermata di aggiornamento si vede la parte nella lingua dell\'app', () => {
  const body = '🇬🇧 English notes.\nSecond line.\n\n🇮🇹 Note in italiano.\n\n\n**Full Changelog**: https://x';
  assert.equal(notesFor(body, 'en'), 'English notes.\nSecond line.');
  assert.equal(notesFor(body, 'it'), 'Note in italiano.');
  assert.equal(notesFor('Solo testo, senza bandiere', 'en'), 'Solo testo, senza bandiere');
});

/** Schermate e componenti: niente testi scritti a mano, tutto passa da t(). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx$/.test(n) ? [p] : [];
  });
}

const ALLOWED = new Set(['LIVE', 'REC', 'TIMELAPSE', 'ControllaMI', 'EV']);

test('nessun testo scritto direttamente nelle schermate (resterebbe in una sola lingua)', () => {
  const found: string[] = [];
  for (const file of [...sources('app'), ...sources('src/ui')]) {
    const code = readFileSync(file, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s\/\/ .*$/gm, '');
    // testo tra i tag JSX (non dopo "=>": sono tipi come Promise<void>; con operatori è codice, non testo)
    for (const m of code.matchAll(/(?<!=)>([^<>{}\n]*[A-Za-zÀ-ÿ]{2,}[^<>{}\n]*)</g)) {
      const s = m[1].trim();
      if (s && !ALLOWED.has(s) && !/[=&|;()?]/.test(s)) found.push(`${file}: ${s}`);
    }
    // stringhe con almeno due parole (frasi)
    for (const m of code.matchAll(/(['"])((?:(?!\1)[^\n])*?[A-Za-zÀ-ÿ]{2,} [A-Za-zÀ-ÿ’']{2,}(?:(?!\1)[^\n])*?)\1/g)) {
      // codice tra due stringhe (es. 'lost' && typeof last === 'number'), non una frase
      if (/&&|\|\||[=!]==/.test(m[2])) continue;
      found.push(`${file}: ${m[2]}`);
    }
  }
  assert.deepEqual(found, []);
});
