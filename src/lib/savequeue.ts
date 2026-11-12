/**
 * One queue for every save. Only one write is in flight at a time, and
 * changes made meanwhile coalesce into a single follow-up write of the latest
 * state, so two saves can never race each other (a race used to look like a
 * change from another window).
 */
export interface SaveQueueOptions<T> {
  /** Writes `data` if storage is still at `rev`. Resolves the new revision, or null if another window saved first. */
  write: (data: T, rev: number) => Promise<number | null>;
  /** Saving is switched off (e.g. stored data could not be read): drop writes. */
  blocked: () => boolean;
  /** Another window saved newer data. Queued changes are dropped; the caller reloads. */
  onConflict: () => void | Promise<void>;
  onSaved: (data: T, rev: number) => void;
  /** Every retry failed (the next change tries again). */
  onFailed: (error: unknown) => void;
  /** Delays before each retry of a failed write. */
  retryDelays?: number[];
  sleep?: (ms: number) => Promise<void>;
}

export class SaveQueue<T> {
  /** Revision of the data we last loaded or saved. */
  rev = 0;
  private pending: { data: T } | null = null;
  private running: Promise<void> | null = null;
  private readonly opts: SaveQueueOptions<T>;

  constructor(opts: SaveQueueOptions<T>) {
    this.opts = opts;
  }

  /** True while a write is in flight or waiting. */
  get busy() {
    return !!this.running || !!this.pending;
  }

  /** Queue the latest state. Resolves once it (or a newer state) has been handled. */
  save(data: T): Promise<void> {
    this.pending = { data };
    if (!this.running) {
      this.running = this.loop().finally(() => { this.running = null; });
    }
    return this.idle();
  }

  /** Resolves when nothing is queued or in flight. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  /** Forget anything queued (e.g. after the data was replaced from elsewhere). */
  clear() {
    this.pending = null;
  }

  private async loop() {
    const { write, blocked, onConflict, onSaved, onFailed } = this.opts;
    const delays = this.opts.retryDelays ?? [1000, 2000];
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    while (this.pending) {
      const { data } = this.pending;
      this.pending = null;
      if (blocked()) continue;
      for (let attempt = 0; ; attempt++) {
        try {
          const next = await write(data, this.rev);
          if (next === null) {
            this.pending = null;
            await onConflict();
          } else {
            this.rev = next;
            onSaved(data, next);
          }
          break;
        } catch (e) {
          console.error('save failed', e);
          // A newer state is waiting: write that instead of retrying the old one.
          if (this.pending) break;
          if (attempt >= delays.length) { onFailed(e); break; }
          await sleep(delays[attempt]);
          if (this.pending || blocked()) break;
        }
      }
    }
  }
}
