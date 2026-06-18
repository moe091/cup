import type { SampleMode } from './RemoteSmoother';

/**
 * Lightweight, toggleable netcode instrumentation for diagnosing remote-ball
 * jitter/delay. Zero cost when disabled. Accumulates per-frame samples and
 * flushes a single compact, copy-pasteable summary to the console once per
 * window (default 1s), plus exposes a live HUD string.
 *
 * Toggle: backtick (`) in the gameplay scene, or window.__netDebug.toggle().
 *
 * Layers measured (so jitter can be attributed to a stage):
 *  - network:        snapshot inter-arrival time + seq gaps (packet loss)
 *  - interpolator:   vx of RemoteSmoother.sample() output (pre secondary lerp)
 *  - final sprite:   vx of the actual rendered sprite (what the player sees)
 *  - self:           local ball's true engine velocity (constant-speed baseline)
 *  - timing:         frame dt, RTT, clock offset
 */

type Stat = { n: number; sum: number; sumSq: number; min: number; max: number };

const newStat = (): Stat => ({ n: 0, sum: 0, sumSq: 0, min: Infinity, max: -Infinity });
const push = (s: Stat, v: number) => {
  s.n++;
  s.sum += v;
  s.sumSq += v * v;
  if (v < s.min) s.min = v;
  if (v > s.max) s.max = v;
};
const mean = (s: Stat) => (s.n ? s.sum / s.n : 0);
const std = (s: Stat) => {
  if (s.n < 2) return 0;
  const m = mean(s);
  return Math.sqrt(Math.max(0, s.sumSq / s.n - m * m));
};
const fmt = (s: Stat, d = 0) =>
  s.n === 0 ? 'n/a' : `μ${mean(s).toFixed(d)} σ${std(s).toFixed(d)} [${s.min.toFixed(d)}..${s.max.toFixed(d)}]`;

type RenderTrack = {
  has: boolean;
  px: number; // prev interpolator sample x/y
  py: number;
  sx: number; // prev sprite x/y
  sy: number;
  t: number; // prev sample timestamp (performance.now ms)
  vxSpr: Stat;
  vySpr: Stat;
  vxInt: Stat;
  interp: number;
  extrap: number;
  single: number;
  buf: Stat;
};

type ArrivalTrack = {
  has: boolean;
  prevT: number;
  prevSeq: number;
  inter: Stat;
  seqGaps: number;
  count: number;
};

const shortId = (id: string) => id.slice(-4);

class NetDebug {
  enabled = false;
  private windowMs = 1000;
  private lastFlush = 0;

  private frameDt = newStat();
  private selfVx = newStat();
  private rtt = newStat();
  private renders = new Map<string, RenderTrack>();
  private arrivals = new Map<string, ArrivalTrack>();

  private lastRtt = 0;
  private lastOffset = 0;
  private hudText = '';

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.hudText = '';
    } else {
      this.lastFlush = 0;
    }
    console.log(`[netdbg] ${this.enabled ? 'ON' : 'OFF'}`);
  }

  recordFrame(dtMs: number) {
    if (!this.enabled) return;
    push(this.frameDt, dtMs);
  }

  recordSelf(xVel: number) {
    if (!this.enabled) return;
    push(this.selfVx, xVel);
  }

  recordPing(rttMs: number, offsetMs: number) {
    this.lastRtt = rttMs;
    this.lastOffset = offsetMs;
    if (!this.enabled) return;
    push(this.rtt, rttMs);
  }

  recordArrival(playerId: string, seq: number, recvMs: number) {
    if (!this.enabled) return;
    let a = this.arrivals.get(playerId);
    if (!a) {
      a = { has: false, prevT: 0, prevSeq: 0, inter: newStat(), seqGaps: 0, count: 0 };
      this.arrivals.set(playerId, a);
    }
    a.count++;
    if (a.has) {
      push(a.inter, recvMs - a.prevT);
      const gap = seq - a.prevSeq - 1;
      if (gap > 0) a.seqGaps += gap;
    }
    a.prevT = recvMs;
    a.prevSeq = seq;
    a.has = true;
  }

  recordRemoteRender(
    playerId: string,
    sampleX: number,
    sampleY: number,
    spriteX: number,
    spriteY: number,
    mode: SampleMode,
    bufferDepth: number,
    nowMs: number,
  ) {
    if (!this.enabled) return;
    let r = this.renders.get(playerId);
    if (!r) {
      r = {
        has: false,
        px: 0,
        py: 0,
        sx: 0,
        sy: 0,
        t: 0,
        vxSpr: newStat(),
        vySpr: newStat(),
        vxInt: newStat(),
        interp: 0,
        extrap: 0,
        single: 0,
        buf: newStat(),
      };
      this.renders.set(playerId, r);
    }

    if (mode === 'interp') r.interp++;
    else if (mode === 'extrap') r.extrap++;
    else if (mode === 'single') r.single++;
    push(r.buf, bufferDepth);

    if (r.has) {
      const dt = (nowMs - r.t) / 1000;
      if (dt > 0) {
        push(r.vxSpr, (spriteX - r.sx) / dt);
        push(r.vySpr, (spriteY - r.sy) / dt);
        push(r.vxInt, (sampleX - r.px) / dt);
      }
    }
    r.px = sampleX;
    r.py = sampleY;
    r.sx = spriteX;
    r.sy = spriteY;
    r.t = nowMs;
    r.has = true;
  }

  maybeFlush(nowMs: number) {
    if (!this.enabled) return;
    if (this.lastFlush === 0) {
      this.lastFlush = nowMs;
      return;
    }
    if (nowMs - this.lastFlush < this.windowMs) return;
    const elapsed = nowMs - this.lastFlush;
    this.lastFlush = nowMs;
    this.flush(elapsed);
  }

  clear() {
    this.renders.clear();
    this.arrivals.clear();
    this.lastFlush = 0;
  }

  getHudText(): string {
    if (!this.enabled) return '';
    return `netdbg ON  rtt=${this.lastRtt.toFixed(0)}ms off=${this.lastOffset.toFixed(0)}ms\n${this.hudText}`;
  }

  private flush(elapsedMs: number) {
    const fps = (this.frameDt.n / elapsedMs) * 1000;
    const lines: string[] = [];
    lines.push(
      `[netdbg ${(elapsedMs / 1000).toFixed(1)}s] rtt=${this.lastRtt.toFixed(0)}ms off=${this.lastOffset.toFixed(0)}ms ` +
        `fps=${fps.toFixed(0)} dt(ms) ${fmt(this.frameDt, 1)}`,
    );
    lines.push(`  self   vx_true ${fmt(this.selfVx, 0)}`);

    for (const [id, r] of this.renders) {
      const a = this.arrivals.get(id);
      const arr = a ? `arr(ms) ${fmt(a.inter, 0)} gaps=${a.seqGaps} pkts=${a.count}` : 'arr n/a';
      lines.push(
        `  ${shortId(id)}  vx_spr ${fmt(r.vxSpr, 0)} | vx_int σ${std(r.vxInt).toFixed(0)} | ` +
          `vy_spr σ${std(r.vySpr).toFixed(0)} | mode i:${r.interp} e:${r.extrap} s:${r.single} | ` +
          `buf μ${mean(r.buf).toFixed(1)} | ${arr}`,
      );
    }
    if (this.renders.size === 0) lines.push('  (no remote players yet)');

    const text = lines.join('\n');
    console.log(text);
    this.hudText = text;
    this.reset();
  }

  private reset() {
    this.frameDt = newStat();
    this.selfVx = newStat();
    this.rtt = newStat();
    for (const r of this.renders.values()) {
      r.vxSpr = newStat();
      r.vySpr = newStat();
      r.vxInt = newStat();
      r.buf = newStat();
      r.interp = 0;
      r.extrap = 0;
      r.single = 0;
    }
    for (const a of this.arrivals.values()) {
      a.inter = newStat();
      a.seqGaps = 0;
      a.count = 0;
    }
  }
}

export const netDebug = new NetDebug();

if (typeof window !== 'undefined') {
  (window as unknown as { __netDebug: NetDebug }).__netDebug = netDebug;
}
