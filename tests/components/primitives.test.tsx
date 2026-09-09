import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';

describe('Avatar', () => {
  it('shows the first letter of the name when there is no photo', async () => {
    const { getByText } = await render(<Avatar name="priya" />);
    expect(getByText('P')).toBeTruthy();
  });

  it('falls back to a placeholder when there is neither photo nor name', async () => {
    const { getByText } = await render(<Avatar />);
    expect(getByText('?')).toBeTruthy();
  });

  it('renders the image and no initial when a uri is given', async () => {
    const { queryByText } = await render(<Avatar uri="https://example.com/p.jpg" name="Priya" />);
    expect(queryByText('P')).toBeNull();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders the %s size', async (size) => {
    const { getByText } = await render(<Avatar name="Asha" size={size} />);
    expect(getByText('A')).toBeTruthy();
  });
});

describe('Badge', () => {
  it.each(['success', 'warning', 'error', 'info', 'default'] as const)(
    'renders the %s variant',
    async (variant) => {
      const { getByText } = await render(<Badge label="Verified" variant={variant} />);
      expect(getByText('Verified')).toBeTruthy();
    },
  );
});

describe('Card', () => {
  it.each(['sm', 'md', 'lg'] as const)('renders children at %s padding', async (padding) => {
    const { getByText } = await render(
      <Card padding={padding}>
        <Text variant="body">Inside</Text>
      </Card>,
    );
    expect(getByText('Inside')).toBeTruthy();
  });

  it('accepts extra classes', async () => {
    const { getByText } = await render(
      <Card className="mt-4">
        <Text variant="body">Inside</Text>
      </Card>,
    );
    expect(getByText('Inside')).toBeTruthy();
  });
});

describe('Spinner', () => {
  it.each(['sm', 'md', 'lg'] as const)('renders the %s size', async (size) => {
    const { toJSON } = await render(<Spinner size={size} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SafeScreen', () => {
  it('renders children', async () => {
    const { getByText } = await render(
      <SafeScreen>
        <Text variant="body">Body</Text>
      </SafeScreen>,
    );
    expect(getByText('Body')).toBeTruthy();
  });

  it('renders children inside a scroll view when scrollable', async () => {
    const { getByText } = await render(
      <SafeScreen scrollable className="pt-2">
        <Text variant="body">Body</Text>
      </SafeScreen>,
    );
    expect(getByText('Body')).toBeTruthy();
  });
});

describe('Input', () => {
  it('renders its label and reports typing', async () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = await render(
      <Input label="Phone Number" onChangeText={onChangeText} />,
    );

    await fireEvent.changeText(getByLabelText('Phone Number'), '9876543210');
    expect(onChangeText).toHaveBeenCalledWith('9876543210');
  });

  it('shows helper text when there is no error', async () => {
    const { getByText } = await render(<Input label="City" helper="Where you live" />);
    expect(getByText('Where you live')).toBeTruthy();
  });

  it('shows the error instead of the helper', async () => {
    const { getByText, queryByText } = await render(
      <Input label="City" helper="Where you live" error="City is required" />,
    );
    expect(getByText('City is required')).toBeTruthy();
    expect(queryByText('Where you live')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('renders title and subtitle', async () => {
    const { getByText } = await render(
      <EmptyState icon="people" title="No posts yet" subtitle="Be the first" />,
    );
    expect(getByText('No posts yet')).toBeTruthy();
    expect(getByText('Be the first')).toBeTruthy();
  });

  it('renders and fires the optional action', async () => {
    const onAction = jest.fn();
    const { getByText } = await render(
      <EmptyState icon="add" title="Nothing here" actionLabel="Add one" onAction={onAction} />,
    );

    await fireEvent.press(getByText('Add one'));
    expect(onAction).toHaveBeenCalled();
  });

  it('omits the action when only a label is given', async () => {
    const { queryByText } = await render(
      <EmptyState icon="add" title="Nothing here" actionLabel="Add one" />,
    );
    expect(queryByText('Add one')).toBeNull();
  });
});
