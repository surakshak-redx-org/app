import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { formatClockTime, formatDuration } from '@/utils/date.utils';

export interface TimeAdjusterProps {
  valueMinutes: number;
  onChange: (newMinutes: number) => void;
  minMinutes?: number;
  maxMinutes?: number;
  stepChips?: number[];
  showClockTime?: boolean;
  className?: string;
  testID?: string;
}

const DEFAULT_MIN_MINUTES = 5;
const DEFAULT_MAX_MINUTES = 720;
const DEFAULT_STEP_CHIPS = [-15, -5, 5, 15, 30];
const MS_PER_MINUTE = 60_000;

export function TimeAdjuster({
  valueMinutes,
  onChange,
  minMinutes = DEFAULT_MIN_MINUTES,
  maxMinutes = DEFAULT_MAX_MINUTES,
  stepChips = DEFAULT_STEP_CHIPS,
  showClockTime = true,
  className = '',
  testID = 'time-adjuster',
}: TimeAdjusterProps): React.JSX.Element {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!showClockTime) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return (): void => clearInterval(interval);
  }, [showClockTime]);

  const expectedArrival = formatClockTime(new Date(now + valueMinutes * MS_PER_MINUTE));

  const handleStep = (step: number): void => {
    const clamped = Math.min(maxMinutes, Math.max(minMinutes, valueMinutes + step));
    onChange(clamped);
  };

  return (
    <View
      testID={testID}
      className={`rounded-xl border border-stone/20 bg-card-bg p-3 ${className}`}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text variant="caption" className="text-stone">
            {t('location.duration', { defaultValue: 'Duration' })}
          </Text>
          <Text variant="h2" testID={`${testID}-value`} className="font-bold text-near-black">
            {formatDuration(valueMinutes)}
          </Text>
        </View>

        {showClockTime && (
          <View className="items-end">
            <Text variant="caption" className="text-stone">
              {t('location.expectedArrival', { defaultValue: 'Expected Arrival' })}
            </Text>
            <Text
              variant="body"
              testID={`${testID}-clock`}
              className="font-semibold text-shakti-purple"
            >
              ~ {expectedArrival}
            </Text>
          </View>
        )}
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {stepChips.map((step) => {
          const targetValue = valueMinutes + step;
          const isDisabled =
            (step > 0 && valueMinutes >= maxMinutes) ||
            (step < 0 && valueMinutes <= minMinutes) ||
            (step > 0 && targetValue > maxMinutes && valueMinutes >= maxMinutes) ||
            (step < 0 && targetValue < minMinutes && valueMinutes <= minMinutes);

          const sign = step > 0 ? `+${step}` : `${step}`;
          const chipLabel = `${sign}m`;

          return (
            <Pressable
              key={step}
              testID={`${testID}-chip-${step}`}
              onPress={() => !isDisabled && handleStep(step)}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={`${sign} minutes`}
              accessibilityState={{ disabled: isDisabled }}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              className={`min-h-[38px] min-w-[54px] items-center justify-center rounded-lg border px-2.5 py-1.5 ${
                isDisabled
                  ? 'border-stone/20 bg-stone/5 opacity-40'
                  : 'border-shakti-purple/30 bg-shakti-purple/10 active:bg-shakti-purple/20'
              }`}
            >
              <Text
                variant="caption"
                className={`font-semibold ${isDisabled ? 'text-stone' : 'text-shakti-purple'}`}
              >
                {chipLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
