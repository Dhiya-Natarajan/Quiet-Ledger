import twilio from 'twilio';
import { config } from '../../config';
import { prisma } from '../../services/db';

let twilioClient: twilio.Twilio | null = null;

if (config.sms.accountSid && config.sms.authToken) {
  twilioClient = twilio(config.sms.accountSid, config.sms.authToken);
}

export interface SendSmsParams {
  to: string;
  message: string;
}

export async function sendSms(params: SendSmsParams) {
  const { to, message } = params;

  let logId = '';
  try {
    const log = await prisma.deliveryLog.create({
      data: {
        channel: 'SMS',
        recipient: to,
        content: message,
        status: 'PENDING',
        attempts: 1,
      },
    });
    logId = log.id;
  } catch (err) {
    console.error('[SMS] Failed to create delivery log:', err);
  }

  try {
    if (twilioClient && !config.sms.enableMock) {
      const response = await twilioClient.messages.create({
        body: message,
        from: config.sms.fromNumber,
        to,
      });

      console.log(`[SMS] Twilio SMS dispatched to ${to} (SID: ${response.sid})`);

      if (logId) {
        await prisma.deliveryLog.update({
          where: { id: logId },
          data: { status: 'SENT', updatedAt: new Date() },
        });
      }

      return { success: true, sid: response.sid, logId };
    } else {
      // Mock SMS Provider fallback
      console.log(`[SMS Mock] 📱 SMS to ${to}: "${message}"`);

      if (logId) {
        await prisma.deliveryLog.update({
          where: { id: logId },
          data: { status: 'SENT', updatedAt: new Date() },
        });
      }

      return { success: true, sid: `mock-sms-${Date.now()}`, logId };
    }
  } catch (error: any) {
    console.error(`[SMS] Failed to send SMS to ${to}:`, error);

    if (logId) {
      await prisma.deliveryLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          error: error.message || String(error),
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
          updatedAt: new Date(),
        },
      });
    }

    return { success: false, error: error.message || String(error), logId };
  }
}
