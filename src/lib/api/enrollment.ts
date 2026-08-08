import { isDuplicateRegistrationError } from "@/lib/authErrors";

export type EnrollmentPayload = {
  email: string;
  password: string;
  full_name: string;
  phone_number: string | null;
  society_name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

export type EnrollmentSuccessData = {
  userId: string | null;
  societyId: string | null;
};

export type EnrollmentApiError = {
  message: string;
  support_hint?: string;
  action?: string;
  code?: string;
};

export type EnrollmentResult =
  | { success: true; data: EnrollmentSuccessData; raw: unknown }
  | {
      success: false;
      error: string;
      apiError: EnrollmentApiError;
      status: number;
      duplicateAccount?: boolean;
      raw: unknown;
    };

function getRouterApiUrl(): string | null {
  const url = import.meta.env.VITE_ROUTER_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export function parseEnrollmentApiError(body: unknown, fallback: string): EnrollmentApiError {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const message =
    (typeof record.message === "string" && record.message.trim()) ||
    (typeof record.error === "string" && record.error.trim()) ||
    (typeof body === "string" && body.trim()) ||
    fallback;

  const support_hint =
    typeof record.support_hint === "string" && record.support_hint.trim()
      ? record.support_hint.trim()
      : undefined;

  const action =
    typeof record.action === "string" && record.action.trim()
      ? record.action.trim()
      : undefined;

  const code =
    typeof record.code === "string" && record.code.trim()
      ? record.code.trim()
      : undefined;

  return { message, support_hint, action, code };
}

function isDuplicateEnrollmentError(apiError: EnrollmentApiError): boolean {
  if (apiError.code === "ACCOUNT_EXISTS") return true;
  return isDuplicateRegistrationError(new Error(apiError.message));
}

function formatEnrollmentErrorDescription(apiError: EnrollmentApiError): string {
  if (apiError.support_hint) {
    return `${apiError.message}\n\n${apiError.support_hint}`;
  }
  return apiError.message;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function extractEnrollmentSuccessData(raw: unknown): EnrollmentSuccessData {
  const empty: EnrollmentSuccessData = { userId: null, societyId: null };
  if (!raw || typeof raw !== "object") return empty;

  const body = raw as Record<string, unknown>;
  const dataBlock =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body;

  const userRecord =
    dataBlock.user && typeof dataBlock.user === "object"
      ? (dataBlock.user as Record<string, unknown>)
      : null;

  const societyRecord =
    dataBlock.society && typeof dataBlock.society === "object"
      ? (dataBlock.society as Record<string, unknown>)
      : null;

  const userId =
    (typeof dataBlock.userId === "string" && dataBlock.userId) ||
    (typeof dataBlock.user_id === "string" && dataBlock.user_id) ||
    (typeof userRecord?.id === "string" && userRecord.id) ||
    null;

  const societyId =
    (typeof dataBlock.societyId === "string" && dataBlock.societyId) ||
    (typeof dataBlock.society_id === "string" && dataBlock.society_id) ||
    (typeof societyRecord?.id === "string" && societyRecord.id) ||
    null;

  return { userId, societyId };
}

/** Treat HTTP 200/201 as success unless the body explicitly reports failure. */
function isSuccessfulEnrollmentResponse(status: number, raw: unknown): boolean {
  if (status !== 200 && status !== 201) return false;
  if (!raw || typeof raw !== "object") return true;

  const body = raw as Record<string, unknown>;
  if (body.success === false) return false;
  if (body.success === true) return true;

  const data = extractEnrollmentSuccessData(raw);
  return Boolean(data.userId || data.societyId || body.data);
}

/**
 * Submit society admin enrollment to the Universal Tenant Router.
 * POST ${VITE_ROUTER_API_URL}/api/v1/auth/enroll
 */
export async function submitEnrollment(payload: EnrollmentPayload): Promise<EnrollmentResult> {
  const routerBaseUrl = getRouterApiUrl();
  if (!routerBaseUrl) {
    const apiError: EnrollmentApiError = {
      message: "Enrollment service is not configured (VITE_ROUTER_API_URL is missing).",
    };
    return {
      success: false,
      error: apiError.message,
      apiError,
      status: 0,
      raw: null,
    };
  }

  const url = `${routerBaseUrl}/api/v1/auth/enroll`;
  const requestBody = {
    email: payload.email.trim(),
    password: payload.password,
    full_name: payload.full_name.trim(),
    phone_number: payload.phone_number,
    society_name: payload.society_name.trim(),
    address: payload.address ?? null,
    city: payload.city ?? null,
    state: payload.state ?? null,
    pincode: payload.pincode ?? null,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to reach enrollment service";
    const apiError: EnrollmentApiError = { message };
    return { success: false, error: message, apiError, status: 0, raw: null };
  }

  const raw = await parseResponseBody(response);

  if (isSuccessfulEnrollmentResponse(response.status, raw)) {
    return {
      success: true,
      data: extractEnrollmentSuccessData(raw),
      raw,
    };
  }

  if (response.ok) {
    const apiError = parseEnrollmentApiError(
      raw,
      "Enrollment completed but returned an unexpected response.",
    );
    return {
      success: false,
      error: formatEnrollmentErrorDescription(apiError),
      apiError,
      status: response.status,
      raw,
    };
  }

  const fallback =
    response.status >= 500
      ? "Enrollment service is temporarily unavailable. Please try again."
      : "Society enrollment failed. Please check your details and try again.";

  const apiError = parseEnrollmentApiError(raw, fallback);

  return {
    success: false,
    error: formatEnrollmentErrorDescription(apiError),
    apiError,
    status: response.status,
    duplicateAccount: isDuplicateEnrollmentError(apiError),
    raw,
  };
}

/** @deprecated Use submitEnrollment — kept for call-site clarity. */
export const enrollSociety = submitEnrollment;
