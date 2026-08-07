import { getTenantRouterUrl } from "@/lib/api/tenantRouterUrl";
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
  return fallback;
}

/**
 * Submit society admin enrollment to the Universal Tenant Router.
 * POST ${TENANT_ROUTER_URL}/api/v1/auth/enroll
 */
export async function submitEnrollment(payload: EnrollmentPayload): Promise<EnrollmentResult> {
  const tenantRouterUrl = getTenantRouterUrl();
  const url = `${tenantRouterUrl}/api/v1/auth/enroll`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: payload.email.trim(),
        password: payload.password,
        full_name: payload.full_name.trim(),
        phone_number: payload.phone_number,
        society_name: payload.society_name.trim(),
        address: payload.address ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to reach enrollment service";
    return { success: false, error: message, status: 0, raw: null };
  }

  const contentType = response.headers.get("content-type") || "";
  const raw = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (response.ok && raw && typeof raw === "object") {
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
