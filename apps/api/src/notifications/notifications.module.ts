import { existsSync } from 'node:fs';
import { Logger, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { type AppConfig, CONFIG } from '../config/config';
import { FcmPushSender, StoredOnlySender } from './fcm.sender';
import { PrismaNotificationStore } from './notification.store';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_STORE, NOTIFY, PUSH_SENDER, type PushSender } from './notifications.interfaces';
import { NotificationsService } from './notifications.service';

export function pushSenderFromConfig(config: AppConfig): PushSender {
  const file = config.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (!file || !existsSync(file)) {
    new Logger('Notifications').warn(
      file
        ? `${file} not found: notifications are stored but not pushed`
        : 'FIREBASE_SERVICE_ACCOUNT_FILE is not set: notifications are stored but not pushed',
    );
    return new StoredOnlySender();
  }
  return FcmPushSender.fromFile(file, config.APP_WEB_URL?.replace(/\/$/, ''));
}

/** Notifications shared service (SDD §3.1.3): in-app list plus FCM push. */
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFY, useExisting: NotificationsService },
    { provide: NOTIFICATION_STORE, useClass: PrismaNotificationStore },
    { provide: PUSH_SENDER, inject: [CONFIG], useFactory: pushSenderFromConfig },
  ],
  exports: [NOTIFY],
})
export class NotificationsModule {}
