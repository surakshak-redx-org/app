import { installGlobalErrorHandler } from '@/utils/global-error-handler.utils';

describe('installGlobalErrorHandler', () => {
  const originalHandler = jest.fn();
  const mockErrorUtils = {
    getGlobalHandler: jest.fn(() => originalHandler),
    setGlobalHandler: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = mockErrorUtils;
  });

  afterEach(() => {
    delete (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
  });

  it('wraps the existing handler, calling the new one first then the original', () => {
    const onError = jest.fn();
    installGlobalErrorHandler(onError);

    const installed = mockErrorUtils.setGlobalHandler.mock.calls[0]?.[0] as (
      error: unknown,
      isFatal?: boolean,
    ) => void;
    const error = new Error('boom');
    installed(error, true);

    expect(onError).toHaveBeenCalledWith(error);
    expect(originalHandler).toHaveBeenCalledWith(error, true);
  });

  it('returns a restore function that reinstates the original handler', () => {
    const restore = installGlobalErrorHandler(jest.fn());
    restore?.();

    expect(mockErrorUtils.setGlobalHandler).toHaveBeenLastCalledWith(originalHandler);
  });

  it('returns undefined when ErrorUtils is unavailable', () => {
    delete (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
    expect(installGlobalErrorHandler(jest.fn())).toBeUndefined();
  });
});
