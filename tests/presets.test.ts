import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickVideoResolution,
  pickPhotoSize,
  pickQuality,
  pickClosestInterval,
  findExposureKey,
} from '../src/core/presets';
import { ModeManager, memoryStorage } from '../src/core/modes';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { Transport } from '../src/core/transport';
import { MSG } from '../src/core/protocol';

// ---- scelta dei valori migliori (funzioni pure) ----

test('video: sceglie 1080p a 60 fps tra le opzioni', () => {
  const opts = ['1920x1080 30P 16:9', '1280x720 120P 16:9', '1920x1080 60P 16:9', '2304x1296 30P 16:9'];
  assert.equal(pickVideoResolution(opts), '1920x1080 60P 16:9');
});

test('video: senza 60P sceglie il 1080p con più fps', () => {
  assert.equal(pickVideoResolution(['1920x1080 24P 16:9', '1920x1080 48P 16:9', '1280x720 60P 16:9']), '1920x1080 48P 16:9');
});

test('video: accetta anche le varianti 1080p 60 in 4:3 o con suffissi', () => {
  assert.equal(pickVideoResolution(['1920x1440 30P 4:3', '1920x1080 60P 16:9 super']), '1920x1080 60P 16:9 super');
});

test('qualità: S.Fine (bitrate massimo) prima di tutto', () => {
  assert.equal(pickQuality(['Normal', 'Fine', 'S.Fine']), 'S.Fine');
  assert.equal(pickQuality(['Normal', 'Fine']), 'Fine');
});

test('foto: sceglie la risoluzione con più megapixel', () => {
  assert.equal(pickPhotoSize(['8M (3264x2448 4:3)', '16M (4608x3456 4:3)', '13M (4128x3096 4:3)']), '16M (4608x3456 4:3)');
});

test('intervallo: il valore più vicino a quello chiesto, qualunque sia il formato', () => {
  assert.equal(pickClosestInterval(['0.5 sec', '1.0 sec', '2.0 sec', '5.0 sec'], 2), '2.0 sec');
  assert.equal(pickClosestInterval(['off', '0.5', '1', '2', '5', '10'], 3), '2');
  assert.equal(pickClosestInterval(['off', '0.5', '1', '2', '5', '10'], 4), '5');
});

test('esposizione: preferisce la compensazione EV, altrimenti la misurazione', () => {
  assert.equal(findExposureKey(['meter_mode', 'exposure_value']), 'exposure_value');
  assert.equal(findExposureKey(['meter_mode', 'video_quality']), 'meter_mode');
  assert.equal(findExposureKey(['video_quality']), null);
});

// ---- modalità sulla camera (controller + gestore modalità) ----

async function setup(opts: { ev?: boolean } = {}) {
  const cam = new FakeCamera({ token: 4 });
  if (opts.ev) cam.enableExposureValue();
  const transports: Transport[] = [];
  const ctrl = new CameraController({
    createTransport: async () => {
      const t = createInMemoryTransport(cam);
      transports.push(t);
      return t;
    },
    timeoutMs: 300,
    heartbeatMs: 0,
  });
  await ctrl.connect();
  const storage = memoryStorage();
  const modes = new ModeManager(ctrl, storage);
  await modes.load();
  return { cam, ctrl, modes, storage, transports };
}

test('GARANZIA: Video in modalità Semplice = 1080p 60 fps, qualità S.Fine (bitrate massimo), NTSC', async () => {
  const { cam, modes } = await setup();
  await modes.selectSimple('video');
  assert.equal(cam.get('video_standard'), 'NTSC', '60 fps esistono solo in NTSC');
  assert.equal(cam.get('video_resolution'), '1920x1080 60P 16:9');
  assert.equal(cam.get('video_quality'), 'S.Fine');
  assert.equal(cam.get('timelapse_video'), 'off');
  assert.equal(cam.get('rec_mode'), 'record');
});

test('Video Semplice partendo da PAL: passa a NTSC e poi trova il 60P (le opzioni cambiano con lo standard)', async () => {
  const { cam, modes } = await setup();
  assert.equal(cam.get('video_standard'), 'PAL');
  cam.set('video_resolution', '1920x1080 50P 16:9');
  await modes.selectSimple('video');
  assert.equal(cam.get('video_resolution'), '1920x1080 60P 16:9');
});

test('Foto in modalità Semplice = risoluzione massima, scatto singolo di qualità', async () => {
  const { cam, ctrl, modes } = await setup();
  cam.set('photo_size', '8M (3264x2448 4:3)');
  await modes.selectSimple('photo');
  assert.equal(cam.get('photo_size'), '16M (4608x3456 4:3)');
  assert.equal(cam.get('capture_mode'), 'precise quality');
  assert.equal(ctrl.state.mode, 'photo');
});

test('Timelapse video in Semplice: qualità massima + intervallo scelto', async () => {
  const { cam, ctrl, modes } = await setup();
  await modes.setInterval('timelapse_video', 2);
  await modes.selectSimple('timelapse_video');
  assert.equal(cam.get('rec_mode'), 'record_timelapse');
  assert.equal(cam.get('timelapse_video'), '2');
  assert.equal(cam.get('video_quality'), 'S.Fine');
  assert.equal(ctrl.state.mode, 'video');
});

test('tornando a Video normale il timelapse si spegne', async () => {
  const { cam, modes } = await setup();
  await modes.selectSimple('timelapse_video');
  await modes.selectSimple('video');
  assert.equal(cam.get('rec_mode'), 'record');
  assert.equal(cam.get('timelapse_video'), 'off');
});

test('Timelapse foto in Semplice: scatto continuo alla risoluzione massima con l\'intervallo scelto', async () => {
  const { cam, ctrl, modes } = await setup();
  await modes.setInterval('timelapse_photo', 5);
  await modes.selectSimple('timelapse_photo');
  assert.equal(cam.get('capture_mode'), 'precise quality cont.');
  assert.equal(cam.get('precise_cont_time'), '5.0 sec');
  assert.equal(cam.get('photo_size'), '16M (4608x3456 4:3)');
  assert.equal(ctrl.state.mode, 'photo');
});

test('le impostazioni che la camera non ha vengono saltate senza errori', async () => {
  const { cam, modes } = await setup();
  cam.removeOption('rec_mode');
  cam.removeOption('timelapse_video');
  await modes.selectSimple('video');
  assert.equal(cam.get('video_resolution'), '1920x1080 60P 16:9');
});

test('Pro → Semplice: i valori tornano quelli della Semplice; Semplice → Pro: tornano i tuoi', async () => {
  const { cam, ctrl, modes } = await setup();
  await modes.setUiMode('pro');
  await ctrl.changeSetting('video_standard', 'NTSC');
  await ctrl.changeSetting('video_resolution', '1280x720 120P 16:9');
  await ctrl.changeSetting('video_quality', 'Normal');

  await modes.setUiMode('simple');
  assert.equal(cam.get('video_resolution'), '1920x1080 60P 16:9');
  assert.equal(cam.get('video_quality'), 'S.Fine');

  await modes.setUiMode('pro');
  assert.equal(cam.get('video_resolution'), '1280x720 120P 16:9');
  assert.equal(cam.get('video_quality'), 'Normal');
});

test('in Semplice, se qualcuno cambia un valore (anche dai tasti della camera) prima del REC viene ripristinato', async () => {
  const { cam, ctrl, modes } = await setup();
  await modes.selectSimple('video');
  cam.set('video_quality', 'Normal'); // cambiato dai tasti della camera
  await ctrl.refreshSettings();
  await modes.shutter();
  assert.equal(cam.get('video_quality'), 'S.Fine');
  assert.equal(cam.recording, true);
});

test('in Pro il pulsante non tocca le impostazioni', async () => {
  const { cam, ctrl, modes } = await setup();
  await modes.setUiMode('pro');
  await ctrl.changeSetting('video_quality', 'Normal');
  await modes.shutter();
  assert.equal(cam.get('video_quality'), 'Normal');
  assert.equal(cam.recording, true);
});

test('timelapse foto: il pulsante avvia e ferma lo scatto continuo', async () => {
  const { cam, modes } = await setup();
  const sent: number[] = [];
  const handle = cam.handle.bind(cam);
  cam.handle = (req: any) => {
    sent.push(req.msg_id);
    return handle(req);
  };
  await modes.selectSimple('timelapse_photo');
  await modes.shutter();
  assert.equal(modes.state.capturing, true);
  await modes.shutter();
  assert.equal(modes.state.capturing, false);
  assert.ok(sent.includes(MSG.TAKE_PHOTO));
  assert.ok(sent.includes(MSG.STOP_PHOTO));
});

test('esposizione in Semplice: con la compensazione EV si regola e resta anche quando i valori vengono ripristinati', async () => {
  const { cam, modes } = await setup({ ev: true });
  await modes.selectSimple('video');
  const ctl = await modes.exposureControl();
  assert.equal(ctl?.key, 'exposure_value');
  assert.ok(ctl!.options.includes('+1.0'));
  await modes.setExposure('+1.0');
  assert.equal(cam.get('exposure_value'), '+1.0');
  cam.set('video_quality', 'Normal');
  await modes.selectSimple('video');
  assert.equal(cam.get('exposure_value'), '+1.0', 'l\'esposizione è una scelta dell\'utente, non va azzerata');
});

test('esposizione senza compensazione EV: si usa la misurazione (centro / media / spot)', async () => {
  const { modes } = await setup();
  const ctl = await modes.exposureControl();
  assert.equal(ctl?.key, 'meter_mode');
  assert.deepEqual(ctl?.options, ['center', 'average', 'spot']);
});

test('la modalità scelta (Semplice/Pro, intervalli, esposizione) viene ricordata', async () => {
  const { ctrl, storage, modes } = await setup();
  await modes.setUiMode('pro');
  await modes.setInterval('timelapse_photo', 10);
  const again = new ModeManager(ctrl, storage);
  await again.load();
  assert.equal(again.state.uiMode, 'pro');
  assert.equal(again.state.intervals.timelapse_photo, 10);
});

test('la prima volta parte in modalità Semplice', async () => {
  const { modes } = await setup();
  assert.equal(modes.state.uiMode, 'simple');
  assert.equal(modes.state.simpleMode, 'video');
});
