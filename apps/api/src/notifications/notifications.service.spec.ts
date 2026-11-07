import type { IMemberDirectory } from '../accounts/accounts.interfaces';
import type { NotificationStore, StoredNotification } from './notification.store';
import type { DevicePlatform, PushMessage, PushResult, PushSender } from './notifications.interfaces';
import { NotificationsService } from './notifications.service';

class MemoryStore implements NotificationStore {
  devices = new Map<string, { userId: string; platform: DevicePlatform }>();
  rows: StoredNotification[] = [];
  saveDevice(userId: string, token: string, platform: DevicePlatform) {
    this.devices.set(token, { userId, platform });
    return Promise.resolve();
  }
  removeDevice(userId: string, token: string) {
    if (this.devices.get(token)?.userId === userId) this.devices.delete(token);
    return Promise.resolve();
  }
  forgetToken(token: string) {
    this.devices.delete(token);
    return Promise.resolve();
  }
  tokens(userId: string) {
    return Promise.resolve([...this.devices].filter(([, d]) => d.userId === userId).map(([t]) => t));
  }
  create(n: Omit<StoredNotification, 'id' | 'sentAt' | 'readAt'>) {
    const row = { ...n, id: `n${this.rows.length + 1}`, sentAt: new Date('2026-11-07T08:00:00Z'), readAt: null };
    this.rows.push(row);
    return Promise.resolve(row);
  }
  list(userId: string, since: Date) {
    return Promise.resolve(this.rows.filter((r) => r.userId === userId && r.sentAt >= since));
  }
  markRead(userId: string, id: string, at: Date) {
    const row = this.rows.find((r) => r.id === id && r.userId === userId && !r.readAt);
    if (row) row.readAt = at;
    return Promise.resolve(!!row);
  }
}

class FakeSender implements PushSender {
  readonly name = 'fake';
  sent: PushMessage[] = [];
  constructor(private readonly results: Record<string, PushResult> = {}) {}
  send(m: PushMessage) {
    this.sent.push(m);
    return Promise.resolve(this.results[m.token] ?? 'sent');
  }
}

const members = (language: 'ar' | 'en'): IMemberDirectory => ({
  resolve: () => Promise.reject(new Error('unused')),
  language: () => Promise.resolve(language),
});

describe('NotificationsService (US-11.01)', () => {
  it('stores the notification and pushes it to every device, with the deep link in the data', async () => {
    const store = new MemoryStore();
    const push = new FakeSender();
    const service = new NotificationsService(store, push, members('ar'));
    await service.registerDevice('u1', 'token-phone', 'android');
    await service.registerDevice('u1', 'token-browser', 'web');
    await service.registerDevice('u2', 'token-other', 'web');

    const sent = await service.send('u1', 'expiryDigest', { count: 3 });
    expect(sent.delivered).toBe(2);
    expect(sent.title).toBe('حاجات قربت تخلص');
    expect(sent.body).toContain('3');
    expect(push.sent.map((m) => m.token).sort()).toEqual(['token-browser', 'token-phone']);
    expect(push.sent[0].data).toEqual({ notificationId: sent.id, type: 'expiryDigest', deepLink: '/pantry' });
    expect(await service.list('u1', new Date('2026-11-08T00:00:00Z'))).toHaveLength(1);
  });

  it('writes in the reader’s language and links reservations to Deals', async () => {
    const push = new FakeSender();
    const service = new NotificationsService(new MemoryStore(), push, members('en'));
    await service.registerDevice('u1', 'token-phone', 'android');
    const sent = await service.send('u1', 'reservation', { store: 'Al Shams Bakery', pickup: 'today 8–9 pm' });
    expect(sent.title).toBe('Reservation confirmed');
    expect(sent.body).toBe('Your order from Al Shams Bakery is confirmed. Pickup today 8–9 pm.');
    expect(sent.deepLink).toBe('/deals');
  });

  it('forgets a device FCM reports as gone, and still stores the notification', async () => {
    const store = new MemoryStore();
    const service = new NotificationsService(store, new FakeSender({ 'token-old': 'invalidToken' }), members('ar'));
    await service.registerDevice('u1', 'token-old', 'web');
    const sent = await service.send('u1', 'pickup', { store: 'x', pickup: '9' });
    expect(sent.delivered).toBe(0);
    expect(store.devices.has('token-old')).toBe(false);
    expect(store.rows).toHaveLength(1);
  });

  it('lists only the last 30 days and marks one read once', async () => {
    const store = new MemoryStore();
    const service = new NotificationsService(store, new FakeSender(), members('ar'));
    const sent = await service.send('u1', 'expiryDigest', { count: 1 });
    expect(await service.list('u1', new Date('2026-12-08T00:00:00Z'))).toHaveLength(0);
    expect(await service.markRead('u1', sent.id)).toBe(true);
    expect(await service.markRead('u1', sent.id)).toBe(false);
    expect(await service.markRead('u2', sent.id)).toBe(false);
  });
});
