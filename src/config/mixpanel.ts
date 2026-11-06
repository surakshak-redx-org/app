import {
  MPSessionReplay,
  MPSessionReplayConfig,
  MPSessionReplayMask,
} from '@mixpanel/react-native-session-replay';
import { Mixpanel } from 'mixpanel-react-native';

import { ENV, IS_TELEMETRY_ENABLED } from '@/config/env';
import { MIXPANEL_REPLAY_SESSION_PERCENT_BY_ENV } from '@/constants/config';
import { isReplayOptedOut } from '@/utils/replay-consent.utils';

let mixpanelInstance: Mixpanel | null = null;
let isReplayReady = false;

/**
 * Starts Mixpanel session replay. Isolated from analytics init so a replay
 * failure (unsupported device, native module missing) never costs us events.
 */
async function initSessionReplay(instance: Mixpanel): Promise<void> {
  try {
    const optedOut = await isReplayOptedOut();
    const distinctId = await instance.getDistinctId();
    const config = new MPSessionReplayConfig({
      // Upload on Wi-Fi only: replay segments are heavy and many users are on
      // metered mobile data.
      wifiOnly: true,
      recordingSessionsPercent: MIXPANEL_REPLAY_SESSION_PERCENT_BY_ENV[ENV.APP_ENV],
      // Mask every category the SDK can detect. Text inputs are always masked.
      autoMaskedViews: [
        MPSessionReplayMask.Text,
        MPSessionReplayMask.Image,
        MPSessionReplayMask.Web,
        MPSessionReplayMask.Map,
      ],
      autoStartRecording: !optedOut,
    });
    await MPSessionReplay.initialize(ENV.MIXPANEL_TOKEN, distinctId, config);
    isReplayReady = true;
  } catch (error) {
    console.error('initSessionReplay failed:', error);
  }
}

export async function initMixPanel(): Promise<void> {
  if (!IS_TELEMETRY_ENABLED) {
    return;
  }

  try {
    const instance = new Mixpanel(ENV.MIXPANEL_TOKEN, true);
    await instance.init();
    mixpanelInstance = instance;
    await initSessionReplay(instance);
  } catch (error) {
    console.error('initMixPanel failed:', error);
  }
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!IS_TELEMETRY_ENABLED || !mixpanelInstance) return;
  mixpanelInstance.track(event, properties);
}

export function identify(userId: string): void {
  if (!IS_TELEMETRY_ENABLED || !mixpanelInstance) return;
  void mixpanelInstance.identify(userId);
  if (isReplayReady) {
    // Replays are matched to a person by distinct id, so it must follow identify.
    MPSessionReplay.identify(userId).catch((error: unknown) => {
      console.error('session replay identify failed:', error);
    });
  }
}

export function resetAnalytics(): void {
  if (!IS_TELEMETRY_ENABLED || !mixpanelInstance) return;
  mixpanelInstance.reset();
}

/**
 * Starts or stops Mixpanel replay immediately, unlike Sentry's which only
 * changes on the next launch. Used by the Settings opt-out so Mixpanel stops
 * recording the moment the user asks.
 */
export async function setSessionReplayRecording(enabled: boolean): Promise<void> {
  if (!IS_TELEMETRY_ENABLED || !isReplayReady) return;
  try {
    if (enabled) {
      await MPSessionReplay.startRecording(MIXPANEL_REPLAY_SESSION_PERCENT_BY_ENV[ENV.APP_ENV]);
    } else {
      await MPSessionReplay.stopRecording();
    }
  } catch (error) {
    console.error('setSessionReplayRecording failed:', error);
  }
}
