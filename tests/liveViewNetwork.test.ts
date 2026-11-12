import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { LiveViewOptions, LiveViewSupervisor } from '../src/core/liveView';
import { computeHealth } from '../src/core/health';
import { waitFor } from './helpers';

/**
 * Segnalazione del 12/11 (primo utente, Honor 200 Lite, Android 14): live view nera per un po',
 * poi partita da sola.
 * 1. "ready" del player arriva prima della prima immagine: la schermata toglieva "Avvio live
 *    view…" e mostrava nero. Ora conta solo il primo fotogramma vero.
 * 2. Se Android non usa il Wi-Fi della camera (MagicOS "WLAN+" passa ai dati mobili) il video
 *    non arriva: prima di avviarlo si controlla la rete e, se manca, si dice perché.
 */

async function setup(opts: LiveViewOptions = {}) {
  const cam = new FakeCamera({ token: 3 });
  const ctrl = new CameraController({ createTransport: async () => createInMemoryTransport(cam), timeoutMs: 500, heartbeatMs: 0 });
  await ctrl.connect();
  const live = new LiveViewSupervisor(ctrl, { retryBaseMs: 10, retryMaxMs: 40, stallMs: 30, restartDelayMs: 5, firstFrameMs: 40, ...opts });
  return { cam, ctrl, live };
}

test('Regressione: "ready" senza immagine non è ancora "playing" (niente schermo nero al posto di "Avvio live view…")', async () => {
  const { live } = await setup();
  live.setActive(true);
  await waitFor(() => !!live.state.url);
  live.onPlayerState('ready');
  assert.notEqual(live.state.phase, 'playing');
  live.onPlayerState('firstFrame');
  assert.equal(live.state.phase, 'playing');
  assert.equal(live.state.attempts, 0);
  live.dispose();
});

test('Regressione: "ready" ma nessuna immagine entro il tempo massimo → nuovo tentativo con un player nuovo', async () => {
  const { live } = await setup();
  live.setActive(true);
  await waitFor(() => !!live.state.url);
  const first = live.state.generation;
  live.onPlayerState('ready');
  await waitFor(() => live.state.generation > first, 1000);
  assert.ok(live.state.attempts >= 1);
  live.dispose();
});

test('dopo la prima immagine un buffering breve seguito da "ready" resta "playing"', async () => {
  const { live } = await setup({ stallMs: 200 });
  live.setActive(true);
  await waitFor(() => !!live.state.url);
  live.onPlayerState('ready');
  live.onPlayerState('firstFrame');
  live.onPlayerState('buffering');
  live.onPlayerState('ready');
  assert.equal(live.state.phase, 'playing');
  live.dispose();
});

test('Regressione: rete della camera non disponibile per il video → fase "no_network", nessun comando di avvio', async () => {
  let vfStarts = 0;
  const { cam, live } = await setup({ ensureNetwork: async () => false });
  const handle = cam.handle.bind(cam);
  cam.handle = (req: any) => {
    if (req.msg_id === 259) vfStarts++;
    return handle(req);
  };
  live.setActive(true);
  await waitFor(() => live.state.phase === 'no_network');
  assert.equal(live.state.url, null);
  assert.equal(vfStarts, 0);
  live.dispose();
});

test('quando la rete della camera torna disponibile la live view parte da sola', async () => {
  let ready = false;
  const { live } = await setup({ ensureNetwork: async () => ready });
  live.setActive(true);
  await waitFor(() => live.state.phase === 'no_network');
  ready = true;
  await waitFor(() => !!live.state.url, 1000);
  live.onPlayerState('ready');
  live.onPlayerState('firstFrame');
  assert.equal(live.state.phase, 'playing');
  live.dispose();
});

test('se il controllo della rete fallisce con un errore si comporta come "rete non disponibile"', async () => {
  const { live } = await setup({
    ensureNetwork: async () => {
      throw new Error('modulo nativo assente');
    },
  });
  live.setActive(true);
  await waitFor(() => live.state.phase === 'no_network');
  live.dispose();
});

test('senza rete per il video la connessione risulta instabile', () => {
  assert.equal(computeHealth({ status: 'connected', heartbeats: [20, 20, 20], live: 'no_network' }), 'unstable');
});
