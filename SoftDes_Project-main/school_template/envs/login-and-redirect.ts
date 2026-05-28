// pages/api/teacher/login-and-redirect.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyEmailToken } from './auth-tokens';
import { createSession } from './session';
import { getTeacherById } from './db';

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

  if (!payload || payload.action !== 'login') {
    return res.status(401).json({ message: 'Invalid or expired login link.' });
  }

  const teacher = await getTeacherById(payload.userId);

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found.' });
  }

  // Create a session for the teacher
  await createSession(res, teacher.id);

  // Redirect the teacher to their dashboard
  res.redirect(302, teacher.dashboardUrl); // Use 302 for temporary redirect
}