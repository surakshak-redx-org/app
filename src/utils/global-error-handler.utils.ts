/**
 * React Native polyfills a global `ErrorUtils` object (not exported by any
 * package as a value, only as a Flow/TS type), so it's read off `globalThis`
 * with a narrow, explicit shape instead of `any` or a `declare global`.
 */
type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface GlobalErrorUtils {
  getGlobalHandler: () => ErrorHandler;
  setGlobalHandler: (handler: ErrorHandler) => void;
}

function readErrorUtils(): GlobalErrorUtils | undefined {
  return (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
}

/**
 * Installs a handler that reports every otherwise-unhandled JS error to
 * Sentry before falling through to whatever handler was already installed
 * (React Native's own red-box/dev handler, or the release-mode default).
 * @returns a function that restores the previous handler; `undefined` if
 * `ErrorUtils` isn't available (e.g. under Jest).
 */
export function installGlobalErrorHandler(
  onError: (error: unknown) => void,
): (() => void) | undefined {
  const errorUtils = readErrorUtils();
  if (errorUtils === undefined) return undefined;

  const originalHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    onError(error);
    originalHandler(error, isFatal);
  });

  return (): void => errorUtils.setGlobalHandler(originalHandler);
}
