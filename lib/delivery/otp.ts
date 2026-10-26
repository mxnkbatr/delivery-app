import { randomInt } from 'crypto';

/** 4-digit delivery confirmation code (1000–9999). */
export function generateDeliveryOtp(): string {
  return String(randomInt(1000, 10000));
}

export function isValidOtpFormat(otp: unknown): otp is string {
  return typeof otp === 'string' && /^\d{4}$/.test(otp);
}
