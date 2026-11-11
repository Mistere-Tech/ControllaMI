import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { formatCameraClock, parseCameraClock, CLOCK_TOLERANCE_S } from '../src/core/clock';

/**
 * Data e ora della YI: senza batteria la camera torna al 2015/2016 e i file escono con la
 * data sbagliata. L'app la rimette uguale a quella del telefono a ogni connessione e su richiesta.
 */

// 11/11/2026 21:30:05, ora del telefono
const PHONE = new Date(2026, 10, 11, 21, 30, 5).getTime();

function setup(cam = new FakeCamera(), now = PHONE) {
  const ctrl = new CameraController({ createTransport: async () => createInMemoryTransport(cam), heartbeatMs: 0, now: () => now });
  return { cam, ctrl };
}

test('formato della YI: "AAAA-MM-GG hh:mm:ss" con l\'ora locale del telefono', () => {
  assert.equal(formatCameraClock(new Date(2026, 0, 2, 3, 4, 5)), '2026-01-02 03:04:05');
  assert.equal(formatCameraClock(new Date(PHONE)), '2026-11-11 21:30:05');
});

test('lettura dell\'ora della camera; valori strani → null', () => {
  assert.equal(parseCameraClock('2026-11-11 21:30:05')?.getTime(), PHONE);
  assert.equal(parseCameraClock(''), null);
  assert.equal(parseCameraClock('boh'), null);
});

test('alla connessione una camera con la data sbagliata (2016) prende quella del telefono', async () => {
  const { cam, ctrl } = setup();
  assert.equal(cam.get('camera_clock'), '2016-03-01 10:00:00');
  await ctrl.connect();
  assert.equal(cam.get('camera_clock'), '2026-11-11 21:30:05');
  assert.equal(ctrl.state.settings.camera_clock, '2026-11-11 21:30:05');
  ctrl.disconnect();
});

test('se l\'ora della camera è già giusta (entro la tolleranza) non la riscrive', async () => {
  const cam = new FakeCamera();
  const almost = formatCameraClock(new Date(PHONE - (CLOCK_TOLERANCE_S - 5) * 1000));
  cam.set('camera_clock', almost);
  const { ctrl } = setup(cam);
  await ctrl.connect();
  assert.equal(cam.get('camera_clock'), almost);
  assert.equal(cam.clockWrites, 0);
  ctrl.disconnect();
});

test('se la camera rifiuta il cambio di ora la connessione va avanti lo stesso', async () => {
  const cam = new FakeCamera();
  cam.failNext(2, -14); // msg 2 = modifica impostazione
  const { ctrl } = setup(cam);
  await ctrl.connect();
  assert.equal(ctrl.state.status, 'connected');
  ctrl.disconnect();
});

test('camera che non espone camera_clock: nessun tentativo, connessione normale', async () => {
  const cam = new FakeCamera();
  cam.removeSetting('camera_clock');
  const { ctrl } = setup(cam);
  await ctrl.connect();
  assert.equal(ctrl.state.status, 'connected');
  assert.equal(cam.clockWrites, 0);
  ctrl.disconnect();
});

test('"Data e ora" da Impostazioni: rimette subito l\'ora del telefono', async () => {
  let now = PHONE;
  const cam = new FakeCamera();
  const ctrl = new CameraController({ createTransport: async () => createInMemoryTransport(cam), heartbeatMs: 0, now: () => now });
  await ctrl.connect();
  now += 3 * 3600_000; // tre ore dopo (es. cambio di fuso in viaggio)
  await ctrl.syncClock();
  assert.equal(cam.get('camera_clock'), '2026-11-12 00:30:05');
  assert.equal(ctrl.state.settings.camera_clock, '2026-11-12 00:30:05');
  ctrl.disconnect();
});

test('camera finta realistica: accetta una data valida per camera_clock, rifiuta il resto (-9)', async () => {
  const { cam, ctrl } = setup();
  await ctrl.connect();
  await assert.rejects(ctrl.changeSetting('camera_clock', 'domani'));
  assert.equal(cam.get('camera_clock'), '2026-11-11 21:30:05');
  ctrl.disconnect();
});
