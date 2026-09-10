/**
 * Dev-only diagnostic logging. Routes through `console.warn` (the only console
 * method the lint config permits) and is a no-op in release builds, so it is
 * safe to leave call sites in place while chasing a device-only issue.
 */
export function debugLog(tag: string, ...args: unknown[]): void {
  if (!__DEV__) return;
  console.warn(`[${tag}]`, ...args);
}
