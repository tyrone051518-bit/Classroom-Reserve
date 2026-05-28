// lib/session.ts - Adapted from Next.js Authentication Guide

import { SignJWT, jwtVerify } from 'jose';
import type { NextApiResponse } from 'next';

// Define the session payload structure
export type SessionPayload = {
  userId: string;
  expiresAt: Date;
};

// Ensure you have a strong, secret key for signing JWTs.
// This should be stored securely in your environment variables.
// Example: openssl rand -base64 32
const SESSION_SECRET = process.env.SESSION_SECRET_KEY;

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET_KEY is not defined in environment variables.');
}

const encodedSessionKey = new TextEncoder().encode(SESSION_SECRET as string);

/**
 * Encrypts a session payload into a JWT.
 */
export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .sign(encodedSessionKey);
}

/**
 * Decrypts a session JWT and returns its payload.
 */
export async function decryptSession(session: string | undefined = ''): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(session, encodedSessionKey, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    console.error('Failed to verify session:', error);
    return null;
  }
}

/**
 * Creates a new session cookie for the given userId.
 */
export async function createSession(res: NextApiResponse, userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await encryptSession({ userId, expiresAt });

  // Standard cookie serialization for Pages Router API routes
  const cookieValue = [
    `session=${session}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${7 * 24 * 60 * 60}`,
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookieValue);
}