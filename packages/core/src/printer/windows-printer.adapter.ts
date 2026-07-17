import { execSync } from "node:child_process";
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

// Sends raw ESC/POS bytes to a Windows printer queue via .NET RawPrint.
// This bypasses GDI rendering and writes the buffer directly to the print spooler.
const RAW_PRINT_SCRIPT = String.raw`
param([string]$PrinterName, [string]$Base64Data)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, ExactSpelling=false)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", ExactSpelling=false, SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.drv", ExactSpelling=false, SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", ExactSpelling=false, SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", ExactSpelling=false, SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", ExactSpelling=false, SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  [DllImport("winspool.drv", ExactSpelling=false, SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  public static bool SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter = new IntPtr(0);
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "ESC/POS";
    di.pOutputFile = null;
    di.pDataType = "RAW";
    int dwWritten = 0;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
    if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
    if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }
    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
    bool ok = WritePrinter(hPrinter, pBytes, bytes.Length, out dwWritten);
    Marshal.FreeCoTaskMem(pBytes);
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    return ok;
  }
}
"@
$bytes = [Convert]::FromBase64String($Base64Data)
$ok = [RawPrint]::SendBytes($PrinterName, $bytes)
if ($ok) { Write-Output "OK" } else { Write-Output "FAIL:$([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
`;

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
    const b64 = buf.toString("base64");

    try {
      const escaped = this.printerName.replace(/'/g, "''");
      const cmd = `powershell -NoProfile -Command "& { ${RAW_PRINT_SCRIPT.replace(/\n/g, " ")} } -PrinterName '${escaped}' -Base64Data '${b64}'`;
      const out = execSync(cmd, { timeout: 15000, windowsHide: true }).toString().trim();
      if (out.startsWith("OK")) {
        this.logger.info({ printerName: this.printerName, bytes: buf.length }, "[win-printer] print OK");
        return { success: true, message: "OK" };
      }
      const msg = `Windows print error: ${out}`;
      this.logger.error({ printerName: this.printerName, out }, "[win-printer] print failed");
      return { success: false, message: msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ printerName: this.printerName, err: msg }, "[win-printer] exec error");
      return { success: false, message: msg };
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
