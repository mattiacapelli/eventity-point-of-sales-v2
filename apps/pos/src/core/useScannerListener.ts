import { useEffect, useRef } from "react";

const MAX_INTERKEY_MS = 80;   // HID scanners type far faster than any human — pause above this resets the buffer
const MIN_PAYLOAD_LENGTH = 8; // ignore accidental short bursts (e.g. a few fast keystrokes while typing)

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Detects input from a USB/Bluetooth barcode/QR scanner running in HID keyboard-wedge mode:
 * it types characters far faster than a human, then sends Enter. Ignored while focus is on an
 * editable field, so manual typing (e.g. a search box) is never intercepted.
 */
export function useScannerListener(onScan: (payload: string) => void): void {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) {
        bufferRef.current = "";
        return;
      }

      const now = performance.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (elapsed > MAX_INTERKEY_MS) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        const payload = bufferRef.current;
        bufferRef.current = "";
        if (payload.length >= MIN_PAYLOAD_LENGTH) {
          onScanRef.current(payload);
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    document.addEventListener("keydown", handleKeydown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeydown, { capture: true });
  }, []);
}
