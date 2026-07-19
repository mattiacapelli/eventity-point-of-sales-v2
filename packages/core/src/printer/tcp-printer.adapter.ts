import net from "node:net";
import type { Logger } from "pino";
import type { PrinterAdapter, PrintJob, PrintResult } from "./printer.service.js";

// ESC/POS byte sequences — no external lib needed
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

const CMD_INIT         = Buffer.from([ESC, 0x40]);
const CMD_CUT          = Buffer.from([GS, 0x56, 0x41, 0x00]);
const CMD_BOLD_ON      = Buffer.from([ESC, 0x45, 0x01]);
const CMD_BOLD_OFF     = Buffer.from([ESC, 0x45, 0x00]);
const CMD_ALIGN_LEFT   = Buffer.from([ESC, 0x61, 0x00]);
const CMD_ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);

function buildEscPosBuffer(text: string): Buffer {
  const parts: Buffer[] = [CMD_INIT, CMD_ALIGN_LEFT];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();

    if (line.startsWith("##")) {
      // Bold centered header
      parts.push(CMD_ALIGN_CENTER, CMD_BOLD_ON);
      parts.push(Buffer.from(line.replace(/^#+\s*/, "") + "\n", "latin1"));
      parts.push(CMD_BOLD_OFF, CMD_ALIGN_LEFT);
    } else if (line.startsWith("**") && line.endsWith("**")) {
      parts.push(CMD_BOLD_ON);
      parts.push(Buffer.from(line.slice(2, -2) + "\n", "latin1"));
      parts.push(CMD_BOLD_OFF);
    } else {
      parts.push(Buffer.from(line + "\n", "latin1"));
    }
  }

  // Feed and cut
  parts.push(Buffer.from([LF, LF, LF]));
  parts.push(CMD_CUT);

  return Buffer.concat(parts);
}

const CONNECT_TIMEOUT_MS = 5000;

const OFFLINE_FAST_FAIL_MS = 3_000;

export class TcpPrinterAdapter implements PrinterAdapter {
  private socket: net.Socket | null = null;
  private connected = false;
  private reconnectDelay = 5000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private connectingPromise: Promise<void> | null = null;
  /** Timestamp of the last confirmed-offline event. Null when connected or unknown. */
  private offlineSince: number | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly logger: Logger,
  ) {
    this.connectingPromise = this.connect();
  }

  private connect(): Promise<void> {
    if (this.destroyed) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.socket = new net.Socket();

      const timeout = setTimeout(() => {
        resolve(); // resolve even on timeout — caller checks this.connected
      }, CONNECT_TIMEOUT_MS);

      this.socket.connect(this.port, this.host, () => {
        clearTimeout(timeout);
        this.connected = true;
        this.offlineSince = null;
        this.reconnectDelay = 5000;
        this.logger.info({ host: this.host, port: this.port }, "[printer] TCP connected");
        resolve();
      });

      this.socket.on("error", (err) => {
        clearTimeout(timeout);
        this.logger.warn({ host: this.host, port: this.port, err: err.message }, "[printer] TCP error");
        this.connected = false;
        this.offlineSince = Date.now();
        resolve();
      });

      this.socket.on("close", () => {
        this.connected = false;
        if (this.offlineSince === null) this.offlineSince = Date.now();
        if (!this.destroyed) {
          this.logger.debug({ delay: this.reconnectDelay }, "[printer] TCP disconnected — will reconnect");
          this.connectingPromise = this.scheduleReconnect();
        }
      });
    });
  }

  private scheduleReconnect(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
        this.socket?.destroy();
        this.socket = null;
        this.connect().then(resolve);
      }, this.reconnectDelay);
    });
  }

  async print(job: PrintJob): Promise<PrintResult> {
    // Fast-fail: if we know the printer has been offline for less than
    // OFFLINE_FAST_FAIL_MS, skip the reconnect wait entirely. Once the grace
    // period expires we allow another attempt so a recovered printer is noticed.
    if (
      !this.connected &&
      this.offlineSince !== null &&
      Date.now() - this.offlineSince < OFFLINE_FAST_FAIL_MS
    ) {
      return { success: false, message: `Printer ${this.host}:${this.port} offline` };
    }

    // Wait for in-progress connection/reconnect without nulling it — concurrent callers
    // must each await independently so they all benefit from the same reconnect.
    if (this.connectingPromise) {
      await this.connectingPromise;
    }

    if (!this.connected || !this.socket) {
      return { success: false, message: `Printer ${this.host}:${this.port} not connected` };
    }

    const buf = job.contentBuffer ?? buildEscPosBuffer(job.content ?? "");

    return new Promise<PrintResult>((resolve) => {
      this.socket!.write(buf, (err) => {
        if (err) {
          this.logger.error({ host: this.host, port: this.port, err: err.message }, "[printer] write error");
          resolve({ success: false, message: err.message });
        } else {
          this.logger.info({ host: this.host, port: this.port, bytes: buf.length }, "[printer] TCP print OK");
          resolve({ success: true, message: "OK" });
        }
      });
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
    this.socket = null;
  }
}
