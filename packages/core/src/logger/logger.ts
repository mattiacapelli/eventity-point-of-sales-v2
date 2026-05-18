import pino from "pino";
import type { AppConfig } from "../config/config-loader.js";

export type Logger = pino.Logger;

export function createRootLogger(config: Pick<AppConfig, "logLevel" | "env">): Logger {
  return pino({
    level: config.logLevel,
    ...(config.env === "development"
      ? { transport: { target: "pino-pretty", options: { colorize: true } } }
      : {}),
  });
}

export function createModuleLogger(root: Logger, moduleName: string): Logger {
  return root.child({ module: moduleName });
}
