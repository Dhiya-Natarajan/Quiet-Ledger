import nodemailer from 'nodemailer';
import { config } from '../../config';
import { prisma } from '../../services/db';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (config.email.user && config.email.pass) {
    const isGmail = config.email.host.includes('gmail') || config.email.user.endsWith('@gmail.com');
    const cleanPass = config.email.pass.replace(/\s+/g, '');

    if (isGmail) {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: config.email.user.trim(),
          pass: cleanPass,
        },
      });
      console.log(`[Email] Configured Gmail SMTP transport (port 587 / STARTTLS) for ${config.email.user}`);
    } else {
      transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user.trim(),
          pass: cleanPass,
        },
      });
      console.log(`[Email] Configured custom SMTP transport (${config.email.host}:${config.email.port})`);
    }
  } else {
    // Generate Ethereal test account if no SMTP provided
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email] Using Ethereal test SMTP account: ${testAccount.user}`);
    } catch (err) {
      console.warn('[Email] Failed to create Ethereal test account, using JSON transport fallback.');
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return transporter;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export async function sendEmail(params: SendEmailParams) {
  const { to, subject, body, html } = params;

  // Create delivery log record in PENDING state
  let logId = '';
  try {
    const log = await prisma.deliveryLog.create({
      data: {
        channel: 'EMAIL',
        recipient: to,
        subject: subject,
        content: body,
        status: 'PENDING',
        attempts: 1,
      },
    });
    logId = log.id;
  } catch (err) {
    console.error('[Email] Failed to create delivery log:', err);
  }

  try {
    const activeTransporter = await getTransporter();
    const fromAddress = config.email.user 
      ? `"QuietLedger Alerts" <${config.email.user}>` 
      : config.email.from;

    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text: body,
      html: html || `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #3182ce; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #1a365d; margin: 0; font-size: 20px;">${subject}</h2>
        </div>
        <p style="font-size: 15px; color: #2d3748; line-height: 1.6; white-space: pre-line; margin-bottom: 24px;">${body}</p>
        <hr style="border: none; border-top: 1px solid #edf2f7; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #a0aec0; margin: 0;">QuietLedger Security & Communication Engine • Port 4003</p>
      </div>`,
    };

    const info = await activeTransporter.sendMail(mailOptions);
    console.log(`[Email] Sent email to ${to}: ${subject} (MessageID: ${info.messageId})`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`[Email] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    if (logId) {
      await prisma.deliveryLog.update({
        where: { id: logId },
        data: {
          status: 'SENT',
          updatedAt: new Date(),
        },
      });
    }

    return { success: true, messageId: info.messageId, logId };
  } catch (error: any) {
    console.error(`[Email] Failed to send email to ${to}:`, error);
    if (error.code === 'EAUTH') {
      console.error('[Email] SMTP Authentication failed! If using Gmail, ensure 2-Step Verification is enabled and you generated a 16-character App Password from Google Account.');
    }

    if (logId) {
      await prisma.deliveryLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          error: error.message || String(error),
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
          updatedAt: new Date(),
        },
      });
    }

    return { success: false, error: error.message || String(error), logId };
  }
}
