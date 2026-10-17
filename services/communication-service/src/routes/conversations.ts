import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitMessageToConversation } from '../modules/socket/socketServer';

const router = Router();

// POST /conversations - Create a conversation
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, isGroup, memberIds } = req.body;
    const currentUserId = req.user?.id || 'demo-user-123';

    const allMemberIds = Array.from(new Set([currentUserId, ...(memberIds || [])]));

    const conversation = await prisma.conversation.create({
      data: {
        title: title || (isGroup ? 'Group Conversation' : 'Direct Message'),
        isGroup: Boolean(isGroup),
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            role: userId === currentUserId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        members: true,
      },
    });

    return res.status(201).json(conversation);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /conversations - List user's conversations
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.query.userId as string || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: true,
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ conversations });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /conversations/:id/messages - Get chat history
router.get('/:id/messages', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string || '100', 10);

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return res.json({ conversationId: id, messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /conversations/:id/messages - Send a chat message
router.post('/:id/messages', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, mediaUrl, senderId } = req.body;
    const actualSenderId = senderId || req.user?.id || 'demo-user-123';

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: actualSenderId,
        content,
        mediaUrl,
      },
    });

    // Touch conversation updatedAt timestamp
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Broadcast live over Socket.IO room conversation:<id>
    emitMessageToConversation(id, message);

    return res.status(201).json(message);
  } catch (error: any) {
    console.error('Error sending conversation message:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
