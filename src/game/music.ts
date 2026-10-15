import { sfx } from './audio';

/**
 * Original, procedurally synthesised soundtrack: a heroic march in D major at 152 BPM (half-time feel), with a quiet
 * intro that builds into brass and drums. The arrangement follows the local player's age:
 * Stone = horns + tribal toms, Medieval = brass + timpani, Renaissance = brass + harpsichord, Modern = brass + military
 * snare, Future = synth lead + arpeggiator + electronic drums. No audio files are used.
 */

const BPM = 152;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Note = [beat: number, midi: number, beats: number];

// Chord voicings (root position, 3rd octave). First entry is the root.
const CH: Record<string, number[]> = {
  D: [50, 54, 57],
  A: [45, 49, 52],
  Bm: [47, 50, 54],
  G: [43, 47, 50],
  Em: [40, 43, 47],
};

// ---- the tune (original composition) ------------------------------------------------------------------------------
const A_CH = ['D', 'A', 'Bm', 'G', 'D', 'G', 'Em', 'A'];
const A_MEL: Note[][] = [
  [[0, 62, 1.5], [1.5, 66, 0.5], [2, 69, 2]],
  [[0, 73, 1.5], [1.5, 71, 0.5], [2, 69, 1], [3, 66, 1]],
  [[0, 71, 1.5], [1.5, 73, 0.5], [2, 74, 1.5], [3.5, 73, 0.5]],
  [[0, 71, 3], [3, 67, 1]],
  [[0, 69, 1.5], [1.5, 74, 0.5], [2, 78, 2]],
  [[0, 76, 1], [1, 74, 1], [2, 71, 1], [3, 74, 1]],
  [[0, 76, 1.5], [1.5, 74, 0.5], [2, 73, 1], [3, 71, 1]],
  [[0, 69, 4]],
];
const B_CH = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A'];
const B_MEL: Note[][] = [
  [[0, 74, 2], [2, 73, 1], [3, 71, 1]],
  [[0, 67, 2], [2, 71, 2]],
  [[0, 69, 3], [3, 66, 1]],
  [[0, 64, 2], [2, 69, 2]],
  [[0, 74, 2], [2, 76, 1], [3, 78, 1]],
  [[0, 79, 3], [3, 78, 1]],
  [[0, 76, 2], [2, 74, 1], [3, 73, 1]],
  [[0, 73, 2], [2, 76, 2]],
];
const A2_CH = [...A_CH.slice(0, 7), 'D'];
const A2_MEL: Note[][] = [...A_MEL.slice(0, 7), [[0, 74, 4]]];

type Kind = 'intro' | 'A' | 'B' | 'A2';
interface Section {
  kind: Kind;
  chords: string[];
  melody: Note[][] | null;
}
const SONG: Section[] = [
  { kind: 'intro', chords: A_CH, melody: null },
  { kind: 'A', chords: A_CH, melody: A_MEL },
  { kind: 'B', chords: B_CH, melody: B_MEL },
  { kind: 'A2', chords: A2_CH, melody: A2_MEL },
];
const LOOP_FROM = 1; // the intro plays once

// ---- arrangement per age --------------------------------------------------------------------------------------------
type Lead = 'horn' | 'brass' | 'synth';
type Ost = 'pluck' | 'strings' | 'harpsi' | 'strings16' | 'arp';
type Perc = 'tribal' | 'timpani' | 'march' | 'military' | 'electro';
const FLAVOR: { lead: Lead; ost: Ost; perc: Perc }[] = [
  { lead: 'horn', ost: 'pluck', perc: 'tribal' },
  { lead: 'brass', ost: 'strings', perc: 'timpani' },
  { lead: 'brass', ost: 'harpsi', perc: 'march' },
  { lead: 'brass', ost: 'strings16', perc: 'military' },
  { lead: 'synth', ost: 'arp', perc: 'electro' },
];

// ---- synth voices ---------------------------------------------------------------------------------------------------
interface Voice {
  type: OscillatorType;
  freq: number;
  t: number;
  dur: number;
  vol: number;
  attack?: number;
  release?: number;
  detunes?: number[];
  cutoff?: number;
  swell?: boolean; // filter opens with the note (brass)
  vibrato?: number; // cents
}

function voice(c: AudioContext, out: AudioNode, v: Voice): void {
  const attack = v.attack ?? 0.01;
  const release = v.release ?? 0.08;
  const end = v.t + v.dur;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  const cut = v.cutoff ?? 4000;
  if (v.swell) {
    f.frequency.setValueAtTime(cut * 0.35, v.t);
    f.frequency.linearRampToValueAtTime(cut, v.t + attack + 0.06);
    f.frequency.linearRampToValueAtTime(cut * 0.6, end);
  } else f.frequency.setValueAtTime(cut, v.t);
  const g = c.createGain();
  g.gain.setValueAtTime(0, v.t);
  g.gain.linearRampToValueAtTime(v.vol, v.t + attack);
  g.gain.linearRampToValueAtTime(v.vol * 0.8, Math.max(v.t + attack, end));
  g.gain.exponentialRampToValueAtTime(0.0001, end + release);
  f.connect(g).connect(out);
  let lfo: OscillatorNode | undefined;
  let lfoGain: GainNode | undefined;
  if (v.vibrato) {
    lfo = c.createOscillator();
    lfo.frequency.value = 5.2;
    lfoGain = c.createGain();
    lfoGain.gain.value = v.vibrato;
    lfo.connect(lfoGain);
    lfo.start(v.t);
    lfo.stop(end + release + 0.05);
  }
  for (const d of v.detunes ?? [0]) {
    const o = c.createOscillator();
    o.type = v.type;
    o.frequency.setValueAtTime(v.freq, v.t);
    o.detune.setValueAtTime(d, v.t);
    if (lfoGain) lfoGain.connect(o.detune);
    o.connect(f);
    o.start(v.t);
    o.stop(end + release + 0.05);
  }
}

function noise(c: AudioContext, out: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.7): void {
  const buf = sfx.noiseBuffer;
  if (!buf) return;
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, (t * 7.31) % 0.5);
  s.stop(t + dur + 0.02);
}

function drop(c: AudioContext, out: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const kick = (c: AudioContext, o: AudioNode, t: number, v = 0.5) => drop(c, o, t, 130, 42, 0.28, v);
const snare = (c: AudioContext, o: AudioNode, t: number, v = 0.22) => (noise(c, o, t, 0.14, v, 'highpass', 1500), drop(c, o, t, 220, 160, 0.06, v * 0.5));
const hat = (c: AudioContext, o: AudioNode, t: number, v = 0.06) => noise(c, o, t, 0.04, v, 'highpass', 8000);
const crash = (c: AudioContext, o: AudioNode, t: number, v = 0.12) => noise(c, o, t, 1.6, v, 'highpass', 5000);
const tom = (c: AudioContext, o: AudioNode, t: number, f: number, v = 0.35) => drop(c, o, t, f, f * 0.6, 0.3, v);
function timpani(c: AudioContext, o: AudioNode, t: number, midi: number, v = 0.4): void {
  const f = mtof(midi);
  drop(c, o, t, f * 1.03, f, 0.9, v);
  noise(c, o, t, 0.12, v * 0.4, 'lowpass', 300);
}

// ---- sequencer ------------------------------------------------------------------------------------------------------
class MusicPlayer {
  private timer = 0;
  private bus?: GainNode;
  private nextBar = 0;
  private sec = 0;
  private bar = 0;
  private ageOf: () => number = () => 1;

  /** Starts (or keeps) the soundtrack. `ageOf` picks the arrangement at every bar. Waits silently for audio unlock. */
  play(ageOf: () => number): void {
    this.ageOf = ageOf;
    if (!this.timer) this.timer = window.setInterval(() => this.tick(), 100);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = 0;
    const c = sfx.context;
    if (this.bus && c) {
      const b = this.bus;
      b.gain.setTargetAtTime(0, c.currentTime, 0.3);
      setTimeout(() => b.disconnect(), 2000);
    }
    this.bus = undefined;
  }

  private tick(): void {
    const c = sfx.context;
    const out = sfx.musicOut;
    if (!c || !out) return;
    if (!this.bus) {
      this.bus = c.createGain();
      this.bus.connect(out);
      this.nextBar = c.currentTime + 0.1;
      this.sec = 0;
      this.bar = 0;
    }
    if (this.nextBar < c.currentTime) this.nextBar = c.currentTime + 0.05; // tab was throttled: resync
    while (this.nextBar < c.currentTime + 1.2) {
      this.scheduleBar(c, this.bus, this.nextBar);
      this.nextBar += BAR;
      if (++this.bar >= 8) {
        this.bar = 0;
        this.sec = this.sec + 1 >= SONG.length ? LOOP_FROM : this.sec + 1;
      }
    }
  }

  private scheduleBar(c: AudioContext, out: AudioNode, t0: number): void {
    const age = Math.max(0, Math.min(FLAVOR.length - 1, this.ageOf()));
    const fl = FLAVOR[age];
    const sec = SONG[this.sec];
    const bar = this.bar;
    const chord = CH[sec.chords[bar]];
    const root = chord[0];
    const at = (beat: number) => t0 + beat * BEAT;
    const intro = sec.kind === 'intro';
    const swell = intro ? 0.35 + (0.65 * bar) / 7 : 1; // intro crescendo
    const full = sec.kind === 'A2';

    // pad (sustained chord)
    for (const n of chord) {
      if (fl.lead === 'synth') voice(c, out, { type: 'triangle', freq: mtof(n + 12), t: t0, dur: BAR, vol: 0.03 * swell, attack: 0.3, release: 0.4, detunes: [-8, 8], cutoff: 1200 });
      else voice(c, out, { type: 'sawtooth', freq: mtof(n + 12), t: t0, dur: BAR, vol: 0.018 * swell, attack: 0.4, release: 0.5, detunes: [-10, 0, 10], cutoff: 1300 });
    }

    // bass
    if (fl.lead === 'synth') {
      for (let b = 0; b < 8; b++) voice(c, out, { type: 'sawtooth', freq: mtof(root - 12), t: at(b * 0.5), dur: BEAT * 0.4, vol: 0.09 * swell, cutoff: 420 });
    } else {
      for (const b of [0, 2]) voice(c, out, { type: 'triangle', freq: mtof(root - 12), t: at(b), dur: BEAT * 1.8, vol: 0.16 * swell, attack: 0.02, release: 0.15 });
    }

    // ostinato
    const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12];
    const sixteenths = fl.ost === 'strings16' || fl.ost === 'arp';
    const steps = sixteenths ? 16 : 8;
    for (let i = 0; i < steps; i++) {
      const beat = (i * 4) / steps;
      const n = fl.ost === 'arp' ? chord[i % 3] + 24 + (i % 6 >= 3 ? 12 : 0) : tones[i % 4];
      const v = (fl.ost === 'pluck' ? 0.07 : 0.03) * (intro ? swell : 0.8);
      const dur = BEAT * (sixteenths ? 0.2 : fl.ost === 'pluck' ? 0.25 : 0.4);
      const type: OscillatorType = fl.ost === 'pluck' ? 'triangle' : fl.ost === 'harpsi' || fl.ost === 'arp' ? 'square' : 'sawtooth';
      voice(c, out, { type, freq: mtof(n), t: at(beat), dur, vol: fl.ost === 'harpsi' || fl.ost === 'arp' ? v * 0.7 : v, release: fl.ost === 'pluck' ? 0.12 : 0.05, cutoff: fl.ost === 'arp' ? 2600 : 1800 });
    }

    // melody
    if (sec.melody) {
      for (const [beat, midi, beats] of sec.melody[bar]) {
        const t = at(beat);
        const dur = beats * BEAT * 0.95;
        const b = sec.kind === 'B';
        if (fl.lead === 'horn') voice(c, out, { type: 'triangle', freq: mtof(midi), t, dur, vol: 0.13, attack: 0.06, release: 0.15, detunes: [0, 6], cutoff: 2200, vibrato: 12 });
        else if (fl.lead === 'synth') {
          voice(c, out, { type: 'square', freq: mtof(midi), t, dur, vol: b ? 0.035 : 0.045, attack: b ? 0.08 : 0.01, release: 0.1, detunes: [-8, 8], cutoff: 2800, vibrato: b ? 10 : 0 });
          voice(c, out, { type: 'square', freq: mtof(midi), t: t + BEAT * 0.75, dur, vol: 0.012, release: 0.1, cutoff: 1800 }); // echo
        } else if (b) voice(c, out, { type: 'sawtooth', freq: mtof(midi), t, dur, vol: 0.05, attack: 0.15, release: 0.25, detunes: [-7, 7], cutoff: 1900, vibrato: 10 });
        else voice(c, out, { type: 'sawtooth', freq: mtof(midi), t, dur, vol: 0.07, attack: 0.05, release: 0.12, detunes: [-6, 6], cutoff: 2300, swell: true });
        if (full) voice(c, out, { type: fl.lead === 'synth' ? 'square' : 'sawtooth', freq: mtof(midi - 12), t, dur, vol: 0.035, attack: 0.05, release: 0.12, cutoff: 1400 });
      }
    }

    // percussion
    const last = bar === 7;
    if (bar === 0 && !intro) crash(c, out, t0);
    if (intro) {
      if (fl.perc === 'tribal') tom(c, out, t0, 110, 0.25 * swell);
      else if (fl.perc === 'electro') kick(c, out, t0, 0.3 * swell);
      else timpani(c, out, t0, root - 12, 0.3 * swell);
    } else {
      const light = sec.kind === 'B';
      switch (fl.perc) {
        case 'tribal':
          kick(c, out, at(0), 0.4);
          kick(c, out, at(2), 0.35);
          for (const [b, f] of [[1.5, 160], [2.5, 130], [3, 190], [3.5, 150]] as const) if (!light || b === 3) tom(c, out, at(b), f, 0.25);
          break;
        case 'timpani':
          timpani(c, out, at(0), root - 12, 0.45);
          timpani(c, out, at(2), root - 5, 0.3);
          if (!light) for (const b of [1, 3]) snare(c, out, at(b), 0.12);
          break;
        case 'march':
          kick(c, out, at(0), 0.45);
          kick(c, out, at(2), 0.4);
          if (!light) {
            for (const b of [1, 3]) snare(c, out, at(b), 0.18);
            snare(c, out, at(3.75), 0.08);
          }
          break;
        case 'military':
          kick(c, out, at(0), 0.5);
          kick(c, out, at(2), 0.45);
          for (const b of [1, 3]) snare(c, out, at(b), light ? 0.12 : 0.2);
          if (!light) for (let s = 0; s < 16; s++) if (s % 4 !== 0) snare(c, out, at(s / 4), 0.035);
          break;
        case 'electro':
          for (let b = 0; b < 4; b++) kick(c, out, at(b), light && b % 2 ? 0 : 0.5);
          for (const b of [1, 3]) snare(c, out, at(b), 0.16);
          for (let b = 0; b < 4; b++) hat(c, out, at(b + 0.5));
          break;
      }
    }
    // fill into the next section
    if (last) {
      for (let s = 8; s < 16; s++) {
        const v = 0.05 + (0.15 * (s - 8)) / 8;
        if (fl.perc === 'tribal') tom(c, out, at(s / 4), 120 + (s % 2) * 40, v * 1.6);
        else snare(c, out, at(s / 4), v);
      }
    }
  }
}

export const music = new MusicPlayer();
