/**
 * Stockfish in a Web Worker, spoken to over UCI.
 *
 * The threaded build needs SharedArrayBuffer, which browsers only expose when
 * the page is cross-origin isolated (COOP same-origin + COEP require-corp).
 * The standalone site sends those headers; /embed deliberately does not, so it
 * always gets the single-threaded build.
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

export function engineBuild(isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated): { file: string; threads: number } {
  if (isolated && typeof SharedArrayBuffer !== 'undefined') {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
    return { file: 'stockfish-19-lite.js', threads: Math.max(1, Math.min(4, cores - 1)) };
  }
  return { file: 'stockfish-19-lite-single.js', threads: 1 };
}

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
  readonly build = engineBuild();

  constructor(private readonly onLine: (l: EngineLine) => void, private readonly onStatus: (s: EngineStatus, detail?: string) => void) {}

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.onStatus('loading');
    this.ready = new Promise<void>((resolve, reject) => {
      let w: Worker;
      try {
        w = new Worker(`${import.meta.env.BASE_URL}stockfish/${this.build.file}`);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      this.worker = w;
      w.onerror = (e) => {
        this.onStatus('error', e.message || 'The engine failed to load.');
        reject(new Error(e.message));
      };
      w.onmessage = (e: MessageEvent<string>) => {
        const line = String(e.data);
        if (line === 'uciok') {
          if (this.build.threads > 1) w.postMessage(`setoption name Threads value ${this.build.threads}`);
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
    this.ready.catch(() => {
      this.ready = null;
    });
    return this.ready;
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
