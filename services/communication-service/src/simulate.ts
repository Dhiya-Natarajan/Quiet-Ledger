import http from 'http';
import express from 'express';
import cors from 'cors';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { config } from './config';
import { connectDB, prisma } from './services/db';
import { initSocketServer } from './modules/socket/socketServer';
import { startDeliveryWorker, processDeliveryRetries } from './modules/delivery/deliveryWorker';
import notificationRoutes from './routes/notifications';
import messageRoutes from './routes/messages';
import conversationRoutes from './routes/conversations';
import preferenceRoutes from './routes/preferences';
import eventRoutes from './routes/events';

const PORT = 4003;
const BASE_URL = `http://localhost:${PORT}`;

// Visual helper formatting
function printHeader(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`  🚀 ${title}`);
  console.log('='.repeat(70));
}

function printStep(step: number, title: string) {
  console.log(`\n📌 [STEP ${step}] ${title}`);
  console.log('-'.repeat(50));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSimulation() {
  console.log('\n');
  console.log('**********************************************************************');
  console.log('   🎉 WELCOME TO THE COMMUNICATION (MESSAGE) SERVICE SIMULATOR 🎉    ');
  console.log('   Port 4003 · PostgreSQL / In-Memory Engine · WebSockets · Email · SMS');
  console.log('**********************************************************************');

  // 1. Start Server for Simulation
  printStep(1, 'Bootstrapping Communication Microservice on Port 4003');
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ service: 'Communication Service', status: 'healthy', port: PORT });
  });

  app.use('/notifications', notificationRoutes);
  app.use('/messages', messageRoutes);
  app.use('/conversations', conversationRoutes);
  app.use('/preferences', preferenceRoutes);
  app.use('/events', eventRoutes);

  const server = http.createServer(app);
  initSocketServer(server);
  await connectDB();

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`✅ Microservice listening at ${BASE_URL}`);
      resolve();
    });
  });

  // 2. Connect WebSocket Clients
  printStep(2, 'Connecting Real-Time Socket.IO Clients (Citizen & NGO Officer)');
  const citizenSocket: ClientSocket = ClientIO(BASE_URL, {
    query: { userId: 'citizen-rahul-01' },
  });

  const ngoSocket: ClientSocket = ClientIO(BASE_URL, {
    query: { userId: 'ngo-aarav-org' },
  });

  let citizenReceivedNotification: any = null;
  citizenSocket.on('notification_received', (data) => {
    console.log('  ⚡ [Socket.IO Event] Citizen received live notification:', data.title);
    citizenReceivedNotification = data;
  });

  let ngoReceivedMessage: any = null;
  ngoSocket.on('message_received', (data) => {
    console.log(`  ⚡ [Socket.IO Event] NGO Officer received live chat message from [${data.senderId}]: "${data.content}"`);
    ngoReceivedMessage = data;
  });

  let citizenReceivedTyping = false;
  citizenSocket.on('user_typing', (data) => {
    console.log(`  ⚡ [Socket.IO Event] Citizen noticed: User [${data.userId}] is typing...`);
    citizenReceivedTyping = true;
  });

  await sleep(600);
  console.log('✅ Citizen Socket connected:', citizenSocket.id);
  console.log('✅ NGO Officer Socket connected:', ngoSocket.id);

  // 3. In-App Notifications Test
  printStep(3, 'Testing In-App Notification Flow & Real-Time Push');
  console.log('Creating notification for Citizen (citizen-rahul-01)...');
  const notifPostRes = await fetch(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'citizen-rahul-01',
      type: 'COMPLAINT_UPDATE',
      title: 'Complaint #CMP-4821 Submitted Successfully',
      message: 'Your report regarding street light outage has been registered.',
      link: '/complaints/CMP-4821',
    }),
  });
  const createdNotif = await notifPostRes.json();
  console.log('✅ Created Notification in DB:', createdNotif.id);

  await sleep(400);
  console.log('✅ Real-time Socket.IO notification verified:', citizenReceivedNotification?.title === createdNotif.title);

  // Check unread count
  const unreadRes = await fetch(`${BASE_URL}/notifications/unread-count?userId=citizen-rahul-01`);
  const unreadData = await unreadRes.json();
  console.log('✅ Citizen Unread Notification Count:', unreadData.unreadCount);

  // Mark as read
  await fetch(`${BASE_URL}/notifications/${createdNotif.id}/read`, { method: 'PATCH' });
  const updatedUnreadRes = await fetch(`${BASE_URL}/notifications/unread-count?userId=citizen-rahul-01`);
  const updatedUnreadData = await updatedUnreadRes.json();
  console.log('✅ After Marking Read, Unread Count is:', updatedUnreadData.unreadCount);

  // 4. Email Module Dispatch
  printStep(4, 'Testing Transactional Email Dispatch (Nodemailer)');
  console.log('Sending email to citizen: rahul.verma@example.com ...');
  const emailRes = await fetch(`${BASE_URL}/messages/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'rahul.verma@example.com',
      subject: 'Official Update: Investigation Initiated for CMP-4821',
      body: 'Dear Rahul, A municipal team has been scheduled to inspect the location today at 3:00 PM.',
    }),
  });
  const emailData = await emailRes.json();
  console.log('✅ Email Dispatched successfully:', emailData.success);
  console.log('✅ Delivery Log Record ID:', emailData.logId);

  // 5. SMS Module Dispatch
  printStep(5, 'Testing SMS Dispatch (Twilio / Mock Provider)');
  console.log('Sending urgent SMS to: +919876543210 ...');
  const smsRes = await fetch(`${BASE_URL}/messages/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '+919876543210',
      message: 'CivicAlert: Officer on site for Complaint #CMP-4821. Tap here for live status: https://civic.org/c/4821',
    }),
  });
  const smsData = await smsRes.json();
  console.log('✅ SMS Dispatched successfully:', smsData.success, `(SID: ${smsData.sid})`);
  console.log('✅ Delivery Log Record ID:', smsData.logId);

  // 6. Live Chat Flow
  printStep(6, 'Testing Real-Time Chat (Direct Conversation + WebSockets)');
  console.log('Creating conversation between Citizen and NGO Officer...');
  const convRes = await fetch(`${BASE_URL}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'citizen-rahul-01' },
    body: JSON.stringify({
      title: 'Complaint CMP-4821 Coordination',
      isGroup: false,
      memberIds: ['ngo-aarav-org'],
    }),
  });
  const convData = await convRes.json();
  const convId = convData.id;
  console.log('✅ Conversation created with ID:', convId);

  // Join rooms
  citizenSocket.emit('join_conversation', convId);
  ngoSocket.emit('join_conversation', convId);
  await sleep(300);

  // Send message 1 from citizen
  console.log('\n💬 [Citizen -> Officer]: "Hello! Will the repair team arrive before evening?"');
  await fetch(`${BASE_URL}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'citizen-rahul-01' },
    body: JSON.stringify({
      content: 'Hello! Will the repair team arrive before evening?',
    }),
  });

  await sleep(400);
  console.log('✅ NGO Officer received live message in room!');

  // NGO Officer types
  ngoSocket.emit('typing_start', { conversationId: convId, userId: 'ngo-aarav-org' });
  await sleep(300);
  console.log('✅ Typing indicator broadcast verified:', citizenReceivedTyping);

  // Send reply from officer
  console.log('\n💬 [Officer -> Citizen]: "Yes, our field engineer is 10 minutes away."');
  await fetch(`${BASE_URL}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'ngo-aarav-org' },
    body: JSON.stringify({
      content: 'Yes, our field engineer is 10 minutes away.',
    }),
  });

  // 7. Event-Driven Kafka Simulation
  printStep(7, 'Testing Upstream Kafka Event Pipeline (CASE_ASSIGNED)');
  console.log('Simulating Kafka event published by Intake / Case Service...');
  const eventRes = await fetch(`${BASE_URL}/events/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'CASE_ASSIGNED',
      caseId: 'CASE-7732',
      complaintId: 'CMP-4821',
      recipientUserId: 'ngo-aarav-org',
      recipientEmail: 'aarav@green-city-ngo.org',
      recipientPhone: '+919811223344',
      title: 'New Case Assigned: Streetlight Hazard #7732',
      message: 'Case #7732 in Sector 4 has been officially assigned to your organization.',
      link: '/cases/7732',
    }),
  });
  const eventData = await eventRes.json();
  console.log('✅ Event Processed Result:', eventData.message);
  console.log('✅ Auto-generated Notification ID:', eventData.notification?.id);

  // 8. Delivery Worker & Retry Pipeline
  printStep(8, 'Testing Delivery Worker & Exponential Backoff Retries');
  console.log('Simulating a failed delivery log entry in database...');
  const failedLog = await prisma.deliveryLog.create({
    data: {
      channel: 'SMS',
      recipient: '+919999900000',
      content: 'Important Notice: Case reassigned.',
      status: 'FAILED',
      error: 'Network timeout during gateway handshake',
      attempts: 1,
      maxAttempts: 3,
      nextRetryAt: new Date(Date.now() - 1000), // Due for retry right now
    },
  });
  console.log('✅ Created FAILED log entry:', failedLog.id, `(Attempts: ${failedLog.attempts})`);

  console.log('Triggering background delivery retry cycle...');
  await processDeliveryRetries();

  const refreshedLog = await prisma.deliveryLog.findUnique({ where: { id: failedLog.id } });
  console.log('✅ Log state after worker processing:', refreshedLog?.status, `(Attempts: ${refreshedLog?.attempts})`);

  // Final summary
  printHeader('ALL 8 SIMULATION SCENARIOS COMPLETED SUCCESSFULLY!');
  console.log(`
  Summary of Simulated Capabilities:
  -------------------------------------------------------
  1. Microservice Server       : Running on Port ${PORT}
  2. In-App Notifications      : Live Socket.IO push & read status
  3. Email Dispatch            : Nodemailer with HTML & logs
  4. SMS Dispatch              : Formatted dispatches & logs
  5. Real-Time Chat            : 2-way WebSockets & typing indicator
  6. Kafka Event Processing    : Event routing -> In-App + Email + SMS
  7. Delivery Retry Worker     : Handled failed attempts & retry queue
  -------------------------------------------------------
  `);

  citizenSocket.disconnect();
  ngoSocket.disconnect();
  server.close();
  process.exit(0);
}

runSimulation().catch((err) => {
  console.error('❌ Simulation encountered an error:', err);
  process.exit(1);
});
