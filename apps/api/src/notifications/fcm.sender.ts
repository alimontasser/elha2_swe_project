import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import type { PushMessage, PushResult, PushSender } from './notifications.interfaces';

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

type Fetch = typeof fetch;

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** An RS256 JWT signed with the service account's key (Google's OAuth "JWT bearer" grant). */
export function signServiceAccountJwt(account: ServiceAccount, audience: string, iatSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: audience, iat: iatSeconds, exp: iatSeconds + 3600 }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
}

/**
 * Sends through FCM HTTP v1 (US-11.01). Authenticates with a Firebase service account: a signed
 * JWT is exchanged for an access token, reused until shortly before it expires.
 */
export class FcmPushSender implements PushSender {
  readonly name = 'fcm';
  private readonly logger = new Logger('FcmPushSender');
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly options: { webLink?: string; fetch?: Fetch; now?: () => number } = {},
  ) {}

  static fromFile(path: string, webLink?: string): FcmPushSender {
    return new FcmPushSender(JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount, { webLink });
  }

  private get fetch(): Fetch {
    return this.options.fetch ?? fetch;
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > this.now()) return this.accessToken.value;
    const tokenUri = this.account.token_uri ?? 'https://oauth2.googleapis.com/token';
    const assertion = signServiceAccountJwt(this.account, tokenUri, Math.floor(this.now() / 1000));
    const res = await this.fetch(tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    if (!res.ok) throw new Error(`FCM auth failed with ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: body.access_token, expiresAt: this.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      const res = await this.fetch(`https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: message.token,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: { priority: 'high', notification: { click_action: 'FLUTTER_NOTIFICATION_CLICK' } },
            webpush: this.options.webLink ? { fcm_options: { link: `${this.options.webLink}/#${message.data.deepLink}` } } : undefined,
          },
        }),
      });
      if (res.ok) return 'sent';
      const error = (await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } };
      const code = error.error?.details?.find((d) => d.errorCode)?.errorCode ?? error.error?.status;
      if (res.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') return 'invalidToken';
      this.logger.warn(`FCM refused a message: ${res.status} ${code ?? ''}`);
      return 'failed';
    } catch (e) {
      this.logger.warn(`FCM unreachable: ${(e as Error).message}`);
      return 'failed';
    }
  }
}

/** Used when no Firebase service account is configured: notifications are stored, not pushed. */
export class StoredOnlySender implements PushSender {
  readonly name = 'none (no Firebase service account; stored only)';
  send(): Promise<PushResult> {
    return Promise.resolve('failed');
  }
}
