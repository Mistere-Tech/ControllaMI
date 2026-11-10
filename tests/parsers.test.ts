import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseListing } from '../src/core/gallery';
import { describeSetting, settingsToMap } from '../src/core/settings';

test('parseListing interpreta nome, dimensione, data e tipo', () => {
  const items = parseListing([
    { 'YDXJ0042.mp4': '52428800 bytes|2016-03-01 10:20:30' },
    { 'YDXJ0040.jpg': '4194304 bytes|2016-03-01 10:10:00' },
    { 'YDXJ0042_thm.mp4': '1000 bytes|2016-03-01 10:20:30' },
  ]);
  assert.equal(items.length, 2, 'scarta i file _thm');
  assert.equal(items[0].name, 'YDXJ0042.mp4');
  assert.equal(items[0].size, 52428800);
  assert.equal(items[0].kind, 'video');
  assert.equal(items[1].kind, 'photo');
  assert.equal(items[0].date, '2016-03-01 10:20:30');
});

test('parseListing ordina dal più recente', () => {
  const items = parseListing([
    { 'A.jpg': '1 bytes|2016-01-01 00:00:00' },
    { 'B.jpg': '1 bytes|2017-01-01 00:00:00' },
  ]);
  assert.equal(items[0].name, 'B.jpg');
});

test('settingsToMap appiattisce la lista della camera', () => {
  assert.deepEqual(settingsToMap([{ a: '1' }, { b: '2' }]), { a: '1', b: '2' });
});

test('describeSetting dà etichetta italiana e gruppo', () => {
  const d = describeSetting('video_resolution');
  assert.equal(d.label, 'Risoluzione');
  assert.equal(d.group, 'Video');
  const u = describeSetting('chiave_sconosciuta');
  assert.equal(u.label, 'chiave sconosciuta');
  assert.equal(u.group, 'Altro');
});

test('describeSetting segnala le impostazioni di sola lettura', () => {
  assert.equal(describeSetting('serial_number').readOnly, true);
});
