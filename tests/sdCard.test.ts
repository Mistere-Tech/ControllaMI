import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraController } from '../src/core/CameraController';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';
import { Transport } from '../src/core/transport';
import { sdStateFrom, SdMissingError } from '../src/core/errors';
import { MSG } from '../src/core/protocol';
import { waitFor } from './helpers';

async function setup(sdInserted = true) {
  const cam = new FakeCamera({ token: 9 });
  cam.sdInserted = sdInserted;
  const sent: number[] = [];
  const handle = cam.handle.bind(cam);
  cam.handle = (req: any) => {
    sent.push(req.msg_id);
    return handle(req);
  };
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
  return { cam, ctrl, sent, transports };
}

test('sdStateFrom legge lo stato della SD dalle impostazioni', () => {
  assert.equal(sdStateFrom({ sd_card_status: 'insert' }), 'ok');
  assert.equal(sdStateFrom({ sd_card_status: 'remove' }), 'missing');
  assert.equal(sdStateFrom({ sd_card_status: 'insert', sdcard_need_format: 'need' }), 'needs_format');
  assert.equal(sdStateFrom({ sd_card_status: 'insert', sdcard_need_format: 'no-need' }), 'ok');
  assert.equal(sdStateFrom({}), 'unknown');
});

test('alla connessione senza SD lo stato dice "missing"', async () => {
  const { ctrl } = await setup(false);
  assert.equal(ctrl.state.sd, 'missing');
});

test('con la SD lo stato dice "ok"', async () => {
  const { ctrl } = await setup(true);
  assert.equal(ctrl.state.sd, 'ok');
});

test('senza SD REC e foto non partono e non mandano comandi alla camera', async () => {
  const { ctrl, sent } = await setup(false);
  await assert.rejects(ctrl.toggleRecord(), SdMissingError);
  ctrl.setMode('photo');
  await assert.rejects(ctrl.shutter(), SdMissingError);
  assert.ok(!sent.includes(MSG.START_RECORD));
  assert.ok(!sent.includes(MSG.TAKE_PHOTO));
});

test('senza SD la galleria non chiede l\'elenco file alla camera', async () => {
  const { ctrl, sent } = await setup(false);
  await assert.rejects(ctrl.loadFiles(), SdMissingError);
  assert.ok(!sent.includes(MSG.LS));
});

test('la notifica sd_card_status aggiorna lo stato: tolta e rimessa', async () => {
  const { cam, ctrl, transports } = await setup(true);
  cam.sdInserted = false;
  cam.notify(transports[0], { type: 'sd_card_status', param: 'remove' });
  await waitFor(() => ctrl.state.sd === 'missing');
  cam.sdInserted = true;
  cam.notify(transports[0], { type: 'sd_card_status', param: 'insert' });
  await waitFor(() => ctrl.state.sd === 'ok');
  await ctrl.toggleRecord();
  assert.equal(cam.recording, true);
});

test('stato SD sconosciuto (firmware che non lo dice) → i comandi partono lo stesso', async () => {
  const { cam, ctrl } = await setup(true);
  cam.reportsSdStatus = false;
  await ctrl.refreshSettings();
  assert.equal(ctrl.state.sd, 'unknown');
  await ctrl.toggleRecord();
  assert.equal(cam.recording, true);
});
