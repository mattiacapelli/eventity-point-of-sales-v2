import React, { useEffect, useState } from "react";
import { bootstrapApi } from "../../core/bootstrap-api.js";
import { adminApi } from "../../core/admin-api.js";
import { authClient } from "../../core/auth-client.js";
import { useStore } from "../../state/global-store.js";
import { Button } from "../../components/ui/Button.js";
import { inputStyle, labelStyle } from "../admin/shared.js";
import {
  ShieldCheckIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  PrinterIcon,
  CheckCircleIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  TagIcon,
  DocumentTextIcon,
} from "../../components/ui/icons.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "license" | "restaurant" | "admin" | "printer" | "done";

const STEPS: { id: WizardStep; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "license",    label: "Licenza",   Icon: ShieldCheckIcon },
  { id: "restaurant", label: "Locale",    Icon: BuildingStorefrontIcon },
  { id: "admin",      label: "Accesso",   Icon: UserGroupIcon },
  { id: "printer",    label: "Stampante", Icon: PrinterIcon },
  { id: "done",       label: "Pronto",    Icon: CheckCircleIcon },
];

// ─── Responsive helpers ───────────────────────────────────────────────────────

const RESPONSIVE = `
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 860px) {
    .setup-brand-mobile {
      display: flex !important;
    }
    .setup-form-panel {
      padding-top: 72px !important;
    }
  }

  .setup-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-sm);
  }
  @media (max-width: 480px) {
    .setup-grid-2 {
      grid-template-columns: 1fr;
    }
  }

  .setup-done-tips {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setup-printer-row {
    display: flex;
    gap: var(--sp-sm);
  }
  @media (max-width: 480px) {
    .setup-printer-row {
      flex-direction: column;
    }
  }
`;

// ─── Step bar (pannello sinistro, verticale) ─────────────────────────────────

function StepBar({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {STEPS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        const StepIcon = s.Icon;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: done ? "rgba(255,255,255,0.9)" : active ? "var(--color-accent)" : "rgba(255,255,255,0.12)",
                color: done ? "var(--color-brand-dark)" : active ? "var(--color-gray-900)" : "rgba(255,255,255,0.5)",
                transition: "all 0.3s",
              }}>
                {done ? <CheckIcon style={{ width: "16px", height: "16px" }} /> : <StepIcon style={{ width: "16px", height: "16px" }} />}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: "2px",
                  height: "22px",
                  background: done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",
                  transition: "background 0.4s",
                }} />
              )}
            </div>
            <span style={{
              fontSize: "var(--text-sm)",
              fontWeight: active ? 700 : 500,
              color: active ? "var(--color-white)" : "rgba(255,255,255,0.6)",
              transition: "color 0.3s",
              paddingBottom: i < STEPS.length - 1 ? "22px" : 0,
            }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      background: "rgba(154,44,34,0.08)",
      color: "var(--color-danger)",
      borderRadius: "var(--radius-md)",
      padding: "12px 14px",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      display: "flex",
      alignItems: "flex-start",
      gap: "8px",
    }}>
      <ExclamationTriangleIcon style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "1px" }} />
      <span>{msg}</span>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={{ marginTop: "4px", fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>{hint}</div>}
    </div>
  );
}

function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: "var(--sp-lg)" }}>
      <div style={{ fontSize: "var(--text-xxl, 26px)", fontWeight: 700, color: "var(--color-gray-900)", marginBottom: "6px", letterSpacing: "-0.01em" }}>
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
      {onBack && (
        <Button variant="ghost" size="md" onClick={onBack} icon={<ArrowLeftIcon style={{ width: "16px", height: "16px" }} />} style={{ flexShrink: 0 }}>
          Indietro
        </Button>
      )}
      <Button
        variant="primary"
        size="md"
        disabled={nextDisabled}
        onClick={onNext}
        icon={<ArrowRightIcon style={{ width: "16px", height: "16px" }} />}
        style={{ flexDirection: "row-reverse", flex: 1, minWidth: 0 }}
      >
        {nextLabel}
      </Button>
    </div>
  );
}

// ─── Step: Licenza ────────────────────────────────────────────────────────────

function StepLicense({ onNext }: { onNext: () => void }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <StepHeading title="Contratto di licenza" sub="Leggi e accetta i termini per continuare con l'installazione." />

      <div style={{
        background: "var(--color-gray-50)",
        borderRadius: "var(--radius-md)",
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
        background: "var(--color-gray-50)",
        borderRadius: "var(--radius-lg)",
        border: "1.5px solid var(--color-gray-200)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}>
        <ShieldCheckIcon style={{ width: "22px", height: "22px", flexShrink: 0, color: "var(--color-brand)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>Licenza di prova attiva</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginTop: "2px" }}>Funzionalità complete durante l'installazione.</div>
        </div>
        <div style={{ background: "rgba(23,102,60,0.1)", color: "var(--color-brand)", borderRadius: "999px", padding: "3px 10px", fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0 }}>
          ATTIVA
        </div>
      </div>

      {/* Checkbox */}
      <label style={{
        display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer",
        padding: "14px", borderRadius: "var(--radius-md)",
        border: `2px solid ${accepted ? "var(--color-brand)" : "var(--color-gray-200)"}`,
        background: accepted ? "rgba(23,102,60,0.04)" : "transparent",
        transition: "all 0.2s",
      }}>
        <div style={{
          width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0, marginTop: "1px",
          border: `2px solid ${accepted ? "var(--color-brand)" : "var(--color-gray-300)"}`,
          background: accepted ? "var(--color-brand)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}>
          {accepted && <CheckIcon style={{ width: "12px", height: "12px", color: "white" }} />}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
      <StepHeading title="Il tuo locale" sub="Questi dati appaiono sullo scontrino. Modificabili in qualsiasi momento." />

      {/* Layout a due colonne: logo sx, campi dx */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "var(--sp-md)", alignItems: "start" }}>

        {/* Logo upload verticale */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", background: "var(--color-gray-50)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <BuildingStorefrontIcon style={{ width: "26px", height: "26px", color: "var(--color-gray-300)" }} />}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "72px", padding: "5px 0", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "10px", fontWeight: 600, color: "var(--color-gray-600)", textAlign: "center" }}>
            Logo
            <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handleLogo} />
          </label>
        </div>

        {/* Nome (occupa tutta la colonna destra) */}
        <Field label="Nome del locale *">
          <input style={inputStyle} type="text" placeholder="Es. Trattoria Da Mario" value={form.name} onChange={set("name")} autoFocus />
        </Field>
      </div>

      {/* Griglia 2 colonne per i campi secondari */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-sm)" }}>
        <Field label="Indirizzo">
          <input style={inputStyle} type="text" placeholder="Es. Via Roma 12" value={form.address} onChange={set("address")} />
        </Field>
        <Field label="Città / CAP">
          <input style={inputStyle} type="text" placeholder="Es. Milano, 20121" value={form.city} onChange={set("city")} />
        </Field>
        <Field label="P.IVA / C.F." hint="Appare sullo scontrino">
          <input style={inputStyle} type="text" placeholder="Es. IT01234567890" value={form.vat} onChange={set("vat")} />
        </Field>
        <Field label="Telefono">
          <input style={inputStyle} type="text" placeholder="Es. +39 02 1234567" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Sito web" hint="">
          <input style={inputStyle} type="text" placeholder="Es. www.esempio.it" value={form.website} onChange={set("website")} />
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <StepHeading title="Account amministratore" sub="Crea il primo account con accesso completo al POS e all'area admin." />

      <Field label="Nome completo *">
        <input style={inputStyle} type="text" placeholder="Es. Mario Rossi" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
      </Field>

      <Field label="PIN di accesso *" hint="Solo numeri, minimo 4 cifre.">
        <div style={{ position: "relative" }}>
          <input
            style={{ ...inputStyle, paddingRight: "48px", letterSpacing: "0.15em" }}
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            placeholder="••••"
            value={form.pin}
            onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
          />
          <button type="button" onClick={() => setShowPin((v) => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-gray-400)", padding: "4px", display: "flex" }}>
            {showPin ? <EyeSlashIcon style={{ width: "18px", height: "18px" }} /> : <EyeIcon style={{ width: "18px", height: "18px" }} />}
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
          style={{ ...inputStyle, borderColor: form.pinConfirm && form.pin !== form.pinConfirm ? "var(--color-danger)" : undefined, letterSpacing: "0.15em" }}
          type={showPin ? "text" : "password"}
          inputMode="numeric"
          placeholder="••••"
          value={form.pinConfirm}
          onChange={(e) => setForm((f) => ({ ...f, pinConfirm: e.target.value.replace(/\D/g, "") }))}
          onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
        />
        {form.pinConfirm && form.pin === form.pinConfirm && (
          <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px", fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 600 }}>
            <CheckIcon style={{ width: "12px", height: "12px" }} /> I PIN corrispondono
          </div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <StepHeading title="Stampante" sub="Connetti la stampante ESC/POS per gli scontrini. Puoi aggiungerla anche in seguito dall'admin." />

      {/* Discovery toggle */}
      <button type="button" onClick={() => { setShowDisc((v) => !v); if (!showDisc) void handleDiscover(); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderRadius: "var(--radius-md)", border: `1.5px solid ${showDisc ? "var(--color-brand)" : "var(--color-gray-200)"}`, background: showDisc ? "rgba(23,102,60,0.04)" : "var(--color-white)", cursor: "pointer", fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)", textAlign: "left", width: "100%" }}>
        <MagnifyingGlassIcon style={{ width: "20px", height: "20px", flexShrink: 0, color: "var(--color-gray-400)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div>Cerca stampanti sulla rete</div>
          <div style={{ fontWeight: 400, color: "var(--color-gray-400)", fontSize: "var(--text-xs)", marginTop: "1px" }}>Scansiona la rete locale automaticamente</div>
        </div>
        <span style={{ color: "var(--color-gray-300)", fontSize: "11px", flexShrink: 0 }}>{showDisc ? "▲" : "▼"}</span>
      </button>

      {showDisc && (
        <div style={{ border: "1.5px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", background: "var(--color-gray-50)" }}>
          <div className="setup-printer-row">
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Subnet (es. 192.168.1) — lascia vuoto per auto" value={subnet} onChange={(e) => setSubnet(e.target.value)} />
            <Button variant="primary" size="md" loading={discovering} onClick={() => void handleDiscover()}>
              Cerca
            </Button>
          </div>
          {discovered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {discovered.map((p) => (
                <button key={`${p.host}:${p.port}`} onClick={() => { setForm((f) => ({ ...f, host: p.host, port: String(p.port) })); setShowDisc(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-800)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <PrinterIcon style={{ width: "16px", height: "16px", color: "var(--color-gray-400)" }} />
                    {p.host}:{p.port}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--color-brand)", fontSize: "var(--text-xs)" }}>
                    Usa <ArrowRightIcon style={{ width: "12px", height: "12px" }} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <Field label="Nome stampante">
          <input style={inputStyle} type="text" placeholder="Es. Cassa principale" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="setup-grid-2">
          <Field label="Indirizzo IP">
            <input style={inputStyle} type="text" placeholder="Es. 192.168.1.100" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
          </Field>
          <Field label="Porta">
            <input style={inputStyle} type="text" inputMode="numeric" placeholder="9100" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} />
          </Field>
        </div>
      </div>

      {error && <ErrorBanner msg={error} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleNext}
          icon={form.host.trim() ? <ArrowRightIcon style={{ width: "16px", height: "16px" }} /> : undefined}
          style={form.host.trim() ? { flexDirection: "row-reverse" } : undefined}
        >
          {form.host.trim() ? "Aggiungi stampante" : "Salta per ora"}
        </Button>
        <Button variant="ghost" size="md" onClick={onBack} icon={<ArrowLeftIcon style={{ width: "16px", height: "16px" }} />}>
          Indietro
        </Button>
      </div>
    </div>
  );
}

// ─── Step: Done ───────────────────────────────────────────────────────────────

function StepDone({ username, storeName, onDone }: { username: string; storeName: string; onDone: () => void }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-lg)", textAlign: "center" }}>
      <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center", transform: vis ? "scale(1)" : "scale(0.5)", opacity: vis ? 1 : 0, transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease" }}>
        <CheckIcon style={{ width: "38px", height: "38px", color: "var(--color-white)" }} />
      </div>

      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(10px)", transition: "all 0.4s ease 0.2s" }}>
        <div style={{ fontSize: "var(--text-xxl, 26px)", fontWeight: 700, color: "var(--color-gray-900)", marginBottom: "6px", letterSpacing: "-0.01em" }}>
          {storeName} è pronto!
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
          Configurazione completata. Usa le credenziali qui sotto per accedere.
        </div>
      </div>

      <div style={{ width: "100%", background: "var(--color-gray-50)", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", padding: "18px", opacity: vis ? 1 : 0, transition: "opacity 0.4s ease 0.4s" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Credenziali di accesso</div>
        {[{ label: "Username", value: username, mono: true }, { label: "PIN", value: "Il PIN che hai scelto", mono: false }].map(({ label, value, mono }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>{label}</span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)", fontFamily: mono ? "monospace" : "var(--font)", background: "var(--color-white)", border: "1.5px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)", padding: "3px 10px" }}>{value}</span>
          </div>
        ))}
      </div>

      <div className="setup-done-tips" style={{ width: "100%", opacity: vis ? 1 : 0, transition: "opacity 0.4s ease 0.55s" }}>
        {[
          { Icon: TagIcon, text: "Aggiungi prodotti e categorie dall'area Admin" },
          { Icon: DocumentTextIcon, text: "Configura i template di stampa in Admin → Scontrini" },
          { Icon: UserGroupIcon, text: "Crea altri utenti in Admin → Utenti" },
        ].map(({ Icon, text }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "rgba(23,102,60,0.05)", textAlign: "left", fontSize: "var(--text-xs)", color: "var(--color-gray-600)", fontWeight: 500 }}>
            <Icon style={{ width: "16px", height: "16px", flexShrink: 0, color: "var(--color-brand)" }} />
            {text}
          </div>
        ))}
      </div>

      <Button
        variant="primary"
        size="md"
        fullWidth
        onClick={onDone}
        style={{ opacity: vis ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}
      >
        Vai al login
      </Button>
    </div>
  );
}

// ─── Main SetupScreen ─────────────────────────────────────────────────────────

export function SetupScreen({ onDone }: { onDone: () => void }) {
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

  return (
    <>
      <style>{RESPONSIVE}</style>
      <div style={{ height: "100dvh", display: "flex", minHeight: 0 }}>
        {/* Brand panel */}
        <div
          className="login-brand-panel"
          style={{
            flex: "1 1 40%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "var(--sp-xxl, 48px)",
            background: "linear-gradient(160deg, var(--color-brand-dark) 0%, var(--color-brand) 100%)",
            color: "var(--color-white)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(circle at 15% 15%, rgba(255,255,255,0.08) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(255,255,255,0.06) 0%, transparent 40%)",
            }}
          />

          <div style={{ position: "relative" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.04em" }}>epos</span>
          </div>

          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "var(--sp-xl, 32px)" }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
                Configurazione guidata
              </div>
              <h1 style={{ margin: 0, fontSize: "28px", lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.01em" }}>
                Configuriamo insieme la tua cassa
              </h1>
            </div>
            <StepBar current={step} />
          </div>

          <span style={{ position: "relative", fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.6)" }}>
            © {new Date().getFullYear()} epos · Point of Sale
          </span>
        </div>

        {/* Form panel */}
        <div
          className="setup-form-panel"
          style={{
            flex: "1 1 60%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-white)",
            padding: "var(--sp-xl)",
            position: "relative",
            overflowY: "auto",
          }}
        >
          <div className="setup-brand-mobile" style={{ display: "none", position: "absolute", top: "var(--sp-lg)", left: "var(--sp-lg)", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-brand)" }}>epos</span>
          </div>

          <div style={{ width: "100%", maxWidth: "460px", padding: "var(--sp-xl) 0" }}>
            {/* Loading overlay */}
            {loading && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", zIndex: 10 }}>
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
      </div>
    </>
  );
}
