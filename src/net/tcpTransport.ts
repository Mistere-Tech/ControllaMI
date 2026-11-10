import TcpSocket from 'react-native-tcp-socket';
import { Transport } from '../core/transport';

/** Apre la connessione TCP verso la camera (di default 192.168.42.1:7878). */
export function connectTcp(host: string, port = 7878, timeoutMs = 5000): Promise<Transport> {
  return new Promise((resolve, reject) => {
    const dataCbs: ((s: string) => void)[] = [];
    const closeCbs: (() => void)[] = [];
    let settled = false;
    let closed = false;

    const fireClose = () => {
      if (closed) return;
      closed = true;
      closeCbs.forEach((c) => c());
    };

    const socket = TcpSocket.createConnection(
      { host, port, connectTimeout: timeoutMs, interface: 'wifi' } as any,
      () => {
        settled = true;
        resolve({
          write: (data) => {
            socket.write(data);
          },
          onData: (cb) => {
            dataCbs.push(cb);
          },
          onClose: (cb) => {
            closeCbs.push(cb);
          },
          close: () => {
            socket.destroy();
            fireClose();
          },
        });
      },
    );

    socket.setEncoding('utf8');
    socket.on('data', (d: any) => {
      const text = typeof d === 'string' ? d : d.toString('utf8');
      dataCbs.forEach((c) => c(text));
    });
    socket.on('error', (err: any) => {
      if (!settled) {
        settled = true;
        reject(new Error(`Camera non raggiungibile su ${host}:${port} (${err?.message ?? err})`));
      }
    });
    socket.on('close', fireClose);
  });
}
