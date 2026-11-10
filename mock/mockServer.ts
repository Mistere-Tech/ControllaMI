import net from 'node:net';
import { FakeCamera } from '../src/core/fakeCamera';
import { JsonStreamParser } from '../src/core/jsonStream';

/**
 * Finta YI Action Camera su TCP (porta 7878 di default).
 * Avvio: npm run mock   →   poi nell'app imposta l'host del PC al posto di 192.168.42.1.
 */
export async function startMockServer(opts: { port?: number; host?: string; chunked?: boolean; log?: boolean } = {}) {
  const server = net.createServer((sock) => {
    const cam = new FakeCamera({ token: Math.floor(Math.random() * 90) + 10 });
    const parser = new JsonStreamParser();
    // le scritture spezzate vanno in fila, altrimenti due risposte si mescolano
    let chain = Promise.resolve();
    const later = (fn: () => void, ms: number) => (chain = chain.then(() => new Promise<void>((r) => setTimeout(() => { fn(); r(); }, ms))));
    sock.setEncoding('utf8');
    sock.on('data', (chunk: string) => {
      for (const req of parser.feed(chunk)) {
        if (opts.log) console.log('→', JSON.stringify(req));
        const text = cam.handle(req).map((o) => JSON.stringify(o)).join('');
        if (!text) continue;
        if (opts.log) console.log('←', text);
        if (!opts.chunked) later(() => sock.write(text), 0);
        else {
          const cut = Math.max(1, Math.floor(text.length / 3));
          later(() => sock.write(text.slice(0, cut)), 0);
          later(() => sock.write(text.slice(cut)), 5);
        }
      }
    });
    sock.on('error', () => {});
    sock.on('close', () => { chain = Promise.resolve(); });
  });
  await new Promise<void>((res) => server.listen(opts.port ?? 7878, opts.host ?? '0.0.0.0', res));
  const port = (server.address() as net.AddressInfo).port;
  return {
    port,
    close: () => new Promise<void>((res) => server.close(() => res())),
  };
}

// eseguito direttamente: npm run mock
if (process.argv[1] && /mockServer\.(ts|js)$/.test(process.argv[1])) {
  startMockServer({ log: true, chunked: true }).then((s) => console.log(`Finta YI in ascolto sulla porta ${s.port}`));
}
