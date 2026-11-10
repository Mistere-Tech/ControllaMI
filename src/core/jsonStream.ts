/**
 * La YI invia oggetti JSON uno dietro l'altro sulla stessa connessione TCP,
 * senza separatori e spezzati a caso dai pacchetti. Questo parser accumula
 * i caratteri e restituisce ogni oggetto appena le graffe si chiudono.
 */
export class JsonStreamParser {
  private buf = '';
  private depth = 0;
  private inString = false;
  private escape = false;
  private start = -1;
  private scanned = 0;

  feed(chunk: string): any[] {
    this.buf += chunk;
    const out: any[] = [];
    let i = this.scanned;
    for (; i < this.buf.length; i++) {
      const ch = this.buf[i];
      if (this.inString) {
        if (this.escape) this.escape = false;
        else if (ch === '\\') this.escape = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') {
        if (this.depth > 0) this.inString = true;
      } else if (ch === '{') {
        if (this.depth === 0) this.start = i;
        this.depth++;
      } else if (ch === '}') {
        if (this.depth === 0) continue; // graffa orfana: ignorala
        this.depth--;
        if (this.depth === 0) {
          const text = this.buf.slice(this.start, i + 1);
          try {
            out.push(JSON.parse(text));
          } catch {
            // oggetto malformato: lo scartiamo e andiamo avanti
          }
          this.buf = this.buf.slice(i + 1);
          i = -1;
          this.start = -1;
        }
      }
    }
    if (this.depth === 0) {
      // niente in sospeso: butta spazi e spazzatura fuori dagli oggetti
      this.buf = '';
      this.scanned = 0;
    } else {
      // tieni solo dall'inizio dell'oggetto aperto
      if (this.start > 0) {
        this.buf = this.buf.slice(this.start);
        this.start = 0;
      }
      this.scanned = this.buf.length;
    }
    return out;
  }

  reset() {
    this.buf = '';
    this.depth = 0;
    this.inString = false;
    this.escape = false;
    this.start = -1;
    this.scanned = 0;
  }
}
