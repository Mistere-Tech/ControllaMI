import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { Transport } from '../src/core/transport';
import { waitFor } from './helpers';

/**
 * Bug del 10/11 (provato sul telefono): "Connetti alla camera" senza essere sul Wi-Fi
 * della camera restava in caricamento per sempre. La connessione deve avere un tempo
 * massimo, poi un errore che spiega cosa fare; e deve potersi annullare.
 */

/** Trasporto che si apre ma non risponde mai (es. rete sbagliata che accetta e tace). */
function silentTransport(): Transport & { closed: boolean } {
  const t = {
    closed: false,
    write() {},
    onData() {},
    onClose() {},
    close() {
      t.closed = true;
    },
  };
  return t;
}

test('connessione: se il Wi-Fi/la camera non rispondono mai → errore entro il tempo massimo, non caricamento infinito', async () => {
  const ctrl = new CameraController({
    createTransport: () => new Promise<Transport>(() => {}), // bind al Wi-Fi o TCP che non tornano mai
    connectTimeoutMs: 60,
    heartbeatMs: 0,
  });
  const t0 = Date.now();
  await assert.rejects(ctrl.connect());
  assert.ok(Date.now() - t0 < 1000, 'deve arrendersi da sola');
  assert.equal(ctrl.state.status, 'error');
  assert.match(ctrl.state.error ?? '', /Wi-Fi/);
});

test('connessione: TCP aperto ma la camera non risponde alla sessione → errore entro il tempo massimo', async () => {
  const t = silentTransport();
  const ctrl = new CameraController({
    createTransport: async () => t,
    timeoutMs: 10_000, // il timeout del singolo comando è lungo: deve valere quello della connessione
    connectTimeoutMs: 60,
    heartbeatMs: 0,
  });
  await assert.rejects(ctrl.connect());
  assert.equal(ctrl.state.status, 'error');
  await waitFor(() => t.closed);
});

test('connessione: il trasporto arrivato dopo il tempo massimo viene chiuso e non "riaccende" lo stato', async () => {
  const cam = new FakeCamera({ token: 3 });
  let late: Transport | null = null;
  let closedLate = false;
  const ctrl = new CameraController({
    createTransport: () =>
      new Promise<Transport>((resolve) =>
        setTimeout(() => {
          const real = createInMemoryTransport(cam);
          late = { ...real, close: () => { closedLate = true; real.close(); } };
          resolve(late);
        }, 120),
      ),
    connectTimeoutMs: 40,
    heartbeatMs: 0,
  });
  await assert.rejects(ctrl.connect());
  await waitFor(() => late !== null);
  await waitFor(() => closedLate);
  assert.equal(ctrl.state.status, 'error');
  assert.equal(ctrl.client, null);
});

test('connessione: Annulla durante il caricamento → stato disconnesso subito, nessun errore mostrato', async () => {
  const ctrl = new CameraController({
    createTransport: () => new Promise<Transport>(() => {}),
    connectTimeoutMs: 10_000,
    heartbeatMs: 0,
  });
  const pending = ctrl.connect();
  await waitFor(() => ctrl.state.status === 'connecting');
  const t0 = Date.now();
  ctrl.disconnect();
  await assert.rejects(pending);
  assert.ok(Date.now() - t0 < 500, 'annulla subito, senza aspettare il tempo massimo');
  assert.equal(ctrl.state.status, 'disconnected');
  assert.equal(ctrl.state.error, null);
});

test('connessione: dopo un tempo scaduto si può riprovare e collegarsi', async () => {
  const cam = new FakeCamera({ token: 4 });
  let first = true;
  const ctrl = new CameraController({
    createTransport: () => {
      if (first) {
        first = false;
        return new Promise<Transport>(() => {});
      }
      return Promise.resolve(createInMemoryTransport(cam));
    },
    connectTimeoutMs: 60,
    heartbeatMs: 0,
  });
  await assert.rejects(ctrl.connect());
  await ctrl.connect();
  assert.equal(ctrl.state.status, 'connected');
  assert.equal(ctrl.state.error, null);
  ctrl.disconnect();
});

test('riconnessione: anche i tentativi automatici hanno un tempo massimo (niente "riconnessione" infinita)', async () => {
  const cam = new FakeCamera({ token: 5 });
  let calls = 0;
  let firstT: Transport | null = null;
  const ctrl = new CameraController({
    createTransport: () => {
      calls++;
      if (calls === 1) return Promise.resolve((firstT = createInMemoryTransport(cam)));
      return new Promise<Transport>(() => {}); // dopo la caduta la rete non torna più
    },
    connectTimeoutMs: 40,
    reconnectDelayMs: 5,
    maxReconnects: 2,
    heartbeatMs: 0,
  });
  await ctrl.connect();
  firstT!.close(); // cade il Wi-Fi della camera
  await waitFor(() => ctrl.state.status === 'error', 2000);
  assert.match(ctrl.state.error ?? '', /Connessione persa/);
});
