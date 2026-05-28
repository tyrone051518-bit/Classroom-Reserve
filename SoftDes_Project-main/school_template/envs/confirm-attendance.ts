// pages/api/teacher/confirm-attendance.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyEmailToken } from './auth-tokens';
import { updateClassConfirmation } from './db';

type ResponseData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { token } = req.query;

  if (typeof token !== 'string') {
    return res.status(400).json({ message: 'Invalid token provided.' });
  }

  const payload = await verifyEmailToken(token);

  if (!payload || payload.action !== 'confirm') {
    return res.status(401).json({ message: 'Invalid or expired confirmation link.' });
  }

  const success = await updateClassConfirmation(payload.classId, true);

  if (success) {
    // You might want to redirect to a confirmation page instead of just sending JSON
    return res.status(200).json({ message: 'Attendance confirmed successfully! Thank you.' });
  } else {
    return res.status(500).json({ message: 'Failed to confirm attendance. Please try again or contact support.' });
  }
}