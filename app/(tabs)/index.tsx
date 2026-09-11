import { MaterialIcons } from '@expo/vector-icons';
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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { PREDEFINED_EMERGENCY_NUMBERS } from '@/constants/emergency-numbers';
import { ROUTES } from '@/constants/routes';
import { STORAGE_FLAG_OFF, STORAGE_KEYS } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import { useBatteryAlert } from '@/hooks/useBatteryAlert';
import { useFakeCall } from '@/hooks/useFakeCall';
import { useSafeCheckin } from '@/hooks/useSafeCheckin';
import { useShakeDetection } from '@/hooks/useShakeDetection';
import { useSiren } from '@/hooks/useSiren';
import { useSOS } from '@/hooks/useSOS';
import { useSuspiciousFollow } from '@/hooks/useSuspiciousFollow';
import { trackEmergencyCallPlaced } from '@/services/analytics.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useUserStore } from '@/stores/user.store';
import { formatEta } from '@/utils/date.utils';
import { placeCall } from '@/utils/phone.utils';

const MS_PER_MINUTE = 60_000;

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
  const isGuest = useAuthStore((state) => state.isGuest);
  const setGuestSigningIn = useAuthStore((state) => state.setGuestSigningIn);

  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [followEnabled, setFollowEnabled] = useState(true);
  const [fakeCallModalVisible, setFakeCallModalVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const safeCheckin = useSafeCheckin();

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEYS.SHAKE_ENABLED, STORAGE_KEYS.FOLLOW_DETECTION_ENABLED])
      .then((entries) => {
        const stored = new Map(entries);
        setShakeEnabled(stored.get(STORAGE_KEYS.SHAKE_ENABLED) !== STORAGE_FLAG_OFF);
        setFollowEnabled(stored.get(STORAGE_KEYS.FOLLOW_DETECTION_ENABLED) !== STORAGE_FLAG_OFF);
      })
      .catch((error: unknown) => captureException(error));
  }, []);

  useEffect(() => {
    if (!safeCheckin.isActive) return;
    const timer = setInterval(() => setNow(Date.now()), MS_PER_MINUTE);
    return (): void => clearInterval(timer);
  }, [safeCheckin.isActive]);

  const handleShake = useCallback((): void => {
    trigger('shake');
  }, [trigger]);

  useShakeDetection(handleShake, shakeEnabled && !isActive);
  useSuspiciousFollow(followEnabled && !isActive);

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

  // Guest mode never signs in to Firebase (see welcome.tsx — it's a local-only
  // flag), so any feature that writes to the user's own Firestore/Storage
  // data would fail there regardless of what the UI allows. Rather than let
  // a guest tap through to a silent permission-denied error, these cards are
  // locked up front with a path to actually sign in.
  function openFeatureForGuest(navigate: () => void): void {
    if (!isGuest) {
      navigate();
      return;
    }
    Alert.alert(t('home.guestFeatureLockedTitle'), t('home.guestFeatureLockedBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signInNow'),
        onPress: (): void => {
          setGuestSigningIn(true);
          router.push(ROUTES.WELCOME);
        },
      },
    ]);
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
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.EMERGENCY_CONTACTS))}
          />
          <QuickActionCard
            icon="location"
            labelKey="home.liveLocation"
            active={isLiveLocationActive}
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.LIVE_LOCATION))}
          />
          <QuickActionCard
            icon="walk"
            labelKey="home.safeJourney"
            active={isSafeJourneyActive}
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.SAFE_JOURNEY))}
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
          <QuickActionCard
            icon="mic"
            labelKey="home.silentRecording"
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.SILENT_RECORDING))}
          />
          <QuickActionCard
            icon="document-text"
            labelKey="home.incidentReport"
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.INCIDENT_REPORT))}
          />
        </View>

        {safeCheckin.isActive && (
          <Card padding="sm" className="mt-4 border border-forest-green">
            <View className="flex-row items-center gap-2">
              <MaterialIcons
                name="check-circle"
                size={ICON_SIZE.STATUS}
                color={COLORS.FOREST_GREEN}
              />
              <Text
                variant="caption"
                tKey="home.checkinActive"
                tOptions={{
                  time:
                    safeCheckin.nextCheckInAt === null
                      ? ''
                      : formatEta(
                          Math.max(
                            0,
                            Math.ceil((safeCheckin.nextCheckInAt.getTime() - now) / MS_PER_MINUTE),
                          ),
                        ),
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                label={t('safeCheckin.checkInNow')}
                onPress={() => void safeCheckin.checkIn()}
              />
            </View>
          </Card>
        )}

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
