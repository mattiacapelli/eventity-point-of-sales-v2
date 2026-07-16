import { createRequire } from "node:module";
import type { Logger } from "pino";
import type { PrinterAdapter, PrintJob, PrintResult } from "./printer.service.js";

// usb v2 uses CJS — import via createRequire for ESM compat
const require = createRequire(import.meta.url);

interface UsbDevice {
  deviceDescriptor: { idVendor: number; idProduct: number };
  open(): void;
  close(): void;
  interfaces: UsbInterface[];
  interface(n: number): UsbInterface;
}

interface UsbInterface {
  endpoints: UsbEndpoint[];
  claim(): void;
  release(cb: (err: Error | null) => void): void;
}

interface UsbEndpoint {
  direction: "in" | "out";
  transfer(buf: Buffer, cb: (err: Error | null) => void): void;
}

interface UsbLib {
  getDeviceList(): UsbDevice[];
  findByIds(vid: number, pid: number): UsbDevice | undefined;
}

function loadUsb(): UsbLib | null {
  try {
    return require("usb") as UsbLib;
  } catch {
    return null;
  }
}

export interface UsbDeviceInfo {
  vendorId: number;
  productId: number;
  vendorIdHex: string;
  productIdHex: string;
}

const PRINTER_CLASS = 7;
const HUB_CLASS = 9;

export function listUsbPrinters(): UsbDeviceInfo[] {
  const usb = loadUsb();
  if (!usb) return [];

  const results: UsbDeviceInfo[] = [];

  for (const d of usb.getDeviceList()) {
    const desc = d.deviceDescriptor;
    const devClass = (desc as unknown as { bDeviceClass: number }).bDeviceClass ?? 0;

    // Skip hubs
    if (devClass === HUB_CLASS) continue;

    let isPrinter = devClass === PRINTER_CLASS;

    if (!isPrinter) {
      // Device class 0 means "defined per interface" — open and check interfaces
      try {
        d.open();
        isPrinter = (d.interfaces ?? []).some(
          (i) => (i as unknown as { descriptor: { bInterfaceClass: number } }).descriptor?.bInterfaceClass === PRINTER_CLASS
        );
        d.close();
      } catch {
        // Cannot open (permission/busy) — include anyway if class is not a known system class
        isPrinter = devClass === 0; // 0 = "defined by interface", likely a printer or other HID
      }
    }

    if (isPrinter) {
      results.push({
        vendorId: desc.idVendor,
        productId: desc.idProduct,
        vendorIdHex: `0x${desc.idVendor.toString(16).padStart(4, "0")}`,
        productIdHex: `0x${desc.idProduct.toString(16).padStart(4, "0")}`,
      });
    }
  }

  return results;
}

export class UsbPrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly vendorId: number,
    private readonly productId: number,
    private readonly logger: Logger,
  ) {}

  async print(job: PrintJob): Promise<PrintResult> {
    const usb = loadUsb();
    if (!usb) {
      return { success: false, message: "Libreria USB non disponibile" };
    }

    const device = usb.findByIds(this.vendorId, this.productId);
    if (!device) {
      return {
        success: false,
        message: `Stampante USB non trovata (VID:0x${this.vendorId.toString(16)} PID:0x${this.productId.toString(16)})`,
      };
    }

    const buf = job.contentBuffer ?? buildEscPosBuffer(job.content ?? "");

    return new Promise<PrintResult>((resolve) => {
      try {
        device.open();

        // Find the first bulk-OUT endpoint across all interfaces
        let outEndpoint: UsbEndpoint | null = null;
        let claimedIface: UsbInterface | null = null;

        for (const iface of device.interfaces ?? []) {
          for (const ep of iface.endpoints ?? []) {
            if (ep.direction === "out") {
              try { iface.claim(); } catch { /* already claimed */ }
              claimedIface = iface;
              outEndpoint = ep;
              break;
            }
          }
          if (outEndpoint) break;
        }

        if (!outEndpoint || !claimedIface) {
          try { device.close(); } catch { /* ignore */ }
          resolve({ success: false, message: "Nessun endpoint OUT trovato sulla stampante USB" });
          return;
        }

        outEndpoint.transfer(buf, (err) => {
          claimedIface!.release(() => {
            try { device.close(); } catch { /* ignore */ }
            if (err) {
              this.logger.error({ vid: this.vendorId, pid: this.productId, err: err.message }, "[usb-printer] transfer error");
              resolve({ success: false, message: err.message });
            } else {
              this.logger.info({ vid: this.vendorId, pid: this.productId, bytes: buf.length }, "[usb-printer] print OK");
              resolve({ success: true, message: "OK" });
            }
          });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ vid: this.vendorId, pid: this.productId, err: msg }, "[usb-printer] open error");
        resolve({ success: false, message: msg });
      }
    });
  }
}

// Reuse the same ESC/POS builder as the TCP adapter
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
