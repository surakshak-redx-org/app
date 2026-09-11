export type CalculatorOperation = '+' | '-' | '×' | '÷';

export interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: CalculatorOperation | null;
  shouldResetDisplay: boolean;
}

const PERCENT_DIVISOR = 100;

export function initialCalculatorState(): CalculatorState {
  return { display: '0', previousValue: null, operation: null, shouldResetDisplay: false };
}

function applyOperation(a: number, b: number, operation: CalculatorOperation): number {
  switch (operation) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

/** Formats a computed value back into the display's string form, trimming float noise. */
function formatResult(value: number): string {
  if (Number.isNaN(value)) return 'Error';
  return Number(value.toFixed(10)).toString();
}

export function inputDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.shouldResetDisplay || state.display === '0') {
    return { ...state, display: digit, shouldResetDisplay: false };
  }
  return { ...state, display: state.display + digit };
}

export function inputDecimal(state: CalculatorState): CalculatorState {
  if (state.shouldResetDisplay) return { ...state, display: '0.', shouldResetDisplay: false };
  if (state.display.includes('.')) return state;
  return { ...state, display: `${state.display}.` };
}

export function clearCalculator(): CalculatorState {
  return initialCalculatorState();
}

export function toggleSign(state: CalculatorState): CalculatorState {
  const value = Number(state.display);
  return { ...state, display: formatResult(value * -1) };
}

export function applyPercent(state: CalculatorState): CalculatorState {
  const value = Number(state.display);
  return { ...state, display: formatResult(value / PERCENT_DIVISOR) };
}

export function inputOperation(
  state: CalculatorState,
  operation: CalculatorOperation,
): CalculatorState {
  const current = Number(state.display);

  if (state.previousValue === null) {
    return { display: state.display, previousValue: current, operation, shouldResetDisplay: true };
  }

  if (state.shouldResetDisplay) {
    return { ...state, operation };
  }

  const result = applyOperation(state.previousValue, current, state.operation ?? operation);
  return {
    display: formatResult(result),
    previousValue: result,
    operation,
    shouldResetDisplay: true,
  };
}

export function calculateResult(state: CalculatorState): CalculatorState {
  if (state.operation === null || state.previousValue === null) return state;

  const current = Number(state.display);
  const result = applyOperation(state.previousValue, current, state.operation);
  return {
    display: formatResult(result),
    previousValue: null,
    operation: null,
    shouldResetDisplay: true,
  };
}
