import * as argon2 from "argon2";
import { eq, lt, and, users, sessions } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { UserRole } from "@pos/shared-types";
import type { SessionContext } from "@pos/shared-types";

export interface LoginInput {
  readonly username: string;
  readonly pin: string;
}

export interface LoginResult {
  readonly token: string;
  readonly session: SessionContext;
}

export class AuthService {
  constructor(
    private readonly db: DbClient,
    private readonly sessionTtlSeconds: number
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);

    if (user === undefined || !user.active) {
      throw new AuthError("Invalid credentials");
    }

    if (user.pin === null || user.pin === undefined) {
      throw new AuthError("User has no PIN configured");
    }

    const valid = await argon2.verify(user.pin, input.pin);
    if (!valid) {
      throw new AuthError("Invalid credentials");
    }

    return this.createSession(user as { id: number; role: string; username: string; name: string });
  }

  async loginByPin(pin: string): Promise<LoginResult> {
    const activeUsers = await this.db
      .select()
      .from(users)
      .where(and(eq(users.active, true)));

    // Verify all hashes in parallel to avoid timing oracle (no early exit).
    // A dummy verify runs if no users have a PIN, so response time is always O(1 argon2).
    const usersWithPin = activeUsers.filter((u) => u.pin !== null && u.pin !== undefined);
    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$dummy$dummyhashfordummypurposesonly00000";

    const results = await Promise.all(
      usersWithPin.length > 0
        ? usersWithPin.map((u) => argon2.verify(u.pin!, pin).then((ok) => ok ? u : null).catch(() => null))
        : [argon2.verify(dummyHash, pin).then(() => null).catch(() => null)]
    );

    const matched = results.find((r) => r !== null);
    if (!matched) throw new AuthError("Invalid credentials");

    return this.createSession(matched as { id: number; role: string; username: string; name: string });
  }

  private async createSession(user: { id: number; role: string; username: string; name: string }): Promise<LoginResult> {
    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);

    // Invalidate all prior sessions for this user before creating a new one.
    // This ensures a deactivated or compromised account cannot keep old tokens alive.
    await this.db.delete(sessions).where(eq(sessions.userId, user.id));

    const [sessionRow] = await this.db.insert(sessions).values({
      userId: user.id,
      token,
      createdAt: now,
      expiresAt,
    }).returning();

    return {
      token,
      session: {
        sessionId: sessionRow!.id,
        userId: user.id,
        role: user.role as UserRole,
        username: user.username,
        name: user.name,
      },
    };
  }

  async validateToken(token: string): Promise<SessionContext> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);

    if (session === undefined) {
      throw new AuthError("Session not found");
    }

    if (session.expiresAt < new Date()) {
      await this.db.delete(sessions).where(eq(sessions.token, token));
      throw new AuthError("Session expired");
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (user === undefined || !user.active) {
      throw new AuthError("User not found or inactive");
    }

    return {
      sessionId: session.id,
      userId: user.id,
      role: user.role as UserRole,
      username: user.username,
      name: user.name,
    } satisfies SessionContext;
  }

  async logout(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.token, token));
  }

  async purgeExpiredSessions(): Promise<void> {
    await this.db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  async changePin(userId: number, currentPin: string, newPin: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user === undefined || !user.active) throw new AuthError("User not found");
    if (user.pin === null || user.pin === undefined) throw new AuthError("No PIN configured");

    const valid = await argon2.verify(user.pin, currentPin);
    if (!valid) throw new AuthError("PIN attuale non corretto");

    const hashedPin = await argon2.hash(newPin);
    await this.db.update(users).set({ pin: hashedPin }).where(eq(users.id, userId));
  }

  async createUser(input: {
    name: string;
    username: string;
    role: UserRole;
    pin: string;
  }): Promise<number> {
    const hashedPin = await argon2.hash(input.pin);

    const [row] = await this.db.insert(users).values({
      name: input.name,
      username: input.username,
      role: input.role,
      pin: hashedPin,
      active: true,
      createdAt: new Date(),
    }).returning({ id: users.id });

    return row!.id;
  }

  async listUsers(): Promise<Array<{ id: number; name: string; username: string; role: UserRole; active: boolean; createdAt: Date }>> {
    const rows = await this.db.select().from(users);
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role as UserRole,
      active: u.active,
      createdAt: u.createdAt,
    }));
  }

  async updateUser(id: number, patch: Partial<{ name: string; username: string; role: UserRole; active: boolean }>): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(users).set(patch).where(eq(users.id, id));
  }

  async resetPin(id: number, newPin: string): Promise<void> {
    const hashedPin = await argon2.hash(newPin);
    await this.db.update(users).set({ pin: hashedPin }).where(eq(users.id, id));
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function requireRole(
  session: SessionContext,
  ...roles: UserRole[]
): void {
  if (!roles.includes(session.role)) {
    throw new AuthError(
      `Role "${session.role}" is not allowed. Required: ${roles.join(", ")}`
    );
  }
}
