import type { UserRole } from "./user.js";

export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly role: UserRole;
  readonly token: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface SessionContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly role: UserRole;
  readonly username: string;
}
