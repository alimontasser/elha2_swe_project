import { createVerify, generateKeyPairSync } from 'node:crypto';
import { FcmPushSender } from './fcm.sender';
import type { PushMessage } from './notifications.interfaces';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = {
  project_id: 'elha2-test',
  client_email: 'fcm@elha2-test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};

const message = (token: string): PushMessage => ({
  token,
  title: 'حاجات قربت تخلص',
  body: 'عندك 3 حاجة',
  data: { notificationId: 'n1', type: 'expiryDigest', deepLink: '/pantry' },
});

function fakeFetch(sendStatus: (token: string) => { status: number; body?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (input: string | URL | Request, init: RequestInit = {}) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });
    if (url.includes('oauth2')) {
      return Promise.resolve(new Response(JSON.stringify({ access_token: 'access-1', expires_in: 3600 }), { status: 200 }));
    }
    const token = (JSON.parse(init.body as string) as { message: { token: string } }).message.token;
    const { status, body } = sendStatus(token);
    return Promise.resolve(new Response(JSON.stringify(body ?? {}), { status }));
  };
  return { fn: fn, calls };
}

describe('FcmPushSender', () => {
  it('signs in with the service account once and sends FCM v1 messages with the deep link', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200 }));
    const sender = new FcmPushSender(account, { fetch: fn, webLink: 'https://elha2.web.app' });
    expect(await sender.send(message('t1'))).toBe('sent');
    expect(await sender.send(message('t2'))).toBe('sent');

    const auth = calls.filter((c) => c.url.includes('oauth2'));
    expect(auth).toHaveLength(1);
    const assertion = new URLSearchParams(auth[0].init.body as string).get('assertion')!;
    const [header, payload, signature] = assertion.split('.');
    expect(createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
    expect(claims.iss).toBe(account.client_email);
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    expect(claims.scope).toBe('https://www.googleapis.com/auth/firebase.messaging');

    const send = calls.find((c) => c.url.includes('fcm.googleapis.com'))!;
    expect(send.url).toBe('https://fcm.googleapis.com/v1/projects/elha2-test/messages:send');
    expect((send.init.headers as Record<string, string>).authorization).toBe('Bearer access-1');
    const body = JSON.parse(send.init.body as string) as { message: Record<string, unknown> };
    expect(body.message.data).toEqual({ notificationId: 'n1', type: 'expiryDigest', deepLink: '/pantry' });
    expect(body.message.webpush).toEqual({ fcm_options: { link: 'https://elha2.web.app/#/pantry' } });
  });

  it('reports a device FCM no longer knows, and other refusals as failures', async () => {
    const { fn } = fakeFetch((token) =>
      token === 'gone'
        ? { status: 404, body: { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } } }
        : { status: 503, body: { error: { status: 'UNAVAILABLE' } } },
    );
    const sender = new FcmPushSender(account, { fetch: fn });
    expect(await sender.send(message('gone'))).toBe('invalidToken');
    expect(await sender.send(message('busy'))).toBe('failed');
  });
});
