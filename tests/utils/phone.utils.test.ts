import { Linking, Platform } from 'react-native';
import { placeCallDirectly } from 'surakshak-native';

import { formatIndianPhone, maskPhone, placeCall, validateIndianPhone } from '@/utils/phone.utils';

const mockedPlaceCallDirectly = jest.mocked(placeCallDirectly);

describe('formatIndianPhone', () => {
  it('prefixes a bare 10-digit number with +91', () => {
    expect(formatIndianPhone('9876543210')).toBe('+919876543210');
  });

  it('strips spaces, dashes and parentheses', () => {
    expect(formatIndianPhone('(987) 654-3210')).toBe('+919876543210');
  });

  it('does not double up an existing 91 country code', () => {
    expect(formatIndianPhone('+91 98765 43210')).toBe('+919876543210');
  });

  it('drops a leading trunk zero', () => {
    expect(formatIndianPhone('09876543210')).toBe('+919876543210');
  });
});

describe('validateIndianPhone', () => {
  it.each(['6000000000', '7123456789', '8123456789', '9876543210'])(
    'accepts %s (valid leading digit)',
    (phone) => {
      expect(validateIndianPhone(phone)).toBe(true);
    },
  );

  it.each(['5876543210', '1234567890', '0876543210'])(
    'rejects %s (invalid leading digit)',
    (phone) => {
      expect(validateIndianPhone(phone)).toBe(false);
    },
  );

  it('rejects numbers that are too short', () => {
    expect(validateIndianPhone('98765')).toBe(false);
  });

  it('rejects numbers that are too long', () => {
    expect(validateIndianPhone('98765432101')).toBe(false);
  });

  it('accepts an already-formatted number', () => {
    expect(validateIndianPhone('+919876543210')).toBe(true);
  });
});

describe('placeCall', () => {
  let openURLSpy: jest.SpyInstance;
  const originalOS = Platform.OS;

  beforeEach(() => {
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => {
    openURLSpy.mockRestore();
    Platform.OS = originalOS;
    jest.clearAllMocks();
  });

  it('dials a 10-digit number in E.164 form (iOS dialer)', async () => {
    Platform.OS = 'ios';
    await placeCall('9876543210');
    expect(openURLSpy).toHaveBeenCalledWith('tel:+919876543210');
  });

  it('dials a helpline short code verbatim (iOS dialer)', async () => {
    Platform.OS = 'ios';
    await placeCall('112');
    expect(openURLSpy).toHaveBeenCalledWith('tel:112');

    await placeCall('1091');
    expect(openURLSpy).toHaveBeenCalledWith('tel:1091');
  });

  it('logs and rethrows when the dialer cannot be opened', async () => {
    Platform.OS = 'ios';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    openURLSpy.mockRejectedValueOnce(new Error('no dialer'));

    await expect(placeCall('9876543210')).rejects.toThrow('no dialer');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('places the call directly on Android and never opens the dialer', async () => {
    Platform.OS = 'android';
    mockedPlaceCallDirectly.mockResolvedValueOnce({
      success: true,
      phone: '+919876543210',
      method: 'direct',
    });

    await placeCall('9876543210');

    expect(mockedPlaceCallDirectly).toHaveBeenCalledWith('+919876543210');
    expect(openURLSpy).not.toHaveBeenCalled();
  });

  it('falls back to the dialer on Android when the direct call fails', async () => {
    Platform.OS = 'android';
    mockedPlaceCallDirectly.mockRejectedValueOnce(new Error('permission revoked'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await placeCall('9876543210');

    expect(openURLSpy).toHaveBeenCalledWith('tel:+919876543210');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('maskPhone', () => {
  it('reveals only the last four digits', () => {
    expect(maskPhone('9876543210')).toBe('+91XXXXXX3210');
  });

  it('handles an already-formatted number', () => {
    expect(maskPhone('+919876543210')).toBe('+91XXXXXX3210');
  });

  it('does not mask a number shorter than the visible window', () => {
    expect(maskPhone('321')).toBe('+91321');
  });
});
