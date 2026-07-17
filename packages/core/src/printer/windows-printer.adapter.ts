import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { Logger } from "pino";
import type { PrinterAdapter, PrintJob, PrintResult } from "./printer.service.js";

export interface WindowsPrinterInfo {
  name: string;
  status: string;
  isDefault: boolean;
  portName: string | null;
}

export interface WindowsUsbPortInfo {
  portName: string;   // e.g. "USB001"
  description: string;
}

/** List printers installed in Windows via Get-Printer, including their port name. */
export function listWindowsPrinters(): WindowsPrinterInfo[] {
  if (process.platform !== "win32") return [];
  try {
    const ps = `powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus,Default,PortName | ConvertTo-Json -Compress"`;
    const out = execSync(ps, { timeout: 8000, windowsHide: true }).toString().trim();
    if (!out) return [];
    const raw = JSON.parse(out);
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((r: { Name?: string; PrinterStatus?: number; Default?: boolean; PortName?: string }) => ({
      name: r.Name ?? "",
      status: r.PrinterStatus === 0 ? "Pronta" : "Offline/Occupata",
      isDefault: r.Default === true,
      portName: r.PortName ?? null,
    })).filter((r) => r.name !== "");
  } catch {
    return [];
  }
}

/**
 * List USB ports (USB001…USB009) that have a device attached.
 * Uses `copy /B nul PORT` — succeeds (exit 0) when the port exists and
 * is writable, fails otherwise. No PowerShell or P/Invoke needed.
 */
export function listWindowsUsbPorts(): WindowsUsbPortInfo[] {
  if (process.platform !== "win32") return [];
  const found: WindowsUsbPortInfo[] = [];
  for (let i = 1; i <= 9; i++) {
    const portName = `USB00${i}`;
    try {
      execSync(`copy /B nul \\\\.\\${portName}`, {
        timeout: 2000,
        windowsHide: true,
        shell: "cmd.exe",
        stdio: "pipe",
      });
      found.push({ portName, description: `Porta ${portName}` });
    } catch {
      // port not available or no device
    }
  }
  return found;
}


export class WindowsPrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly printerName: string,   // nome stampante Windows installata, es. "EPSON TM-T20III"
    private readonly logger: Logger,
  ) {}

  async print(job: PrintJob): Promise<PrintResult> {
    if (process.platform !== "win32") {
      return { success: false, message: "Windows printer adapter non disponibile su questa piattaforma" };
    }

    const buf = job.contentBuffer ?? buildEscPosBuffer(job.content ?? "");
    const id = randomBytes(8).toString("hex");
    const binPath = join(tmpdir(), `pos-print-${id}.bin`);

    try {
      writeFileSync(binPath, buf);

      // copy /B su \\localhost\NomeStampante usa lo spooler Windows ma con il
      // driver Epson installato funziona correttamente per ESC/POS raw.
      const out = execSync(
        `copy /B "${binPath}" "\\\\localhost\\${this.printerName}"`,
        { timeout: 15000, windowsHide: true, shell: "cmd.exe" },
      ).toString().trim();

      this.logger.info({ printerName: this.printerName, bytes: buf.length, out }, "[win-printer] copy /B OK");
      return { success: true, message: "OK" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ printerName: this.printerName, err: msg }, "[win-printer] copy /B failed");
      return { success: false, message: msg };
    } finally {
      try { unlinkSync(binPath); } catch { /* ignore */ }
    }
  }
}

// ESC/POS builder (same as tcp/usb adapters)
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
  parts.push(Buffer.from([LF, LF, LF]));
  parts.push(CMD_CUT);
  return Buffer.concat(parts);
}
