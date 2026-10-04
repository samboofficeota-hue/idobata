/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_KOUCHOU_API_BASE_URL?: string;
    readonly VITE_KOUCHOU_PUBLIC_API_KEY?: string;
    [key: string]: string;
  };
}
