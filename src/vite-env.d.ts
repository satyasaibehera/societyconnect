/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_ROUTER_API_URL?: string;
  readonly VITE_TENANT_ROUTER_URL?: string;
  readonly VITE_AUTH_PROVIDER?: "custom" | "supabase" | string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_ID?: string;
  readonly VITE_SUPER_ADMIN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
