import { deflate, inflate } from "pako";

export interface QrOrderItem {
  productId: number;
  quantity: number;
  selectedOptionIds?: number[];
}

export interface QrOrderPayload {
  v: 1;
  code: string;
  tableId: string;
  customerName: string | null;
  items: QrOrderItem[];
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return Buffer.from(binary, "binary").toString("base64url");
}

function base64urlDecode(str: string): Uint8Array {
  const binary = Buffer.from(str, "base64url").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Compresses the order payload (deflate + base64url) so it fits comfortably in a QR code. */
export function encodeQrPayload(payload: QrOrderPayload): string {
  const json = JSON.stringify(payload);
  const compressed = deflate(json);
  return base64urlEncode(compressed);
}

export function decodeQrPayload(encoded: string): QrOrderPayload {
  const bytes = base64urlDecode(encoded);
  const json = inflate(bytes, { to: "string" });
  return JSON.parse(json) as QrOrderPayload;
}
