import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DevicePlatform, NotificationType } from './notifications.interfaces';

export interface StoredNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string;
  sentAt: Date;
  readAt: Date | null;
}

/** What Notifications keeps, in the "notifications" schema. */
export interface NotificationStore {
  saveDevice(userId: string, token: string, platform: DevicePlatform): Promise<void>;
  removeDevice(userId: string, token: string): Promise<void>;
  /** Drops a token FCM reported as gone, whoever it belonged to. */
  forgetToken(token: string): Promise<void>;
  tokens(userId: string): Promise<string[]>;
  create(n: Omit<StoredNotification, 'id' | 'sentAt' | 'readAt'>): Promise<StoredNotification>;
  list(userId: string, since: Date): Promise<StoredNotification[]>;
  markRead(userId: string, id: string, at: Date): Promise<boolean>;
}

@Injectable()
export class PrismaNotificationStore implements NotificationStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async saveDevice(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    // A token moves to whoever signed in last on that device.
    await this.db.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
  }

  async removeDevice(userId: string, token: string): Promise<void> {
    await this.db.deviceToken.deleteMany({ where: { userId, token } });
  }

  async forgetToken(token: string): Promise<void> {
    await this.db.deviceToken.deleteMany({ where: { token } });
  }

  async tokens(userId: string): Promise<string[]> {
    const rows = await this.db.deviceToken.findMany({ where: { userId }, select: { token: true } });
    return rows.map((r) => r.token);
  }

  create(n: Omit<StoredNotification, 'id' | 'sentAt' | 'readAt'>): Promise<StoredNotification> {
    return this.db.notification.create({ data: n });
  }

  list(userId: string, since: Date): Promise<StoredNotification[]> {
    return this.db.notification.findMany({ where: { userId, sentAt: { gte: since } }, orderBy: { sentAt: 'desc' }, take: 100 });
  }

  async markRead(userId: string, id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: at } });
    return count > 0;
  }
}
