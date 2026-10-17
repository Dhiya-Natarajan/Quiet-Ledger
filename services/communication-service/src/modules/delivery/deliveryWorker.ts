import { prisma } from '../../services/db';
import { sendEmail } from '../email/emailService';
import { sendSms } from '../sms/smsService';

let isRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;

export async function processDeliveryRetries() {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const pendingRetries = await prisma.deliveryLog.findMany({
      where: {
        status: { in: ['FAILED', 'RETRYING'] },
        attempts: { lt: 3 }, // maxAttempts
        OR: [
          { nextRetryAt: { lte: now } },
          { nextRetryAt: null },
        ],
      },
      take: 20,
    });

    if (pendingRetries.length > 0) {
      console.log(`[DeliveryWorker] Found ${pendingRetries.length} failed delivery logs scheduled for retry.`);
    }

    for (const log of pendingRetries) {
      const currentAttempt = log.attempts + 1;
      console.log(`[DeliveryWorker] Retrying ${log.channel} delivery (Log ID: ${log.id}, Attempt #${currentAttempt})...`);

      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: 'RETRYING',
          attempts: currentAttempt,
          updatedAt: new Date(),
        },
      });

      let res: { success: boolean; error?: string } = { success: false };

      if (log.channel === 'EMAIL') {
        res = await sendEmail({
          to: log.recipient,
          subject: log.subject || 'Retry Notification',
          body: log.content,
        });
      } else if (log.channel === 'SMS') {
        res = await sendSms({
          to: log.recipient,
          message: log.content,
        });
      }

      if (res.success) {
        await prisma.deliveryLog.update({
          where: { id: log.id },
          data: {
            status: 'SENT',
            error: null,
            updatedAt: new Date(),
          },
        });
        console.log(`[DeliveryWorker] Log ${log.id} successfully sent on attempt #${currentAttempt}`);
      } else {
        const backoffMinutes = Math.pow(2, currentAttempt) * 5; // Exponential backoff: 10m, 20m, etc.
        const nextTime = new Date(Date.now() + backoffMinutes * 60 * 1000);
        await prisma.deliveryLog.update({
          where: { id: log.id },
          data: {
            status: currentAttempt >= log.maxAttempts ? 'FAILED' : 'RETRYING',
            error: res.error || 'Retry failed',
            nextRetryAt: nextTime,
            updatedAt: new Date(),
          },
        });
        console.warn(`[DeliveryWorker] Log ${log.id} retry #${currentAttempt} failed: ${res.error}`);
      }
    }
  } catch (error) {
    console.error('[DeliveryWorker] Error executing retry cycle:', error);
  } finally {
    isRunning = false;
  }
}

export function startDeliveryWorker(intervalMs: number = 30000) {
  console.log(`[DeliveryWorker] Started background delivery retry worker (Polling interval: ${intervalMs / 1000}s).`);
  intervalHandle = setInterval(processDeliveryRetries, intervalMs);
}

export function stopDeliveryWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[DeliveryWorker] Stopped background delivery retry worker.');
  }
}
