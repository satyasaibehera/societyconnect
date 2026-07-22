import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Standalone instance uses the dedicated `society_connect` schema.
 * Types still describe the same table shape under `public`; we alias it here
 * so createClient can type-check the custom default schema.
 */
type AppDatabase = Database & {
  society_connect: Database["public"];
};

export const supabase = createClient<AppDatabase, "society_connect">(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: "society_connect",
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
