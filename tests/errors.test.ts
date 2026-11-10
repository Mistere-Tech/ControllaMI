import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeError, SdMissingError } from '../src/core/errors';
import { YiError } from '../src/core/YiClient';
import { MSG } from '../src/core/protocol';

test('timeout → la camera non risponde, si può riprovare', () => {
  const p = describeError(new Error('Timeout: la camera non ha risposto (513)'));
  assert.equal(p.title, 'La camera non risponde');
  assert.equal(p.action, 'retry');
  assert.equal(p.severity, 'error');
});

test('connessione chiusa → connessione persa, ci pensa la riconnessione automatica', () => {
  for (const msg of ['Connessione chiusa', 'Camera non connessa']) {
    const p = describeError(new Error(msg));
    assert.equal(p.title, 'Connessione persa');
    assert.equal(p.action, null);
  }
});

test('-14 durante la registrazione → ferma prima la registrazione', () => {
  const p = describeError(new YiError(-14, MSG.SET_SETTING), { recording: true });
  assert.equal(p.title, 'Camera occupata');
  assert.match(p.message, /Ferma la registrazione/);
  assert.equal(p.action, null);
});

test('-14 senza registrazione → camera occupata, riprova', () => {
  const p = describeError(new YiError(-14, MSG.TAKE_PHOTO), { recording: false });
  assert.equal(p.title, 'Camera occupata');
  assert.equal(p.action, 'retry');
});

test('-9 → valore non accettato dalla camera', () => {
  const p = describeError(new YiError(-9, MSG.SET_SETTING));
  assert.equal(p.title, 'Valore non accettato');
});

test('codice sconosciuto → messaggio generico in italiano, codice solo come dettaglio', () => {
  const p = describeError(new YiError(-999, MSG.START_RECORD));
  assert.equal(p.title, 'Comando non riuscito');
  assert.doesNotMatch(p.message, /-999|rval|msg_id/, 'il codice non va nel testo principale');
  assert.equal(p.code, '-999 · 513');
});

test('SD assente: errore dedicato con azione "inserisci la SD"', () => {
  const p = describeError(new SdMissingError());
  assert.equal(p.title, 'Scheda SD assente');
  assert.match(p.message, /Inserisci una scheda SD/);
  assert.equal(p.action, 'insert_sd');
  assert.equal(p.severity, 'warning');
});

test('qualsiasi rifiuto della camera con la SD assente diventa "Scheda SD assente"', () => {
  // il codice reale della YI senza SD non è ancora noto: deve funzionare con qualunque codice
  for (const rval of [-1, -21, -27, -999]) {
    const p = describeError(new YiError(rval, MSG.START_RECORD), { sd: 'missing' });
    assert.equal(p.title, 'Scheda SD assente', `codice ${rval}`);
    assert.equal(p.code, `${rval} · 513`);
  }
});

test('SD da formattare → messaggio dedicato', () => {
  const p = describeError(new YiError(-1, MSG.TAKE_PHOTO), { sd: 'needs_format' });
  assert.equal(p.title, 'Scheda SD da formattare');
  assert.match(p.message, /formatta/i);
});

test('errore qualsiasi senza messaggio → testo generico, mai vuoto', () => {
  const p = describeError(undefined);
  assert.equal(p.title, 'Comando non riuscito');
  assert.ok(p.message.length > 0);
});
