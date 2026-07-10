import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminApi } from "../../core/admin-api.js";
import type { ModuleInfo } from "../../core/admin-api.js";
import { ArrowPathIcon } from "../../components/ui/icons.js";

type ResetStep = "password" | "confirm1" | "confirm2" | "done";

function FactoryResetDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<ResetStep>("password");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === "password") {
      if (!password.trim()) { setError("Inserisci la password"); return; }
      setStep("confirm1");
      return;
    }
    if (step === "confirm1") {
      setStep("confirm2");
      return;
    }
    if (step === "confirm2") {
      setLoading(true);
      try {
        await adminApi.factoryReset(password);
        setStep("done");
        // Clear all POS localStorage keys so stale shift/terminal IDs don't
        // cause FK constraint errors on the first request after the reset.
        const posKeys = Object.keys(localStorage).filter((k) => k.startsWith("pos_"));
        posKeys.forEach((k) => localStorage.removeItem(k));
        setTimeout(() => { window.location.href = "/"; }, 2000);
      } catch (err) {
        setStep("password");
        setPassword("");
        setError(err instanceof Error ? err.message : "Errore — password non valida");
      } finally {
        setLoading(false);
      }
    }
  }

  const stepConfig: Record<ResetStep, { title: string; body: React.ReactNode; action: string; danger: boolean }> = {
    password: {
      title: "Reset di sistema",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "14px", color: "var(--color-gray-600)", lineHeight: 1.6 }}>
            Questa operazione <strong>cancella tutti i dati</strong>: ordini, scontrini, catalogo, turni, terminali, stampanti e impostazioni.<br />
            L'unico dato conservato è il tuo utente admin.
          </div>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#DC2626", fontWeight: 600 }}>
            ⚠️ Questa azione è irreversibile.
          </div>
          <input
            ref={inputRef}
            type="password"
            placeholder="Password di reset"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "8px", border: "1.5px solid var(--color-gray-200)", fontSize: "14px", fontFamily: "var(--font)", outline: "none" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#DC2626"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-gray-200)"; }}
          />
          {error && <div style={{ fontSize: "13px", color: "#DC2626", fontWeight: 600 }}>{error}</div>}
        </div>
      ),
      action: "Continua",
      danger: false,
    },
    confirm1: {
      title: "Sei sicuro?",
      body: (
        <div style={{ fontSize: "14px", color: "var(--color-gray-600)", lineHeight: 1.6 }}>
          Stai per cancellare <strong>tutti i dati del sistema</strong>.<br />
          Questa operazione non può essere annullata.<br /><br />
          Conferma per continuare.
        </div>
      ),
      action: "Sì, sono sicuro",
      danger: true,
    },
    confirm2: {
      title: "Ultima conferma",
      body: (
        <div style={{ fontSize: "14px", color: "var(--color-gray-600)", lineHeight: 1.6 }}>
          Questa è l'<strong>ultima conferma</strong>.<br />
          Dopo questo click tutti i dati verranno eliminati definitivamente.
        </div>
      ),
      action: "RESET DEFINITIVO",
      danger: true,
    },
    done: {
      title: "Reset completato",
      body: (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: "14px", color: "var(--color-gray-600)" }}>
          ✓ Sistema resettato. Reindirizzamento in corso...
        </div>
      ),
      action: "",
      danger: false,
    },
  };

  const cfg = stepConfig[step];

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{
        background: "var(--color-white)",
        borderRadius: "16px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        width: "100%", maxWidth: "420px",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--color-gray-100)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontWeight: 700, fontSize: "16px", color: "#DC2626" }}>{cfg.title}</span>
          {step !== "done" && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--color-gray-400)", lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleNext(e)}>
          <div style={{ padding: "20px 24px" }}>{cfg.body}</div>

          {step !== "done" && (
            <div style={{ padding: "0 24px 20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{
                padding: "9px 18px", borderRadius: "8px",
                border: "1px solid var(--color-gray-200)", background: "var(--color-white)",
                color: "var(--color-gray-600)", fontFamily: "var(--font)", fontSize: "14px", fontWeight: 600, cursor: "pointer",
              }}>Annulla</button>
              <button type="submit" disabled={loading} style={{
                padding: "9px 18px", borderRadius: "8px", border: "none",
                background: cfg.danger ? "#DC2626" : "var(--color-brand)",
                color: "white", fontFamily: "var(--font)", fontSize: "14px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
              }}>{loading ? "..." : cfg.action}</button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function AdvancedTab({ onModuleToggle }: { onModuleToggle?: () => void }) {
  const [subTab, setSubTab] = useState<"general" | "modules" | "fiscal">("general");

  const [expressMode, setExpressMode] = useState<boolean | null>(null);
  const [savingExpress, setSavingExpress] = useState(false);
  const [multiTerminalEnabled, setMultiTerminalEnabled] = useState(false);
  const [savingMultiTerminal, setSavingMultiTerminal] = useState(false);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Fiscal RT settings
  const [fiscalEnabled, setFiscalEnabled] = useState(false);
  const [fiscalRtType, setFiscalRtType] = useState("epson");
  const [fiscalRtHost, setFiscalRtHost] = useState("192.168.1.100");
  const [fiscalRtPort, setFiscalRtPort] = useState("8008");
  const [fiscalRtSerial, setFiscalRtSerial] = useState("");
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [fiscalStatus, setFiscalStatus] = useState<"idle" | "online" | "offline">("idle");

  useEffect(() => {
    adminApi.settings.get().then((s) => {
      setExpressMode(s.expressMode);
      setMultiTerminalEnabled(s.multiTerminalEnabled);
    }).catch(() => {});

    adminApi.modules.list()
      .then((m) => setModules(m))
      .catch((e) => setModuleError(e instanceof Error ? e.message : "Errore"))
      .finally(() => setLoadingModules(false));

    // Load fiscal settings from app_settings via generic settings endpoint
    adminApi.settings.getRaw(["fiscal_enabled", "fiscal_rt_type", "fiscal_rt_host", "fiscal_rt_port", "fiscal_rt_serial"])
      .then((m) => {
        if (m["fiscal_enabled"] !== undefined) setFiscalEnabled(m["fiscal_enabled"] === "true");
        if (m["fiscal_rt_type"] !== undefined) setFiscalRtType(m["fiscal_rt_type"]);
        if (m["fiscal_rt_host"] !== undefined) setFiscalRtHost(m["fiscal_rt_host"]);
        if (m["fiscal_rt_port"] !== undefined) setFiscalRtPort(m["fiscal_rt_port"]);
        if (m["fiscal_rt_serial"] !== undefined) setFiscalRtSerial(m["fiscal_rt_serial"]);
      }).catch(() => {});
  }, []);

  async function handleModuleToggle(name: string) {
    setToggling(name);
    setModuleError(null);
    try {
      const updated = await adminApi.modules.toggle(name);
      setModules((prev) => prev.map((m) => m.name === name ? { ...m, enabled: updated.enabled } : m));
      onModuleToggle?.();
    } catch (e) {
      setModuleError(e instanceof Error ? e.message : "Errore");
    } finally {
      setToggling(null);
    }
  }

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

  if (expressMode === null) {
    return <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", padding: "var(--sp-lg)" }}>Caricamento...</div>;
  }

  const subTabs: { key: "general" | "modules" | "fiscal"; label: string }[] = [
    { key: "general", label: "Generale" },
    { key: "modules", label: "Moduli" },
    { key: "fiscal", label: "Fiscale" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)", maxWidth: "560px" }}>

      {/* Tabs */}
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

      {subTab === "general" && (
        <>
          {/* Express mode */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-md)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "6px" }}>Modalità Express</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>
                  Salta il workflow cucina — l'ordine viene completato direttamente al pagamento senza passare per i stati confermato / in preparazione / pronto.
                </div>
                <div style={{ marginTop: "12px", fontSize: "var(--text-xs)", fontWeight: 600, color: expressMode ? "var(--color-success, #059669)" : "var(--color-gray-400)" }}>
                  {expressMode ? "Attiva — gli ordini vengono completati al pagamento" : "Disattiva — gli ordini seguono il flusso cucina"}
                </div>
              </div>
              <button role="switch" aria-checked={expressMode} disabled={savingExpress}
                onClick={async () => {
                  const next = !expressMode;
                  setSavingExpress(true);
                  try { await adminApi.settings.update({ expressMode: next }); setExpressMode(next); }
                  catch { /* ignore */ } finally { setSavingExpress(false); }
                }}
                style={toggleStyle(expressMode, savingExpress)}
              >
                <span style={thumbStyle(expressMode)} />
              </button>
            </div>
          </div>

          {/* Multi-terminal */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-md)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "6px" }}>Multi-terminale</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", maxWidth: "380px", lineHeight: 1.5 }}>
                  Abilita la gestione di più casse fisiche. Ogni terminale può avere stampanti dedicate.
                  Una volta attivato, configura i terminali nel tab <strong>Terminali</strong>.
                </div>
              </div>
              <button disabled={savingMultiTerminal}
                onClick={async () => {
                  const next = !multiTerminalEnabled;
                  setSavingMultiTerminal(true);
                  try { await adminApi.settings.update({ multiTerminalEnabled: next }); setMultiTerminalEnabled(next); }
                  catch { /* ignore */ } finally { setSavingMultiTerminal(false); }
                }}
                style={toggleStyle(multiTerminalEnabled, savingMultiTerminal)}
              >
                <span style={thumbStyle(multiTerminalEnabled)} />
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div style={{ ...cardStyle, borderColor: "#FECACA", background: "#FFF5F5" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "#DC2626", marginBottom: "6px" }}>Zona pericolosa</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.5, marginBottom: "14px" }}>
              Il reset di sistema cancella tutti i dati (ordini, catalogo, turni, stampanti, impostazioni) mantenendo solo il tuo account admin.
            </div>
            <button
              onClick={() => setResetDialogOpen(true)}
              style={{
                padding: "9px 20px", borderRadius: "var(--radius-md)",
                border: "1.5px solid #DC2626", background: "white",
                color: "#DC2626", fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer",
              }}
            >
              Reset di sistema
            </button>
          </div>

          {resetDialogOpen && <FactoryResetDialog onClose={() => setResetDialogOpen(false)} />}

        </>
      )}

      {subTab === "modules" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)" }}>Moduli</div>
            <button onClick={() => {
              setLoadingModules(true);
              adminApi.modules.list().then((m) => setModules(m)).catch(() => {}).finally(() => setLoadingModules(false));
            }} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", display: "flex", color: "var(--color-gray-500)" }}>
              <ArrowPathIcon style={{ width: "15px", height: "15px" }} />
            </button>
          </div>
          {moduleError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: "12px", fontSize: "var(--text-sm)", color: "#DC2626" }}>
              {moduleError}
            </div>
          )}
          {loadingModules ? (
            <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {modules.map((mod) => (
                <div key={mod.name} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--color-gray-100)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2px" }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>{mod.name}</span>
                      <span style={{
                        fontSize: "var(--text-xs)", fontWeight: 600, padding: "1px 7px", borderRadius: "999px",
                        background: mod.enabled ? "rgba(34,197,94,0.12)" : "var(--color-gray-100)",
                        color: mod.enabled ? "#15803D" : "var(--color-gray-400)",
                      }}>{mod.enabled ? "attivo" : "disabilitato"}</span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>v{mod.version}</span>
                    </div>
                    {mod.dependencyErrors.length > 0 && (
                      <div style={{ fontSize: "var(--text-xs)", color: "#DC2626", fontWeight: 600 }}>{mod.dependencyErrors[0]}</div>
                    )}
                  </div>
                  <button role="switch" aria-checked={mod.enabled} disabled={toggling === mod.name}
                    onClick={() => void handleModuleToggle(mod.name)}
                    style={toggleStyle(mod.enabled, toggling === mod.name)}
                  >
                    <span style={thumbStyle(mod.enabled)} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "fiscal" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-md)", marginBottom: "18px" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "6px" }}>Registratore Telematico (RT)</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>
                Emette documenti commerciali fiscali obbligatori in Italia. Richiede un RT omologato AE in rete locale o un servizio RT Cloud.
              </div>
            </div>
            <button
              disabled={savingFiscal}
              onClick={async () => {
                const next = !fiscalEnabled;
                setSavingFiscal(true);
                try { await adminApi.settings.setRaw("fiscal_enabled", String(next)); setFiscalEnabled(next); }
                catch { /* ignore */ } finally { setSavingFiscal(false); }
              }}
              style={toggleStyle(fiscalEnabled, savingFiscal)}
            >
              <span style={thumbStyle(fiscalEnabled)} />
            </button>
          </div>

          {fiscalEnabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--color-gray-100)", paddingTop: "18px" }}>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-600)", display: "block", marginBottom: "6px" }}>Tipo RT</label>
                <select
                  value={fiscalRtType}
                  onChange={(e) => setFiscalRtType(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-sm)", background: "var(--color-white)", cursor: "pointer" }}
                >
                  <option value="epson">Epson FP-90III / RT / iMya (XML HTTP)</option>
                  <option value="custom">Custom RT (JSON HTTP)</option>
                  <option value="cloud">RT Cloud (REST)</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-600)", display: "block", marginBottom: "6px" }}>Host / IP</label>
                  <input
                    value={fiscalRtHost}
                    onChange={(e) => setFiscalRtHost(e.target.value)}
                    placeholder="192.168.1.100"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-sm)", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-600)", display: "block", marginBottom: "6px" }}>Porta</label>
                  <input
                    value={fiscalRtPort}
                    onChange={(e) => setFiscalRtPort(e.target.value)}
                    placeholder="8008"
                    type="number"
                    style={{ width: "80px", padding: "9px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-sm)" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-600)", display: "block", marginBottom: "6px" }}>Matricola RT (opzionale)</label>
                <input
                  value={fiscalRtSerial}
                  onChange={(e) => setFiscalRtSerial(e.target.value)}
                  placeholder="Es. EPSON123456"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-sm)", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  disabled={savingFiscal}
                  onClick={async () => {
                    setSavingFiscal(true);
                    try {
                      await Promise.all([
                        adminApi.settings.setRaw("fiscal_rt_type", fiscalRtType),
                        adminApi.settings.setRaw("fiscal_rt_host", fiscalRtHost),
                        adminApi.settings.setRaw("fiscal_rt_port", fiscalRtPort),
                        adminApi.settings.setRaw("fiscal_rt_serial", fiscalRtSerial),
                      ]);
                    } catch { /* ignore */ } finally { setSavingFiscal(false); }
                  }}
                  style={{ padding: "8px 20px", borderRadius: "var(--radius-md)", background: "var(--color-brand)", color: "var(--color-white)", border: "none", cursor: savingFiscal ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "var(--text-sm)" }}
                >
                  {savingFiscal ? "Salvando..." : "Salva configurazione"}
                </button>
                <button
                  onClick={async () => {
                    setFiscalStatus("idle");
                    try {
                      const res = await fetch("/api/fiscal/status");
                      const data = await res.json() as { online: boolean };
                      setFiscalStatus(data.online ? "online" : "offline");
                    } catch { setFiscalStatus("offline"); }
                  }}
                  style={{ padding: "8px 16px", borderRadius: "var(--radius-md)", background: "var(--color-gray-100)", color: "var(--color-gray-700)", border: "1px solid var(--color-gray-200)", cursor: "pointer", fontWeight: 600, fontSize: "var(--text-sm)" }}
                >
                  Testa connessione
                </button>
                {fiscalStatus !== "idle" && (
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: fiscalStatus === "online" ? "#15803D" : "#DC2626" }}>
                    {fiscalStatus === "online" ? "RT Online" : "RT Offline / irraggiungibile"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
