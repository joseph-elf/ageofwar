import { AGE_GAP } from './tuning';

/** Compresses the distance between `raw` and the Stone-Age reference `ref` according to AGE_GAP (see tuning.ts). */
export const gap = (raw: number, ref: number): number => (ref > 0 && raw > 0 ? ref * Math.pow(raw / ref, AGE_GAP) : raw);
export const int = (n: number): number => Math.max(1, Math.round(n));
