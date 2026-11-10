import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { startMockServer } from '../mock/mockServer';
import { YiClient } from '../src/core/YiClient';
import { Transport } from '../src/core/transport';

function nodeTransport(port: number): Promise<Transport> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1');
    const dataCbs: ((s: string) => void)[] = [];
    const closeCbs: (() => void)[] = [];
    sock.setEncoding('utf8');
    sock.on('data', (d: string) => dataCbs.forEach((c) => c(d)));
    sock.on('close', () => closeCbs.forEach((c) => c()));
    sock.on('error', reject);
    sock.on('connect', () =>
      resolve({
        write: (s) => { sock.write(s); },
        onData: (c) => { dataCbs.push(c); },
        onClose: (c) => { closeCbs.push(c); },
        close: () => { sock.destroy(); },
      }),
    );
  });
}

test('il mock server parla il protocollo YI via TCP vero', async () => {
  const server = await startMockServer({ port: 0, chunked: true });
  try {
    const client = new YiClient(await nodeTransport(server.port), { timeoutMs: 1000 });
    await client.connect();
    assert.ok(client.token > 0);
    await client.startRecord();
    await client.stopRecord();
    const files = await client.listFiles();
    assert.ok(files.length > 0);
    client.close();
  } finally {
    await server.close();
  }
});
