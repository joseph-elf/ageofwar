import { onSettingsChange, settings } from './settings';

export type Sfx =
  | 'click' | 'error' | 'coin' | 'build' | 'sell' | 'evolve' | 'spawn' | 'melee' | 'hit' | 'death' | 'base_hit' | 'win' | 'lose'
  | 'shoot_rock' | 'shoot_bolt' | 'shoot_gun' | 'shoot_cannon' | 'shoot_laser' | 'boom'
  | 'special_0' | 'special_1' | 'special_2' | 'special_3' | 'special_4';

/** Minimum gap between two plays of the same sound (ms) so crowded fights do not turn into noise. */
const THROTTLE: Partial<Record<Sfx, number>> = { melee: 70, hit: 60, death: 90, coin: 80, shoot_rock: 80, shoot_bolt: 80, shoot_gun: 50, shoot_cannon: 90, shoot_laser: 70, boom: 60, spawn: 120, base_hit: 200 };

/** Everything is synthesised with the Web Audio API; there are no audio files. */
class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private last = new Map<Sfx, number>();

  constructor() {
    onSettingsChange(() => this.applyVolume());
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; // audio only; not part of the simulation
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = settings.muted ? 0 : settings.volume * 0.5;
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, freq: number, q = 1, delay = 0, sweepTo?: number): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise!;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name: Sfx): void {
    if (!this.ctx || !this.master || settings.muted || this.ctx.state !== 'running') return;
    const now = performance.now();
    const gap = THROTTLE[name];
    if (gap && now - (this.last.get(name) ?? -1e9) < gap) return;
    this.last.set(name, now);
    switch (name) {
      case 'click': this.tone(660, 880, 0.05, 'square', 0.12); break;
      case 'error': this.tone(180, 120, 0.15, 'sawtooth', 0.15); break;
      case 'coin': this.tone(988, 988, 0.06, 'square', 0.1); this.tone(1319, 1319, 0.12, 'square', 0.1, 0.06); break;
      case 'build': this.burst(0.12, 0.3, 300, 2); this.tone(220, 440, 0.12, 'square', 0.12); break;
      case 'sell': this.tone(500, 250, 0.15, 'triangle', 0.15); break;
      case 'spawn': this.tone(330, 440, 0.08, 'triangle', 0.1); break;
      case 'melee': this.burst(0.07, 0.35, 900, 1.5); this.tone(140, 80, 0.07, 'square', 0.08); break;
      case 'hit': this.burst(0.04, 0.15, 1800, 2); break;
      case 'death': this.tone(300, 70, 0.22, 'sawtooth', 0.12); this.burst(0.15, 0.2, 500, 1); break;
      case 'base_hit': this.burst(0.25, 0.5, 200, 1); this.tone(90, 45, 0.25, 'sine', 0.3); break;
      case 'shoot_rock': this.burst(0.09, 0.2, 700, 1, 0, 300); break;
      case 'shoot_bolt': this.tone(900, 300, 0.08, 'triangle', 0.14); this.burst(0.05, 0.15, 2500, 2); break;
      case 'shoot_gun': this.burst(0.09, 0.35, 1500, 0.8, 0, 500); this.tone(160, 60, 0.07, 'square', 0.1); break;
      case 'shoot_cannon': this.burst(0.3, 0.55, 300, 0.7, 0, 90); this.tone(110, 40, 0.3, 'sine', 0.4); break;
      case 'shoot_laser': this.tone(1800, 350, 0.14, 'sawtooth', 0.1); break;
      case 'boom': this.burst(0.35, 0.5, 250, 0.6, 0, 70); this.tone(80, 35, 0.3, 'sine', 0.35); break;
      case 'evolve': [392, 494, 587, 784].forEach((f, i) => this.tone(f, f, 0.22, 'square', 0.13, i * 0.1)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.3, 'triangle', 0.2, i * 0.15)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.95, 0.35, 'sawtooth', 0.14, i * 0.2)); break;
      case 'special_0': this.burst(1.2, 0.4, 150, 0.6, 0, 40); this.tone(70, 30, 1.0, 'sine', 0.4); break;
      case 'special_1': for (let i = 0; i < 8; i++) this.burst(0.18, 0.12, 3000, 3, i * 0.12, 1200); break;
      case 'special_2': for (let i = 0; i < 4; i++) { this.burst(0.35, 0.4, 260, 0.7, i * 0.25, 80); this.tone(100, 40, 0.3, 'sine', 0.3, i * 0.25); } break;
      case 'special_3': this.burst(1.4, 0.3, 400, 0.5, 0, 1800); this.tone(120, 300, 1.2, 'sawtooth', 0.12); break;
      case 'special_4': this.tone(300, 1600, 0.9, 'sawtooth', 0.12); this.tone(1600, 100, 0.8, 'sine', 0.2, 0.7); break;
    }
  }
}

export const sfx = new AudioEngine();
