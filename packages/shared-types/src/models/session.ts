import type { UserRole } from "./user.js";

export interface Session {
  readonly id: number;
  readonly userId: number;
  readonly role: UserRole;
  readonly token: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface SessionContext {
  readonly sessionId: number;
  readonly userId: number;
  readonly role: UserRole;
  readonly username: string;
  readonly name: string;
}
