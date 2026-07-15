import {
  FireIcon, CakeIcon, BeakerIcon, CubeIcon, BuildingStorefrontIcon,
  WrenchScrewdriverIcon, TagIcon, GlobeAltIcon, ShoppingCartIcon,
  ClipboardDocumentListIcon, PrinterIcon, HomeIcon, UserGroupIcon,
  CreditCardIcon, BanknotesIcon,
} from "../../components/ui/icons.js";
import { labelStyle } from "./shared.js";

const ICON_OPTIONS: Array<{ name: string; component: React.FC<React.SVGProps<SVGSVGElement>> }> = [
  { name: "BuildingStorefrontIcon", component: BuildingStorefrontIcon },
  { name: "FireIcon",               component: FireIcon },
  { name: "CakeIcon",               component: CakeIcon },
  { name: "BeakerIcon",             component: BeakerIcon },
  { name: "CubeIcon",               component: CubeIcon },
  { name: "WrenchScrewdriverIcon",  component: WrenchScrewdriverIcon },
  { name: "TagIcon",                component: TagIcon },
  { name: "GlobeAltIcon",           component: GlobeAltIcon },
  { name: "ShoppingCartIcon",       component: ShoppingCartIcon },
  { name: "ClipboardDocumentListIcon", component: ClipboardDocumentListIcon },
  { name: "PrinterIcon",            component: PrinterIcon },
  { name: "HomeIcon",               component: HomeIcon },
  { name: "UserGroupIcon",          component: UserGroupIcon },
  { name: "CreditCardIcon",         component: CreditCardIcon },
  { name: "BanknotesIcon",          component: BanknotesIcon },
];

export function getProductionCenterIcon(name: string | null | undefined): React.FC<React.SVGProps<SVGSVGElement>> {
  if (!name) return BuildingStorefrontIcon;
  return ICON_OPTIONS.find((i) => i.name === name)?.component ?? BuildingStorefrontIcon;
}

export function IconPickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>Icona</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {ICON_OPTIONS.map(({ name, component: Icon }) => {
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              title={name.replace("Icon", "")}
              onClick={() => onChange(selected ? "" : name)}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                border: selected ? "2px solid var(--color-brand)" : "2px solid var(--color-gray-200)",
                background: selected ? "rgba(48,107,52,0.08)" : "var(--color-white)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: selected ? "var(--color-brand)" : "var(--color-gray-500)",
                transition: "border-color 0.15s, background 0.15s, color 0.15s",
                flexShrink: 0,
              }}
            >
              <Icon style={{ width: "18px", height: "18px" }} />
            </button>
          );
        })}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-gray-400)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 4px",
              textDecoration: "underline",
              alignSelf: "center",
            }}
          >
            Rimuovi
          </button>
        )}
      </div>
    </div>
  );
}
