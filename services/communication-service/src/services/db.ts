import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const realPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

let isPostgresConnected = false;

// In-memory data store for standalone simulation mode when PostgreSQL server is not running
class MemoryStore {
  notifications: any[] = [];
  messages: any[] = [];
  conversations: any[] = [];
  conversationMembers: any[] = [];
  deliveryLogs: any[] = [];
  preferences: any[] = [];

  notification = {
    create: async ({ data }: { data: any }) => {
      const record = {
        id: crypto.randomUUID(),
        userId: data.userId,
        type: data.type || 'IN_APP',
        title: data.title,
        message: data.message,
        link: data.link || null,
        read: Boolean(data.read),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.notifications.unshift(record);
      return record;
    },
    findMany: async ({ where, orderBy, take }: any = {}) => {
      let results = [...this.notifications];
      if (where?.userId) results = results.filter((n) => n.userId === where.userId);
      if (where?.read !== undefined) results = results.filter((n) => n.read === where.read);
      if (take) results = results.slice(0, take);
      return results;
    },
    count: async ({ where }: any = {}) => {
      let results = [...this.notifications];
      if (where?.userId) results = results.filter((n) => n.userId === where.userId);
      if (where?.read !== undefined) results = results.filter((n) => n.read === where.read);
      return results.length;
    },
    update: async ({ where, data }: any) => {
      const item = this.notifications.find((n) => n.id === where.id);
      if (!item) throw new Error(`Notification not found: ${where.id}`);
      Object.assign(item, data, { updatedAt: new Date() });
      return item;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const item of this.notifications) {
        if (where?.userId && item.userId !== where.userId) continue;
        if (where?.read !== undefined && item.read !== where.read) continue;
        Object.assign(item, data, { updatedAt: new Date() });
        count++;
      }
      return { count };
    },
    delete: async ({ where }: any) => {
      const idx = this.notifications.findIndex((n) => n.id === where.id);
      if (idx === -1) throw new Error(`Notification not found: ${where.id}`);
      const [removed] = this.notifications.splice(idx, 1);
      return removed;
    },
  };

  message = {
    create: async ({ data }: { data: any }) => {
      const record = {
        id: crypto.randomUUID(),
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        mediaUrl: data.mediaUrl || null,
        createdAt: new Date(),
      };
      this.messages.push(record);
      return record;
    },
    findMany: async ({ where, take }: any = {}) => {
      let results = this.messages.filter((m) => m.conversationId === where?.conversationId);
      if (take) results = results.slice(-take);
      return results;
    },
  };

  conversation = {
    create: async ({ data, include }: any) => {
      const convId = crypto.randomUUID();
      const record = {
        id: convId,
        title: data.title || null,
        isGroup: Boolean(data.isGroup),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.conversations.unshift(record);

      const members: any[] = [];
      if (data.members?.create) {
        for (const m of data.members.create) {
          const memberRecord = {
            id: crypto.randomUUID(),
            conversationId: convId,
            userId: m.userId,
            role: m.role || 'MEMBER',
            joinedAt: new Date(),
          };
          this.conversationMembers.push(memberRecord);
          members.push(memberRecord);
        }
      }

      return {
        ...record,
        members: include?.members ? members : undefined,
      };
    },
    findMany: async ({ where, include }: any = {}) => {
      const targetUserId = where?.members?.some?.userId;
      let matchedConvs = this.conversations;

      if (targetUserId) {
        const userConvIds = new Set(
          this.conversationMembers.filter((m) => m.userId === targetUserId).map((m) => m.conversationId)
        );
        matchedConvs = this.conversations.filter((c) => userConvIds.has(c.id));
      }

      return matchedConvs.map((conv) => {
        const res: any = { ...conv };
        if (include?.members) {
          res.members = this.conversationMembers.filter((m) => m.conversationId === conv.id);
        }
        if (include?.messages) {
          res.messages = this.messages
            .filter((m) => m.conversationId === conv.id)
            .slice(-1);
        }
        return res;
      });
    },
    findUnique: async ({ where }: any) => {
      return this.conversations.find((c) => c.id === where.id) || null;
    },
    update: async ({ where, data }: any) => {
      const item = this.conversations.find((c) => c.id === where.id);
      if (!item) throw new Error(`Conversation not found: ${where.id}`);
      Object.assign(item, data);
      return item;
    },
  };

  deliveryLog = {
    create: async ({ data }: { data: any }) => {
      const record = {
        id: crypto.randomUUID(),
        channel: data.channel,
        recipient: data.recipient,
        subject: data.subject || null,
        content: data.content,
        status: data.status || 'PENDING',
        error: data.error || null,
        attempts: data.attempts || 1,
        maxAttempts: data.maxAttempts || 3,
        nextRetryAt: data.nextRetryAt || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.deliveryLogs.unshift(record);
      return record;
    },
    findUnique: async ({ where }: any) => {
      return this.deliveryLogs.find((l) => l.id === where.id) || null;
    },
    findMany: async ({ where, take }: any = {}) => {
      let results = [...this.deliveryLogs];
      if (where?.channel) results = results.filter((l) => l.channel === where.channel);
      if (where?.status?.in) results = results.filter((l) => where.status.in.includes(l.status));
      else if (where?.status) results = results.filter((l) => l.status === where.status);
      if (where?.attempts?.lt) results = results.filter((l) => l.attempts < where.attempts.lt);
      if (take) results = results.slice(0, take);
      return results;
    },
    update: async ({ where, data }: any) => {
      const item = this.deliveryLogs.find((l) => l.id === where.id);
      if (!item) throw new Error(`DeliveryLog not found: ${where.id}`);
      Object.assign(item, data, { updatedAt: new Date() });
      return item;
    },
  };

  notificationPreference = {
    findUnique: async ({ where }: any) => {
      return this.preferences.find((p) => p.userId === where.userId) || null;
    },
    create: async ({ data }: any) => {
      const record = {
        id: crypto.randomUUID(),
        userId: data.userId,
        emailEnabled: data.emailEnabled ?? true,
        smsEnabled: data.smsEnabled ?? true,
        inAppEnabled: data.inAppEnabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.preferences.push(record);
      return record;
    },
    upsert: async ({ where, update, create }: any) => {
      let item = this.preferences.find((p) => p.userId === where.userId);
      if (item) {
        Object.assign(item, update, { updatedAt: new Date() });
        return item;
      } else {
        const record = {
          id: crypto.randomUUID(),
          userId: where.userId,
          emailEnabled: create.emailEnabled ?? true,
          smsEnabled: create.smsEnabled ?? true,
          inAppEnabled: create.inAppEnabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.preferences.push(record);
        return record;
      }
    },
  };
}

const memoryStore = new MemoryStore();

// Smart proxy that routes to real PostgreSQL if connected, or memoryStore if running standalone simulation
export const prisma: any = new Proxy({}, {
  get(_target, prop) {
    if (isPostgresConnected && (realPrisma as any)[prop]) {
      return (realPrisma as any)[prop];
    }
    if ((memoryStore as any)[prop]) {
      return (memoryStore as any)[prop];
    }
    return (realPrisma as any)[prop];
  },
});

export async function connectDB() {
  try {
    // Attempt connecting to real PostgreSQL with 2s timeout probe
    await Promise.race([
      realPrisma.$connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PostgreSQL connection timeout')), 2000)),
    ]);
    isPostgresConnected = true;
    console.log(' Successfully connected to PostgreSQL database (communication_db).');
  } catch (error) {
    isPostgresConnected = false;
    console.log('⚠️  PostgreSQL is not running on localhost:5432.');
    console.log('✨ Activated In-Memory Database Engine: ready for instant simulation & zero-downtime testing!');
  }
}
