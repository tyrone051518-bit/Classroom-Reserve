// pages/api/schedule-class-reminders.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUpcomingClasses, getTeacherById } from './db';
import { generateEmailToken } from './auth-tokens';
import { sendEmail } from './email';

type ResponseData = {
  message: string;
  sentEmails?: number;
  errors?: string[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // This endpoint should ideally be protected, e.g., with an API key,
  // to ensure only your scheduler can trigger it.
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Validate API key or other authentication for the scheduler
  const apiKeyHeader = req.headers['x-api-key'];
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
  const schedulerSecret = process.env.SCHEDULER_API_KEY as string; // Assert as string after check
  if (!schedulerSecret || apiKey !== schedulerSecret) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const errors: string[] = [];
  let sentEmailsCount = 0;

  try {
    // Fetch classes scheduled in the next 10-15 minutes
    const upcomingClasses = await getUpcomingClasses(15); // Look for classes in the next 15 minutes

    for (const classItem of upcomingClasses) {
      const teacher = await getTeacherById(classItem.teacherId);

      if (!teacher) {
        errors.push(`Teacher not found for class ${classItem.id}`);
        continue;
      }

      // Generate tokens for email links
      const confirmToken = await generateEmailToken({
        userId: teacher.id,
        classId: classItem.id,
        action: 'confirm',
      });
      const loginToken = await generateEmailToken({
        userId: teacher.id,
        classId: classItem.id,
        action: 'login',
      });

      const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL as string) || 'http://localhost:3000'; // Assert as string
      const confirmLink = `${baseUrl}/api/teacher/confirm-attendance?token=${confirmToken}`;
      const loginLink = `${baseUrl}/api/teacher/login-and-redirect?token=${loginToken}`;

      const emailHtml = `
        <p>Hello ${teacher.name},</p>
        <p>This is a reminder for your class: <strong>${classItem.name}</strong> scheduled at <strong>${classItem.scheduledTime.toLocaleTimeString()}</strong>.</p>
        <p>Please confirm your attendance:</p>
        <p><a href="${confirmLink}">Yes, I will attend this class</a></p>
        <p>If you need to make changes, you can log in to your dashboard:</p>
        <p><a href="${loginLink}">Go to My Teacher Page</a></p>
        <p>Thank you!</p>
      `;

      await sendEmail({
        to: teacher.email,
        subject: `Class Reminder: ${classItem.name} in 10 minutes`,
        html: emailHtml,
      });
      sentEmailsCount++;
    }

    res.status(200).json({ message: 'Class reminders processed', sentEmails: sentEmailsCount, errors });
  } catch (error) {
    console.error('Error processing class reminders:', error);
    res.status(500).json({ message: 'Failed to process class reminders', errors: [
      ...errors, 
      error instanceof Error ? error.message : 'Unknown error'
    ] });
  }
}