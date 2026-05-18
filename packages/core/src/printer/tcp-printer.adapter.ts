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

export class TcpPrinterAdapter implements PrinterAdapter {
  private socket: net.Socket | null = null;
  private connected = false;
  private reconnectDelay = 5000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly logger: Logger,
  ) {
    this.connect();
  }

  private connect(): void {
    if (this.destroyed) return;

    this.socket = new net.Socket();

    this.socket.connect(this.port, this.host, () => {
      this.connected = true;
      this.reconnectDelay = 5000;
      this.logger.info({ host: this.host, port: this.port }, "[printer] TCP connected");
    });

    this.socket.on("error", (err) => {
      this.logger.warn({ host: this.host, port: this.port, err: err.message }, "[printer] TCP error");
      this.connected = false;
    });

    this.socket.on("close", () => {
      this.connected = false;
      if (!this.destroyed) {
        this.logger.debug({ delay: this.reconnectDelay }, "[printer] TCP disconnected — will reconnect");
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this.socket?.destroy();
      this.socket = null;
      this.connect();
    }, this.reconnectDelay);
  }

  async print(job: PrintJob): Promise<PrintResult> {
    if (!this.connected || !this.socket) {
      return { success: false, message: `Printer ${this.host}:${this.port} not connected` };
    }

    const buf = buildEscPosBuffer(job.content);

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
