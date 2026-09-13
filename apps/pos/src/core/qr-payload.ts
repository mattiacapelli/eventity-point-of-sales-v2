import { inflate } from "pako";

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

// base64url alphabet: A-Z a-z 0-9 - _
// HID scanners on IT keyboard layout may corrupt - and _ into other chars.
// We try the canonical decode first, then fall back to known IT-layout substitutions.
const IT_KEYBOARD_SUBSTITUTIONS: Array<[RegExp, string]> = [
  // IT layout: US '-' → IT "'" (apostrophe, key next to 0)
  // IT layout: US '_' → IT '?' (shift+apostrophe)
  [/'/g, "-"],
  [/\?/g, "_"],
];

function base64urlToBytes(str: string): Uint8Array {
  // base64url → base64 standard → atob
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function tryDecode(str: string): QrOrderPayload {
  const bytes = base64urlToBytes(str);
  const json = inflate(bytes, { to: "string" });
  return JSON.parse(json) as QrOrderPayload;
}

/** Browser-compatible counterpart of cloud/web-ui-server's encodeQrPayload (pako deflate + base64url).
 *  Tolerates IT keyboard layout corruption of - and _ characters from HID scanners. */
export function decodeQrPayload(encoded: string): QrOrderPayload {
  // Try as-is first (correct layout or already base64url-clean)
  try { return tryDecode(encoded); } catch { /* fall through */ }

  // Apply IT keyboard substitutions and retry
  let fixed = encoded;
  for (const [pattern, replacement] of IT_KEYBOARD_SUBSTITUTIONS) {
    fixed = fixed.replace(pattern, replacement);
  }
  return tryDecode(fixed);
}
