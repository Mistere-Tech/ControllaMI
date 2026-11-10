import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraController, formatElapsed } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { Transport } from '../src/core/transport';

function setup(opts: { failFirst?: number } = {}) {
  const cam = new FakeCamera({ token: 7 });
  let fails = opts.failFirst ?? 0;
  const transports: Transport[] = [];
  let now = 1_000_000;
  const ctrl = new CameraController({
    createTransport: async () => {
      if (fails > 0) { fails--; throw new Error('rete non raggiungibile'); }
      const t = createInMemoryTransport(cam);
      transports.push(t);
      return t;
    },
    timeoutMs: 300,
    reconnectDelayMs: 10,
    maxReconnects: 3,
    now: () => now,
  });
  return { cam, ctrl, transports, advance: (ms: number) => { now += ms; } };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('connect porta lo stato a connected e carica batteria e impostazioni', async () => {
  const { ctrl } = setup();
  const seen: string[] = [];
  ctrl.subscribe((s) => seen.push(s.status));
  await ctrl.connect();
  assert.equal(ctrl.state.status, 'connected');
  assert.equal(ctrl.state.battery, 85);
  assert.equal(ctrl.state.settings.video_standard, 'PAL');
  assert.ok(seen.includes('connecting'));
});

test('connect fallito → stato error con messaggio', async () => {
  const { ctrl } = setup({ failFirst: 1 });
  await assert.rejects(ctrl.connect());
  assert.equal(ctrl.state.status, 'error');
  assert.match(ctrl.state.error ?? '', /rete/);
});

test('toggleRecord avvia e ferma, e segna l\'ora di inizio', async () => {
  const { ctrl, cam } = setup();
  await ctrl.connect();
  await ctrl.toggleRecord();
  assert.equal(cam.recording, true);
  assert.equal(ctrl.state.recording, true);
  assert.equal(ctrl.state.recordStartedAt, 1_000_000);
  await ctrl.toggleRecord();
  assert.equal(ctrl.state.recording, false);
  assert.equal(ctrl.state.recordStartedAt, null);
});

test('la notifica di fine registrazione aggiorna lastFile', async () => {
  const { ctrl } = setup();
  await ctrl.connect();
  await ctrl.toggleRecord();
  await ctrl.toggleRecord();
  await wait(5);
  assert.match(ctrl.state.lastFile ?? '', /YDXJ\d+\.mp4$/);
});

test('in modalità foto il pulsante scatta una foto', async () => {
  const { ctrl, cam } = setup();
  await ctrl.connect();
  ctrl.setMode('photo');
  await ctrl.shutter();
  assert.equal(cam.photosTaken, 1);
  assert.equal(cam.recording, false);
});

test('non si cambia modalità durante la registrazione', async () => {
  const { ctrl } = setup();
  await ctrl.connect();
  ctrl.setMode('video');
  await ctrl.shutter();
  ctrl.setMode('photo');
  assert.equal(ctrl.state.mode, 'video');
});

test('elapsedSeconds e formatElapsed', async () => {
  const { ctrl, advance } = setup();
  await ctrl.connect();
  await ctrl.toggleRecord();
  advance(87_400);
  assert.equal(ctrl.elapsedSeconds(), 87);
  assert.equal(formatElapsed(87), '00:01:27');
  assert.equal(formatElapsed(3661), '01:01:01');
});

test('changeSetting aggiorna lo stato locale', async () => {
  const { ctrl } = setup();
  await ctrl.connect();
  await ctrl.changeSetting('video_standard', 'NTSC');
  assert.equal(ctrl.state.settings.video_standard, 'NTSC');
});

test('changeSetting fallito lascia il valore vecchio e riporta l\'errore', async () => {
  const { ctrl } = setup();
  await ctrl.connect();
  await assert.rejects(ctrl.changeSetting('video_standard', 'XYZ'));
  assert.equal(ctrl.state.settings.video_standard, 'PAL');
});

test('loadFiles e deleteFiles', async () => {
  const { ctrl } = setup();
  await ctrl.connect();
  await ctrl.loadFiles();
  const n = ctrl.state.files.length;
  assert.ok(n >= 2);
  await ctrl.deleteFiles([ctrl.state.files[0].name, ctrl.state.files[1].name]);
  assert.equal(ctrl.state.files.length, n - 2);
});

test('se cade la connessione si riconnette da solo', async () => {
  const { ctrl, transports } = setup();
  await ctrl.connect();
  transports[0].close();
  assert.equal(ctrl.state.status, 'reconnecting');
  await wait(60);
  assert.equal(ctrl.state.status, 'connected');
  assert.equal(transports.length, 2);
});

test('disconnect manuale non riconnette', async () => {
  const { ctrl, transports } = setup();
  await ctrl.connect();
  ctrl.disconnect();
  await wait(40);
  assert.equal(ctrl.state.status, 'disconnected');
  assert.equal(transports.length, 1);
});

test('dopo troppi tentativi falliti si arrende con errore', async () => {
  const { ctrl, transports, cam } = setup();
  await ctrl.connect();
  cam.mute = true; // la camera non risponde più alla sessione
  transports[0].close();
  await wait(1500);
  assert.equal(ctrl.state.status, 'error');
});
