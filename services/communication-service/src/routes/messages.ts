import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sendEmail } from '../modules/email/emailService';
import { sendSms } from '../modules/sms/smsService';

const router = Router();

// POST /messages/email - Send an email
router.post('/email', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, subject, body, html } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body parameters are required' });
    }

    const result = await sendEmail({ to, subject, body, html });
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    console.error('Error sending email route:', error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// POST /messages/sms - Send an SMS
router.post('/sms', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'to and message parameters are required' });
    }

    const result = await sendSms({ to, message });
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    console.error('Error sending SMS route:', error);
    return res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
});

// GET /delivery/:id - Check delivery status
router.get('/delivery/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const log = await prisma.deliveryLog.findUnique({
      where: { id },
    });

    if (!log) {
      return res.status(404).json({ error: 'Delivery log not found' });
    }

    return res.json(log);
  } catch (error: any) {
    console.error('Error fetching delivery log:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /delivery - List recent delivery logs
router.get('/delivery', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const channel = req.query.channel as string;
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string || '50', 10);

    const logs = await prisma.deliveryLog.findMany({
      where: {
        ...(channel ? { channel } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({ logs, count: logs.length });
  } catch (error: any) {
    console.error('Error listing delivery logs:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /delivery/:id/retry - Force immediate retry of a failed log
router.post('/delivery/:id/retry', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const log = await prisma.deliveryLog.findUnique({ where: { id } });

    if (!log) {
      return res.status(404).json({ error: 'Delivery log not found' });
    }

    let resAttempt;
    if (log.channel === 'EMAIL') {
      resAttempt = await sendEmail({
        to: log.recipient,
        subject: log.subject || 'Retry',
        body: log.content,
      });
    } else {
      resAttempt = await sendSms({
        to: log.recipient,
        message: log.content,
      });
    }

    return res.json({ message: 'Retry attempt dispatched', result: resAttempt });
  } catch (error: any) {
    console.error('Error retrying delivery log:', error);
    return res.status(500).json({ error: error.message || 'Retry failed' });
  }
});

export default router;
