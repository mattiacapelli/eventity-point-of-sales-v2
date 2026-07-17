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
}

export function listWindowsPrinters(): WindowsPrinterInfo[] {
  if (process.platform !== "win32") return [];
  try {
    const ps = `powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus,Default | ConvertTo-Json -Compress"`;
    const out = execSync(ps, { timeout: 8000, windowsHide: true }).toString().trim();
    if (!out) return [];
    const raw = JSON.parse(out);
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((r: { Name?: string; PrinterStatus?: number; Default?: boolean }) => ({
      name: r.Name ?? "",
      status: r.PrinterStatus === 0 ? "Pronta" : "Occupata/Offline",
      isDefault: r.Default === true,
    })).filter((r) => r.name !== "");
  } catch {
    return [];
  }
}

export class WindowsPrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly printerName: string,
    private readonly logger: Logger,
  ) {}

  async print(job: PrintJob): Promise<PrintResult> {
    if (process.platform !== "win32") {
      return { success: false, message: "Windows printer adapter non disponibile su questa piattaforma" };
    }

    const buf = job.contentBuffer ?? buildEscPosBuffer(job.content ?? "");

    // Write data and script to temp files to avoid command-line length limits
    // and quoting issues when embedding binary/base64 inline in PowerShell -Command.
    const id = randomBytes(8).toString("hex");
    const binPath = join(tmpdir(), `pos-print-${id}.bin`);
    const ps1Path = join(tmpdir(), `pos-print-${id}.ps1`);

    try {
      writeFileSync(binPath, buf);

      // The script reads raw bytes from the bin file and sends them via winspool RAW job.
      const script = `
param([string]$PrinterName, [string]$BinPath)
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrint {
  [DllImport("winspool.drv", CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr h, int lvl, [In,MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr p, int n, out int w);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr h);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  public static string Send(string name, byte[] data) {
    IntPtr h; if (!OpenPrinter(name, out h, IntPtr.Zero)) return "ERR:OpenPrinter:" + Marshal.GetLastWin32Error();
    var di = new DOCINFO { pDocName="ESC/POS", pOutputFile=null, pDataType="RAW" };
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return "ERR:StartDoc:" + Marshal.GetLastWin32Error(); }
    StartPagePrinter(h);
    IntPtr p = Marshal.AllocCoTaskMem(data.Length);
    Marshal.Copy(data, 0, p, data.Length);
    int w; bool ok = WritePrinter(h, p, data.Length, out w);
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return ok ? "OK" : "ERR:WritePrinter:" + Marshal.GetLastWin32Error();
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes($BinPath)
Write-Output ([RawPrint]::Send($PrinterName, $bytes))
`;
      writeFileSync(ps1Path, script, { encoding: "utf8" });

      const out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}" -PrinterName "${this.printerName.replace(/"/g, '`"')}" -BinPath "${binPath}"`,
        { timeout: 15000, windowsHide: true },
      ).toString().trim();

      if (out.startsWith("OK")) {
        this.logger.info({ printerName: this.printerName, bytes: buf.length }, "[win-printer] print OK");
        return { success: true, message: "OK" };
      }
      this.logger.error({ printerName: this.printerName, out }, "[win-printer] print failed");
      return { success: false, message: `Windows print error: ${out}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ printerName: this.printerName, err: msg }, "[win-printer] exec error");
      return { success: false, message: msg };
    } finally {
      try { unlinkSync(binPath); } catch { /* ignore */ }
      try { unlinkSync(ps1Path); } catch { /* ignore */ }
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
