import { createClient } from "@supabase/supabase-js";
import { APP_SCHEMA } from "@/config/appConfig";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Each app deployment uses its own PostgREST schema (VITE_APP_ID).
 * Types describe tables under `public`; we alias the active schema here
 * so createClient can type-check the custom default schema.
 */
type AppDatabase = Database & Record<string, Database["public"]>;

export const supabase = createClient<AppDatabase, typeof APP_SCHEMA>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    db: {
      schema: APP_SCHEMA,
    },
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
