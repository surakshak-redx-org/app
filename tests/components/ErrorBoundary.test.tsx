import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';

jest.mock('@/config/sentry', () => ({ captureException: jest.fn() }));

function Boom(): React.JSX.Element {
  throw new Error('render exploded');
}

describe('ErrorBoundary', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React logs the caught error itself; keep the expected noise out of output.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(captureException).mockClear();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders children when nothing throws', async () => {
    const { getByText } = await render(
      <ErrorBoundary>
        <Text variant="body">All good</Text>
      </ErrorBoundary>,
    );
    expect(getByText('All good')).toBeTruthy();
  });

  it('shows the fallback and reports to Sentry when a child throws', async () => {
    const { getByText } = await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('offers a retry control on the fallback', async () => {
    const { getByText } = await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    // Pressing retry must not throw — it clears the error state so a
    // subsequent successful render can replace the fallback.
    expect(() => fireEvent.press(getByText('Try again'))).not.toThrow();
  });
});
