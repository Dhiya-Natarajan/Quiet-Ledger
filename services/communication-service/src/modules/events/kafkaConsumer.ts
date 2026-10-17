import { Kafka, Consumer } from 'kafkajs';
import { config } from '../../config';
import { prisma } from '../../services/db';
import { emitNotificationToUser } from '../socket/socketServer';
import { sendEmail } from '../email/emailService';
import { sendSms } from '../sms/smsService';

let kafkaConsumer: Consumer | null = null;

export interface EventPayload {
  eventType: 'CASE_ASSIGNED' | 'COMPLAINT_CREATED' | 'STATUS_UPDATED' | string;
  caseId?: string;
  complaintId?: string;
  recipientUserId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export async function processCommunicationEvent(event: EventPayload) {
  console.log(`[EventProcessor] Received event: ${event.eventType} for User: ${event.recipientUserId}`);

  // Fetch or default notification preferences for target user
  let prefs = await prisma.notificationPreference.findUnique({
    where: { userId: event.recipientUserId },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: {
        userId: event.recipientUserId,
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
      },
    });
  }

  // 1. In-App Notification Creation
  let createdNotification = null;
  if (prefs.inAppEnabled) {
    createdNotification = await prisma.notification.create({
      data: {
        userId: event.recipientUserId,
        type: event.eventType,
        title: event.title,
        message: event.message,
        link: event.link || (event.caseId ? `/cases/${event.caseId}` : undefined),
        read: false,
      },
    });

    // Broadcast live to Socket.IO user room
    emitNotificationToUser(event.recipientUserId, createdNotification);
  }

  // 2. Email Delivery
  if (prefs.emailEnabled && (event.recipientEmail || event.metadata?.email)) {
    const emailTo = event.recipientEmail || event.metadata?.email;
    await sendEmail({
      to: emailTo,
      subject: `[CivicConnect] ${event.title}`,
      body: `${event.message}\n\nCase ID: ${event.caseId || 'N/A'}\nView details: ${event.link || 'Dashboard'}`,
    });
  }

  // 3. SMS Delivery
  if (prefs.smsEnabled && (event.recipientPhone || event.metadata?.phone)) {
    const phoneTo = event.recipientPhone || event.metadata?.phone;
    await sendSms({
      to: phoneTo,
      message: `${event.title}: ${event.message}`,
    });
  }

  return createdNotification;
}

export async function startKafkaConsumer() {
  if (!config.kafka.enabled) {
    console.log('[Kafka] Kafka consumer is disabled (ENABLE_KAFKA=false). Operating in standalone API mode.');
    return;
  }

  try {
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });

    kafkaConsumer = kafka.consumer({ groupId: config.kafka.groupId });
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe({ topics: ['case-events', 'complaint-events'], fromBeginning: false });

    console.log(' Kafka consumer connected and subscribed to case/complaint topics.');

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (message.value) {
            const payload: EventPayload = JSON.parse(message.value.toString());
            console.log(`[Kafka] Message received from topic ${topic}[${partition}]:`, payload.eventType);
            await processCommunicationEvent(payload);
          }
        } catch (err) {
          console.error('[Kafka] Error parsing or processing event:', err);
        }
      },
    });
  } catch (error) {
    console.warn('[Kafka] Could not connect to Kafka brokers. Fallback to REST API event triggers:', error);
  }
}
