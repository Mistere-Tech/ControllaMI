import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVersion,
  isNewer,
  releaseFromGitHub,
  checkForUpdate,
  UpdateCache,
  LatestRelease,
} from '../src/core/updates';

const release = (version: string): LatestRelease => ({
  version,
  apkUrl: `https://github.com/Mistere-Tech/ControllaMI/releases/download/v${version}/ControllaMI-v${version}-arm64.apk`,
  apkSize: 31_000_000,
  notes: 'Novità',
  publishedAt: '2026-11-10T10:00:00Z',
});

function memCache(initial: LatestRelease | null = null): UpdateCache & { value: LatestRelease | null } {
  return {
    value: initial,
    async load() {
      return this.value;
    },
    async save(r) {
      this.value = r;
    },
  };
}

test('parseVersion accetta tag con o senza "v" e ignora i suffissi -dev', () => {
  assert.deepEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3, dev: false });
  assert.deepEqual(parseVersion('0.10.0'), { major: 0, minor: 10, patch: 0, dev: false });
  assert.deepEqual(parseVersion('0.1.0-dev.42'), { major: 0, minor: 1, patch: 0, dev: true });
  assert.equal(parseVersion('ciao'), null);
});

test('isNewer confronta per numeri, non per testo', () => {
  assert.equal(isNewer('0.10.0', '0.9.9'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('0.2.0', '0.10.0'), false);
  assert.equal(isNewer('v0.2.1', '0.2.0'), true);
});

test('releaseFromGitHub prende la versione dal tag e l\'APK arm64 tra gli allegati', () => {
  const r = releaseFromGitHub({
    tag_name: 'v0.3.0',
    body: 'Correzioni',
    published_at: '2026-11-12T08:00:00Z',
    assets: [
      { name: 'note.txt', browser_download_url: 'https://x/note.txt', size: 10 },
      { name: 'ControllaMI-v0.3.0-arm64.apk', browser_download_url: 'https://x/app.apk', size: 31_500_000 },
    ],
  });
  assert.deepEqual(r, {
    version: '0.3.0',
    apkUrl: 'https://x/app.apk',
    apkSize: 31_500_000,
    notes: 'Correzioni',
    publishedAt: '2026-11-12T08:00:00Z',
  });
});

test('release senza APK o con tag strano → ignorata', () => {
  assert.equal(releaseFromGitHub({ tag_name: 'v0.3.0', assets: [] }), null);
  assert.equal(releaseFromGitHub({ tag_name: 'prova', assets: [{ name: 'a.apk', browser_download_url: 'u', size: 1 }] }), null);
});

test('c\'è una versione più nuova → aggiornamento obbligatorio', async () => {
  const res = await checkForUpdate({ current: '0.2.0', fetchLatest: async () => release('0.3.0'), cache: memCache() });
  assert.equal(res.status, 'required');
  assert.equal(res.latest?.version, '0.3.0');
});

test('già all\'ultima versione → nessun blocco', async () => {
  const res = await checkForUpdate({ current: '0.3.0', fetchLatest: async () => release('0.3.0'), cache: memCache() });
  assert.equal(res.status, 'up_to_date');
});

test('l\'ultima versione vista viene ricordata per quando non c\'è internet', async () => {
  const cache = memCache();
  await checkForUpdate({ current: '0.2.0', fetchLatest: async () => release('0.3.0'), cache });
  assert.equal(cache.value?.version, '0.3.0');
});

test('SENZA internet ma sapendo già che esiste una versione nuova → resta bloccata', async () => {
  // sicurezza: non basta spegnere la rete (o stare sul Wi-Fi della camera) per evitare l'aggiornamento
  const res = await checkForUpdate({
    current: '0.2.0',
    fetchLatest: async () => {
      throw new Error('rete non raggiungibile');
    },
    cache: memCache(release('0.3.0')),
  });
  assert.equal(res.status, 'required');
  assert.equal(res.latest?.version, '0.3.0');
});

test('senza internet e senza informazioni → l\'app funziona (es. in montagna o sul Wi-Fi della camera)', async () => {
  const res = await checkForUpdate({
    current: '0.2.0',
    fetchLatest: async () => {
      throw new Error('rete non raggiungibile');
    },
    cache: memCache(),
  });
  assert.equal(res.status, 'unknown');
});

test('dopo aver aggiornato, la versione ricordata non blocca più', async () => {
  const res = await checkForUpdate({
    current: '0.3.0',
    fetchLatest: async () => {
      throw new Error('offline');
    },
    cache: memCache(release('0.3.0')),
  });
  assert.equal(res.status, 'up_to_date');
});

test('le build di sviluppo (-dev) non vengono bloccate: avvisano soltanto', async () => {
  const res = await checkForUpdate({ current: '0.2.0-dev.17', fetchLatest: async () => release('0.3.0'), cache: memCache() });
  assert.equal(res.status, 'available');
});

test('una risposta più vecchia di quella ricordata non sblocca l\'app', async () => {
  // es. cache CDN vecchia: GitHub risponde 0.2.0 ma sappiamo già che esiste la 0.3.0
  const res = await checkForUpdate({ current: '0.2.0', fetchLatest: async () => release('0.2.0'), cache: memCache(release('0.3.0')) });
  assert.equal(res.status, 'required');
  assert.equal(res.latest?.version, '0.3.0');
});

test('controllo lento: dopo il tempo massimo si comporta come se fosse offline', async () => {
  const res = await checkForUpdate({
    current: '0.2.0',
    fetchLatest: () => new Promise(() => {}),
    cache: memCache(),
    timeoutMs: 30,
  });
  assert.equal(res.status, 'unknown');
});
