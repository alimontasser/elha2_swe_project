export const NOTIFICATION_TYPES = ['expiryDigest', 'reservation', 'pickup'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type DevicePlatform = 'web' | 'android' | 'ios';

/** Offered by Notifications to every module (SDD §3.2.4): store the notification and push it. */
export interface INotify {
  send(userId: string, type: NotificationType, values?: Record<string, string | number>): Promise<SentNotification>;
}

export interface SentNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string;
  sentAt: Date;
  readAt: Date | null;
  /** How many of the user's devices FCM accepted it for. */
  delivered: number;
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** Data the app reads to open the right screen (all values are strings, as FCM requires). */
  data: { notificationId: string; type: NotificationType; deepLink: string };
}

/** invalidToken: FCM says the device is gone, so the token is deleted. */
export type PushResult = 'sent' | 'invalidToken' | 'failed';

/** The push channel (Adapter over FCM HTTP v1, SDD §3.1.4). */
export interface PushSender {
  readonly name: string;
  send(message: PushMessage): Promise<PushResult>;
}

export const NOTIFY = Symbol('INotify');
export const PUSH_SENDER = Symbol('PushSender');
export const NOTIFICATION_STORE = Symbol('NotificationStore');
