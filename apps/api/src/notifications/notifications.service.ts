import { Inject, Injectable, Logger } from '@nestjs/common';
import { type IMemberDirectory, MEMBER_DIRECTORY } from '../accounts/accounts.interfaces';
import { DEEP_LINKS, render } from './messages';
import type { NotificationStore, StoredNotification } from './notification.store';
import {
  type DevicePlatform,
  type INotify,
  NOTIFICATION_STORE,
  type NotificationType,
  PUSH_SENDER,
  type PushSender,
  type SentNotification,
} from './notifications.interfaces';

/** Notifications are listed for 30 days (US-11.05). */
export const KEEP_DAYS = 30;

@Injectable()
export class NotificationsService implements INotify {
  private readonly logger = new Logger('Notifications');

  constructor(
    @Inject(NOTIFICATION_STORE) private readonly store: NotificationStore,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
    @Inject(MEMBER_DIRECTORY) private readonly members: IMemberDirectory,
  ) {}

  /** US-11.01: store the notification, then push it to every device of the user. */
  async send(userId: string, type: NotificationType, values: Record<string, string | number> = {}): Promise<SentNotification> {
    const language = await this.members.language(userId);
    const { title, body } = render(type, language, values);
    const stored = await this.store.create({ userId, type, title, body, deepLink: DEEP_LINKS[type] });
    let delivered = 0;
    for (const token of await this.store.tokens(userId)) {
      const result = await this.push.send({ token, title, body, data: { notificationId: stored.id, type, deepLink: stored.deepLink } });
      if (result === 'sent') delivered++;
      if (result === 'invalidToken') await this.store.forgetToken(token);
    }
    this.logger.log(`${type} for one user: ${delivered} device(s) through ${this.push.name}`);
    return { ...stored, delivered };
  }

  languageOf(userId: string): Promise<'ar' | 'en'> {
    return this.members.language(userId);
  }

  registerDevice(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    return this.store.saveDevice(userId, token, platform);
  }

  removeDevice(userId: string, token: string): Promise<void> {
    return this.store.removeDevice(userId, token);
  }

  list(userId: string, now = new Date()): Promise<StoredNotification[]> {
    return this.store.list(userId, new Date(now.getTime() - KEEP_DAYS * 86_400_000));
  }

  markRead(userId: string, id: string, now = new Date()): Promise<boolean> {
    return this.store.markRead(userId, id, now);
  }
}
