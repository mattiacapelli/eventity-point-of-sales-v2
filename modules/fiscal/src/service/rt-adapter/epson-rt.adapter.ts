import type { RtAdapter, RtDocumentInput, RtDocumentResult, RtZReportResult } from "./rt-adapter.interface.js";

// Epson FP-90III / RT protocol: XML over HTTP on port 8008.
// Reference: Epson EPOS2 SDK + FP-90III/iMya programmer guide.
export class EpsonRtAdapter implements RtAdapter {
  private readonly baseUrl: string;

  constructor(host: string, port: number) {
    this.baseUrl = `http://${host}:${port}`;
  }

  private async _post(xml: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/cgi-bin/fpmate.cgi`, {
      method: "POST",
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: xml,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Epson RT HTTP error ${res.status}: ${await res.text()}`);
    }
    return res.text();
  }

  private _vatDeptCode(vatRate: number): number {
    // Epson uses department codes 1-4 mapped to aliquote:
    // 1 → 22%, 2 → 10%, 3 → 5%, 4 → 4%
    if (vatRate >= 22) return 1;
    if (vatRate >= 10) return 2;
    if (vatRate >= 5)  return 3;
    return 4;
  }

  private _paymentCode(method: string): number {
    // Epson payment type codes
    switch (method) {
      case "cash":           return 0;
      case "card":           return 2;
      case "digital_wallet": return 2;
      default:               return 0;
    }
  }

  async emitDocument(input: RtDocumentInput): Promise<RtDocumentResult> {
    const itemLines = input.rows.map((row) =>
      `<printRecItem description="${_esc(row.description)}" quantity="${row.quantity}" unitPrice="${row.unitPrice.toFixed(2)}" department="${this._vatDeptCode(row.vatRate)}" />`
    ).join("\n");

    const total = input.rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
    const payCode = this._paymentCode(input.payment.method);

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<printerFiscalReceipt>
  <beginFiscalReceipt operator="1" />
${itemLines}
  <printRecTotal description="TOTALE" payment="${total.toFixed(2)}" paymentType="${payCode}" index="1" />
  <endFiscalReceipt />
</printerFiscalReceipt>`;

    const raw = await this._post(xml);
    return _parseDocumentResponse(raw);
  }

  async emitVoid(docNumber: string, docDate: string): Promise<void> {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<printerFiscalReceipt>
  <beginFiscalReceipt operator="1" />
  <printRecVoid receiptNum="${docNumber}" receiptDate="${docDate}" />
  <endFiscalReceipt />
</printerFiscalReceipt>`;
    await this._post(xml);
  }

  async emitZReport(): Promise<RtZReportResult> {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<printerFiscalReport>
  <reportZFiscal operator="1" />
</printerFiscalReport>`;
    const raw = await this._post(xml);
    return _parseZReportResponse(raw);
  }

  async ping(): Promise<boolean> {
    try {
      const xml = `<?xml version="1.0" encoding="utf-8"?><printerFiscalReport><queryPrinterStatus /></printerFiscalReport>`;
      await this._post(xml);
      return true;
    } catch {
      return false;
    }
  }
}

function _esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _parseDocumentResponse(raw: string): RtDocumentResult {
  const docNumber = _extractAttr(raw, "receiptNumber") ?? _extractAttr(raw, "docNumber") ?? "0";
  const docDate = _extractAttr(raw, "receiptDate") ?? _extractAttr(raw, "docDate") ?? new Date().toISOString().slice(0, 10);
  const rtSerial = _extractAttr(raw, "printerSerial") ?? _extractAttr(raw, "serial") ?? "";
  return { docNumber, docDate, rtSerial, raw };
}

function _parseZReportResponse(raw: string): RtZReportResult {
  const totalStr = _extractAttr(raw, "grossTotal") ?? _extractAttr(raw, "totalAmount") ?? "0";
  const date = _extractAttr(raw, "zDate") ?? new Date().toISOString().slice(0, 10);
  const rtSerial = _extractAttr(raw, "printerSerial") ?? _extractAttr(raw, "serial") ?? "";
  return { date, totalGross: parseFloat(totalStr), rtSerial, raw };
}

function _extractAttr(xml: string, attr: string): string | undefined {
  const match = xml.match(new RegExp(`${attr}="([^"]*)"`, "i"));
  return match?.[1];
}
