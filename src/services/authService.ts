import type {
  AuthError,
  AuthOtpResponse,
  AuthResponse,
  AuthTokenResponsePassword,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeAuthError, isDuplicateRegistrationError } from "@/lib/authErrors";
import { APP_CONFIG } from "@/config/appConfig";
import { appRegistrationMetadata } from "@/services/appAccessService";

const ROUTER_URL = APP_CONFIG.routerBaseUrl;
const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER || "supabase") as "custom" | "supabase";

export type SignInCredentials = {
  email: string;
  password: string;
};

export type SignUpCredentials = {
  email: string;
  password: string;
  options?: {
    data?: Record<string, unknown>;
    emailRedirectTo?: string;
  };
};

export type OtpKind = "email" | "phone";

export type SendOtpOptions = {
  /** Defaults to email. Phone uses SMS OTP when the provider supports it. */
  kind?: OtpKind;
  shouldCreateUser?: boolean;
};

export type VerifyOtpOptions = {
  kind?: OtpKind;
};

export type AuthResult = {
  data: AuthResponse["data"] | AuthTokenResponsePassword["data"] | null;
  error: AuthError | Error | null;
};

export type OtpResult = {
  data: AuthOtpResponse["data"] | Record<string, unknown> | null;
  error: AuthError | Error | null;
};

type RouterAuthPayload = {
  access_token?: string;
  refresh_token?: string;
  session?: {
    access_token?: string;
    refresh_token?: string;
  } | null;
  user?: AuthResponse["data"]["user"];
  error?: string;
  message?: string;
  dev_code?: string;
};

async function parseRouterResponse(response: Response): Promise<RouterAuthPayload> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as RouterAuthPayload;
  }
  const text = await response.text();
  return { error: text || response.statusText };
}

function routerError(payload: RouterAuthPayload, fallback: string): Error {
  return new Error(payload.error || payload.message || fallback);
}

/**
 * After a successful custom-router login/register, hydrate the local Supabase
 * session so AuthContext / onAuthStateChange continue to work unchanged.
 */
async function hydrateSupabaseSession(payload: RouterAuthPayload): Promise<AuthResult> {
  const access_token = payload.session?.access_token || payload.access_token;
  const refresh_token = payload.session?.refresh_token || payload.refresh_token;

  if (!access_token || !refresh_token) {
    return {
      data: {
        user: payload.user ?? null,
        session: null,
      },
      error: null,
    };
  }

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  return { data, error };
}

// ─── Custom (Netlify router) ────────────────────────────────────────────────

async function customSignIn({ email, password }: SignInCredentials): Promise<AuthResult> {
  const response = await fetch(`${ROUTER_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseRouterResponse(response);
  if (!response.ok) {
    return {
      data: { user: null, session: null },
      error: sanitizeAuthError(routerError(payload, "Login failed"), "signIn"),
    };
  }

  return hydrateSupabaseSession(payload);
}

async function customSignUp({ email, password, options }: SignUpCredentials): Promise<AuthResult> {
  const response = await fetch(`${ROUTER_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      ...(options?.data ? { data: options.data, user_metadata: options.data } : {}),
      ...(options?.emailRedirectTo ? { emailRedirectTo: options.emailRedirectTo } : {}),
    }),
  });

  const payload = await parseRouterResponse(response);
  if (!response.ok) {
    return {
      data: { user: null, session: null },
      error: sanitizeAuthError(routerError(payload, "Registration failed"), "signUp"),
    };
  }

  return hydrateSupabaseSession(payload);
}

async function customSendOtp(target: string, options?: SendOtpOptions): Promise<OtpResult> {
  const kind = options?.kind ?? "email";
  const body =
    kind === "phone"
      ? { kind, target, phone: target }
      : { kind, target, email: target };

  const response = await fetch(`${ROUTER_URL}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await parseRouterResponse(response);
  if (!response.ok) {
    return {
      data: null,
      error: sanitizeAuthError(routerError(payload, "Failed to send OTP"), "otpSend"),
    };
  }

  return { data: payload, error: null };
}

async function customVerifyOtp(
  target: string,
  code: string,
  options?: VerifyOtpOptions,
): Promise<AuthResult> {
  const kind = options?.kind ?? "email";
  const body =
    kind === "phone"
      ? { kind, target, phone: target, code, token: code }
      : { kind, target, email: target, code, token: code };

  const response = await fetch(`${ROUTER_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await parseRouterResponse(response);
  if (!response.ok) {
    return {
      data: { user: null, session: null },
      error: sanitizeAuthError(routerError(payload, "OTP verification failed"), "otpVerify"),
    };
  }

  return hydrateSupabaseSession(payload);
}

async function customSignOut(): Promise<{ error: AuthError | Error | null }> {
  let routerErrorResult: Error | null = null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${ROUTER_URL}/api/auth/logout`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const payload = await parseRouterResponse(response);
      routerErrorResult = routerError(payload, "Logout failed");
    }
  } catch (err) {
    routerErrorResult = err instanceof Error ? err : new Error("Logout failed");
  }

  const { error } = await supabase.auth.signOut();
  return { error: error || routerErrorResult };
}

// ─── Native Supabase ────────────────────────────────────────────────────────

async function supabaseSignIn({ email, password }: SignInCredentials): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error: sanitizeAuthError(error, "signIn") };
}

async function supabaseSignUp({ email, password, options }: SignUpCredentials): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: options?.emailRedirectTo,
      data: appRegistrationMetadata(options?.data),
    },
  });
  return { data, error: sanitizeAuthError(error, "signUp") };
}

async function supabaseSendOtp(target: string, options?: SendOtpOptions): Promise<OtpResult> {
  const kind = options?.kind ?? "email";
  const shouldCreateUser = options?.shouldCreateUser ?? true;

  if (kind === "phone") {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: target,
      options: { shouldCreateUser, data: appRegistrationMetadata() },
    });
    return { data, error: sanitizeAuthError(error, "otpSend") };
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email: target,
    options: { shouldCreateUser, data: appRegistrationMetadata() },
  });
  return { data, error: sanitizeAuthError(error, "otpSend") };
}

async function supabaseVerifyOtp(
  target: string,
  code: string,
  options?: VerifyOtpOptions,
): Promise<AuthResult> {
  const kind = options?.kind ?? "email";

  if (kind === "phone") {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: target,
      token: code,
      type: "sms",
    });
    return { data, error: sanitizeAuthError(error, "otpVerify") };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: target,
    token: code,
    type: "email",
  });
  return { data, error: sanitizeAuthError(error, "otpVerify") };
}

async function supabaseSignOut(): Promise<{ error: AuthError | Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// ─── Public API ─────────────────────────────────────────────────────────────

function withAppMetadata(credentials: SignUpCredentials): SignUpCredentials {
  return {
    ...credentials,
    options: {
      ...credentials.options,
      data: appRegistrationMetadata(credentials.options?.data),
    },
  };
}

export async function signIn(credentials: SignInCredentials): Promise<AuthResult> {
  if (AUTH_PROVIDER === "custom") {
    return customSignIn(credentials);
  }
  return supabaseSignIn(credentials);
}

export async function signUp(credentials: SignUpCredentials): Promise<AuthResult> {
  const enriched = withAppMetadata(credentials);
  if (AUTH_PROVIDER === "custom") {
    return customSignUp(enriched);
  }
  return supabaseSignUp(enriched);
}

/**
 * Request an email (or phone) OTP / magic link.
 * Prefer `sendOtp(email)` for the common email path.
 */
export async function sendOtp(target: string, options?: SendOtpOptions): Promise<OtpResult> {
  if (AUTH_PROVIDER === "custom") {
    return customSendOtp(target, options);
  }
  return supabaseSendOtp(target, options);
}

export async function verifyOtp(
  target: string,
  code: string,
  options?: VerifyOtpOptions,
): Promise<AuthResult> {
  if (AUTH_PROVIDER === "custom") {
    return customVerifyOtp(target, code, options);
  }
  return supabaseVerifyOtp(target, code, options);
}

export async function signOut(): Promise<{ error: AuthError | Error | null }> {
  if (AUTH_PROVIDER === "custom") {
    return customSignOut();
  }
  return supabaseSignOut();
}

export const authService = {
  signIn,
  signUp,
  sendOtp,
  verifyOtp,
  signOut,
  AUTH_PROVIDER,
  ROUTER_URL,
};
