/** Aspetta che `cond` diventi vera (controlla ogni 5 ms), al massimo `timeoutMs`. */
export async function waitFor(cond: () => boolean, timeoutMs = 1000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`Condizione non raggiunta entro ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 5));
  }
}
