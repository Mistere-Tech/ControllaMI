import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YiClient, YiError } from '../src/core/YiClient';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';

/**
 * Bug del 10/11 (provato sul telefono): la galleria dava "errore -1 · 1283".
 * L'app faceva cd fisso in /tmp/fuse_d/DCIM/100MEDIA: se la cartella non esiste
 * (SD appena formattata, nessuno scatto) la YI risponde -1. E quando 100MEDIA si
 * riempie la camera continua in 101MEDIA, 102MEDIA…
 */

async function client(cam: FakeCamera) {
  const c = new YiClient(createInMemoryTransport(cam), { timeoutMs: 500 });
  await c.connect();
  return c;
}

test('camera finta realistica: cd in una cartella che non esiste → errore -1 (come la YI vera)', async () => {
  const cam = new FakeCamera();
  cam.formatSd();
  const c = await client(cam);
  await assert.rejects(c.send({ msg_id: 1283, param: '/tmp/fuse_d/DCIM/100MEDIA' }), (e) => e instanceof YiError && e.rval === -1);
});

test('galleria: SD appena formattata (DCIM senza 100MEDIA) → lista vuota, nessun errore -1', async () => {
  const cam = new FakeCamera();
  cam.formatSd();
  const c = await client(cam);
  assert.deepEqual(await c.listFiles(), []);
});

test('galleria: SD senza nemmeno la cartella DCIM → lista vuota, nessun errore', async () => {
  const cam = new FakeCamera();
  cam.removeDcim();
  const c = await client(cam);
  assert.deepEqual(await c.listFiles(), []);
});

test('galleria: file sparsi in 100MEDIA e 101MEDIA → li vede tutti, con l\'indirizzo della cartella giusta', async () => {
  const cam = new FakeCamera();
  cam.formatSd();
  cam.addFile('100MEDIA', 'YDXJ0999.mp4', '1000 bytes|2026-11-01 10:00:00');
  cam.addFile('101MEDIA', 'YDXJ1000.mp4', '2000 bytes|2026-11-02 10:00:00');
  cam.addFile('101MEDIA', 'YDXJ1001.jpg', '3000 bytes|2026-11-03 10:00:00');
  const c = await client(cam);
  const files = await c.listFiles();
  assert.deepEqual(files.map((f) => f.name), ['YDXJ1001.jpg', 'YDXJ1000.mp4', 'YDXJ0999.mp4']); // più recenti prima
  assert.equal(files[0].url, 'http://192.168.42.1/DCIM/101MEDIA/YDXJ1001.jpg');
  assert.equal(files[2].url, 'http://192.168.42.1/DCIM/100MEDIA/YDXJ0999.mp4');
  assert.equal(files[0].dir, '101MEDIA');
});

test('galleria: eliminare un file di 101MEDIA lo cancella davvero da 101MEDIA', async () => {
  const cam = new FakeCamera();
  cam.formatSd();
  cam.addFile('100MEDIA', 'YDXJ0999.mp4', '1000 bytes|2026-11-01 10:00:00');
  cam.addFile('101MEDIA', 'YDXJ1000.mp4', '2000 bytes|2026-11-02 10:00:00');
  const ctrl = new CameraController({ createTransport: async () => createInMemoryTransport(cam), heartbeatMs: 0 });
  await ctrl.connect();
  await ctrl.loadFiles();
  await ctrl.deleteFiles(['YDXJ1000.mp4']);
  assert.deepEqual(ctrl.state.files.map((f) => f.name), ['YDXJ0999.mp4']);
  await ctrl.loadFiles();
  assert.deepEqual(ctrl.state.files.map((f) => f.name), ['YDXJ0999.mp4']);
  ctrl.disconnect();
});

test('galleria: dopo il primo video su una SD vuota il file compare', async () => {
  const cam = new FakeCamera();
  cam.formatSd();
  const c = await client(cam);
  assert.deepEqual(await c.listFiles(), []);
  await c.startRecord();
  await c.stopRecord();
  const files = await c.listFiles();
  assert.equal(files.length, 1);
  assert.equal(files[0].dir, '100MEDIA');
});

test('galleria: gli altri errori della camera (es. occupata -14) non vengono nascosti', async () => {
  const cam = new FakeCamera();
  cam.failNext(1283, -14);
  const c = await client(cam);
  await assert.rejects(c.listFiles(), (e) => e instanceof YiError && e.rval === -14);
});
