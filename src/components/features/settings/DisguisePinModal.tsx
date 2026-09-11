import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';

import { PinInput } from '@/components/features/settings/PinInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { STORAGE_KEYS } from '@/constants/storage';
import { hashPin } from '@/utils/pin.utils';

export type DisguisePinModalMode = 'enable' | 'disable' | 'change';

export interface DisguisePinModalProps {
  visible: boolean;
  mode: DisguisePinModalMode;
  /** For `enable`/`change`, the new PIN's hash. For `disable`, `null`. */
  onSuccess: (newPinHash: string | null) => void;
  onCancel: () => void;
}

type Step = 'first' | 'confirm' | 'verify';

/**
 * Handles the two PIN flows Disguise Mode needs: setting a new PIN (enter
 * twice, must match) and confirming the existing one before disabling it.
 */
export function DisguisePinModal({
  visible,
  mode,
  onSuccess,
  onCancel,
}: DisguisePinModalProps): React.JSX.Element {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>(mode === 'disable' ? 'verify' : 'first');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  function reset(): void {
    setStep(mode === 'disable' ? 'verify' : 'first');
    setFirstPin('');
    setError(null);
    setResetKey((current) => current + 1);
  }

  function handleCancel(): void {
    reset();
    onCancel();
  }

  async function handleComplete(pin: string): Promise<void> {
    setError(null);

    if (mode === 'disable') {
      const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.DISGUISE_PIN_HASH);
      const candidateHash = await hashPin(pin);
      if (storedHash !== null && storedHash === candidateHash) {
        reset();
        onSuccess(null);
      } else {
        setError(t('settings.pinMismatch'));
        setResetKey((current) => current + 1);
      }
      return;
    }

    if (step === 'first') {
      setFirstPin(pin);
      setStep('confirm');
      setResetKey((current) => current + 1);
      return;
    }

    if (pin === firstPin) {
      const newHash = await hashPin(pin);
      reset();
      onSuccess(newHash);
    } else {
      setError(t('settings.pinMismatch'));
      setStep('first');
      setFirstPin('');
      setResetKey((current) => current + 1);
    }
  }

  const promptKey =
    step === 'verify'
      ? 'settings.enterCurrentPin'
      : step === 'first'
        ? 'settings.enterPin'
        : 'settings.confirmPin';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View className="flex-1 items-center justify-center bg-near-black/60 px-6">
        <Card padding="lg" className="w-full">
          <Text variant="h3" tKey={promptKey} className="mb-4 text-center" />

          <PinInput key={resetKey} onComplete={(pin) => void handleComplete(pin)} />

          {error !== null && (
            <Text variant="caption" className="mt-3 text-center text-error-red">
              {error}
            </Text>
          )}

          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="mt-6"
            label={t('common.cancel')}
            onPress={handleCancel}
          />
        </Card>
      </View>
    </Modal>
  );
}
