export type RtType = "epson" | "custom" | "cloud";

export interface FiscalSettings {
  enabled: boolean;
  rtType: RtType;
  rtHost: string;
  rtPort: number;
  rtSerial: string;
}

export interface FiscalDocumentResult {
  docNumber: string;
  docDate: string;
  rtSerial: string;
  raw?: string;
}

export interface ZReportResult {
  date: string;
  totalGross: number;
  rtSerial: string;
  raw?: string;
}
