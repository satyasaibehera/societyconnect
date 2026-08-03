import type { AuthError } from "@supabase/supabase-js";

export const AUTH_MESSAGES = {
  signInFailed: "Invalid email or password.",
  signUpFailed: "Unable to create account. Please try again or sign in if you already have one.",
  otpSendFailed: "Unable to send verification code. Please try again.",
  otpVerifyFailed: "Invalid or expired verification code.",
  resetPasswordSent:
    "If an account exists for that email, a password reset link has been sent.",
  appAccessDenied: "You do not have access to this application.",
  duplicateRegistration:
    "An account with this email may already exist. Please try logging in.",
  generic: "Something went wrong. Please try again.",
} as const;

const DUPLICATE_REGISTRATION_PATTERNS = [
  /already been registered/i,
  /already registered/i,
  /user already registered/i,
  /email address is already/i,
  /duplicate/i,
];

/** Detect duplicate-account errors from auth providers or enrollment APIs. */
export function isDuplicateRegistrationError(
  error: unknown,
  httpStatus?: number,
): boolean {
  if (httpStatus === 422) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return DUPLICATE_REGISTRATION_PATTERNS.some((pattern) => pattern.test(message));
}

type AuthContext = "signIn" | "signUp" | "otpSend" | "otpVerify";

const SIGN_IN_PATTERNS = [
  /invalid login credentials/i,
  /invalid email or password/i,
  /email not confirmed/i,
  /user not found/i,
  /wrong password/i,
  /invalid credentials/i,
];

const SIGN_UP_PATTERNS = [
  /user already registered/i,
  /already been registered/i,
  /email address is already/i,
  /duplicate/i,
];

function messageFromError(error: AuthError | Error): string {
  return error.message || "";
}

/**
 * Replace provider-specific auth errors with generic messages to prevent user enumeration.
 */
export function sanitizeAuthError(
  error: AuthError | Error | null,
  context: AuthContext,
): Error | null {
  if (!error) return null;

  const message = messageFromError(error);

  switch (context) {
    case "signIn":
      if (SIGN_IN_PATTERNS.some((p) => p.test(message)) || message) {
        return new Error(AUTH_MESSAGES.signInFailed);
      }
      return new Error(AUTH_MESSAGES.signInFailed);

    case "signUp":
      if (SIGN_UP_PATTERNS.some((p) => p.test(message)) || message) {
        return new Error(AUTH_MESSAGES.signUpFailed);
      }
      return new Error(AUTH_MESSAGES.signUpFailed);

    case "otpSend":
      return new Error(AUTH_MESSAGES.otpSendFailed);

    case "otpVerify":
      return new Error(AUTH_MESSAGES.otpVerifyFailed);

    default:
      return new Error(AUTH_MESSAGES.generic);
  }
}
