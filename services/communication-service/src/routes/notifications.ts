import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitNotificationToUser } from '../modules/socket/socketServer';

const router = Router();

// POST /notifications - Create a notification
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, type, title, message, link } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'userId, title, and message are required' });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type || 'IN_APP',
        title,
        message,
        link,
        read: false,
      },
    });

    emitNotificationToUser(userId, notification);

    return res.status(201).json(notification);
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /notifications - Get current user's notifications
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.query.userId as string || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = parseInt(req.query.limit as string || '50', 10);

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({ notifications, count: notifications.length });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /notifications/unread-count - Get unread count
router.get('/unread-count', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.query.userId as string || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return res.json({ userId, unreadCount: count });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// PATCH /notifications/:id/read - Mark single notification as read
router.patch('/:id/read', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('Error marking notification read:', error);
    return res.status(500).json({ error: error.message || 'Failed to update notification' });
  }
});

// PATCH /notifications/read-all - Mark all as read
router.patch('/read-all', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return res.json({ message: 'All notifications marked as read', updatedCount: result.count });
  } catch (error: any) {
    console.error('Error marking all notifications read:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// DELETE /notifications/:id - Delete a notification
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id },
    });

    return res.json({ message: 'Notification deleted successfully', id });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete notification' });
  }
});

export default router;
