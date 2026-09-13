import type { Logger } from "@pos/core";
import type { FiscalSettings } from "@pos/shared-types";
import type { FiscalRepository } from "../repository/fiscal.repository.js";
import { buildRtDocument } from "./document-builder.js";
import { EpsonRtAdapter } from "./rt-adapter/epson-rt.adapter.js";
import type { RtAdapter } from "./rt-adapter/rt-adapter.interface.js";

export class FiscalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalError";
  }
}

export class FiscalService {
  private adapter: RtAdapter | null = null;
  private settings: FiscalSettings | null = null;

  constructor(
    private readonly repo: FiscalRepository,
    private readonly logger: Logger,
  ) {}

  async loadSettings(): Promise<void> {
    this.settings = await this.repo.getSettings();
    if (this.settings.enabled) {
      this.adapter = this._buildAdapter(this.settings);
    }
  }

  private _buildAdapter(s: FiscalSettings): RtAdapter {
    switch (s.rtType) {
      case "epson":
        return new EpsonRtAdapter(s.rtHost, s.rtPort);
      default:
        throw new FiscalError(`Unknown RT type: ${s.rtType}`);
    }
  }

  get enabled(): boolean {
    return this.settings?.enabled === true;
  }

  async ping(): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.ping();
  }

  async emitFiscalDocument(orderId: number, paymentMethod: "cash" | "card" | "digital_wallet" | "tab", amount: number): Promise<void> {
    if (!this.enabled || !this.adapter) {
      this.logger.debug({ orderId }, "Fiscal disabled — skipping document emission");
      return;
    }

    const order = await this.repo.getOrderWithItems(orderId);
    if (!order) throw new FiscalError(`Order ${orderId} not found`);

    if (order.fiscalDocNumber) {
      this.logger.warn({ orderId, docNumber: order.fiscalDocNumber }, "Fiscal document already emitted — skipping");
      return;
    }

    const rtInput = buildRtDocument(order.items, { method: paymentMethod, amount });

    try {
      const result = await this.adapter.emitDocument(rtInput);
      await this.repo.saveFiscalData(orderId, {
        fiscalDocNumber: result.docNumber,
        fiscalDocDate: result.docDate,
        fiscalRtSerial: result.rtSerial || (this.settings?.rtSerial ?? ""),
      });
      this.logger.info({ orderId, docNumber: result.docNumber }, "Fiscal document emitted");
    } catch (err) {
      this.logger.error({ err, orderId }, "Fiscal document emission failed");
      throw new FiscalError(`RT communication error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async emitVoidDocument(orderId: number): Promise<void> {
    if (!this.enabled || !this.adapter) return;

    const order = await this.repo.getOrderWithItems(orderId);
    if (!order?.fiscalDocNumber) {
      this.logger.warn({ orderId }, "No fiscal document to void — skipping");
      return;
    }

    try {
      await this.adapter.emitVoid(order.fiscalDocNumber, new Date().toISOString().slice(0, 10));
      this.logger.info({ orderId, docNumber: order.fiscalDocNumber }, "Fiscal document voided");
    } catch (err) {
      this.logger.error({ err, orderId }, "Fiscal void failed");
      throw new FiscalError(`RT void error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async emitZReport(shiftId: number): Promise<object> {
    if (!this.enabled || !this.adapter) {
      throw new FiscalError("Fiscal module is disabled — cannot emit Z-report");
    }

    const existing = await this.repo.getZReportFiscal(shiftId);
    if (existing) {
      this.logger.warn({ shiftId }, "Z-report already emitted for this shift");
      return JSON.parse(existing) as object;
    }

    try {
      const result = await this.adapter.emitZReport();
      await this.repo.saveZReport(shiftId, result);
      this.logger.info({ shiftId, date: result.date, total: result.totalGross }, "Z-report emitted");
      return result;
    } catch (err) {
      this.logger.error({ err, shiftId }, "Z-report emission failed");
      throw new FiscalError(`RT Z-report error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
