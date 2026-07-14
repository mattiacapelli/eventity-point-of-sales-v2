export type UserRole = "admin" | "cashier" | "kitchen" | "waiter" | "viewer";

export interface User {
  readonly id: number;
  readonly name: string;
  readonly username: string;
  readonly role: UserRole;
  readonly pin?: string;
  readonly active: boolean;
  readonly createdAt: Date;
}

export interface AuthSession {
  readonly userId: number;
  readonly role: UserRole;
  readonly expiresAt: Date;
}
