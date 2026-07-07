import { describe, it, expect } from "vitest";
import { loadConfig, INSECURE_JWT_DEFAULT } from "../config/config-loader.js";

describe("loadConfig", () => {
  it("returns valid config with all defaults in development", () => {
    const cfg = loadConfig({ NODE_ENV: "development" });
    expect(cfg.env).toBe("development");
    expect(cfg.port).toBe(3000);
    expect(cfg.jwtSecret).toBe(INSECURE_JWT_DEFAULT);
  });

  it("throws when JWT_SECRET is the insecure default in production", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production" })
    ).toThrow(/JWT_SECRET must be set/);
  });

  it("throws when JWT_SECRET is the explicit insecure default in production", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production", JWT_SECRET: INSECURE_JWT_DEFAULT })
    ).toThrow(/JWT_SECRET must be set/);
  });

  it("accepts a strong secret in production", () => {
    const cfg = loadConfig({
      NODE_ENV: "production",
      JWT_SECRET: "a-very-strong-secret-at-least-32-chars-long!",
    });
    expect(cfg.env).toBe("production");
    expect(cfg.jwtSecret).toBe("a-very-strong-secret-at-least-32-chars-long!");
  });

  it("throws when jwtSecret is shorter than 32 chars", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "development", JWT_SECRET: "short" })
    ).toThrow();
  });

  it("does not throw with insecure default in test environment", () => {
    const cfg = loadConfig({ NODE_ENV: "test" });
    expect(cfg.env).toBe("test");
    expect(cfg.jwtSecret).toBe(INSECURE_JWT_DEFAULT);
  });
});
