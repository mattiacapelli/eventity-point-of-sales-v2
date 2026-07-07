import React, { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import type { RestaurantInfo } from "../../core/admin-api.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import { inputStyle, labelStyle } from "./shared.js";

export function RestaurantTab() {
  const [form, setForm] = useState<RestaurantInfo>({ name: "", address: "", city: "", vat: "", phone: "", website: "", logoPath: null });
  const [loading_, setLoading_] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoTs, setLogoTs] = useState(() => Date.now());

  useEffect(() => {
    adminApi.restaurant.get()
      .then((data) => setForm(data))
      .catch(() => {})
      .finally(() => setLoading_(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { logoPath: _lp, ...formData } = form;
      const updated = await adminApi.restaurant.update(formData);
      setForm((prev) => ({ ...updated, logoPath: prev.logoPath }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const result = await adminApi.restaurant.uploadLogo(file);
      setForm((prev) => ({ ...prev, logoPath: result.logoPath }));
      setLogoTs(Date.now());
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore upload logo");
    } finally { setLogoUploading(false); }
  }

  async function handleLogoDelete() {
    try {
      await adminApi.restaurant.deleteLogo();
      setForm((prev) => ({ ...prev, logoPath: null }));
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore rimozione logo");
    }
  }

  const fields: { key: keyof Omit<RestaurantInfo, "logoPath">; label: string; placeholder: string; type?: string }[] = [
    { key: "name",    label: "Nome locale",   placeholder: "Es. Trattoria da Mario" },
    { key: "address", label: "Indirizzo",      placeholder: "Es. Via Roma 12" },
    { key: "city",    label: "Città / CAP",    placeholder: "Es. Milano, 20121" },
    { key: "vat",     label: "P.IVA / C.F.",   placeholder: "Es. IT01234567890" },
    { key: "phone",   label: "Telefono",        placeholder: "Es. +39 02 1234567" },
    { key: "website", label: "Sito web",        placeholder: "Es. www.trattoriadamario.it" },
  ];

  return (
    <div style={{ padding: "var(--sp-lg)", maxWidth: "560px" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginTop: 0, marginBottom: "6px" }}>
        Informazioni ristorante
      </h2>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", marginTop: 0, marginBottom: "var(--sp-lg)" }}>
        Questi dati appaiono sullo scontrino e nel Z-report.
      </p>

      {loading_ ? (
        <div style={{ color: "var(--color-gray-400)", padding: "40px", textAlign: "center" }}>Caricamento...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "28px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "18px" }}>
            {fields.map(({ key, label, placeholder }) => {
              const vatWarning = key === "vat" && form.vat && !/^(IT\d{11}|\d{16})$/i.test(form.vat.replace(/\s/g, ""));
              return (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    style={{ ...inputStyle, borderColor: vatWarning ? "#f59e0b" : undefined }}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                  {vatWarning && (
                    <div style={{ marginTop: "4px", fontSize: "var(--text-xs)", color: "#92400e" }}>
                      Formato non standard (atteso: IT + 11 cifre o Codice Fiscale 16 caratteri)
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Logo */}
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "24px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>Logo ristorante</div>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
              Appare in cima allo scontrino immagine. Formato: PNG o JPG, max 5 MB.
            </p>
            {form.logoPath && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img
                  src={`/api/static/${form.logoPath}?t=${logoTs}`}
                  alt="Logo ristorante"
                  style={{ height: "64px", objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-gray-50)", padding: "6px" }}
                />
                <button type="button" onClick={() => void handleLogoDelete()}
                  style={{ padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                  Rimuovi
                </button>
              </div>
            )}
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)", width: "fit-content" }}>
              {logoUploading ? "Caricamento..." : form.logoPath ? "Cambia logo" : "Carica logo"}
              <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => void handleLogoUpload(e)} />
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Button size="sm" loading={saving} onClick={() => void handleSave()}>
              Salva
            </Button>
            {saved && (
              <span style={{ fontSize: "var(--text-sm)", color: "#16a34a", fontWeight: 600 }}>
                ✓ Salvato
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
