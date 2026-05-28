// lib/email.ts - Mock Email Sender

type EmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(options: EmailOptions): Promise<void> {
  console.log(`--- Sending Email ---`);
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`Body:\n${options.html}`);
  console.log(`---------------------`);
  // In a real app, integrate with an email service here (e.g., Nodemailer, SendGrid)
}