import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthService, AuthError } from "../auth/auth-service.js";
import { createTestDb } from "./helpers/test-db.js";
import type { DbClient } from "@pos/db";

let db: DbClient;
let cleanup: () => void;
let auth: AuthService;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  auth = new AuthService(db, 3600);
});

afterEach(() => cleanup());

describe("AuthService.login", () => {
  it("returns a token for valid username+PIN", async () => {
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    const result = await auth.login({ username: "alice", pin: "1234" });
    expect(result.token).toBeTruthy();
    expect(result.session.username).toBe("alice");
  });

  it("throws AuthError for wrong PIN", async () => {
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    await expect(auth.login({ username: "alice", pin: "9999" })).rejects.toThrow(AuthError);
  });

  it("throws AuthError for unknown username", async () => {
    await expect(auth.login({ username: "nobody", pin: "1234" })).rejects.toThrow(AuthError);
  });
});

describe("AuthService.loginByPin (fix 2: parallel constant-time verify)", () => {
  it("returns a session for a correct PIN", async () => {
    await auth.createUser({ name: "Bob", username: "bob", role: "cashier", pin: "5678" });
    const result = await auth.loginByPin("5678");
    expect(result.session.username).toBe("bob");
  });

  it("throws AuthError for a wrong PIN even with multiple users", async () => {
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1111" });
    await auth.createUser({ name: "Bob", username: "bob", role: "cashier", pin: "2222" });
    await expect(auth.loginByPin("9999")).rejects.toThrow(AuthError);
  });

  it("does not throw when no users exist (dummy verify runs)", async () => {
    await expect(auth.loginByPin("1234")).rejects.toThrow(AuthError);
  });

  it("disambiguates correctly between two users", async () => {
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1111" });
    await auth.createUser({ name: "Bob", username: "bob", role: "cashier", pin: "2222" });
    const r1 = await auth.loginByPin("1111");
    expect(r1.session.username).toBe("alice");
    const r2 = await auth.loginByPin("2222");
    expect(r2.session.username).toBe("bob");
  });
});

describe("AuthService.createSession (fix 3: invalidates previous sessions)", () => {
  it("a new login invalidates the previous session token", async () => {
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    const first = await auth.login({ username: "alice", pin: "1234" });
    const second = await auth.login({ username: "alice", pin: "1234" });

    // First token must no longer be valid
    await expect(auth.validateToken(first.token)).rejects.toThrow(AuthError);
    // Second token must still work
    const session = await auth.validateToken(second.token);
    expect(session.username).toBe("alice");
  });

  it("does not accumulate session rows — only one row per user", async () => {
    const { sessions, eq } = await import("@pos/db");
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    await auth.login({ username: "alice", pin: "1234" });
    await auth.login({ username: "alice", pin: "1234" });
    await auth.login({ username: "alice", pin: "1234" });
    const rows = await db.select().from(sessions);
    expect(rows.length).toBe(1);
  });
});

describe("AuthService.validateToken", () => {
  it("returns session context for a valid token", async () => {
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    const { token } = await auth.login({ username: "alice", pin: "1234" });
    const ctx = await auth.validateToken(token);
    expect(ctx.username).toBe("alice");
    expect(ctx.role).toBe("admin");
  });

  it("throws for an unknown token", async () => {
    await expect(auth.validateToken("nonexistent-token")).rejects.toThrow(AuthError);
  });

  it("throws after logout", async () => {
    await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    const { token } = await auth.login({ username: "alice", pin: "1234" });
    await auth.logout(token);
    await expect(auth.validateToken(token)).rejects.toThrow(AuthError);
  });
});

describe("AuthService.changePin", () => {
  it("updates the PIN and allows login with the new one", async () => {
    const userId = await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    await auth.changePin(userId, "1234", "5678");
    const result = await auth.login({ username: "alice", pin: "5678" });
    expect(result.session.username).toBe("alice");
  });

  it("throws when the current PIN is wrong", async () => {
    const userId = await auth.createUser({ name: "Alice", username: "alice", role: "admin", pin: "1234" });
    await expect(auth.changePin(userId, "wrong", "5678")).rejects.toThrow(AuthError);
  });
});
