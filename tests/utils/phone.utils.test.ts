import { Linking } from 'react-native';

import { formatIndianPhone, maskPhone, placeCall, validateIndianPhone } from '@/utils/phone.utils';

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

  beforeEach(() => {
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => openURLSpy.mockRestore());

  it('dials a 10-digit number in E.164 form', async () => {
    await placeCall('9876543210');
    expect(openURLSpy).toHaveBeenCalledWith('tel:+919876543210');
  });

  it('dials a helpline short code verbatim', async () => {
    await placeCall('112');
    expect(openURLSpy).toHaveBeenCalledWith('tel:112');

    await placeCall('1091');
    expect(openURLSpy).toHaveBeenCalledWith('tel:1091');
  });

  it('logs and rethrows when the dialer cannot be opened', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    openURLSpy.mockRejectedValueOnce(new Error('no dialer'));

    await expect(placeCall('9876543210')).rejects.toThrow('no dialer');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
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
