/**
 * Timer that keeps firing at full rate even when the browser tab is in the background (setInterval is throttled to 1 Hz
 * there, which would freeze a hosted match). Web Workers are not throttled. Falls back to setInterval.
 */
export function startTicker(fn: () => void, ms: number): () => void {
  try {
    const src = `setInterval(() => postMessage(0), ${ms});`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = fn;
    return () => {
      w.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}
