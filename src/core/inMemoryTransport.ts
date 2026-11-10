import { Transport } from './transport';
import { FakeCamera } from './fakeCamera';
import { JsonStreamParser } from './jsonStream';

/**
 * Collega il client direttamente a una FakeCamera, senza rete.
 * Con `chunked` spezza le risposte in pezzi di 7 caratteri e le incolla
 * tra loro, come fa davvero il TCP.
 */
export function createInMemoryTransport(cam: FakeCamera, opts: { chunked?: boolean; delayMs?: number } = {}): Transport {
  const dataCbs: ((s: string) => void)[] = [];
  const closeCbs: (() => void)[] = [];
  const parser = new JsonStreamParser();
  let open = true;

  const deliver = (text: string) => {
    if (!open) return;
    if (!opts.chunked) return dataCbs.forEach((c) => c(text));
    for (let i = 0; i < text.length; i += 7) {
      const piece = text.slice(i, i + 7);
      dataCbs.forEach((c) => c(piece));
    }
  };

  const transport: Transport = {
    write(data) {
      if (!open) throw new Error('Connessione chiusa');
      const reqs = parser.feed(data);
      setTimeout(() => {
        for (const req of reqs) {
          const out = cam.handle(req);
          if (out.length) deliver(out.map((o) => JSON.stringify(o)).join(''));
        }
      }, opts.delayMs ?? 0);
    },
    onData(cb) { dataCbs.push(cb); },
    onClose(cb) { closeCbs.push(cb); },
    close() {
      if (!open) return;
      open = false;
      cam.detach(transport);
      closeCbs.forEach((c) => c());
    },
  };
  cam.attach(transport, (msgs) => deliver(msgs.map((o) => JSON.stringify(o)).join('')));
  return transport;
}
