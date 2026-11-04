import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, View } from 'react-native';

import { FakeCallScheduler } from '@/components/features/emergency/FakeCallScheduler';
import { IncomingCallOverlay } from '@/components/features/emergency/IncomingCallOverlay';
import { QuickActionCard } from '@/components/features/emergency/QuickActionCard';
import { ActiveTrackingBanner } from '@/components/features/home/ActiveTrackingBanner';
import { EmergencyHelplineGrid } from '@/components/features/home/EmergencyHelplineGrid';
import { SafetyStatusCard } from '@/components/features/home/SafetyStatusCard';
import { SOSButton } from '@/components/features/sos/SOSButton';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { ROUTES } from '@/constants/routes';
import { STORAGE_FLAG_OFF, STORAGE_FLAG_ON, STORAGE_KEYS } from '@/constants/storage';
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
import { useSOSStore } from '@/stores/sos.store';
import { useUserStore } from '@/stores/user.store';
import { formatEta } from '@/utils/date.utils';
import { placeCall } from '@/utils/phone.utils';

const MS_PER_MINUTE = 60_000;

export default function HomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const { isActive, tapCount, handleTap, trigger } = useSOS();
  const sosOutcome = useSOSStore((state) => state.lastOutcome);
  const setSosOutcome = useSOSStore((state) => state.setLastOutcome);
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
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [iosHintDismissed, setIosHintDismissed] = useState(true);

  const safeCheckin = useSafeCheckin();

  const callHelpline = useCallback(
    (phone: string): void => {
      trackEmergencyCallPlaced('predefined');
      placeCall(phone).catch((error: unknown) => {
        captureException(error);
        const isNoTelephony =
          error instanceof Error && error.message === 'errors.telephonyUnavailable';
        Alert.alert(t(isNoTelephony ? 'errors.telephonyUnavailable' : 'errors.callFailed'));
      });
    },
    [t],
  );

  // Re-read on every focus: the tab stays mounted while Settings is open, so a
  // mount-only read would ignore toggles changed there.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.multiGet([STORAGE_KEYS.SHAKE_ENABLED, STORAGE_KEYS.FOLLOW_DETECTION_ENABLED])
        .then((entries) => {
          const stored = new Map(entries);
          setShakeEnabled(stored.get(STORAGE_KEYS.SHAKE_ENABLED) !== STORAGE_FLAG_OFF);
          setFollowEnabled(stored.get(STORAGE_KEYS.FOLLOW_DETECTION_ENABLED) !== STORAGE_FLAG_OFF);
        })
        .catch((error: unknown) => captureException(error));
    }, []),
  );

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AsyncStorage.getItem(STORAGE_KEYS.IOS_HINT_DISMISSED)
      .then((value) => setIosHintDismissed(value === STORAGE_FLAG_ON))
      .catch((error: unknown) => captureException(error));
  }, []);

  const dismissIosHint = useCallback((): void => {
    setIosHintDismissed(true);
    AsyncStorage.setItem(STORAGE_KEYS.IOS_HINT_DISMISSED, STORAGE_FLAG_ON).catch((error: unknown) =>
      captureException(error),
    );
  }, []);

  // Report how the SOS fan-out went exactly once — a silent failure is what
  // made BUG-006 invisible to the person who pressed the button.
  useEffect(() => {
    if (sosOutcome === null) return;
    const { sent, failed, error } = sosOutcome;

    if (error === 'airplane_mode') {
      Alert.alert(t('home.sosResultTitle'), t('home.sosResultAirplaneMode'), [
        { text: t('common.ok'), style: 'default' },
        {
          text: t('emergency.callEmergency112'),
          style: 'destructive',
          onPress: (): void => callHelpline('112'),
        },
      ]);
    } else if (error === 'draft_fallback') {
      Alert.alert(t('home.sosResultTitle'), t('home.sosResultDraft'), [
        { text: t('common.ok'), style: 'default' },
        {
          text: t('emergency.callEmergency112'),
          style: 'destructive',
          onPress: (): void => callHelpline('112'),
        },
      ]);
    } else if (error === 'failed' || (sent === 0 && failed > 0)) {
      Alert.alert(t('home.sosResultTitle'), t('home.sosResultFailed'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.retry'), onPress: (): void => trigger('button') },
        {
          text: t('emergency.callEmergency112'),
          style: 'destructive',
          onPress: (): void => callHelpline('112'),
        },
      ]);
    } else if (error === 'no_contacts' || (sent === 0 && failed === 0)) {
      Alert.alert(t('home.sosResultTitle'), t('home.sosResultNoContacts'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('home.emergencyContacts'),
          onPress: (): void => router.push(ROUTES.EMERGENCY_CONTACTS),
        },
        {
          text: t('emergency.callEmergency112'),
          style: 'destructive',
          onPress: (): void => callHelpline('112'),
        },
      ]);
    } else if (failed === 0) {
      Alert.alert(t('home.sosResultTitle'), t('home.sosResultSent', { count: sent }));
    } else {
      Alert.alert(t('home.sosResultTitle'), t('home.sosResultPartial', { sent, failed }), [
        { text: t('common.ok'), style: 'default' },
        {
          text: t('emergency.callEmergency112'),
          style: 'destructive',
          onPress: (): void => callHelpline('112'),
        },
      ]);
    }
    setSosOutcome(null);
  }, [sosOutcome, setSosOutcome, t, trigger, callHelpline, router]);

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

  function scheduleFakeCall(delaySeconds: number, callerName: string): void {
    void fakeCall.scheduleCall(delaySeconds, callerName);
    setFakeCallModalVisible(false);
    if (delaySeconds > 0) {
      Alert.alert(t('emergency.fakeCallScheduled'));
    }
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
          <View>
            <Text variant="h2" tKey="home.title" />
            <Text
              variant="caption"
              tKey="home.tagline"
              className="text-stone dark:text-dark-text-secondary"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.disguiseModeShortcut')}
            onPress={() => router.push(ROUTES.CALCULATOR)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="h-10 w-10 items-center justify-center rounded-full border border-stone/20 bg-white dark:border-dark-border dark:bg-charcoal"
          >
            <Ionicons name="calculator-outline" size={ICON_SIZE.ROW} color={COLORS.STONE} />
          </Pressable>
        </View>

        <ActiveTrackingBanner
          isSafeJourneyActive={isSafeJourneyActive}
          isLiveLocationActive={isLiveLocationActive}
          onManage={() => setTrackingModalVisible(true)}
        />

        <SafetyStatusCard
          contactCount={contactCount}
          isGuest={isGuest}
          shakeEnabled={shakeEnabled}
          onAddContacts={() => router.push(ROUTES.EMERGENCY_CONTACTS)}
          onSignIn={() => {
            setGuestSigningIn(true);
            router.push(ROUTES.WELCOME);
          }}
        />

        <View className="mt-8 w-full items-center">
          <SOSButton onTrigger={handleTap} disabled={isActive} tapCount={tapCount} />
          <Text
            variant="caption"
            tKey={
              tapCount === 1
                ? 'home.sosTap1'
                : tapCount === 2
                  ? 'home.sosTap2'
                  : 'home.sosInstruction'
            }
            className="mt-3 text-center text-stone dark:text-dark-text-secondary"
          />
        </View>

        <View className="mt-6 flex-row flex-wrap">
          <QuickActionCard
            icon="people"
            labelKey="home.emergencyContacts"
            iconColor="#6366F1"
            warning={!isGuest && contactCount === 0 ? t('home.addContactsWarning') : undefined}
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.EMERGENCY_CONTACTS))}
          />
          <QuickActionCard
            icon="navigate"
            labelKey="home.trackingAndJourneys"
            iconColor="#7C3AED"
            active={isLiveLocationActive || isSafeJourneyActive}
            subtitle={
              isLiveLocationActive && isSafeJourneyActive
                ? t('home.trackingActiveBoth')
                : isSafeJourneyActive
                  ? t('home.trackingActiveJourney')
                  : isLiveLocationActive
                    ? t('home.trackingActiveLocation')
                    : undefined
            }
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => setTrackingModalVisible(true))}
          />
          <QuickActionCard
            icon="call"
            labelKey="home.fakeCall"
            iconColor="#059669"
            onPress={() => setFakeCallModalVisible(true)}
          />
          <QuickActionCard
            icon="megaphone"
            labelKey="home.siren"
            iconColor="#E11D48"
            active={siren.isActive}
            onPress={siren.toggle}
          />
          <QuickActionCard
            icon="medkit"
            labelKey="home.nearbyHelp"
            iconColor="#0D9488"
            onPress={() => router.push({ pathname: ROUTES.MAP, params: { openHelp: '1' } })}
          />
          <QuickActionCard
            icon="mic"
            labelKey="home.silentRecording"
            iconColor="#BE123C"
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.SILENT_RECORDING))}
          />
          <QuickActionCard
            icon="time"
            labelKey="home.safeCheckin"
            iconColor="#0284C7"
            active={safeCheckin.isActive}
            subtitle={safeCheckin.isActive ? t('home.checkinActiveSubtitle') : undefined}
            locked={isGuest}
            onPress={() => openFeatureForGuest(() => router.push(ROUTES.SAFE_CHECKIN))}
          />
          <QuickActionCard
            icon="document-text"
            labelKey="home.incidentReport"
            iconColor="#D97706"
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

        <EmergencyHelplineGrid onCall={callHelpline} />

        {Platform.OS === 'ios' && !iosHintDismissed && (
          <Card padding="sm" className="mx-0 mt-3 border border-saffron/40 bg-saffron/10">
            <Pressable
              onPress={dismissIosHint}
              accessibilityLabel={t('home.iosHintDismissLabel')}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="absolute right-2 top-2 p-1"
            >
              <MaterialIcons name="close" size={ICON_SIZE.DISMISS} color={COLORS.STONE} />
            </Pressable>
            <View className="flex-row items-start gap-2 pr-5">
              <Text variant="body">ℹ️</Text>
              <Text variant="caption" tKey="home.iosHintBody" className="flex-1 text-stone" />
            </View>
          </Card>
        )}
      </SafeScreen>

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

      <BottomSheet visible={trackingModalVisible} onClose={() => setTrackingModalVisible(false)}>
        <Text variant="h2" tKey="home.trackingModalTitle" />
        <Text
          variant="caption"
          tKey="home.trackingModalSubtitle"
          className="mt-1 text-stone dark:text-dark-text-secondary"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.pointToPointJourneyTitle')}
          onPress={() => {
            setTrackingModalVisible(false);
            router.push(ROUTES.SAFE_JOURNEY);
          }}
          className="mt-4 rounded-xl border border-stone/20 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-charcoal"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MaterialIcons
                name="directions-walk"
                size={ICON_SIZE.ROW}
                color={COLORS.SHAKTI_PURPLE}
              />
              <Text variant="h3">{t('home.pointToPointJourneyTitle')}</Text>
            </View>
            {isSafeJourneyActive && <Badge variant="success" label={t('home.activeStatus')} />}
          </View>
          <Text variant="caption" className="mt-2 text-stone dark:text-dark-text-secondary">
            {t('home.pointToPointJourneyDesc')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.continuousLiveLocationTitle')}
          onPress={() => {
            setTrackingModalVisible(false);
            router.push(ROUTES.LIVE_LOCATION);
          }}
          className="mt-3 rounded-xl border border-stone/20 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-charcoal"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="my-location" size={ICON_SIZE.ROW} color={COLORS.SHAKTI_PURPLE} />
              <Text variant="h3">{t('home.continuousLiveLocationTitle')}</Text>
            </View>
            {isLiveLocationActive && <Badge variant="success" label={t('home.activeStatus')} />}
          </View>
          <Text variant="caption" className="mt-2 text-stone dark:text-dark-text-secondary">
            {t('home.continuousLiveLocationDesc')}
          </Text>
        </Pressable>

        <Button
          variant="ghost"
          size="md"
          className="mt-4 self-center"
          label={t('common.cancel')}
          onPress={() => setTrackingModalVisible(false)}
        />
      </BottomSheet>
    </ErrorBoundary>
  );
}
