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

export type EnrollmentResult =
  | { success: true; data: EnrollmentSuccessData; raw: unknown }
  | { success: false; error: string; status: number; duplicateAccount?: boolean; raw: unknown };

function getRouterApiUrl(): string | null {
  const url = import.meta.env.VITE_ROUTER_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error.trim();
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
  }
  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }
  return fallback;
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

/**
 * Submit society admin enrollment to the Universal Tenant Router.
 * POST ${VITE_ROUTER_API_URL}/api/v1/auth/enroll
 */
export async function submitEnrollment(payload: EnrollmentPayload): Promise<EnrollmentResult> {
  const routerBaseUrl = getRouterApiUrl();
  if (!routerBaseUrl) {
    return {
      success: false,
      error: "Enrollment service is not configured (VITE_ROUTER_API_URL is missing).",
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
    return { success: false, error: message, status: 0, raw: null };
  }

  const raw = await parseResponseBody(response);

  if (response.ok) {
    if (raw && typeof raw === "object") {
      const body = raw as Record<string, unknown>;
      if (body.success === true) {
        const dataBlock = body.data as Record<string, unknown> | undefined;
        return {
          success: true,
          data: {
            userId: typeof dataBlock?.userId === "string" ? dataBlock.userId : null,
            societyId: typeof dataBlock?.societyId === "string" ? dataBlock.societyId : null,
          },
          raw,
        };
      }
    }

    return {
      success: false,
      error: extractErrorMessage(raw, "Enrollment completed but returned an unexpected response."),
      status: response.status,
      raw,
    };
  }

  const errorMessage = extractErrorMessage(
    raw,
    response.status >= 500
      ? "Enrollment service is temporarily unavailable. Please try again."
      : "Society enrollment failed. Please check your details and try again.",
  );

  return {
    success: false,
    error: errorMessage,
    status: response.status,
    duplicateAccount: isDuplicateRegistrationError(new Error(errorMessage)),
    raw,
  };
}

/** @deprecated Use submitEnrollment — kept for call-site clarity. */
export const enrollSociety = submitEnrollment;
