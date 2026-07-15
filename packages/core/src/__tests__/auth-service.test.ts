import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthService, AuthError, requireRole } from "../auth/auth-service.js";
import { createTestDb } from "./helpers/test-db.js";
import type { DbClient } from "@pos/db";
import type { SessionContext } from "@pos/shared-types";

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

// ── AuthService.purgeExpiredSessions ─────────────────────────────────────────

describe("AuthService.purgeExpiredSessions", () => {
  it("elimina sessioni scadute", async () => {
    const { sessions, eq } = await import("@pos/db");
    // Auth con TTL -1 secondi → expiresAt è già nel passato
    const shortAuth = new AuthService(db, -1);
    await shortAuth.createUser({ name: "Alice", username: "alice2", role: "admin", pin: "1234" });
    await shortAuth.login({ username: "alice2", pin: "1234" });
    await shortAuth.purgeExpiredSessions();
    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(0);
  });

  it("non elimina sessioni ancora valide", async () => {
    const { sessions } = await import("@pos/db");
    await auth.createUser({ name: "Bob", username: "bob2", role: "cashier", pin: "5678" });
    await auth.login({ username: "bob2", pin: "5678" });
    await auth.purgeExpiredSessions();
    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
  });
});

// ── AuthService.listUsers ─────────────────────────────────────────────────────

describe("AuthService.listUsers", () => {
  it("ritorna lista con gli utenti creati", async () => {
    await auth.createUser({ name: "Alice", username: "alice3", role: "admin", pin: "1234" });
    await auth.createUser({ name: "Bob", username: "bob3", role: "cashier", pin: "5678" });
    const users = await auth.listUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);
    const names = users.map((u) => u.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  it("la risposta non contiene campi password/pin", async () => {
    await auth.createUser({ name: "Alice", username: "alice4", role: "admin", pin: "9999" });
    const users = await auth.listUsers();
    for (const u of users) {
      expect((u as unknown as Record<string, unknown>).pin).toBeUndefined();
      expect((u as unknown as Record<string, unknown>).password).toBeUndefined();
    }
  });

  it("i campi ritornati includono id, name, username, role, active, createdAt", async () => {
    await auth.createUser({ name: "Carol", username: "carol", role: "cashier", pin: "0000" });
    const [user] = (await auth.listUsers()).filter((u) => u.username === "carol");
    expect(user).toBeDefined();
    expect(user!.id).toBeTypeOf("number");
    expect(user!.name).toBe("Carol");
    expect(user!.role).toBe("cashier");
    expect(user!.active).toBe(true);
    expect(user!.createdAt).toBeInstanceOf(Date);
  });
});

// ── AuthService.updateUser ────────────────────────────────────────────────────

describe("AuthService.updateUser", () => {
  it("aggiorna username", async () => {
    const userId = await auth.createUser({ name: "Dave", username: "dave", role: "cashier", pin: "1111" });
    await auth.updateUser(userId, { username: "dave_updated" });
    const result = await auth.login({ username: "dave_updated", pin: "1111" });
    expect(result.session.username).toBe("dave_updated");
  });

  it("aggiorna role", async () => {
    const userId = await auth.createUser({ name: "Eve", username: "eve", role: "cashier", pin: "2222" });
    await auth.updateUser(userId, { role: "admin" });
    const users = await auth.listUsers();
    const eve = users.find((u) => u.id === userId);
    expect(eve!.role).toBe("admin");
  });

  it("patch vuoto → nessuna modifica (no errore)", async () => {
    const userId = await auth.createUser({ name: "Frank", username: "frank", role: "cashier", pin: "3333" });
    await expect(auth.updateUser(userId, {})).resolves.toBeUndefined();
  });
});

// ── AuthService.resetPin ──────────────────────────────────────────────────────

describe("AuthService.resetPin", () => {
  it("cambia PIN senza richiedere quello corrente → login con nuovo PIN riesce", async () => {
    const userId = await auth.createUser({ name: "Grace", username: "grace", role: "admin", pin: "0000" });
    await auth.resetPin(userId, "9999");
    const result = await auth.login({ username: "grace", pin: "9999" });
    expect(result.session.username).toBe("grace");
  });

  it("login con vecchio PIN fallisce dopo reset", async () => {
    const userId = await auth.createUser({ name: "Heidi", username: "heidi", role: "admin", pin: "1234" });
    await auth.resetPin(userId, "9876");
    await expect(auth.login({ username: "heidi", pin: "1234" })).rejects.toThrow(AuthError);
  });
});

// ── requireRole ───────────────────────────────────────────────────────────────

describe("requireRole", () => {
  const adminSession: SessionContext = { sessionId: 1, userId: 1, username: "admin", name: "Admin", role: "admin" };
  const cashierSession: SessionContext = { sessionId: 2, userId: 2, username: "bob", name: "Bob", role: "cashier" };

  it("non lancia se il ruolo è incluso", () => {
    expect(() => requireRole(adminSession, "admin")).not.toThrow();
    expect(() => requireRole(adminSession, "cashier", "admin")).not.toThrow();
  });

  it("lancia AuthError se il ruolo non è sufficiente", () => {
    expect(() => requireRole(cashierSession, "admin")).toThrow(AuthError);
  });

  it("lancia AuthError con messaggio che indica il ruolo richiesto", () => {
    expect(() => requireRole(cashierSession, "admin")).toThrow("admin");
  });

  it("cashier può accedere a risorse cashier", () => {
    expect(() => requireRole(cashierSession, "cashier")).not.toThrow();
  });
});
