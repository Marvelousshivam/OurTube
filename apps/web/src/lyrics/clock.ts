/**
 * The lyric playhead: a clock that runs on its own frames and is steered by
 * the player's readings rather than set by them. Port of BitChord's LyricClock.kt:
 *
 *  1. A reading is dated by when it was taken, not when it was seen.
 *  2. Nothing but an announced jump moves the words backwards.
 *  3. Readings steer, they don't set: the words close the gap to the newest
 *     reading carried forward at the learned rate, at most 25% faster or 50% slower.
 *
 * All times are milliseconds on the `performance.now()` clock.
 */
export class LyricClock {
  /** Where the lyrics are drawn, in song milliseconds. */
  displayedMs: number;

  private lastNowMs = Number.NaN;
  private lastReportMs = Number.MIN_SAFE_INTEGER;
  private lastSampledAtMs = Number.NaN;
  /** When playback was last seen stopped; a reading taken before then was taken standing still. */
  private heldAtMs = Number.NEGATIVE_INFINITY;
  private lastDiscontinuity: number | null = null;
  private jumpPending = false;
  private anchorAtMs = Number.NaN;
  private anchorMs = 0;
  /** The playback rate, learned from how far the song moves between readings. */
  private rate = 1;
  private historyAt: number[] = [];
  private historyMs: number[] = [];
  private rateSettled = false;
  private suspectAtMs = Number.NaN;
  private suspectMs = 0;
  private rejections = 0;
  private glideStartMs = Number.NaN;
  private glideOffsetMs = 0;

  constructor(startMs: number) {
    this.displayedMs = startMs;
  }

  /** Forget the run so far: frames stopped arriving, and the next frame starts a new one. */
  restart(): void {
    this.lastNowMs = Number.NaN;
    this.jumpPending = false;
    this.glideStartMs = Number.NaN;
    this.clearSuspect();
  }

  /** Playback is not moving: settle on [positionMs] outright, as of [nowMs]. */
  hold(positionMs: number, nowMs: number): void {
    this.restart();
    this.displayedMs = positionMs;
    this.heldAtMs = nowMs;
  }

  /**
   * Advance to the frame at [nowMs] and return where the lyrics should be drawn.
   * [sampledAtMs] is when [reportedMs] was taken (NaN when unknown);
   * [discontinuity] changes whenever the playhead jumps on purpose.
   */
  frame(nowMs: number, reportedMs: number, sampledAtMs: number, discontinuity: number): number {
    const firstOfRun = Number.isNaN(this.lastNowMs);
    if (discontinuity !== this.lastDiscontinuity) {
      if (this.lastDiscontinuity !== null && !firstOfRun) this.jumpPending = true;
      this.lastDiscontinuity = discontinuity;
    }
    const isNew =
      reportedMs !== this.lastReportMs || (!Number.isNaN(sampledAtMs) && sampledAtMs !== this.lastSampledAtMs);
    this.lastReportMs = reportedMs;
    this.lastSampledAtMs = sampledAtMs;

    if (firstOfRun) {
      this.lastNowMs = nowMs;
      const takenAt = Number.isNaN(sampledAtMs) || sampledAtMs <= this.heldAtMs ? nowMs : Math.min(sampledAtMs, nowMs);
      this.anchor(takenAt, reportedMs);
      this.displayedMs = this.targetAt(nowMs);
      return Math.trunc(this.displayedMs);
    }

    const dt = Math.max(0, nowMs - this.lastNowMs);
    this.lastNowMs = nowMs;
    this.advance(nowMs, dt);

    if (isNew) {
      const takenAt = Number.isNaN(sampledAtMs) ? nowMs : Math.min(sampledAtMs, nowMs);
      if (takenAt >= this.anchorAtMs || this.jumpPending) this.take(nowMs, takenAt, reportedMs);
    }
    return Math.trunc(this.displayedMs);
  }

  private take(nowMs: number, takenAt: number, reportedMs: number): void {
    if (this.jumpPending) {
      this.jumpPending = false;
      this.clearSuspect();
      this.anchor(takenAt, reportedMs);
      this.jumpTo(nowMs);
      return;
    }

    const expectedMs = this.targetAt(takenAt);
    const errorMs = reportedMs - expectedMs;

    if (Math.abs(errorMs) > 1000) {
      if (!Number.isNaN(this.suspectAtMs) && Math.abs(reportedMs - this.suspectMs) < 300) {
        this.rejections++;
        if (this.rejections >= 2) {
          this.clearSuspect();
          this.anchor(takenAt, reportedMs);
          this.jumpTo(nowMs);
          return;
        }
      } else {
        this.suspectAtMs = takenAt;
        this.suspectMs = reportedMs;
        this.rejections = 1;
        return;
      }
    } else {
      this.clearSuspect();
    }

    this.learnRate(takenAt, reportedMs);
    this.anchor(takenAt, reportedMs);
    this.glide(nowMs);
  }

  private advance(nowMs: number, dtMs: number): void {
    const rawTarget = this.targetAt(nowMs);
    let target = rawTarget;
    if (!Number.isNaN(this.glideStartMs)) {
      const elapsed = nowMs - this.glideStartMs;
      if (elapsed >= 350) {
        this.glideStartMs = Number.NaN;
        this.glideOffsetMs = 0;
      } else {
        const factor = 1 - elapsed / 350;
        target += this.glideOffsetMs * (factor * factor);
      }
    }

    const minAdvance = 0.5 * this.rate * dtMs;
    const maxAdvance = 1.25 * this.rate * dtMs;
    const delta = target - this.displayedMs;

    if (delta > 0) {
      this.displayedMs += Math.min(delta, maxAdvance);
    } else if (delta < 0) {
      this.displayedMs += Math.max(delta, minAdvance);
    }
  }

  private glide(nowMs: number): void {
    const newTarget = this.targetAt(nowMs);
    this.glideOffsetMs = this.displayedMs - newTarget;
    this.glideStartMs = nowMs;
  }

  private jumpTo(nowMs: number): void {
    this.displayedMs = this.targetAt(nowMs);
    this.glideStartMs = Number.NaN;
    this.glideOffsetMs = 0;
    this.historyAt = [];
    this.historyMs = [];
    this.rate = 1;
    this.rateSettled = false;
  }

  private anchor(takenAt: number, reportedMs: number): void {
    this.anchorAtMs = takenAt;
    this.anchorMs = reportedMs;
  }

  private targetAt(timeMs: number): number {
    return this.anchorMs + this.rate * Math.max(0, timeMs - this.anchorAtMs);
  }

  private clearSuspect(): void {
    this.suspectAtMs = Number.NaN;
    this.suspectMs = 0;
    this.rejections = 0;
  }

  private learnRate(atMs: number, posMs: number): void {
    this.historyAt.push(atMs);
    this.historyMs.push(posMs);
    if (this.historyAt.length > 5) {
      this.historyAt.shift();
      this.historyMs.shift();
    }
    if (this.historyAt.length < 3) return;

    const dt = this.historyAt[this.historyAt.length - 1] - this.historyAt[0];
    const dpos = this.historyMs[this.historyMs.length - 1] - this.historyMs[0];
    if (dt > 150) {
      const measured = dpos / dt;
      if (measured > 0.85 && measured < 1.15) {
        this.rate = this.rateSettled ? this.rate * 0.8 + measured * 0.2 : measured;
        this.rateSettled = true;
      }
    }
  }
}
