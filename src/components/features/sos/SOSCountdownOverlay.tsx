import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';

export interface SOSCountdownOverlayProps {
  countdown: number;
  onCancel: () => void;
}

/**
 * Full-bleed overlay shown while the SOS countdown runs. Tapping anywhere on
 * the Cancel control aborts the alert before it fans out.
 */
export function SOSCountdownOverlay({
  countdown,
  onCancel,
}: SOSCountdownOverlayProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View className="absolute inset-0 items-center justify-center bg-near-black/90 px-8">
      <Text variant="h1" className="text-6xl text-white">
        {String(countdown)}
      </Text>
      <Text
        variant="body"
        tKey="home.sosCountdown"
        tOptions={{ count: countdown }}
        className="mt-3 text-center text-white"
      />
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('home.sosCancel')}
        className="mt-8 rounded-full bg-white px-8 py-4"
      >
        <Text variant="h3" className="text-error-red">
          {t('home.sosCancel')}
        </Text>
      </Pressable>
    </View>
  );
}
