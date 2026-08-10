/** Digital ID card category keys (UI + badge styling). */
export const DIGITAL_ID_CATEGORY = {
  RESIDENT: "resident",
  TENANT: "tenant",
  HELPER: "helper",
  VISITOR: "visitor",
  SECURITY: "security",
  OFFICE_BEARER: "office_bearer",
} as const;

export type DigitalIdCategory =
  (typeof DIGITAL_ID_CATEGORY)[keyof typeof DIGITAL_ID_CATEGORY];
