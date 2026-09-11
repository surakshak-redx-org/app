import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

/**
 * Hashes a PIN so it never sits in AsyncStorage (or a device backup) as raw
 * digits. There is nothing else derived from this hash, so a plain unsalted
 * SHA-256 digest is enough for a 4-digit local-unlock PIN.
 */
export async function hashPin(pin: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, pin);
}
