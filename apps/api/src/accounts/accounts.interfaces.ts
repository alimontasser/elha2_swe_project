/** The signed-in person and the household whose pantry they act on. */
export interface Member {
  userId: string;
  householdId: string;
  authUid: string;
}

/**
 * Offered by Accounts to the API layer: turns a verified login into a member,
 * creating the user and a one-person household on the first request after sign-up (US-1.01).
 */
export interface IMemberDirectory {
  resolve(authUid: string, phone?: string): Promise<Member>;
  /** The language a user reads in (US-1.02), for text the server writes to them. */
  language(userId: string): Promise<'ar' | 'en'>;
}

export const MEMBER_DIRECTORY = Symbol('IMemberDirectory');
