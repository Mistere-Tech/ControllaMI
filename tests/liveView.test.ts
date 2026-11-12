import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { Transport } from '../src/core/transport';
import { LiveViewSupervisor } from '../src/core/liveView';
import { MSG } from '../src/core/protocol';
import { waitFor } from './helpers';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setup() {
  const cam = new FakeCamera({ token: 3 });
  const transports: Transport[] = [];
  const ctrl = new CameraController({
    createTransport: async () => {
      const t = createInMemoryTransport(cam);
      transports.push(t);
      return t;
    },
    timeoutMs: 500,
    reconnectDelayMs: 10,
    heartbeatMs: 0,
  });
  await ctrl.connect();
  let vfStarts = 0;
  const handle = cam.handle.bind(cam);
  cam.handle = (req: any) => {
    if (req.msg_id === MSG.START_VF) vfStarts++;
    return handle(req);
  };
  const live = new LiveViewSupervisor(ctrl, { retryBaseMs: 10, retryMaxMs: 40, stallMs: 30, restartDelayMs: 5 });
  const playing = async () => {
    await waitFor(() => !!live.state.url);
    live.onPlayerState('ready');
    live.onPlayerState('firstFrame'); // dal 12/11 "playing" solo con la prima immagine
    return live.state.generation;
  };
  return { cam, ctrl, live, transports, playing, vfStarts: () => vfStarts };
}

test('con la schermata attiva e la camera connessa la live view parte (259) e dà un URL', async () => {
  const { live, vfStarts } = await setup();
  live.setActive(true);
  await waitFor(() => !!live.state.url);
  assert.equal(vfStarts(), 1);
  assert.equal(live.state.url, 'rtsp://192.168.42.1/live');
  assert.equal(live.state.phase, 'starting');
  live.onPlayerState('ready');
  live.onPlayerState('firstFrame');
  assert.equal(live.state.phase, 'playing');
  live.dispose();
});

test('regressione: uscendo dalla schermata e tornando la live view riparte con un nuovo player', async () => {
  // Bug del 10/11: dopo Impostazioni → Controllo la live view restava nera.
  const { live, playing, vfStarts } = await setup();
  live.setActive(true);
  const first = await playing();

  live.setActive(false);
  assert.equal(live.state.url, null);
  assert.equal(live.state.phase, 'off');

  live.setActive(true);
  await waitFor(() => !!live.state.url);
  assert.equal(vfStarts(), 2, 'deve rimandare il comando 259 alla camera');
  assert.ok(live.state.generation > first, 'deve creare un player nuovo (generation diversa)');
  live.dispose();
});

test('se la camera ferma lo stream (vf_stop) e lo riprende (vf_start) la live view si riavvia', async () => {
  const { cam, live, transports, playing } = await setup();
  live.setActive(true);
  const gen = await playing();

  cam.notify(transports[0], { type: 'vf_stop' });
  await waitFor(() => live.state.url === null);
  assert.equal(live.state.phase, 'retrying');

  cam.notify(transports[0], { type: 'vf_start' });
  await waitFor(() => !!live.state.url);
  assert.ok(live.state.generation > gen);
  live.dispose();
});

test('dopo un cambio di impostazione la live view si riavvia da sola', async () => {
  const { ctrl, live, playing } = await setup();
  live.setActive(true);
  const gen = await playing();
  await ctrl.changeSetting('video_standard', 'NTSC');
  await waitFor(() => live.state.generation > gen);
  live.dispose();
});

test("errore del player → nuovi tentativi con attesa crescente finché non arriva l'immagine", async () => {
  const { live, vfStarts } = await setup();
  live.setActive(true);
  await waitFor(() => !!live.state.url);
  live.onPlayerState('error');
  assert.equal(live.state.phase, 'retrying');
  assert.equal(live.state.attempts, 1);
  await waitFor(() => vfStarts() >= 2 && !!live.state.url);
  live.onPlayerState('error');
  assert.equal(live.state.attempts, 2);
  await waitFor(() => vfStarts() >= 3 && !!live.state.url);
  live.onPlayerState('ready');
  live.onPlayerState('firstFrame');
  assert.equal(live.state.phase, 'playing');
  assert.equal(live.state.attempts, 0);
  live.dispose();
});

test('immagine bloccata in buffering troppo a lungo → riavvio', async () => {
  const { live, playing } = await setup();
  live.setActive(true);
  const gen = await playing();
  live.onPlayerState('buffering');
  await waitFor(() => live.state.generation > gen);
  live.dispose();
});

test('un buffering breve non riavvia la live view', async () => {
  const { live, playing } = await setup();
  live.setActive(true);
  const gen = await playing();
  live.onPlayerState('buffering');
  live.onPlayerState('ready');
  await wait(80);
  assert.equal(live.state.generation, gen);
  assert.equal(live.state.phase, 'playing');
  live.dispose();
});

test('se cade la connessione la live view si spegne e riparte quando la camera torna', async () => {
  const { live, transports, ctrl, playing } = await setup();
  live.setActive(true);
  await playing();
  transports[0].close();
  assert.equal(live.state.url, null);
  await waitFor(() => ctrl.state.status === 'connected' && !!live.state.url);
  assert.equal(transports.length, 2);
  live.dispose();
});

test('con la schermata non attiva non manda comandi alla camera', async () => {
  const { live, vfStarts } = await setup();
  await wait(30);
  assert.equal(vfStarts(), 0);
  assert.equal(live.state.phase, 'off');
  live.dispose();
});
