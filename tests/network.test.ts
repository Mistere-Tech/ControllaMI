import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseNetworkMethod, prepareNetwork, networkTip, NetworkDeps, CAMERA_SSID_PREFIX, DEFAULT_CAMERA_PASSWORD } from '../src/core/network';

/**
 * Collegamento al Wi-Fi della camera.
 * Android 10+ (API 29): collegamento guidato dall'app (finestra di sistema "ControllaMI vuole
 * collegarsi a YDXJ_…"): niente avviso "rete senza internet", i dati mobili restano alle altre app.
 * Prima di Android 10, o se l'utente annulla: si usa il Wi-Fi a cui il telefono è già collegato.
 */

function deps(over: Partial<NetworkDeps> = {}): NetworkDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    sdk: 34,
    isBound: () => false,
    bindToWifi: async () => {
      calls.push('bind');
      return true;
    },
    connectToCamera: async (o) => {
      calls.push(`guided:${o.ssidPrefix}:${o.password}`);
      return 'ok';
    },
    ...over,
  };
}

test('Android 10 e successivi: collegamento guidato; prima di Android 10: Wi-Fi già collegato', () => {
  assert.equal(chooseNetworkMethod(29), 'guided');
  assert.equal(chooseNetworkMethod(34), 'guided');
  assert.equal(chooseNetworkMethod(28), 'bind');
});

test('rete della camera già pronta → non chiede niente ad Android', async () => {
  const d = deps({ isBound: () => true });
  const r = await prepareNetwork(d);
  assert.deepEqual(r, { ok: true, method: 'already' });
  assert.deepEqual(d.calls, []);
});

test('Android 14 (Honor 200 Lite): collegamento guidato alle reti "YDXJ_" con la password predefinita', async () => {
  const d = deps();
  const r = await prepareNetwork(d);
  assert.deepEqual(r, { ok: true, method: 'guided' });
  assert.deepEqual(d.calls, [`guided:${CAMERA_SSID_PREFIX}:${DEFAULT_CAMERA_PASSWORD}`]);
  assert.equal(CAMERA_SSID_PREFIX, 'YDXJ_');
  assert.equal(DEFAULT_CAMERA_PASSWORD, '1234567890');
});

test('password cambiata dall\'utente → usa quella', async () => {
  const d = deps();
  await prepareNetwork(d, { password: 'miapassword' });
  assert.deepEqual(d.calls, [`guided:YDXJ_:miapassword`]);
});

test('l\'utente annulla la finestra di Android o la camera non si trova → prova col Wi-Fi già collegato', async () => {
  for (const outcome of ['cancelled', 'unavailable'] as const) {
    const d = deps({ connectToCamera: async () => (d.calls.push('guided'), outcome) });
    const r = await prepareNetwork(d);
    assert.deepEqual(r, { ok: true, method: 'bind' });
    assert.deepEqual(d.calls, ['guided', 'bind']);
  }
});

test('Android 9: niente collegamento guidato, solo il Wi-Fi già collegato', async () => {
  const d = deps({ sdk: 28 });
  const r = await prepareNetwork(d);
  assert.deepEqual(r, { ok: true, method: 'bind' });
  assert.deepEqual(d.calls, ['bind']);
});

test('nessun modo di raggiungere il Wi-Fi della camera → ok false con il motivo', async () => {
  const d = deps({ connectToCamera: async () => 'unavailable', bindToWifi: async () => false });
  assert.deepEqual(await prepareNetwork(d), { ok: false, method: 'none', reason: 'unavailable' });
});

test('errori del modulo nativo non bloccano: si prova il passo successivo', async () => {
  const d = deps({
    connectToCamera: async () => {
      throw new Error('API non supportata');
    },
  });
  assert.deepEqual(await prepareNetwork(d), { ok: true, method: 'bind' });
  const d2 = deps({
    sdk: 28,
    bindToWifi: async () => {
      throw new Error('boh');
    },
  });
  assert.deepEqual(await prepareNetwork(d2), { ok: false, method: 'none', reason: 'unavailable' });
});

test('consiglio giusto per la marca del telefono quando il video non passa', () => {
  assert.equal(networkTip('HONOR'), 'tip.wlanPlus');
  assert.equal(networkTip('HUAWEI'), 'tip.wlanPlus');
  assert.equal(networkTip('samsung'), 'tip.samsung');
  assert.equal(networkTip('Xiaomi'), 'tip.xiaomi');
  assert.equal(networkTip('Redmi'), 'tip.xiaomi');
  assert.equal(networkTip('Google'), 'tip.generic');
  assert.equal(networkTip(undefined), 'tip.generic');
});
