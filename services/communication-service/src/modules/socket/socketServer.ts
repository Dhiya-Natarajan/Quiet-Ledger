import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    },
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket.handshake.query.userId as string) || (socket.handshake.headers['x-user-id'] as string) || 'guest';
    console.log(`[Socket.IO] Client connected: ${socket.id} (UserId: ${userId})`);

    // Automatically join user's private notification channel room
    socket.join(`user:${userId}`);

    // Join conversation rooms
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket.IO] User ${userId} joined room: conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`[Socket.IO] User ${userId} left room: conversation:${conversationId}`);
    });

    // Handle typing status updates
    socket.on('typing_start', (data: { conversationId: string; userId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_typing', data);
    });

    socket.on('typing_stop', (data: { conversationId: string; userId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_stopped_typing', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
}

export function emitNotificationToUser(userId: string, notification: any) {
  if (io) {
    io.to(`user:${userId}`).emit('notification_received', notification);
    console.log(`[Socket.IO] Emitted notification to room user:${userId}`);
  }
}

export function emitMessageToConversation(conversationId: string, message: any) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit('message_received', message);
    console.log(`[Socket.IO] Emitted message to room conversation:${conversationId}`);
  }
}
