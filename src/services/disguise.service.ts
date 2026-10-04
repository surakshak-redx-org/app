import { Platform } from 'react-native';
import { setAppIcon } from 'surakshak-native';

/** Alternate-icon names registered by `plugins/withDisguiseIcon.js`. */
const CALCULATOR_ICON_IOS = 'Calculator';
const CALCULATOR_ICON_ANDROID = 'calculator';

/**
 * Swaps the home-screen icon and name to "Calculator" (or back). Without
 * this, Disguise Mode only changed the in-app screen while the launcher kept
 * showing Surakshak (BUG-014). iOS shows a one-line system notice when the
 * icon changes; Apple offers no way to suppress it.
 */
export async function setDisguiseIcon(enabled: boolean): Promise<void> {
  try {
    const calculator = Platform.OS === 'ios' ? CALCULATOR_ICON_IOS : CALCULATOR_ICON_ANDROID;
    await setAppIcon(enabled ? calculator : null);
  } catch (error) {
    console.error('setDisguiseIcon failed:', error);
    throw error;
  }
}
