import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { FakeCallScheduler } from '@/components/features/emergency/FakeCallScheduler';
import { IncomingCallOverlay } from '@/components/features/emergency/IncomingCallOverlay';
import { QuickActionCard } from '@/components/features/emergency/QuickActionCard';
import { SOSButton } from '@/components/features/sos/SOSButton';
import { SOSCountdownOverlay } from '@/components/features/sos/SOSCountdownOverlay';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { PREDEFINED_EMERGENCY_NUMBERS } from '@/constants/emergency-numbers';
import { ROUTES } from '@/constants/routes';
import { STORAGE_FLAG_OFF, STORAGE_KEYS } from '@/constants/storage';
import { useBatteryAlert } from '@/hooks/useBatteryAlert';
import { useFakeCall } from '@/hooks/useFakeCall';
import { useShakeDetection } from '@/hooks/useShakeDetection';
import { useSiren } from '@/hooks/useSiren';
import { useSOS } from '@/hooks/useSOS';
import { trackEmergencyCallPlaced } from '@/services/analytics.service';
import { useLocationStore } from '@/stores/location.store';
import { useUserStore } from '@/stores/user.store';
import { placeCall } from '@/utils/phone.utils';

export default function HomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const { isActive, countdown, handleTap, trigger, cancel } = useSOS();
  const siren = useSiren();
  const fakeCall = useFakeCall();
  useBatteryAlert();

  const contactCount = useUserStore((state) => state.emergencyContacts.length);
  const isLiveLocationActive = useLocationStore((state) => state.isLiveLocationActive);
  const isSafeJourneyActive = useLocationStore((state) => state.isSafeJourneyActive);

  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [fakeCallModalVisible, setFakeCallModalVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.SHAKE_ENABLED)
      .then((value) => setShakeEnabled(value !== STORAGE_FLAG_OFF))
      .catch((error: unknown) => captureException(error));
  }, []);

  const handleShake = useCallback((): void => {
    trigger('shake');
  }, [trigger]);

  useShakeDetection(handleShake, shakeEnabled && !isActive);

  function callHelpline(phone: string): void {
    trackEmergencyCallPlaced('predefined');
    placeCall(phone).catch((error: unknown) => {
      captureException(error);
      Alert.alert(t('errors.callFailed'));
    });
  }

  function scheduleFakeCall(delaySeconds: number, callerName: string): void {
    void fakeCall.scheduleCall(delaySeconds, callerName);
    setFakeCallModalVisible(false);
  }

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <View className="mt-4 flex-row items-center justify-between">
          <Text variant="h2" tKey="home.title" />
          <Text variant="caption" tKey="home.tagline" className="text-stone" />
        </View>

        <View className="mt-8 w-full items-center">
          <SOSButton onTrigger={handleTap} disabled={isActive} />
          <Text
            variant="caption"
            tKey="home.sosInstruction"
            className="mt-3 text-center text-stone"
          />
        </View>

        <View className="mt-8 flex-row flex-wrap">
          <QuickActionCard
            icon="people"
            labelKey="home.emergencyContacts"
            badge={contactCount > 0 ? String(contactCount) : undefined}
            onPress={() => router.push(ROUTES.EMERGENCY_CONTACTS)}
          />
          <QuickActionCard
            icon="location"
            labelKey="home.liveLocation"
            active={isLiveLocationActive}
            onPress={() => router.push(ROUTES.LIVE_LOCATION)}
          />
          <QuickActionCard
            icon="walk"
            labelKey="home.safeJourney"
            active={isSafeJourneyActive}
            onPress={() => router.push(ROUTES.SAFE_JOURNEY)}
          />
          <QuickActionCard
            icon="call"
            labelKey="home.fakeCall"
            onPress={() => setFakeCallModalVisible(true)}
          />
          <QuickActionCard
            icon="megaphone"
            labelKey="home.siren"
            active={siren.isActive}
            onPress={siren.toggle}
          />
          <QuickActionCard
            icon="medkit"
            labelKey="home.nearbyHelp"
            onPress={() => router.push(ROUTES.NEARBY_HELP)}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-6"
          contentContainerClassName="pr-4"
        >
          {PREDEFINED_EMERGENCY_NUMBERS.map((contact) => (
            <Pressable
              key={contact.id}
              onPress={() => callHelpline(contact.phone)}
              accessibilityRole="button"
              className="mr-3 flex-row items-center rounded-full border border-stone/20 bg-white px-4 py-2"
            >
              <Text variant="caption" className="text-ink">
                {contact.name} · {contact.phone}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeScreen>

      {isActive && <SOSCountdownOverlay countdown={countdown} onCancel={cancel} />}

      <FakeCallScheduler
        visible={fakeCallModalVisible}
        onSchedule={scheduleFakeCall}
        onClose={() => setFakeCallModalVisible(false)}
      />
      <IncomingCallOverlay
        visible={fakeCall.isCallActive}
        callerName={fakeCall.callerName}
        onAnswer={() => undefined}
        onDecline={fakeCall.endCall}
      />
    </ErrorBoundary>
  );
}
