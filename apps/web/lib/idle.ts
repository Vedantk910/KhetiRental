/** Runs `fn` when the browser is idle (a short timer where requestIdleCallback is missing). Returns a canceller. */
export function whenIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn, { timeout: 2000 });
    return () => {
      cancelIdleCallback(id);
    };
  }
  const id = setTimeout(fn, 200);
  return () => {
    clearTimeout(id);
  };
}
