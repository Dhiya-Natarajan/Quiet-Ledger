import { Router, Request, Response } from 'express';
import { processCommunicationEvent, EventPayload } from '../modules/events/kafkaConsumer';

const router = Router();

// POST /events/simulate - Trigger/Simulate Kafka Event manually
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const {
      eventType,
      caseId,
      complaintId,
      recipientUserId,
      recipientEmail,
      recipientPhone,
      title,
      message,
      link,
      metadata,
    } = req.body;

    if (!eventType || !recipientUserId || !title || !message) {
      return res.status(400).json({
        error: 'eventType, recipientUserId, title, and message are required parameters',
      });
    }

    const payload: EventPayload = {
      eventType,
      caseId,
      complaintId,
      recipientUserId,
      recipientEmail,
      recipientPhone,
      title,
      message,
      link,
      metadata,
    };

    const notification = await processCommunicationEvent(payload);

    return res.status(200).json({
      success: true,
      message: `Event '${eventType}' processed successfully for user ${recipientUserId}`,
      notification,
    });
  } catch (error: any) {
    console.error('Error simulating event:', error);
    return res.status(500).json({ error: error.message || 'Failed to simulate event' });
  }
});

export default router;
