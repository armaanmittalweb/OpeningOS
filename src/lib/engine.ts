/**
 * Stockfish in a Web Worker, spoken to over UCI.
 *
 * Always the single-threaded lite build. The threaded build (stockfish-19-lite.js)
 * needs a cross-origin isolated page, and even then it usually fails to answer
 * "uci" in Chromium: it respawns its pthread workers in a loop (80+ in 2.5 s)
 * until WebAssembly.Memory allocation fails and the page freezes. That happens
 * faster than any start-up timeout can kill it, so it is not used.
 */
export interface EngineLine {
  depth: number;
  /** Centipawns from White's point of view. */
  cp: number | null;
  /** Mate in N from White's point of view (negative: Black mates). */
  mate: number | null;
  pv: string[];
}

export type EngineStatus = 'idle' | 'loading' | 'thinking' | 'error';

export const ENGINE_BUILD = { file: 'stockfish-19-lite-single.js', threads: 1 } as const;

/** Parse one UCI "info" line. Scores are converted to White's point of view. */
export function parseInfo(line: string, whiteToMove: boolean): EngineLine | null {
  if (!line.startsWith('info') || !line.includes(' pv ')) return null;
  if (/ multipv (?!1 )\d+/.test(line)) return null;
  const depth = Number(/ depth (\d+)/.exec(line)?.[1] ?? 0);
  const cpm = / score cp (-?\d+)/.exec(line);
  const matem = / score mate (-?\d+)/.exec(line);
  const sign = whiteToMove ? 1 : -1;
  const pv = (/ pv (.+)$/.exec(line)?.[1] ?? '').trim().split(/\s+/);
  return {
    depth,
    cp: cpm?.[1] !== undefined ? sign * Number(cpm[1]) : null,
    mate: matem?.[1] !== undefined ? sign * Number(matem[1]) : null,
    pv,
  };
}

export class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private fen = '';
  private searching = false;
  private next: { fen: string; depth: number } | null = null;
  readonly build = ENGINE_BUILD;

  constructor(private readonly onLine: (l: EngineLine) => void, private readonly onStatus: (s: EngineStatus, detail?: string) => void) {}

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.onStatus('loading');
    this.ready = this.boot();
    this.ready.catch((err: unknown) => {
      this.ready = null;
      this.onStatus('error', err instanceof Error && err.message ? err.message : 'The engine failed to load.');
    });
    return this.ready;
  }

  /** Starts the worker and resolves on readyok. */
  private boot(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let w: Worker;
      try {
        w = new Worker(`${import.meta.env.BASE_URL}stockfish/${this.build.file}`);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      this.worker = w;
      const fail = (message: string) => {
        w.terminate();
        if (this.worker === w) this.worker = null;
        reject(new Error(message));
      };
      w.onerror = (e) => {
        e.preventDefault();
        fail(e.message || 'The engine failed to load.');
      };
      w.onmessage = (e: MessageEvent<string>) => {
        const line = String(e.data);
        if (line === 'uciok') {
          w.postMessage('isready');
        } else if (line === 'readyok') {
          resolve();
        } else if (line.startsWith('bestmove')) {
          this.searching = false;
          if (this.next) this.kick();
          else this.onStatus('idle');
        } else if (!this.next) {
          // Lines that arrive while a new position is queued belong to the old search.
          const info = parseInfo(line, this.fen.split(' ')[1] !== 'b');
          if (info) this.onLine(info);
        }
      };
      w.postMessage('uci');
    });
  }

  async analyse(fen: string, depth = 20): Promise<void> {
    await this.start();
    this.next = { fen, depth };
    if (this.searching) this.worker?.postMessage('stop');
    else this.kick();
  }

  private kick() {
    const w = this.worker;
    const n = this.next;
    if (!w || !n) return;
    this.next = null;
    this.fen = n.fen;
    this.searching = true;
    w.postMessage(`position fen ${n.fen}`);
    w.postMessage(`go depth ${n.depth}`);
    this.onStatus('thinking');
  }

  stop() {
    this.worker?.postMessage('stop');
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}
