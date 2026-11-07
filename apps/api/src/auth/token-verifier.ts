import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { type AppConfig, CONFIG } from '../config/config';

export interface VerifiedLogin {
  authUid: string;
  phone?: string;
}

/**
 * Checks the login token on every request (NFR-10). With SUPABASE_URL set, tokens are verified
 * against the project's published keys (JWKS); otherwise with the shared AUTH_JWT_SECRET, which
 * is only allowed outside production. Both paths use the same claims as Supabase Auth.
 */
@Injectable()
export class TokenVerifier {
  private readonly verifyToken: (token: string) => Promise<JWTPayload>;

  constructor(@Inject(CONFIG) config: AppConfig) {
    if (config.SUPABASE_URL) {
      const base = config.SUPABASE_URL.replace(/\/$/, '');
      const keys = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
      this.verifyToken = async (token) => (await jwtVerify(token, keys, { issuer: `${base}/auth/v1`, audience: 'authenticated' })).payload;
    } else {
      const secret = new TextEncoder().encode(config.AUTH_JWT_SECRET);
      this.verifyToken = async (token) =>
        (
          await jwtVerify(token, secret, {
            algorithms: ['HS256'],
            issuer: config.AUTH_JWT_ISSUER,
            audience: 'authenticated',
          })
        ).payload;
    }
  }

  async verify(token: string): Promise<VerifiedLogin | null> {
    try {
      const payload = await this.verifyToken(token);
      if (!payload.sub) return null;
      return { authUid: payload.sub, phone: typeof payload.phone === 'string' && payload.phone ? payload.phone : undefined };
    } catch {
      return null;
    }
  }
}
