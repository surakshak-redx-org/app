import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import FaqsScreen from '@app/faqs';

const mockGetFaqs = jest.fn();
const mockGetFaqCategories = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/services/firebase/laws.service', () => ({
  getFaqs: (...args: unknown[]) => mockGetFaqs(...args),
  getFaqCategories: (...args: unknown[]) => mockGetFaqCategories(...args),
}));

const FAQS = [
  {
    id: 'faq_1',
    question: 'What is the Women Helpline number?',
    answer: 'The national Women Helpline number is 1091.',
    category: 'Emergency',
    order: 1,
    isPublished: true,
  },
];

describe('FaqsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFaqs.mockResolvedValue(FAQS);
    mockGetFaqCategories.mockResolvedValue(['Emergency']);
  });

  it('renders questions with the answer collapsed by default', async () => {
    const { getByText, queryByText } = await render(<FaqsScreen />);
    expect(getByText('What is the Women Helpline number?')).toBeTruthy();
    expect(queryByText('The national Women Helpline number is 1091.')).toBeNull();
  });

  it('expands the answer when the question is pressed', async () => {
    const { getByText } = await render(<FaqsScreen />);
    await fireEvent.press(getByText('What is the Women Helpline number?'));
    expect(getByText('The national Women Helpline number is 1091.')).toBeTruthy();
  });
});
