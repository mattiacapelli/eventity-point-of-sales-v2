/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_DEFAULT_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
