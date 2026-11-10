import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHealth, HEALTH_LABEL } from '../src/core/health';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { waitFor } from './helpers';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('camera non connessa → persa', () => {
  assert.equal(computeHealth({ status: 'reconnecting', heartbeats: [100], live: null }), 'lost');
  assert.equal(computeHealth({ status: 'error', heartbeats: [], live: null }), 'lost');
});

test('risposte veloci e live view che va → stabile', () => {
  assert.equal(computeHealth({ status: 'connected', heartbeats: [80, 120, 90], live: 'playing' }), 'stable');
  assert.equal(computeHealth({ status: 'connected', heartbeats: [], live: null }), 'stable');
});

test('una risposta mancata o lenta tra le ultime → instabile', () => {
  assert.equal(computeHealth({ status: 'connected', heartbeats: [80, null, 90], live: 'playing' }), 'unstable');
  assert.equal(computeHealth({ status: 'connected', heartbeats: [80, 2500], live: null }), 'unstable');
});

test('contano solo le ultime 3 risposte', () => {
  assert.equal(computeHealth({ status: 'connected', heartbeats: [null, 3000, 80, 90, 100], live: null }), 'stable');
});

test('live view che riprova o va in errore → instabile', () => {
  assert.equal(computeHealth({ status: 'connected', heartbeats: [80], live: 'retrying' }), 'unstable');
  assert.equal(computeHealth({ status: 'connected', heartbeats: [80], live: 'error' }), 'unstable');
});

test('etichette in italiano', () => {
  assert.equal(HEALTH_LABEL.stable, 'Connessione stabile');
  assert.equal(HEALTH_LABEL.unstable, 'Connessione instabile');
  assert.equal(HEALTH_LABEL.lost, 'Connessione persa');
});

test('il controller manda un battito periodico e registra i tempi di risposta', async () => {
  const cam = new FakeCamera({ token: 5 });
  const ctrl = new CameraController({
    createTransport: async () => createInMemoryTransport(cam),
    timeoutMs: 100,
    heartbeatMs: 15,
  });
  await ctrl.connect();
  await waitFor(() => ctrl.state.heartbeats.length >= 2);
  assert.ok(ctrl.state.heartbeats.every((h) => typeof h === 'number'));
  cam.mute = true; // la camera smette di rispondere
  await waitFor(() => ctrl.state.heartbeats.includes(null));
  ctrl.disconnect();
});

test('il battito si ferma con disconnect', async () => {
  const cam = new FakeCamera({ token: 5 });
  let sent = 0;
  const handle = cam.handle.bind(cam);
  cam.handle = (req: any) => {
    if (req.msg_id === 13) sent++;
    return handle(req);
  };
  const ctrl = new CameraController({
    createTransport: async () => createInMemoryTransport(cam),
    timeoutMs: 100,
    heartbeatMs: 10,
  });
  await ctrl.connect();
  await waitFor(() => sent >= 2);
  ctrl.disconnect();
  await wait(20); // un battito già partito può ancora arrivare
  const after = sent;
  await wait(60);
  assert.equal(sent, after);
});
