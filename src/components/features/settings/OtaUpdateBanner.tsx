import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { ICON_SIZE } from '@/constants/ui';
import { useOtaUpdate } from '@/hooks/useOtaUpdate';

/**
 * Shown on the welcome (pre-auth) and profile screens when a newer OTA
 * bundle is ready. Applying restarts the app, so this always confirms first
 * — the user could be mid Safe Journey/SOS elsewhere in the app.
 */
export function OtaUpdateBanner(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { isUpdateAvailable, isApplying, applyNow } = useOtaUpdate();

  if (!isUpdateAvailable) return null;

  function handlePress(): void {
    Alert.alert(t('ota.confirmTitle'), t('ota.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ota.confirmAction'),
        onPress: (): void => {
          applyNow().catch((error: unknown) => {
            captureException(error);
            Alert.alert(t('ota.applyFailed'));
          });
        },
      },
    ]);
  }

  return (
    <Card padding="md" className="mb-4 flex-row items-center gap-3 bg-shakti-purple/10">
      <MaterialIcons name="system-update" size={ICON_SIZE.ROW} color={COLORS.SHAKTI_PURPLE} />
      <View className="flex-1">
        <Text variant="body" tKey="ota.available" />
      </View>
      <Button
        variant="secondary"
        size="sm"
        label={t(isApplying ? 'ota.applying' : 'ota.applyButton')}
        loading={isApplying}
        disabled={isApplying}
        onPress={handlePress}
      />
    </Card>
  );
}
