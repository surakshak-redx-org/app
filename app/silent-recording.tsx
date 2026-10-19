import { MaterialIcons } from '@expo/vector-icons';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { COLORS } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { ROUTES } from '@/constants/routes';
import { KEEP_AWAKE_TAGS } from '@/constants/ui';
import {
  trackEvidenceRecordingStarted,
  trackEvidenceRecordingUploaded,
} from '@/services/analytics.service';
import { recordEvidenceUpload } from '@/services/evidence.service';
import { uploadEvidenceRecording } from '@/services/firebase/incident.service';
import { sendEvidenceLinkAlert } from '@/services/sms.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import { formatSecondsAsClock } from '@/utils/date.utils';
import { requestMicrophonePermission } from '@/utils/permissions.utils';

type RecordingScreenState = 'idle' | 'recording' | 'uploading' | 'uploaded';

const MS_PER_SECOND = 1000;
/** How often to retry resuming after an interruption, and how many tries before giving up and saving. */
const RESUME_RETRY_MS = 2000;
const RESUME_MAX_ATTEMPTS = 30;

const BYTES_PER_MB = 1024 * 1024;
/** Refuse to start below this much free space. */
const MIN_FREE_MB_TO_START = 15;
/** Stop and save what exists once free space falls to this, before writes start failing. */
const MIN_FREE_MB_WHILE_RECORDING = 5;
const STORAGE_CHECK_INTERVAL_MS = 5000;

/** Unknown free space is treated as enough — never block a recording on a failed probe. */
function hasFreeSpace(minMb: number): boolean {
  try {
    const space = Paths.availableDiskSpace;
    if (typeof space !== 'number' || Number.isNaN(space)) return true;
    return space >= minMb * BYTES_PER_MB;
  } catch {
    return true;
  }
}

/**
 * NativeWind classes are extracted from literal source text, so an upload
 * progress bar can't take a fully dynamic `style={{ width }}` (absolute rule
 * 5). These literal width classes are all present in this file's text for
 * NativeWind to pick up; the percentage just rounds to the nearest one.
 */
const PROGRESS_WIDTH_CLASSES = [
  'w-[0%]',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-[100%]',
] as const;

function progressWidthClass(percent: number): string {
  const clampedIndex = Math.max(0, Math.min(20, Math.round(percent / 5)));
  return PROGRESS_WIDTH_CLASSES[clampedIndex] ?? 'w-[0%]';
}

export default function SilentRecordingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, MS_PER_SECOND / 4);

  const [screenState, setScreenState] = useState<RecordingScreenState>('idle');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = useAuthStore((state) => state.user?.uid ?? null);
  const emergencyContacts = useUserStore((state) => state.emergencyContacts);
  const customContacts = useMemo(
    () => emergencyContacts.filter((contact) => !contact.isPredefined),
    [emergencyContacts],
  );

  const durationSeconds = Math.floor(recorderState.durationMillis / MS_PER_SECOND);
  const maxDurationSeconds = APP_CONFIG.MAX_EVIDENCE_RECORDING_MINUTES * 60;

  const clearAutoStopTimer = useCallback((): void => {
    if (autoStopTimerRef.current !== null) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const handleStopAndUpload = useCallback(async (): Promise<void> => {
    if (userId === null) return;

    try {
      clearAutoStopTimer();
      const finishedDurationSeconds = durationSeconds;
      await recorder.stop();
      void deactivateKeepAwake(KEEP_AWAKE_TAGS.RECORDING);
      setScreenState('uploading');
      setUploadProgress(0);

      const uri = recorder.uri;
      if (uri === null) throw new Error('No recording URI');

      // When storage runs out the native encoder can leave an empty file; never
      // upload that. Keep the file in cache and tell the user why.
      if (new File(uri).size === 0) {
        setError(t('errors.storageInsufficient'));
        setUploadProgress(null);
        setScreenState('idle');
        return;
      }

      const url = await uploadEvidenceRecording(userId, uri, setUploadProgress);
      setUploadedUrl(url);
      setUploadProgress(null);
      setScreenState('uploaded');
      trackEvidenceRecordingUploaded(finishedDurationSeconds);

      // Best-effort: the upload itself already succeeded, so a failure here
      // (e.g. AsyncStorage full) shouldn't flip the screen back to an error
      // state — it would just mean this one recording doesn't show up in
      // My Recordings.
      recordEvidenceUpload({ url, durationSeconds: finishedDurationSeconds }).catch(
        (historyError: unknown) => captureException(historyError),
      );
    } catch (uploadError) {
      captureException(uploadError);
      setError(hasFreeSpace(1) ? t('errors.uploadFailed') : t('errors.storageInsufficient'));
      setUploadProgress(null);
      setScreenState('idle');
    }
  }, [clearAutoStopTimer, durationSeconds, recorder, t, userId]);

  const handleStartRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const granted = await requestMicrophonePermission();
      if (!granted) {
        Alert.alert(t('errors.microphonePermissionDenied'));
        return;
      }
      if (!hasFreeSpace(MIN_FREE_MB_TO_START)) {
        Alert.alert(t('errors.storageInsufficient'));
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await activateKeepAwakeAsync(KEEP_AWAKE_TAGS.RECORDING);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setScreenState('recording');
      trackEvidenceRecordingStarted();

      clearAutoStopTimer();
      autoStopTimerRef.current = setTimeout(() => {
        void handleStopAndUpload();
      }, maxDurationSeconds * MS_PER_SECOND);
    } catch (startError) {
      captureException(startError);
      Alert.alert(
        hasFreeSpace(MIN_FREE_MB_TO_START)
          ? t('errors.microphonePermissionDenied')
          : t('errors.storageInsufficient'),
      );
    }
  }, [clearAutoStopTimer, handleStopAndUpload, maxDurationSeconds, recorder, t]);

  const handleDiscard = useCallback((): void => {
    Alert.alert(t('silentRecording.discardConfirmTitle'), t('silentRecording.discardConfirmBody'), [
      { text: t('silentRecording.keepRecording'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          clearAutoStopTimer();
          void recorder.stop();
          void deactivateKeepAwake(KEEP_AWAKE_TAGS.RECORDING);
          setScreenState('idle');
        },
      },
    ]);
  }, [clearAutoStopTimer, recorder, t]);

  const handleCopyLink = useCallback((): void => {
    if (uploadedUrl === null) return;
    void Clipboard.setStringAsync(uploadedUrl).then(() => {
      Alert.alert(t('silentRecording.linkCopied'));
    });
  }, [t, uploadedUrl]);

  const handleShareWithContacts = useCallback((): void => {
    if (uploadedUrl === null || customContacts.length === 0) return;
    sendEvidenceLinkAlert(customContacts, uploadedUrl).catch((shareError: unknown) => {
      captureException(shareError);
      Alert.alert(t('errors.generic'));
    });
  }, [customContacts, t, uploadedUrl]);

  const handleRecordAnother = useCallback((): void => {
    setScreenState('idle');
    setUploadedUrl(null);
    setUploadProgress(null);
    setError(null);
  }, []);

  // iOS pauses the recorder when a call (or other audio session) interrupts it and
  // expo-audio does not resume it. While the screen believes it is recording but
  // the recorder is not, retry resuming; if it cannot resume (or the media
  // services were reset, which invalidates the recorder), stop and upload what
  // was captured instead of leaving a stalled recording that looks active.
  const stopAndUploadRef = useRef(handleStopAndUpload);
  useEffect(() => {
    stopAndUploadRef.current = handleStopAndUpload;
  }, [handleStopAndUpload]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || screenState !== 'recording' || recorderState.isRecording) return;

    if (recorderState.mediaServicesDidReset) {
      void stopAndUploadRef.current();
      return;
    }

    let attempts = 0;
    let inFlight = false;
    const tryResume = async (): Promise<void> => {
      if (inFlight) return;
      inFlight = true;
      attempts += 1;
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        recorder.record();
      } catch (resumeError) {
        captureException(resumeError);
      } finally {
        // `record()` reports failure by not recording rather than by throwing.
        if (attempts >= RESUME_MAX_ATTEMPTS && !recorder.getStatus().isRecording) {
          clearInterval(timer);
          void stopAndUploadRef.current();
        }
        inFlight = false;
      }
    };

    const timer = setInterval(() => void tryResume(), RESUME_RETRY_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tryResume();
    });
    return (): void => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [recorder, recorderState.isRecording, recorderState.mediaServicesDidReset, screenState]);

  // Stop early and save what exists before the disk fills and writes start failing.
  useEffect(() => {
    if (screenState !== 'recording') return;
    const timer = setInterval(() => {
      if (hasFreeSpace(MIN_FREE_MB_WHILE_RECORDING)) return;
      clearInterval(timer);
      Alert.alert(t('errors.storageInsufficient'));
      void stopAndUploadRef.current();
    }, STORAGE_CHECK_INTERVAL_MS);
    return (): void => clearInterval(timer);
  }, [screenState, t]);

  // Revoking the microphone in system settings mid-recording: on return, stop
  // cleanly and upload what was captured (the file is written progressively),
  // then tell the user why, instead of leaving a dead recorder running.
  useEffect(() => {
    if (screenState !== 'recording') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      getRecordingPermissionsAsync()
        .then(({ granted }) => {
          if (granted) return;
          Alert.alert(t('errors.microphonePermissionRevoked'));
          return handleStopAndUpload();
        })
        .catch((permissionError: unknown) => captureException(permissionError));
    });
    return (): void => subscription.remove();
  }, [handleStopAndUpload, screenState, t]);

  useEffect(
    () => (): void => {
      clearAutoStopTimer();
      void recorder.stop().catch(() => undefined);
      void deactivateKeepAwake(KEEP_AWAKE_TAGS.RECORDING);
    },
    [clearAutoStopTimer, recorder],
  );

  if (screenState === 'recording') {
    return (
      <ErrorBoundary>
        <View className="flex-1 items-center justify-center bg-near-black">
          <View className="mb-8 h-4 w-4 rounded-full bg-primary-red" />
          <Text variant="h1" className="mb-2 text-white">
            {formatSecondsAsClock(durationSeconds)}
          </Text>
          <Text variant="body" tKey="silentRecording.recordingAudio" className="mb-12 text-stone" />
          <Text
            variant="caption"
            tKey="silentRecording.remainingMinutes"
            tOptions={{ count: Math.floor((maxDurationSeconds - durationSeconds) / 60) }}
            className="mb-8 text-stone"
          />
          <Button
            variant="danger"
            size="lg"
            // Button defaults non-fullWidth to self-start, which overrides
            // this column's items-center and pins it to the left instead of
            // centering it under the countdown text.
            className="self-center"
            label={t('silentRecording.stopAndUpload')}
            onPress={() => void handleStopAndUpload()}
          />
          <Pressable onPress={handleDiscard} accessibilityRole="button" className="mt-4">
            <Text
              variant="caption"
              tKey="silentRecording.discard"
              className="text-stone underline"
            />
          </Pressable>
        </View>
      </ErrorBoundary>
    );
  }

  if (screenState === 'uploading') {
    return (
      <ErrorBoundary>
        <View className="flex-1 items-center justify-center bg-off-white px-6">
          <MaterialIcons name="cloud-upload" size={60} color={COLORS.SHAKTI_PURPLE} />
          <Text variant="h3" tKey="silentRecording.uploading" className="mb-2 mt-4" />
          <Text variant="body" tKey="silentRecording.uploadingBody" className="mb-6 text-stone" />
          <View className="h-2 w-full rounded-full bg-stone/20">
            <View
              className={`h-2 rounded-full bg-shakti-purple ${progressWidthClass(uploadProgress ?? 0)}`}
            />
          </View>
          <Text variant="caption" className="mt-2 text-stone">
            {`${uploadProgress ?? 0}%`}
          </Text>
        </View>
      </ErrorBoundary>
    );
  }

  if (screenState === 'uploaded') {
    return (
      <ErrorBoundary>
        <View className="flex-1 items-center justify-center bg-off-white px-6">
          <MaterialIcons name="check-circle" size={80} color={COLORS.FOREST_GREEN} />
          <Text
            variant="h2"
            tKey="silentRecording.evidenceSaved"
            className="mb-2 mt-4 text-center"
          />
          <Text
            variant="body"
            tKey="silentRecording.evidenceSavedBody"
            className="mb-8 text-center text-stone"
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            label={t('silentRecording.copyLink')}
            onPress={handleCopyLink}
          />
          <Button
            variant="outline"
            size="lg"
            fullWidth
            className="mt-3"
            label={t('silentRecording.shareWithContacts')}
            disabled={customContacts.length === 0}
            onPress={handleShareWithContacts}
          />
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            className="mt-3"
            label={t('silentRecording.recordAnother')}
            onPress={handleRecordAnother}
          />
          <Pressable
            onPress={() => router.push(ROUTES.MY_RECORDINGS)}
            accessibilityRole="button"
            className="mt-4"
          >
            <Text
              variant="caption"
              tKey="silentRecording.viewRecordings"
              className="text-shakti-purple underline"
            />
          </Pressable>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeScreen scrollable>
        <ScreenHeader titleKey="screens.silentRecording" />

        <View className="mt-4 flex-1 items-center justify-center px-2">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-shakti-purple/10">
            <MaterialIcons name="mic" size={56} color={COLORS.SHAKTI_PURPLE} />
          </View>
          <Text variant="h2" tKey="silentRecording.title" className="mb-2 text-center" />
          <Text
            variant="body"
            tKey="silentRecording.subtitle"
            className="mb-8 text-center text-stone"
          />

          {error !== null && (
            <Text variant="caption" className="mb-4 text-center text-error-red">
              {error}
            </Text>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-2"
            label={t('silentRecording.startRecording')}
            onPress={() => void handleStartRecording()}
          />

          <Card padding="md" className="mt-6 w-full bg-saffron/10">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="info" size={16} color={COLORS.SAFFRON} />
              <Text
                variant="caption"
                tKey="silentRecording.storageNotice"
                tOptions={{ minutes: APP_CONFIG.MAX_EVIDENCE_RECORDING_MINUTES }}
                className="flex-1 text-stone"
              />
            </View>
          </Card>

          <Pressable
            onPress={() => router.push(ROUTES.MY_RECORDINGS)}
            accessibilityRole="button"
            className="mt-4"
          >
            <Text
              variant="caption"
              tKey="silentRecording.viewRecordings"
              className="text-shakti-purple underline"
            />
          </Pressable>
        </View>
      </SafeScreen>
    </ErrorBoundary>
  );
}
