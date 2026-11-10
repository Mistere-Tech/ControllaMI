import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YiClient, YiError } from '../src/core/YiClient';
import { MSG } from '../src/core/protocol';
import { FakeCamera } from '../src/core/fakeCamera';
import { createInMemoryTransport } from '../src/core/inMemoryTransport';

function setup(opts: { chunked?: boolean } = {}) {
  const cam = new FakeCamera({ token: 42 });
  const transport = createInMemoryTransport(cam, { chunked: opts.chunked ?? false });
  const client = new YiClient(transport, { timeoutMs: 500 });
  return { cam, client, transport };
}

test('connect ottiene il token dalla sessione 257', async () => {
  const { client } = setup();
  await client.connect();
  assert.equal(client.token, 42);
});

test('i comandi inviati dopo connect usano il token', async () => {
  const { client, cam } = setup();
  await client.connect();
  await client.startRecord();
  assert.equal(cam.lastRequest?.token, 42);
  assert.equal(cam.lastRequest?.msg_id, MSG.START_RECORD);
});

test('startRecord / stopRecord cambiano lo stato della camera', async () => {
  const { client, cam } = setup();
  await client.connect();
  await client.startRecord();
  assert.equal(cam.recording, true);
  await client.stopRecord();
  assert.equal(cam.recording, false);
});

test('funziona anche con risposte spezzate a pezzi', async () => {
  const { client } = setup({ chunked: true });
  await client.connect();
  const s = await client.getAllSettings();
  assert.equal(s.video_resolution, '1920x1080 60P 16:9');
});

test('getAllSettings restituisce una mappa chiave → valore', async () => {
  const { client } = setup();
  await client.connect();
  const s = await client.getAllSettings();
  assert.equal(s.video_standard, 'PAL');
  assert.equal(typeof s.photo_size, 'string');
});

test('getOptions restituisce le opzioni e se è modificabile', async () => {
  const { client } = setup();
  await client.connect();
  const o = await client.getOptions('video_resolution');
  assert.ok(o.options.includes('1920x1080 30P 16:9'));
  assert.equal(o.settable, true);
});

test('setSetting modifica il valore', async () => {
  const { client } = setup();
  await client.connect();
  await client.setSetting('video_standard', 'NTSC');
  const s = await client.getAllSettings();
  assert.equal(s.video_standard, 'NTSC');
});

test('rval negativo diventa YiError con il codice', async () => {
  const { client } = setup();
  await client.connect();
  await assert.rejects(client.setSetting('video_standard', 'INVALIDO'), (e: unknown) => {
    assert.ok(e instanceof YiError);
    assert.ok((e as YiError).rval < 0);
    return true;
  });
});

test('token scaduto (-4): rinegozia la sessione e ripete il comando una volta', async () => {
  const { client, cam } = setup();
  await client.connect();
  cam.invalidateToken(99);
  await client.takePhoto();
  assert.equal(client.token, 99);
  assert.equal(cam.photosTaken, 1);
});

test('i comandi in parallelo vengono serializzati e ricevono la risposta giusta', async () => {
  const { client } = setup();
  await client.connect();
  const [b, s] = await Promise.all([client.getBattery(), client.getAllSettings()]);
  assert.equal(b.level, 85);
  assert.equal(s.video_standard, 'PAL');
});

test('le notifiche msg_id 7 arrivano agli ascoltatori', async () => {
  const { client } = setup();
  await client.connect();
  const seen: string[] = [];
  client.onNotification((n) => seen.push(n.type));
  await client.startRecord();
  await client.stopRecord();
  assert.deepEqual(seen, ['start_video_record', 'video_record_complete']);
});

test('timeout se la camera non risponde', async () => {
  const { client, cam } = setup();
  await client.connect();
  cam.mute = true;
  await assert.rejects(client.getBattery(), /timeout/i);
});

test('dopo un timeout la coda continua a funzionare', async () => {
  const { client, cam } = setup();
  await client.connect();
  cam.mute = true;
  await assert.rejects(client.getBattery());
  cam.mute = false;
  const b = await client.getBattery();
  assert.equal(b.level, 85);
});

test('chiusura della connessione rifiuta i comandi in attesa', async () => {
  const { client, cam, transport } = setup();
  await client.connect();
  cam.mute = true;
  const p = client.getBattery();
  transport.close();
  await assert.rejects(p, /chius/i);
  assert.equal(client.connected, false);
});

test('listFiles restituisce i file della DCIM con URL di download', async () => {
  const { client } = setup();
  await client.connect();
  const files = await client.listFiles();
  assert.ok(files.length >= 2);
  const v = files.find((f) => f.kind === 'video')!;
  assert.match(v.url, /^http:\/\/192\.168\.42\.1\/DCIM\/100MEDIA\/YDXJ\d+\.MP4$/i);
});

test('deleteFile rimuove il file', async () => {
  const { client } = setup();
  await client.connect();
  const before = await client.listFiles();
  await client.deleteFile(before[0].name);
  const after = await client.listFiles();
  assert.equal(after.length, before.length - 1);
});

test('startLiveView restituisce l\'URL RTSP', async () => {
  const { client } = setup();
  await client.connect();
  assert.equal(await client.startLiveView(), 'rtsp://192.168.42.1/live');
});
