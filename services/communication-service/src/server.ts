import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { connectDB } from './services/db';
import { initSocketServer } from './modules/socket/socketServer';
import { startDeliveryWorker } from './modules/delivery/deliveryWorker';
import { startKafkaConsumer } from './modules/events/kafkaConsumer';

import notificationRoutes from './routes/notifications';
import messageRoutes from './routes/messages';
import conversationRoutes from './routes/conversations';
import preferenceRoutes from './routes/preferences';
import eventRoutes from './routes/events';

const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'Communication Service',
    status: 'healthy',
    port: config.port,
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// API Routes
app.use('/notifications', notificationRoutes);
app.use('/messages', messageRoutes);
app.use('/conversations', conversationRoutes);
app.use('/preferences', preferenceRoutes);
app.use('/events', eventRoutes);

// Initialize WebSockets
initSocketServer(server);

// Start background workers and services
async function bootstrap() {
  await connectDB();
  startDeliveryWorker(30000); // Check retries every 30 seconds
  await startKafkaConsumer();

  server.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(` Communication Service running on Port ${config.port}`);
    console.log(` Database: PostgreSQL (${config.databaseUrl.split('@')[1] || 'localhost'})`);
    console.log(` Socket.IO WebSocket Server initialized on port ${config.port}`);
    console.log(` Email Engine: Nodemailer (SMTP: ${config.email.host})`);
    console.log(` SMS Engine: Twilio / Mock Provider`);
    console.log(` Kafka Consumer Enabled: ${config.kafka.enabled}`);
    console.log(`=======================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start Communication Service server:', err);
  process.exit(1);
});
