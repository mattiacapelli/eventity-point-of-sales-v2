import React, { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useGridStore } from "../../state/grid-store.js";

// ─── Shared styles ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--color-white)",
  border: "1px solid var(--color-gray-100)",
  borderRadius: "var(--radius-xl)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  padding: "24px",
};

const toggleStyle = (on: boolean, disabled: boolean): React.CSSProperties => ({
  width: "52px", height: "28px", borderRadius: "14px",
  background: on ? "var(--color-brand)" : "var(--color-gray-200)",
  border: "none", cursor: disabled ? "not-allowed" : "pointer",
  position: "relative", transition: "background 0.2s", flexShrink: 0,
  opacity: disabled ? 0.6 : 1,
});

const thumbStyle = (on: boolean): React.CSSProperties => ({
  position: "absolute", top: "3px",
  left: on ? "27px" : "3px",
  width: "22px", height: "22px", borderRadius: "50%",
  background: "var(--color-white)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  transition: "left 0.2s",
});

const sectionTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "var(--text-md)",
  color: "var(--color-gray-900)",
  marginBottom: "16px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--sp-md)",
};

// ─── Px slider ────────────────────────────────────────────────────────────────

function PxSlider({ value, min, max, step = 1, onChange }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  function commit(raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(String(value));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ flex: 1, accentColor: "var(--color-brand)", cursor: "pointer" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
          style={{
            width: "56px",
            padding: "6px 8px",
            borderRadius: "var(--radius-md)",
            border: "1.5px solid var(--color-gray-200)",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font)",
            fontWeight: 600,
            textAlign: "center",
            outline: "none",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = "var(--color-gray-200)"; }}
        />
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 600 }}>px</span>
      </div>
    </div>
  );
}

// ─── Mini card preview ─────────────────────────────────────────────────────────

function CardPreview({
  showPrice, showDescription, showCategory, showImage,
  cardTextSize, cardRowHeight,
}: {
  showPrice: boolean; showDescription: boolean;
  showCategory: boolean; showImage: boolean;
  cardTextSize: number; cardRowHeight: number;
}) {
  const nameFontSize = `${cardTextSize}px`;
  const priceFontSize = `${cardTextSize}px`;
  const descFontSize = `${Math.max(8, cardTextSize - 3)}px`;
  const catFontSize = `${Math.max(8, cardTextSize - 4)}px`;

  const previewH = Math.round(cardRowHeight * 0.75);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
    }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-400)", marginBottom: "4px" }}>
        Anteprima card
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        {/* Card senza immagine (con colore) */}
        <div style={{
          width: `${Math.round(previewH * 0.85)}px`, height: `${previewH}px`,
          background: "#4CAF82",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "3px",
          padding: "8px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}>
          {showCategory && (
            <span style={{ fontSize: catFontSize, fontWeight: 600, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2 }}>
              Antipasti
            </span>
          )}
          <span style={{ fontSize: nameFontSize, fontWeight: 600, color: "rgba(255,255,255,0.95)", textAlign: "center", lineHeight: 1.3 }}>
            Bruschette
          </span>
          {showDescription && (
            <span style={{ fontSize: descFontSize, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 1.3 }}>
              Pomodoro, basilico
            </span>
          )}
          {showPrice && (
            <span style={{ fontSize: priceFontSize, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
              €8.00
            </span>
          )}
        </div>
        {/* Card con immagine */}
        <div style={{
          width: `${Math.round(previewH * 0.85)}px`, height: `${previewH}px`,
          background: "var(--color-white)",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}>
          {showImage && (
            <div style={{
              height: Math.round(previewH * 0.45),
              background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "18px" }}>🍝</span>
            </div>
          )}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "3px", padding: "6px 6px",
          }}>
            {showCategory && (
              <span style={{ fontSize: catFontSize, fontWeight: 600, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2 }}>
                Primi
              </span>
            )}
            <span style={{ fontSize: nameFontSize, fontWeight: 600, color: "var(--color-gray-800)", textAlign: "center", lineHeight: 1.3 }}>
              Carbonara
            </span>
            {showDescription && (
              <span style={{ fontSize: descFontSize, color: "var(--color-gray-500)", textAlign: "center", lineHeight: 1.3 }}>
                Guanciale, uova
              </span>
            )}
            {showPrice && (
              <span style={{ fontSize: priceFontSize, fontWeight: 700, color: "var(--color-brand)" }}>
                €14.00
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── InterfaceTab ──────────────────────────────────────────────────────────────

type SubTab = "appearance" | "cart" | "card";

export function InterfaceTab() {
  const [subTab, setSubTab] = useState<SubTab>("appearance");

  // Appearance
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("pos_theme") === "dark");
  const [fontScale, setFontScale] = useState(() => localStorage.getItem("pos_font_size") ?? "normal");

  // Cart
  const [cartNotesEnabled, setCartNotesEnabled] = useState(true);
  const [cartPaxEnabled, setCartPaxEnabled] = useState(true);
  const [cartDiscountEnabled, setCartDiscountEnabled] = useState(true);
  const [cartTextSize, setCartTextSize] = useState(14);
  const [savingCart, setSavingCart] = useState<string | null>(null);

  // Card — read from grid store, write via setPrefs (debounced to server)
  const { showPrice, showDescription, showCategory, showImage, cardTextSize, cardRowHeight, setPrefs } = useGridStore();

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    adminApi.settings.get().then((s) => {
      setCartNotesEnabled(s.cartNotesEnabled);
      setCartPaxEnabled(s.cartPaxEnabled);
      setCartDiscountEnabled(s.cartDiscountEnabled);
      setCartTextSize(s.cartTextSize ?? 14);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  function applyTheme(dark: boolean) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("pos_theme", dark ? "dark" : "light");
  }

  function applyFontScale(scale: string) {
    document.documentElement.setAttribute("data-font-scale", scale);
    localStorage.setItem("pos_font_size", scale);
  }

  async function saveCartToggle(key: "cartNotesEnabled" | "cartPaxEnabled" | "cartDiscountEnabled", value: boolean) {
    setSavingCart(key);
    try {
      await adminApi.settings.update({ [key]: value } as Parameters<typeof adminApi.settings.update>[0]);
    } catch { /* ignore */ } finally { setSavingCart(null); }
  }

  if (!loaded) {
    return <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", padding: "var(--sp-lg)" }}>Caricamento...</div>;
  }

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "appearance", label: "Aspetto" },
    { key: "cart", label: "Carrello" },
    { key: "card", label: "Card prodotto" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)", maxWidth: "640px" }}>

      {/* Sub-tab switcher */}
      <div style={{ display: "flex", gap: "4px", background: "var(--color-gray-100)", borderRadius: "var(--radius-lg)", padding: "4px", width: "fit-content" }}>
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: "8px 20px",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: "pointer",
              background: subTab === t.key ? "var(--color-white)" : "transparent",
              color: subTab === t.key ? "var(--color-brand)" : "var(--color-gray-500)",
              boxShadow: subTab === t.key ? "var(--shadow-sm)" : "none",
              transition: "var(--transition)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Aspetto ── */}
      {subTab === "appearance" && (
        <>
          <div style={cardStyle}>
            <div style={sectionTitle}>Tema</div>
            <div style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)", marginBottom: "3px" }}>
                  Modalità scura
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>
                  Interfaccia con sfondo scuro — salvato su questo dispositivo.
                </div>
              </div>
              <button
                style={toggleStyle(darkMode, false)}
                onClick={() => {
                  const next = !darkMode;
                  setDarkMode(next);
                  applyTheme(next);
                }}
              >
                <span style={thumbStyle(darkMode)} />
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Dimensione testo globale</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginBottom: "16px", lineHeight: 1.5 }}>
              Scala la dimensione del testo in tutta l'interfaccia. Salvato su questo dispositivo.
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {(["small", "normal", "large"] as const).map((s) => {
                const labels = { small: "Piccolo", normal: "Normale", large: "Grande" };
                const active = fontScale === s;
                return (
                  <button
                    key={s}
                    onClick={() => { setFontScale(s); applyFontScale(s); }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "var(--radius-md)",
                      border: `2px solid ${active ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                      background: active ? "var(--color-brand)" : "var(--color-white)",
                      color: active ? "white" : "var(--color-gray-600)",
                      fontFamily: "var(--font)",
                      fontWeight: 600,
                      fontSize: s === "small" ? "12px" : s === "large" ? "16px" : "14px",
                      cursor: "pointer",
                      transition: "var(--transition)",
                    }}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Carrello ── */}
      {subTab === "cart" && (
        <>
          <div style={cardStyle}>
            <div style={sectionTitle}>Funzionalità carrello</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {(
                [
                  { key: "cartNotesEnabled" as const, label: "Note ordine", desc: "Campo note libere sulla comanda (allergie, preferenze, ecc.)", value: cartNotesEnabled, set: setCartNotesEnabled },
                  { key: "cartPaxEnabled" as const, label: "Coperti", desc: "Stepper per il numero di coperti associato all'ordine", value: cartPaxEnabled, set: setCartPaxEnabled },
                  { key: "cartDiscountEnabled" as const, label: "Sconto", desc: "Applica uno sconto percentuale o fisso all'ordine", value: cartDiscountEnabled, set: setCartDiscountEnabled },
                ]
              ).map(({ key, label, desc, value, set }) => (
                <div key={key} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)", marginBottom: "3px" }}>{label}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                  <button
                    disabled={savingCart === key}
                    onClick={async () => {
                      const next = !value;
                      set(next);
                      await saveCartToggle(key, next);
                    }}
                    style={toggleStyle(value, savingCart === key)}
                  >
                    <span style={thumbStyle(value)} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Dimensione testo righe carrello</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginBottom: "16px", lineHeight: 1.5 }}>
              Dimensione in px del nome prodotto e del prezzo. Le note e i modificatori scalano proporzionalmente.
            </div>
            <PxSlider
              value={cartTextSize}
              min={10}
              max={24}
              onChange={async (v) => {
                setCartTextSize(v);
                try { await adminApi.settings.update({ cartTextSize: v }); } catch { /* ignore */ }
              }}
            />
          </div>
        </>
      )}

      {/* ── Card prodotto ── */}
      {subTab === "card" && (
        <>
          {/* Anteprima */}
          <div style={{ ...cardStyle, display: "flex", justifyContent: "center", background: "var(--color-gray-50)" }}>
            <CardPreview
              showPrice={showPrice}
              showDescription={showDescription}
              showCategory={showCategory}
              showImage={showImage}
              cardTextSize={cardTextSize}
              cardRowHeight={cardRowHeight}
            />
          </div>

          {/* Contenuti */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Contenuti</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(
                [
                  { key: "showPrice" as const, label: "Prezzo", desc: "Mostra il prezzo del prodotto sulla card", value: showPrice },
                  { key: "showDescription" as const, label: "Descrizione", desc: "Mostra la descrizione breve sotto il nome del prodotto", value: showDescription },
                  { key: "showCategory" as const, label: "Categoria", desc: "Mostra il nome della categoria sopra il nome del prodotto", value: showCategory },
                  { key: "showImage" as const, label: "Immagine", desc: "Mostra l'immagine del prodotto se presente nel catalogo", value: showImage },
                ]
              ).map(({ key, label, desc, value }) => (
                <div key={key} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)", marginBottom: "3px" }}>{label}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                  <button
                    onClick={() => setPrefs({ [key]: !value })}
                    style={toggleStyle(value, false)}
                  >
                    <span style={thumbStyle(value)} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dimensione testo */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Dimensione testo card</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginBottom: "16px", lineHeight: 1.5 }}>
              Dimensione in px del nome e del prezzo. Descrizione e categoria scalano proporzionalmente.
            </div>
            <PxSlider
              value={cardTextSize}
              min={10}
              max={24}
              onChange={(v) => setPrefs({ cardTextSize: v })}
            />
          </div>

          {/* Altezza card */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Altezza card</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginBottom: "16px", lineHeight: 1.5 }}>
              Altezza della riga della griglia in pixel.
            </div>
            <PxSlider
              value={cardRowHeight}
              min={60}
              max={240}
              step={10}
              onChange={(v) => setPrefs({ cardRowHeight: v })}
            />
          </div>
        </>
      )}
    </div>
  );
}
