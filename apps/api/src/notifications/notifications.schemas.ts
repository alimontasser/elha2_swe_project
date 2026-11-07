import { z } from 'zod';
import { NOTIFICATION_TYPES } from './notifications.interfaces';

export const RegisterDeviceBody = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.enum(['web', 'android', 'ios']),
});

export const TestPushBody = z.object({
  type: z.enum(NOTIFICATION_TYPES),
});
