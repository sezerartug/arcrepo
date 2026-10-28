import type { CompanyStatus, MemberRole } from '../../../db/schema.js';

export interface AuthContext {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly isAdmin: boolean;
  readonly company: {
    readonly id: string;
    readonly legalName: string;
    readonly status: CompanyStatus;
    readonly memberRole: MemberRole;
  } | null;
}

// A signed-in user who belongs to a company (verified or not).
export type CompanyAuthContext = AuthContext & {
  readonly company: NonNullable<AuthContext['company']>;
};

export const SESSION_COOKIE = 'arc_session';
export const SESSION_DAYS = 7;
