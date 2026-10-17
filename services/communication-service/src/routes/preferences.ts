import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /preferences - Retrieve user settings
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = (req.query.userId as string) || req.user?.id || 'demo-user-123';

    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          userId,
          emailEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
        },
      });
    }

    return res.json(preferences);
  } catch (error: any) {
    console.error('Error fetching preferences:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// PUT /preferences - Update user settings
router.put('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.body.userId || req.user?.id || 'demo-user-123';
    const { emailEnabled, smsEnabled, inAppEnabled } = req.body;

    const updated = await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        ...(emailEnabled !== undefined ? { emailEnabled: Boolean(emailEnabled) } : {}),
        ...(smsEnabled !== undefined ? { smsEnabled: Boolean(smsEnabled) } : {}),
        ...(inAppEnabled !== undefined ? { inAppEnabled: Boolean(inAppEnabled) } : {}),
      },
      create: {
        userId,
        emailEnabled: emailEnabled !== undefined ? Boolean(emailEnabled) : true,
        smsEnabled: smsEnabled !== undefined ? Boolean(smsEnabled) : true,
        inAppEnabled: inAppEnabled !== undefined ? Boolean(inAppEnabled) : true,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating preferences:', error);
    return res.status(500).json({ error: error.message || 'Failed to update preferences' });
  }
});

export default router;
