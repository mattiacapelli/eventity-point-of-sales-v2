export interface AppConfig {
  readonly server: {
    readonly host: string;
    readonly port: number;
  };
  readonly database: {
    readonly url: string;
  };
  readonly printer: {
    readonly enabled: boolean;
    readonly pollIntervalMs: number;
  };
  readonly sync: {
    readonly enabled: boolean;
    readonly intervalMs: number;
  };
  readonly debug: boolean;
}

export const defaultConfig: AppConfig = {
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  database: {
    url: "./pos.db",
  },
  printer: {
    enabled: true,
    pollIntervalMs: 500,
  },
  sync: {
    enabled: true,
    intervalMs: 30_000,
  },
  debug: false,
};
