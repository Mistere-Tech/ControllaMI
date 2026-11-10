export interface Transport {
  write(data: string): void;
  onData(cb: (chunk: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}
