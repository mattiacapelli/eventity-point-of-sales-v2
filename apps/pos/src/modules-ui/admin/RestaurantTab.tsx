import React, { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import type { RestaurantInfo } from "../../core/admin-api.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import { PencilSquareIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, PageHeader, DetailCard, DetailSection, DetailRow } from "./shared.js";

const FIELDS: { key: keyof Omit<RestaurantInfo, "logoPath">; label: string; placeholder: string }[] = [
  { key: "name",    label: "Nome locale",   placeholder: "Es. Trattoria da Mario" },
  { key: "address", label: "Indirizzo",      placeholder: "Es. Via Roma 12" },
  { key: "city",    label: "Città / CAP",    placeholder: "Es. Milano, 20121" },
  { key: "vat",     label: "P.IVA / C.F.",   placeholder: "Es. IT01234567890" },
  { key: "phone",   label: "Telefono",        placeholder: "Es. +39 02 1234567" },
  { key: "website", label: "Sito web",        placeholder: "Es. www.trattoriadamario.it" },
];

export function RestaurantTab() {
  const [info, setInfo] = useState<RestaurantInfo>({ name: "", address: "", city: "", vat: "", phone: "", website: "", logoPath: null });
  const [loading, setLoading] = useState(true);
  const [logoTs, setLogoTs] = useState(() => Date.now());

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RestaurantInfo>(info);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    adminApi.restaurant.get()
      .then((data) => setInfo(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openEdit() {
    setForm(info);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { logoPath: _lp, ...formData } = form;
      const updated = await adminApi.restaurant.update(formData);
      setInfo((prev) => ({ ...updated, logoPath: prev.logoPath }));
      setModalOpen(false);
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
      setInfo((prev) => ({ ...prev, logoPath: result.logoPath }));
      setForm((prev) => ({ ...prev, logoPath: result.logoPath }));
      setLogoTs(Date.now());
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore upload logo");
    } finally { setLogoUploading(false); }
  }

  async function handleLogoDelete() {
    try {
      await adminApi.restaurant.deleteLogo();
      setInfo((prev) => ({ ...prev, logoPath: null }));
      setForm((prev) => ({ ...prev, logoPath: null }));
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore rimozione logo");
    }
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <PageHeader
        title="Ristorante"
        subtitle="Questi dati appaiono sullo scontrino e nel Z-report."
        actions={
          <Button size="sm" onClick={openEdit} icon={<PencilSquareIcon style={{ width: "16px", height: "16px" }} />}>
            Modifica
          </Button>
        }
      />

      {loading ? (
        <div style={{ color: "var(--color-gray-400)", padding: "40px", textAlign: "center" }}>Caricamento...</div>
      ) : (
        <DetailCard>
          <DetailSection title="Dati locale">
            <DetailRow label="Nome locale" value={info.name} />
            <DetailRow label="Indirizzo" value={info.address} />
            <DetailRow label="Città / CAP" value={info.city} />
            <DetailRow label="P.IVA / C.F." value={info.vat} />
          </DetailSection>
          <DetailSection title="Contatti">
            <DetailRow label="Telefono" value={info.phone} />
            <DetailRow label="Sito web" value={info.website} />
          </DetailSection>
          <DetailSection title="Logo ristorante">
            <div style={{ padding: "10px 20px 18px" }}>
              {info.logoPath ? (
                <img
                  src={`/api/static/${info.logoPath}?t=${logoTs}`}
                  alt="Logo ristorante"
                  style={{ height: "64px", objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-gray-50)", padding: "6px" }}
                />
              ) : (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-300)" }}>Nessun logo caricato</span>
              )}
            </div>
          </DetailSection>
        </DetailCard>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modifica dati ristorante" width="600px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {FIELDS.map(({ key, label, placeholder }) => {
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

          <div>
            <label style={labelStyle}>Logo ristorante</label>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginBottom: "10px" }}>
              Appare in cima allo scontrino immagine. Formato: PNG o JPG, max 5 MB.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              {form.logoPath && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img
                    src={`/api/static/${form.logoPath}?t=${logoTs}`}
                    alt="Logo ristorante"
                    style={{ height: "64px", objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-gray-50)", padding: "6px" }}
                  />
                  <button type="button" onClick={() => void handleLogoDelete()}
                    style={{ padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font)" }}>
                    Rimuovi
                  </button>
                </div>
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)", width: "fit-content" }}>
                {logoUploading ? "Caricamento..." : form.logoPath ? "Cambia logo" : "Carica logo"}
                <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => void handleLogoUpload(e)} />
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} onClick={() => void handleSave()}>Salva</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
