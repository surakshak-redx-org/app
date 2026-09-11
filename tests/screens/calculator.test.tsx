import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import CalculatorScreen from '@app/(disguise)/calculator';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Identity "hash" — deterministic and easy to assert against in tests. The
// real digest algorithm is exercised separately in `pin.utils.test.ts`-style
// unit coverage if ever added; this test only needs *some* stable mapping.
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn((_algorithm: string, data: string) => Promise.resolve(`hash:${data}`)),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

async function pressKeys(
  getByLabelText: (label: string) => unknown,
  labels: string[],
): Promise<void> {
  for (const label of labels) {
    await fireEvent.press(getByLabelText(label) as never);
  }
}

describe('CalculatorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it('renders all 19 calculator buttons', async () => {
    const { getByLabelText } = await render(<CalculatorScreen />);

    const labels = [
      'C',
      '±',
      '%',
      '÷',
      '7',
      '8',
      '9',
      '×',
      '4',
      '5',
      '6',
      '-',
      '1',
      '2',
      '3',
      '+',
      '0',
      '.',
      '=',
    ];
    for (const label of labels) {
      expect(getByLabelText(label)).toBeTruthy();
    }
  });

  it('adds two numbers: 2 + 3 = 5', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['2', '+', '3', '=']);
    expect(getByTestId('calculator-display').props.children).toBe('5');
  });

  it('subtracts two numbers: 9 - 4 = 5', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['9', '-', '4', '=']);
    expect(getByTestId('calculator-display').props.children).toBe('5');
  });

  it('multiplies two numbers: 3 × 4 = 12', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['3', '×', '4', '=']);
    expect(getByTestId('calculator-display').props.children).toBe('12');
  });

  it('divides two numbers: 10 ÷ 2 = 5', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['1', '0', '÷', '2', '=']);
    expect(getByTestId('calculator-display').props.children).toBe('5');
  });

  it('clear resets the display to 0', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['7', '7', 'C']);
    expect(getByTestId('calculator-display').props.children).toBe('0');
  });

  it('negates the current value with ±', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['5', '±']);
    expect(getByTestId('calculator-display').props.children).toBe('-5');
  });

  it('converts the current value to a percentage', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['5', '0', '%']);
    expect(getByTestId('calculator-display').props.children).toBe('0.5');
  });

  it('supports a decimal point', async () => {
    const { getByLabelText, getByTestId } = await render(<CalculatorScreen />);
    await pressKeys(getByLabelText, ['1', '.', '5', '+', '1', '=']);
    expect(getByTestId('calculator-display').props.children).toBe('2.5');
  });

  it('unlocks and navigates home when 4 digits then "=" match the stored PIN', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('hash:1234');
    const { getByLabelText } = await render(<CalculatorScreen />);

    await pressKeys(getByLabelText, ['1', '2', '3', '4', '=']);
    // Flush the async PIN-check microtask chain triggered by "=".
    await Promise.resolve();
    await Promise.resolve();

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
  });

  it('does not navigate when the PIN is wrong — "=" just evaluates as arithmetic', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('hash:9999');
    const { getByLabelText } = await render(<CalculatorScreen />);

    await pressKeys(getByLabelText, ['1', '2', '3', '4', '=']);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
