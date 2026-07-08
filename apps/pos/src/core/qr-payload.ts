import { inflate } from "pako";

export interface QrOrderItem {
  productId: string;
  quantity: number;
  selectedOptionIds?: string[];
}

export interface QrOrderPayload {
  v: 1;
  code: string;
  tableId: string;
  customerName: string | null;
  items: QrOrderItem[];
}

function base64urlDecode(str: string): Uint8Array {
  const binary = atob(str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + (4 - (str.length % 4)) % 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Browser-compatible counterpart of cloud/web-ui-server's encodeQrPayload (pako deflate + base64url). */
export function decodeQrPayload(encoded: string): QrOrderPayload {
  const bytes = base64urlDecode(encoded);
  const json = inflate(bytes, { to: "string" });
  return JSON.parse(json) as QrOrderPayload;
}
