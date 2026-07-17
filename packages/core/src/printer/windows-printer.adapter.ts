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
 * List USB ports (USB001, USB002, …) that have a device attached, by trying
 * to open each with CreateFile. Returns only ports that open successfully.
 */
export function listWindowsUsbPorts(): WindowsUsbPortInfo[] {
  if (process.platform !== "win32") return [];
  try {
    const id = randomBytes(8).toString("hex");
    const ps1 = join(tmpdir(), `pos-usbports-${id}.ps1`);
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinPort {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern IntPtr CreateFile(string lpFileName, uint dwAccess, uint dwShare,
    IntPtr lpSec, uint dwCreate, uint dwFlags, IntPtr hTemplate);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool CloseHandle(IntPtr h);
  public static bool CanOpen(string path) {
    var h = CreateFile(path, 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
    if (h == new IntPtr(-1)) return false;
    CloseHandle(h); return true;
  }
}
"@
$results = @()
for ($i = 1; $i -le 9; $i++) {
  $port = "USB00$i"
  $path = "\\\\.\\$port"
  if ([WinPort]::CanOpen($path)) { $results += $port }
}
if ($results.Count -eq 0) { Write-Output "NONE" } else { Write-Output ($results -join ",") }
`;
    writeFileSync(ps1, script, { encoding: "utf8" });
    const out = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`,
      { timeout: 10000, windowsHide: true },
    ).toString().trim();
    try { unlinkSync(ps1); } catch { /* ignore */ }
    if (!out || out === "NONE") return [];
    return out.split(",").map((p) => ({ portName: p.trim(), description: `Porta ${p.trim()}` }));
  } catch {
    return [];
  }
}

export class WindowsPrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly portName: string,   // e.g. "USB003" or a printer name fallback
    private readonly logger: Logger,
  ) {}

  async print(job: PrintJob): Promise<PrintResult> {
    if (process.platform !== "win32") {
      return { success: false, message: "Windows printer adapter non disponibile su questa piattaforma" };
    }

    const buf = job.contentBuffer ?? buildEscPosBuffer(job.content ?? "");
    const id = randomBytes(8).toString("hex");
    const binPath = join(tmpdir(), `pos-print-${id}.bin`);
    const ps1Path = join(tmpdir(), `pos-print-${id}.ps1`);

    try {
      writeFileSync(binPath, buf);

      // Write directly to the USB port device path (e.g. \\.\USB003), bypassing
      // the Windows print spooler entirely. This is the only reliable way to send
      // raw ESC/POS bytes to an Epson printer without a vendor-specific RAW driver.
      const script = `
param([string]$PortName, [string]$BinPath)
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class DirectPrint {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern IntPtr CreateFile(string lpFileName, uint dwAccess, uint dwShare,
    IntPtr lpSec, uint dwCreate, uint dwFlags, IntPtr hTemplate);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool WriteFile(IntPtr h, byte[] buf, uint n, out uint written, IntPtr ov);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool CloseHandle(IntPtr h);
  public static string Send(string portName, byte[] data) {
    string path = "\\\\\\\\.\\\\\" + portName;
    IntPtr h = CreateFile(path, 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
    if (h == new IntPtr(-1)) return "ERR:CreateFile:" + Marshal.GetLastWin32Error();
    uint w;
    bool ok = WriteFile(h, data, (uint)data.Length, out w, IntPtr.Zero);
    CloseHandle(h);
    return ok ? "OK:" + w : "ERR:WriteFile:" + Marshal.GetLastWin32Error();
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes($BinPath)
Write-Output ([DirectPrint]::Send($PortName, $bytes))
`;
      writeFileSync(ps1Path, script, { encoding: "utf8" });

      const escapedPort = this.portName.replace(/"/g, '`"');
      const out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}" -PortName "${escapedPort}" -BinPath "${binPath}"`,
        { timeout: 15000, windowsHide: true },
      ).toString().trim();

      if (out.startsWith("OK:")) {
        this.logger.info({ portName: this.portName, bytes: buf.length }, "[win-printer] direct port print OK");
        return { success: true, message: "OK" };
      }
      this.logger.error({ portName: this.portName, out }, "[win-printer] direct port print failed");
      return { success: false, message: `Windows print error: ${out}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ portName: this.portName, err: msg }, "[win-printer] exec error");
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
