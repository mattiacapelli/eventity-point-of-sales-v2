import React, { useEffect, useRef, useState } from "react";
import { bootstrapApi } from "../../core/bootstrap-api.js";
import { adminApi } from "../../core/admin-api.js";
import { authClient } from "../../core/auth-client.js";
import { useStore } from "../../state/global-store.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "license" | "restaurant" | "admin" | "printer" | "done";

const STEPS: { id: WizardStep; label: string; emoji: string }[] = [
  { id: "license",    label: "Licenza",   emoji: "🔑" },
  { id: "restaurant", label: "Locale",    emoji: "🏪" },
  { id: "admin",      label: "Accesso",   emoji: "👤" },
  { id: "printer",    label: "Stampante", emoji: "🖨️" },
  { id: "done",       label: "Pronto",    emoji: "✅" },
];

// ─── Responsive helpers ───────────────────────────────────────────────────────

const RESPONSIVE = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

  .setup-card {
    width: 100%;
    max-width: 520px;
    background: var(--color-white);
    border-radius: 24px;
    padding: 36px 40px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.10);
    position: relative;
    box-sizing: border-box;
  }
  @media (max-width: 600px) {
    .setup-card {
      border-radius: 20px;
      padding: 28px 20px;
    }
  }

  .setup-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 480px) {
    .setup-grid-2 {
      grid-template-columns: 1fr;
    }
  }

  .setup-step-label {
    display: block;
  }
  @media (max-width: 420px) {
    .setup-step-label {
      display: none;
    }
  }

  .setup-done-tips {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setup-printer-row {
    display: flex;
    gap: 12px;
  }
  @media (max-width: 480px) {
    .setup-printer-row {
      flex-direction: column;
    }
  }
`;

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: "100%",
  height: "48px",
  padding: "0 14px",
  borderRadius: "12px",
  border: "2px solid var(--color-gray-200)",
  fontSize: "var(--text-md)",
  fontFamily: "var(--font)",
  color: "var(--color-gray-800)",
  background: "var(--color-white)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-gray-600)",
  marginBottom: "6px",
};

const BTN_PRIMARY: React.CSSProperties = {
  width: "100%",
  height: "52px",
  background: "var(--color-brand)",
  color: "var(--color-white)",
  border: "none",
  borderRadius: "14px",
  fontSize: "var(--text-md)",
  fontWeight: 700,
  fontFamily: "var(--font)",
  cursor: "pointer",
  transition: "opacity 0.15s, transform 0.1s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

const BTN_GHOST: React.CSSProperties = {
  height: "44px",
  padding: "0 20px",
  background: "transparent",
  color: "var(--color-gray-500)",
  border: "none",
  borderRadius: "12px",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  fontFamily: "var(--font)",
  cursor: "pointer",
  flexShrink: 0,
};

// ─── Logo SVG reale (icona circolare) ────────────────────────────────────────
// Path originale dal logo.svg con fill-rule="evenodd" — i 3 sub-path concatenati
// producono automaticamente il buco della E tramite la regola evenodd.
// viewBox originale 0 0 490 528

const ICON_EVENODD_PATH =
  "M266.087 527.204C214.215 527.204 168.106 516.281 127.76 494.434C88.0555 471.946 56.6757 441.425 33.6212 402.872C25.6925 389.235 19.1663 374.875 14.0423 359.79C12.9044 356.44 15.4234 353.014 18.9506 353.014H65.5305C66.6401 353.014 67.7209 352.66 68.6175 352.004L100.723 328.517C103.624 326.395 107.747 327.764 108.962 331.153C112.025 339.71 115.73 347.874 120.076 355.646C134.805 381.348 155.618 401.265 182.515 415.402C209.412 429.538 240.471 436.606 275.693 436.606C300.669 436.606 323.724 432.43 344.857 424.076C349.698 422.219 354.62 420.026 359.621 417.503C362.127 416.238 365.199 417.084 366.635 419.502L405.438 484.866C406.971 487.449 406.039 490.798 403.366 492.161C382.993 502.557 361.248 511.024 338.133 517.566C313.798 523.992 289.783 527.204 266.087 527.204Z" +
  " M479.983 288.179C482.831 288.179 485.158 285.897 485.222 283.041L486.066 245.771C486.707 210.431 481.263 177.984 469.736 148.427C458.849 118.227 442.839 92.2045 421.705 70.3581C401.213 48.5117 376.877 31.4845 348.699 19.2762C320.522 6.42545 290.103 0 257.442 0C220.298 0 185.716 6.74666 153.697 20.24C122.317 33.0907 95.0998 51.7245 72.0453 76.141C49.6313 99.915 32.0201 128.187 19.2121 160.956C13.2345 176.249 8.65178 192.313 5.46397 209.147C1.82132 228.381 0 248.621 0 269.867C0 274.365 0.0902493 278.814 0.270747 283.22C0.38487 286.004 2.68463 288.179 5.46243 288.179H479.983Z" +
  " M116.233 169.63C110.496 181.445 106.112 194.618 103.08 209.147H385.202V202.4C383.281 181.196 376.237 162.241 364.069 145.535C351.901 128.829 336.531 115.657 317.96 106.019C299.389 96.381 279.216 91.5619 257.442 91.5619C222.86 91.5619 193.722 98.3086 170.027 111.802C146.332 124.653 128.401 143.929 116.233 169.63Z";

const DOT_PATH = "M445.371 455.619C469.486 455.619 489.035 436.005 489.035 411.81C489.035 387.614 469.486 368 445.371 368C421.256 368 401.707 387.614 401.707 411.81C401.707 436.005 421.256 455.619 445.371 455.619Z";

// ─── Animated Logo Screen ─────────────────────────────────────────────────────

function AnimatedLogo({ onDone }: { onDone: () => void }) {
  const iconRef = useRef<SVGPathElement>(null);
  const dotRef  = useRef<SVGPathElement>(null);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);

  useEffect(() => {
    const el    = iconRef.current;
    const dotEl = dotRef.current;
    if (!el) return;

    const len = el.getTotalLength();
    el.style.strokeDasharray  = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    el.style.fill = "none";
    if (dotEl) dotEl.style.opacity = "0";

    // Start drawing
    const t1 = setTimeout(() => {
      el.style.transition = `stroke-dashoffset 1200ms cubic-bezier(0.4,0,0.2,1)`;
      el.style.strokeDashoffset = "0";
      setPhase(1);
    }, 80);

    // Fill + dot appear
    const t2 = setTimeout(() => {
      el.style.transition = "fill 350ms ease, stroke 350ms ease";
      el.style.fill   = "white";
      el.style.stroke = "none";
      if (dotEl) { dotEl.style.transition = "opacity 300ms ease"; dotEl.style.opacity = "1"; }
      setPhase(2);
    }, 1400);

    const t3 = setTimeout(() => setPhase(3), 1800);
    const t4 = setTimeout(() => setPhase(4), 2500);
    const t5 = setTimeout(() => onDone(), 3000);

    return () => { [t1, t2, t3, t4, t5].forEach(clearTimeout); };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "var(--color-brand)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "32px",
      opacity: phase === 4 ? 0 : 1,
      transition: phase === 4 ? "opacity 500ms ease" : "none",
      zIndex: 1000,
    }}>
      {/* Icon */}
      <div style={{
        transform: phase >= 3 ? "scale(1.06)" : "scale(1)",
        transition: "transform 500ms cubic-bezier(0.34,1.56,0.64,1)",
        filter: "drop-shadow(0 12px 40px rgba(0,0,0,0.3))",
      }}>
        <svg
          width="140"
          height="140"
          viewBox="0 0 490 528"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Icona originale con evenodd — il buco della E è corretto */}
          <path
            ref={iconRef}
            d={ICON_EVENODD_PATH}
            fillRule="evenodd"
            clipRule="evenodd"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="5"
            fill="none"
            style={{ willChange: "stroke-dashoffset, fill" }}
          />
          {/* Dot */}
          <path
            ref={dotRef}
            d={DOT_PATH}
            fill="white"
            style={{ opacity: 0 }}
          />
        </svg>
      </div>

      {/* Wordmark */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}>
          {/* Full wordmark SVG (white, scaled down) */}
          <svg
            width="200"
            height="68"
            viewBox="597 0 1560 736"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M597.969 736V16.2881H698.608V132.215L683.125 123.52C686.996 104.199 697.963 85.8441 716.026 68.4551C734.09 50.4221 756.024 35.9312 781.829 24.9826C808.279 13.3899 835.374 7.59357 863.114 7.59357C908.918 7.59357 949.561 18.8642 985.043 41.4056C1020.52 63.9469 1048.59 94.8607 1069.23 134.147C1089.88 173.433 1100.2 218.516 1100.2 269.395C1100.2 319.63 1089.88 364.712 1069.23 404.643C1049.23 443.929 1021.49 475.165 986.01 498.35C950.529 520.891 910.531 532.162 866.017 532.162C836.342 532.162 807.634 526.366 779.894 514.773C752.153 502.536 728.606 487.079 709.253 468.402C689.899 449.725 677.964 430.404 673.448 410.439L698.608 396.914V736H597.969ZM849.567 440.387C879.243 440.387 905.693 432.98 928.917 418.167C952.141 403.355 970.527 383.067 984.075 357.306C997.623 331.544 1004.4 302.241 1004.4 269.395C1004.4 236.549 997.623 207.567 984.075 182.45C971.173 156.688 953.109 136.401 929.885 121.588C906.66 106.775 879.888 99.3689 849.567 99.3689C819.246 99.3689 792.473 106.775 769.249 121.588C746.025 135.757 727.639 155.722 714.091 181.484C700.543 207.245 693.77 236.549 693.77 269.395C693.77 302.241 700.543 331.544 714.091 357.306C727.639 383.067 746.025 403.355 769.249 418.167C792.473 432.98 819.246 440.387 849.567 440.387Z" fill="white"/>
            <path d="M1436.82 533.128C1387.14 533.128 1342.63 521.857 1303.28 499.316C1264.57 476.131 1233.92 444.895 1211.34 405.609C1188.77 365.678 1177.48 320.274 1177.48 269.395C1177.48 218.516 1188.77 173.433 1211.34 134.147C1233.92 94.2166 1264.57 62.9808 1303.28 40.4395C1342.63 17.2542 1387.14 5.66148 1436.82 5.66148C1485.84 5.66148 1529.71 17.2542 1568.42 40.4395C1607.77 62.9808 1638.74 94.2166 1661.32 134.147C1683.9 173.433 1695.19 218.516 1695.19 269.395C1695.19 320.274 1683.9 365.678 1661.32 405.609C1638.74 444.895 1607.77 476.131 1568.42 499.316C1529.71 521.857 1485.84 533.128 1436.82 533.128ZM1436.82 442.319C1467.14 442.319 1494.23 434.912 1518.1 420.1C1541.97 404.643 1560.68 384.033 1574.23 358.272C1587.77 331.866 1594.23 302.241 1593.58 269.395C1594.23 235.905 1587.77 206.279 1574.23 180.518C1560.68 154.112 1541.97 133.503 1518.1 118.69C1494.23 103.877 1467.14 96.4707 1436.82 96.4707C1406.49 96.4707 1379.08 104.199 1354.56 119.656C1330.69 134.469 1311.98 155.078 1298.44 181.484C1284.89 207.245 1278.44 236.549 1279.08 269.395C1278.44 302.241 1284.89 331.866 1298.44 358.272C1311.98 384.033 1330.69 404.643 1354.56 420.1C1379.08 434.912 1406.49 442.319 1436.82 442.319Z" fill="white"/>
            <path d="M1973.14 533.128C1930.56 533.128 1892.18 525.722 1857.99 510.909C1823.79 496.096 1795.41 474.199 1772.83 445.217L1840.57 387.254C1859.92 409.795 1880.89 426.218 1903.47 436.523C1926.69 446.183 1952.82 451.013 1981.85 451.013C1993.46 451.013 2004.11 449.725 2013.78 447.149C2024.1 443.929 2032.81 439.421 2039.91 433.624C2047.65 427.828 2053.46 421.066 2057.33 413.337C2061.2 404.965 2063.13 395.948 2063.13 386.288C2063.13 369.543 2057.01 356.018 2044.75 345.713C2038.3 341.205 2027.98 336.375 2013.78 331.222C2000.23 325.426 1982.49 319.63 1960.56 313.833C1923.14 304.173 1892.5 293.224 1868.63 280.987C1844.76 268.751 1826.37 254.904 1813.47 239.447C1803.79 227.21 1796.7 214.008 1792.18 199.839C1787.67 185.026 1785.41 168.925 1785.41 151.536C1785.41 130.283 1789.92 110.962 1798.96 93.5726C1808.63 75.5395 1821.54 60.0826 1837.66 47.2019C1854.44 33.6771 1873.79 23.3725 1895.72 16.2881C1918.3 9.20368 1942.17 5.66148 1967.33 5.66148C1991.2 5.66148 2014.75 8.88166 2037.97 15.322C2061.84 21.7624 2083.78 31.101 2103.78 43.3377C2123.78 55.5744 2140.55 70.0652 2154.1 86.8102L2097 149.604C2084.75 137.367 2071.2 126.741 2056.36 117.724C2042.17 108.063 2027.65 100.657 2012.81 95.5047C1997.98 90.3524 1984.43 87.7762 1972.17 87.7762C1958.62 87.7762 1946.37 89.0643 1935.4 91.6405C1924.43 94.2166 1915.08 98.0808 1907.34 103.233C1900.24 108.385 1894.76 114.826 1890.89 122.554C1887.02 130.283 1885.08 138.977 1885.08 148.638C1885.73 157.01 1887.66 165.061 1890.89 172.789C1894.76 179.874 1899.92 185.992 1906.37 191.144C1913.47 196.297 1924.11 201.771 1938.3 207.567C1952.5 213.364 1970.56 218.838 1992.49 223.99C2024.75 232.363 2051.2 241.701 2071.84 252.006C2093.13 261.666 2109.91 272.937 2122.16 285.818C2135.07 298.054 2144.1 312.223 2149.26 328.324C2154.42 344.425 2157 362.458 2157 382.423C2157 411.405 2148.61 437.489 2131.84 460.674C2115.71 483.215 2093.78 500.926 2066.04 513.807C2038.3 526.688 2007.33 533.128 1973.14 533.128Z" fill="white"/>
          </svg>
        </div>
        <div style={{
          fontSize: "11px",
          color: "var(--color-accent)",
          fontWeight: 700,
          marginTop: "8px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: phase >= 3 ? 1 : 0,
          transition: "opacity 400ms ease 200ms",
        }}>
          Prima configurazione
        </div>
      </div>
    </div>
  );
}

// ─── Step bar ─────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "32px" }}>
      {STEPS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={s.id}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", flexShrink: 0 }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: done ? "14px" : "var(--text-xs)",
                fontWeight: 700,
                background: done ? "var(--color-brand)" : active ? "var(--color-accent)" : "var(--color-gray-100)",
                color: done ? "var(--color-white)" : active ? "var(--color-gray-900)" : "var(--color-gray-400)",
                transition: "all 0.3s",
                boxShadow: active ? "0 0 0 4px rgba(194,232,18,0.25)" : "none",
              }}>
                {done ? "✓" : active ? s.emoji : String(i + 1)}
              </div>
              <span className="setup-step-label" style={{
                fontSize: "9px",
                fontWeight: 700,
                color: active ? "var(--color-brand)" : "var(--color-gray-400)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                transition: "color 0.3s",
                lineHeight: 1,
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1,
                height: "2px",
                background: done ? "var(--color-brand)" : "var(--color-gray-100)",
                transition: "background 0.4s",
                marginTop: "15px",
                minWidth: "8px",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.08)",
      color: "var(--color-danger)",
      borderRadius: "10px",
      padding: "12px 14px",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      display: "flex",
      alignItems: "flex-start",
      gap: "8px",
    }}>
      <span style={{ flexShrink: 0 }}>⚠️</span>
      <span>{msg}</span>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
      {hint && <div style={{ marginTop: "4px", fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>{hint}</div>}
    </div>
  );
}

function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 800, color: "var(--color-gray-900)", marginBottom: "6px", lineHeight: 1.2 }}>
        {title}
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
        {sub}
      </div>
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel = "Continua", nextDisabled = false }: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
      {onBack && <button style={BTN_GHOST} onClick={onBack}>← Indietro</button>}
      <button
        style={{ ...BTN_PRIMARY, flex: 1, opacity: nextDisabled ? 0.4 : 1, cursor: nextDisabled ? "not-allowed" : "pointer" }}
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextLabel} <span style={{ fontSize: "18px" }}>→</span>
      </button>
    </div>
  );
}

// ─── Step: Licenza ────────────────────────────────────────────────────────────

function StepLicense({ onNext }: { onNext: () => void }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <StepHeading title="Contratto di licenza" sub="Leggi e accetta i termini per continuare con l'installazione." />

      <div style={{
        background: "var(--color-gray-50)",
        borderRadius: "12px",
        border: "1.5px solid var(--color-gray-200)",
        padding: "16px 18px",
        maxHeight: "180px",
        overflowY: "auto",
        fontSize: "12px",
        color: "var(--color-gray-600)",
        lineHeight: 1.9,
        whiteSpace: "pre-line",
      }}>
        {"Eventity POS — Licenza d'uso\n\n1. Uso consentito. La licenza autorizza l'installazione e l'uso del software su un numero di terminali pari a quanto indicato nel piano acquistato.\n\n2. Divieti. È vietato: sublicenziare, vendere, redistribuire, decompilare o effettuare reverse engineering del software.\n\n3. Aggiornamenti. Gli aggiornamenti sono inclusi durante il periodo di validità della licenza attiva.\n\n4. Responsabilità. Il software è fornito \"così com'è\". Il licenziante non è responsabile per perdita di dati o danni consequenziali derivanti dall'uso.\n\n5. Risoluzione. La licenza si risolve automaticamente in caso di violazione dei presenti termini.\n\n6. Legge applicabile. Il presente accordo è regolato dalla legge italiana. Foro competente: Milano.\n\n© 2026 Eventity. Tutti i diritti riservati."}
      </div>

      {/* License status */}
      <div style={{
        background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
        borderRadius: "14px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        color: "var(--color-white)",
      }}>
        <div style={{ fontSize: "24px", flexShrink: 0 }}>🔑</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>Licenza di prova attiva</div>
          <div style={{ fontSize: "var(--text-xs)", opacity: 0.8, marginTop: "2px" }}>Funzionalità complete durante l'installazione.</div>
        </div>
        <div style={{ background: "rgba(194,232,18,0.2)", color: "var(--color-accent)", borderRadius: "999px", padding: "3px 10px", fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0 }}>
          ATTIVA
        </div>
      </div>

      {/* Checkbox */}
      <label style={{
        display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer",
        padding: "14px", borderRadius: "12px",
        border: `2px solid ${accepted ? "var(--color-brand)" : "var(--color-gray-200)"}`,
        background: accepted ? "rgba(48,107,52,0.04)" : "transparent",
        transition: "all 0.2s",
      }}>
        <div style={{
          width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0, marginTop: "1px",
          border: `2px solid ${accepted ? "var(--color-brand)" : "var(--color-gray-300)"}`,
          background: accepted ? "var(--color-brand)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}>
          {accepted && <span style={{ color: "white", fontSize: "12px" }}>✓</span>}
        </div>
        <input type="checkbox" style={{ display: "none" }} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)", lineHeight: 1.5 }}>
          Ho letto e accetto i <strong>Termini di licenza</strong> e l'<strong>Informativa sulla privacy</strong> di Eventity POS.
        </div>
      </label>

      <NavRow onNext={onNext} nextLabel="Accetta e continua" nextDisabled={!accepted} />
    </div>
  );
}

// ─── Step: Ristorante ─────────────────────────────────────────────────────────

interface RestaurantData { name: string; address: string; city: string; vat: string; phone: string; website: string; _logoFile?: File | null }

function StepRestaurant({ onNext, onBack }: { onNext: (d: RestaurantData) => void; onBack: () => void }) {
  const [form, setForm] = useState<RestaurantData>({ name: "", address: "", city: "", vat: "", phone: "", website: "" });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof Omit<RestaurantData, "_logoFile">) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleNext() {
    if (!form.name.trim()) { setError("Inserisci il nome del locale"); return; }
    setError(null);
    onNext({ ...form, _logoFile: logoFile });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <StepHeading title="Il tuo locale" sub="Questi dati appaiono sullo scontrino. Modificabili in qualsiasi momento." />

      {/* Layout a due colonne: logo sx, campi dx */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "16px", alignItems: "start" }}>

        {/* Logo upload verticale */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "12px", border: "2px solid var(--color-gray-200)", background: "var(--color-gray-50)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: "26px" }}>🏪</span>}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "72px", padding: "5px 0", borderRadius: "8px", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "10px", fontWeight: 600, color: "var(--color-gray-600)", textAlign: "center" }}>
            Logo
            <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handleLogo} />
          </label>
        </div>

        {/* Nome (occupa tutta la colonna destra) */}
        <Field label="Nome del locale *">
          <input style={INPUT} type="text" placeholder="Es. Trattoria Da Mario" value={form.name} onChange={set("name")} autoFocus />
        </Field>
      </div>

      {/* Griglia 2 colonne per i campi secondari */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Indirizzo">
          <input style={INPUT} type="text" placeholder="Es. Via Roma 12" value={form.address} onChange={set("address")} />
        </Field>
        <Field label="Città / CAP">
          <input style={INPUT} type="text" placeholder="Es. Milano, 20121" value={form.city} onChange={set("city")} />
        </Field>
        <Field label="P.IVA / C.F." hint="Appare sullo scontrino">
          <input style={INPUT} type="text" placeholder="Es. IT01234567890" value={form.vat} onChange={set("vat")} />
        </Field>
        <Field label="Telefono">
          <input style={INPUT} type="text" placeholder="Es. +39 02 1234567" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Sito web" hint="">
          <input style={INPUT} type="text" placeholder="Es. www.esempio.it" value={form.website} onChange={set("website")} />
        </Field>
      </div>

      {error && <ErrorBanner msg={error} />}
      <NavRow onBack={onBack} onNext={handleNext} />
    </div>
  );
}

// ─── Step: Admin ──────────────────────────────────────────────────────────────

interface AdminData { name: string; pin: string; pinConfirm: string }

function StepAdmin({ onNext, onBack }: { onNext: (d: AdminData) => void; onBack: () => void }) {
  const [form, setForm] = useState<AdminData>({ name: "", pin: "", pinConfirm: "" });
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!form.name.trim()) { setError("Inserisci il nome dell'amministratore"); return; }
    if (form.pin.length < 4) { setError("Il PIN deve essere di almeno 4 cifre"); return; }
    if (!/^\d+$/.test(form.pin)) { setError("Il PIN deve contenere solo numeri"); return; }
    if (form.pin !== form.pinConfirm) { setError("I PIN non corrispondono"); return; }
    setError(null);
    onNext(form);
  }

  const strength = form.pin.length === 0 ? null : form.pin.length < 4 ? "weak" : form.pin.length < 6 ? "ok" : "strong";
  const strengthColor = { weak: "var(--color-danger)", ok: "var(--color-warning)", strong: "var(--color-success)" };
  const strengthLabel = { weak: "Troppo corto", ok: "Accettabile", strong: "Sicuro" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <StepHeading title="Account amministratore" sub="Crea il primo account con accesso completo al POS e all'area admin." />

      <Field label="Nome completo *">
        <input style={INPUT} type="text" placeholder="Es. Mario Rossi" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
      </Field>

      <Field label="PIN di accesso *" hint="Solo numeri, minimo 4 cifre.">
        <div style={{ position: "relative" }}>
          <input
            style={{ ...INPUT, paddingRight: "48px", letterSpacing: "0.15em" }}
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            placeholder="••••"
            value={form.pin}
            onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
          />
          <button type="button" onClick={() => setShowPin((v) => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--color-gray-400)", padding: "4px" }}>
            {showPin ? "🙈" : "👁️"}
          </button>
        </div>
        {strength && (
          <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ width: "24px", height: "3px", borderRadius: "2px", transition: "background 0.2s", background: (strength === "weak" && i === 1) || (strength === "ok" && i <= 2) || strength === "strong" ? strengthColor[strength] : "var(--color-gray-200)" }} />
              ))}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: strengthColor[strength], fontWeight: 600 }}>{strengthLabel[strength]}</span>
          </div>
        )}
      </Field>

      <Field label="Conferma PIN *">
        <input
          style={{ ...INPUT, borderColor: form.pinConfirm && form.pin !== form.pinConfirm ? "var(--color-danger)" : undefined, letterSpacing: "0.15em" }}
          type={showPin ? "text" : "password"}
          inputMode="numeric"
          placeholder="••••"
          value={form.pinConfirm}
          onChange={(e) => setForm((f) => ({ ...f, pinConfirm: e.target.value.replace(/\D/g, "") }))}
          onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
        />
        {form.pinConfirm && form.pin === form.pinConfirm && (
          <div style={{ marginTop: "4px", fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 600 }}>✓ I PIN corrispondono</div>
        )}
      </Field>

      {error && <ErrorBanner msg={error} />}
      <NavRow onBack={onBack} onNext={handleNext} />
    </div>
  );
}

// ─── Step: Stampante ──────────────────────────────────────────────────────────

interface PrinterData { name: string; host: string; port: string }

function StepPrinter({ onNext, onBack }: { onNext: (d: PrinterData | null) => void; onBack: () => void }) {
  const [form, setForm] = useState<PrinterData>({ name: "Stampante principale", host: "", port: "9100" });
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<Array<{ host: string; port: number }>>([]);
  const [subnet, setSubnet] = useState("");
  const [showDisc, setShowDisc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDiscover() {
    setDiscovering(true); setDiscovered([]); setError(null);
    try {
      const res = await adminApi.printers.discover(subnet.trim() || undefined);
      setDiscovered(res.found);
      if (res.found.length === 0) setError("Nessuna stampante trovata. Puoi inserire l'IP manualmente.");
    } catch { setError("Errore durante la ricerca."); }
    finally { setDiscovering(false); }
  }

  function handleNext() {
    if (!form.host.trim()) { onNext(null); return; }
    const p = parseInt(form.port, 10);
    if (isNaN(p) || p < 1 || p > 65535) { setError("Porta non valida (1–65535)"); return; }
    setError(null);
    onNext(form);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <StepHeading title="Stampante" sub="Connetti la stampante ESC/POS per gli scontrini. Puoi aggiungerla anche in seguito dall'admin." />

      {/* Discovery toggle */}
      <button type="button" onClick={() => { setShowDisc((v) => !v); if (!showDisc) void handleDiscover(); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${showDisc ? "var(--color-brand)" : "var(--color-gray-200)"}`, background: showDisc ? "rgba(48,107,52,0.04)" : "var(--color-white)", cursor: "pointer", fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)", textAlign: "left", width: "100%" }}>
        <span style={{ fontSize: "20px", flexShrink: 0 }}>🔍</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div>Cerca stampanti sulla rete</div>
          <div style={{ fontWeight: 400, color: "var(--color-gray-400)", fontSize: "var(--text-xs)", marginTop: "1px" }}>Scansiona la rete locale automaticamente</div>
        </div>
        <span style={{ color: "var(--color-gray-300)", fontSize: "11px", flexShrink: 0 }}>{showDisc ? "▲" : "▼"}</span>
      </button>

      {showDisc && (
        <div style={{ border: "1.5px solid var(--color-gray-200)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", background: "var(--color-gray-50)" }}>
          <div className="setup-printer-row">
            <input style={{ ...INPUT, flex: 1 }} placeholder="Subnet (es. 192.168.1) — lascia vuoto per auto" value={subnet} onChange={(e) => setSubnet(e.target.value)} />
            <button onClick={() => void handleDiscover()} disabled={discovering} style={{ height: "48px", padding: "0 16px", borderRadius: "12px", border: "none", background: "var(--color-brand)", color: "var(--color-white)", fontWeight: 700, fontSize: "var(--text-sm)", fontFamily: "var(--font)", cursor: discovering ? "not-allowed" : "pointer", opacity: discovering ? 0.7 : 1, whiteSpace: "nowrap", flexShrink: 0 }}>
              {discovering ? "⏳ Ricerca…" : "Cerca"}
            </button>
          </div>
          {discovered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {discovered.map((p) => (
                <button key={`${p.host}:${p.port}`} onClick={() => { setForm((f) => ({ ...f, host: p.host, port: String(p.port) })); setShowDisc(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-800)" }}>
                  <span>🖨️ {p.host}:{p.port}</span>
                  <span style={{ color: "var(--color-brand)", fontSize: "var(--text-xs)" }}>Usa →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <Field label="Nome stampante">
          <input style={INPUT} type="text" placeholder="Es. Cassa principale" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="setup-grid-2">
          <Field label="Indirizzo IP">
            <input style={INPUT} type="text" placeholder="Es. 192.168.1.100" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
          </Field>
          <Field label="Porta">
            <input style={INPUT} type="text" inputMode="numeric" placeholder="9100" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} />
          </Field>
        </div>
      </div>

      {error && <ErrorBanner msg={error} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button style={{ ...BTN_PRIMARY }} onClick={handleNext}>
          {form.host.trim() ? <>Aggiungi stampante <span style={{ fontSize: "18px" }}>→</span></> : "Salta per ora →"}
        </button>
        <button style={BTN_GHOST} onClick={onBack}>← Indietro</button>
      </div>
    </div>
  );
}

// ─── Step: Done ───────────────────────────────────────────────────────────────

function StepDone({ username, storeName, onDone }: { username: string; storeName: string; onDone: () => void }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
      <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(48,107,52,0.3)", transform: vis ? "scale(1)" : "scale(0.5)", opacity: vis ? 1 : 0, transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease" }}>
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <path d="M9 19.5L15.5 26L29 12" stroke="var(--color-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ strokeDasharray: 40, strokeDashoffset: vis ? 0 : 40, transition: "stroke-dashoffset 0.5s ease 0.3s" }} />
        </svg>
      </div>

      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(10px)", transition: "all 0.4s ease 0.2s" }}>
        <div style={{ fontSize: "clamp(18px, 5vw, 24px)", fontWeight: 800, color: "var(--color-gray-900)", marginBottom: "6px" }}>
          {storeName} è pronto!
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
          Configurazione completata. Usa le credenziali qui sotto per accedere.
        </div>
      </div>

      <div style={{ width: "100%", background: "var(--color-gray-50)", borderRadius: "14px", border: "1.5px solid var(--color-gray-200)", padding: "18px", opacity: vis ? 1 : 0, transition: "opacity 0.4s ease 0.4s" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Credenziali di accesso</div>
        {[{ label: "Username", value: username, mono: true }, { label: "PIN", value: "Il PIN che hai scelto", mono: false }].map(({ label, value, mono }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>{label}</span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)", fontFamily: mono ? "monospace" : "var(--font)", background: "var(--color-white)", border: "1.5px solid var(--color-gray-200)", borderRadius: "8px", padding: "3px 10px" }}>{value}</span>
          </div>
        ))}
      </div>

      <div className="setup-done-tips" style={{ width: "100%", opacity: vis ? 1 : 0, transition: "opacity 0.4s ease 0.55s" }}>
        {[
          { icon: "🏪", text: "Aggiungi prodotti e categorie dall'area Admin" },
          { icon: "🖨️", text: "Configura i template di stampa in Admin → Scontrini" },
          { icon: "👥", text: "Crea altri utenti in Admin → Utenti" },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", background: "rgba(48,107,52,0.05)", textAlign: "left", fontSize: "var(--text-xs)", color: "var(--color-gray-600)", fontWeight: 500 }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
            {text}
          </div>
        ))}
      </div>

      <button style={{ ...BTN_PRIMARY, width: "100%", opacity: vis ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }} onClick={onDone}>
        Vai al login 🚀
      </button>
    </div>
  );
}

// ─── Main SetupScreen ─────────────────────────────────────────────────────────

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const [showAnim, setShowAnim] = useState(true);
  const [step, setStep] = useState<WizardStep>("license");
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null);
  const [createdUsername, setCreatedUsername] = useState("");
  const [storeName, setStoreName] = useState("Il tuo locale");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdminNext(data: AdminData) {
    setLoading(true); setError(null);
    try {
      const result = await bootstrapApi.init({
        storeName: restaurantData?.name?.trim() || "Eventity POS",
        adminPin: data.pin,
        adminName: data.name.trim(),
      });
      setCreatedUsername(result.username);
      setStoreName(restaurantData?.name?.trim() || "Eventity POS");

      // Login automatico per sbloccare le rotte admin protette
      const loginRes = await authClient.login(data.pin);
      authClient.storeToken(loginRes.token);
      useStore.getState().setSession({
        token: loginRes.token,
        role: loginRes.role,
        userId: loginRes.userId,
        name: result.username,
      });

      if (restaurantData) {
        const { _logoFile, ...rest } = restaurantData;
        try {
          await adminApi.restaurant.update(rest);
          if (_logoFile) await adminApi.restaurant.uploadLogo(_logoFile);
        } catch { /* non-fatal */ }
      }

      setStep("printer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'inizializzazione");
    } finally {
      setLoading(false);
    }
  }

  async function handlePrinterNext(data: PrinterData | null) {
    if (data) {
      try {
        await adminApi.printers.create({
          name: data.name,
          host: data.host,
          port: parseInt(data.port, 10),
          active: true,
          receiptEnabled: true,
          kitchenEnabled: false,
        });
      } catch { /* non-fatal */ }
    }
    setStep("done");
  }

  if (showAnim) return <AnimatedLogo onDone={() => setShowAnim(false)} />;

  return (
    <>
      <style>{RESPONSIVE}</style>
      <div style={{
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #f0fdf4 0%, #dcfce7 40%, #f9fafb 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(12px, 4vw, 32px)",
        boxSizing: "border-box",
      }}>
        {/* Decorazioni di sfondo */}
        <div style={{ position: "fixed", top: "-100px", right: "-100px", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle, rgba(48,107,52,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "-60px", left: "-60px", width: "250px", height: "250px", borderRadius: "50%", background: "radial-gradient(circle, rgba(194,232,18,0.09) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div className="setup-card">
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 490 530" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M266.087 527.204C214.215 527.204 168.106 516.281 127.76 494.434C88.0555 471.946 56.6757 441.425 33.6212 402.872C25.6925 389.235 19.1663 374.875 14.0423 359.79C12.9044 356.44 15.4234 353.014 18.9506 353.014H65.5305C66.6401 353.014 67.7209 352.66 68.6175 352.004L100.723 328.517C103.624 326.395 107.747 327.764 108.962 331.153C112.025 339.71 115.73 347.874 120.076 355.646C134.805 381.348 155.618 401.265 182.515 415.402C209.412 429.538 240.471 436.606 275.693 436.606C300.669 436.606 323.724 432.43 344.857 424.076C349.698 422.219 354.62 420.026 359.621 417.503C362.127 416.238 365.199 417.084 366.635 419.502L405.438 484.866C406.971 487.449 406.039 490.798 403.366 492.161C382.993 502.557 361.248 511.024 338.133 517.566C313.798 523.992 289.783 527.204 266.087 527.204ZM479.983 288.179C482.831 288.179 485.158 285.897 485.222 283.041L486.066 245.771C486.707 210.431 481.263 177.984 469.736 148.427C458.849 118.227 442.839 92.2045 421.705 70.3581C401.213 48.5117 376.877 31.4845 348.699 19.2762C320.522 6.42545 290.103 0 257.442 0C220.298 0 185.716 6.74666 153.697 20.24C122.317 33.0907 95.0998 51.7245 72.0453 76.141C49.6313 99.915 32.0201 128.187 19.2121 160.956C13.2345 176.249 8.65178 192.313 5.46397 209.147C1.82132 228.381 0 248.621 0 269.867C0 274.365 0.0902493 278.814 0.270747 283.22C0.38487 286.004 2.68463 288.179 5.46243 288.179H479.983ZM116.233 169.63C110.496 181.445 106.112 194.618 103.08 209.147H385.202V202.4C383.281 181.196 376.237 162.241 364.069 145.535C351.901 128.829 336.531 115.657 317.96 106.019C299.389 96.381 279.216 91.5619 257.442 91.5619C222.86 91.5619 193.722 98.3086 170.027 111.802C146.332 124.653 128.401 143.929 116.233 169.63Z" fill="var(--color-accent)" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--color-brand)", letterSpacing: "-0.5px", lineHeight: 1 }}>Eventity POS</div>
              <div style={{ fontSize: "10px", color: "var(--color-gray-400)", marginTop: "2px", fontWeight: 500 }}>Configurazione guidata</div>
            </div>
          </div>

          <StepBar current={step} />

          {/* Loading overlay */}
          {loading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.88)", borderRadius: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", zIndex: 10 }}>
              <div style={{ width: "44px", height: "44px", border: "4px solid var(--color-gray-100)", borderTop: "4px solid var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <div style={{ fontWeight: 600, color: "var(--color-gray-600)", fontSize: "var(--text-sm)" }}>Configurazione in corso…</div>
            </div>
          )}

          {error && !loading && <div style={{ marginBottom: "20px" }}><ErrorBanner msg={error} /></div>}

          {step === "license"    && <StepLicense    onNext={() => setStep("restaurant")} />}
          {step === "restaurant" && <StepRestaurant onNext={(d) => { setRestaurantData(d); setStep("admin"); }} onBack={() => setStep("license")} />}
          {step === "admin"      && <StepAdmin      onNext={(d) => void handleAdminNext(d)} onBack={() => setStep("restaurant")} />}
          {step === "printer"    && <StepPrinter    onNext={(d) => void handlePrinterNext(d)} onBack={() => setStep("admin")} />}
          {step === "done"       && <StepDone       username={createdUsername} storeName={storeName} onDone={onDone} />}
        </div>
      </div>
    </>
  );
}
