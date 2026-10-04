import { Platform } from 'react-native';
import { setAppIcon } from 'surakshak-native';

import { setDisguiseIcon } from '@/services/disguise.service';

describe('setDisguiseIcon', () => {
  const originalOS = Platform.OS;

  beforeEach(() => jest.mocked(setAppIcon).mockClear());
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('selects the "Calculator" alternate icon on iOS', async () => {
    Platform.OS = 'ios';
    await setDisguiseIcon(true);
    expect(setAppIcon).toHaveBeenCalledWith('Calculator');
  });

  it('enables the calculator launcher alias on Android', async () => {
    Platform.OS = 'android';
    await setDisguiseIcon(true);
    expect(setAppIcon).toHaveBeenCalledWith('calculator');
  });

  it('restores the default icon when disabled', async () => {
    await setDisguiseIcon(false);
    expect(setAppIcon).toHaveBeenCalledWith(null);
  });

  it('rethrows a native failure', async () => {
    jest.mocked(setAppIcon).mockRejectedValueOnce(new Error('ICON_FAILED'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(setDisguiseIcon(true)).rejects.toThrow('ICON_FAILED');
    errorSpy.mockRestore();
  });
});
