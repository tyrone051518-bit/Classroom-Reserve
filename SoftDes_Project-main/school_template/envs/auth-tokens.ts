import { SignJWT, jwtVerify } from 'jose';

// Define the payload structure for our tokens
export type EmailTokenPayload = {
  userId: string;
  classId: string;
  action: 'confirm' | 'login';
};

// Ensure you have a strong, secret key for signing JWTs.
// This should be stored securely in your environment variables.
// Example: openssl rand -base64 32
const JWT_SECRET = process.env.JWT_SECRET_KEY;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET_KEY is not defined in environment variables.');
}

const encodedKey = new TextEncoder().encode(JWT_SECRET as string);

/**
 * Generates a secure, time-limited JWT for email links.
 * @param payload The data to include in the token.
 * @param expiresIn The expiration time for the token (e.g., '1h', '30m').
 * @returns A signed JWT string.
 */
export async function generateEmailToken(
  payload: EmailTokenPayload,
  expiresIn: string = '15m' // Token valid for 15 minutes by default
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedKey);
}

/**
 * Verifies a JWT and returns its payload if valid and not expired.
 * @param token The JWT string to verify.
 * @returns The token payload or null if verification fails.
 */
export async function verifyEmailToken(token: string): Promise<EmailTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return payload as EmailTokenPayload;
  } catch (error) {
    console.error('Failed to verify email token:', error);
    return null;
  }
}