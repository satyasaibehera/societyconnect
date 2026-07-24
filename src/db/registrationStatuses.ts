/**
 * Registration / flat-request state machine statuses.
 *
 * FlatRequest (addition_requests):
 *   PENDING → APPROVED | REJECTED
 *
 * UserRegistration (registration_requests):
 *   WAITING_FOR_FLAT → READY_FOR_REVIEW (after FlatRequest approved)
 *   READY_FOR_REVIEW → approved | rejected
 *   (legacy "pending" / "PENDING_USER_APPROVAL" treated as READY_FOR_REVIEW)
 */

export const FLAT_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type FlatRequestStatus =
  (typeof FLAT_REQUEST_STATUS)[keyof typeof FLAT_REQUEST_STATUS];

export const REGISTRATION_STATUS = {
  WAITING_FOR_FLAT: "WAITING_FOR_FLAT",
  /** Display label: "Ready for Review" — user can be approved */
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  /** @deprecated alias of READY_FOR_REVIEW */
  PENDING_USER_APPROVAL: "PENDING_USER_APPROVAL",
  APPROVED: "approved",
  REJECTED: "rejected",
  /** Legacy value — treat as READY_FOR_REVIEW */
  PENDING: "pending",
} as const;

export type RegistrationStatus =
  (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS];

export const REGISTRATION_STATUS_LABEL: Record<string, string> = {
  [REGISTRATION_STATUS.WAITING_FOR_FLAT]: "Flat Approval Pending",
  [REGISTRATION_STATUS.READY_FOR_REVIEW]: "Ready for Review",
  [REGISTRATION_STATUS.PENDING_USER_APPROVAL]: "Ready for Review",
  [REGISTRATION_STATUS.PENDING]: "Ready for Review",
  [REGISTRATION_STATUS.APPROVED]: "Approved",
  [REGISTRATION_STATUS.REJECTED]: "Rejected",
};

export function isUserApprovalBlocked(status: string | null | undefined): boolean {
  return status === REGISTRATION_STATUS.WAITING_FOR_FLAT;
}

export function isUserApprovable(status: string | null | undefined): boolean {
  return (
    status === REGISTRATION_STATUS.READY_FOR_REVIEW ||
    status === REGISTRATION_STATUS.PENDING_USER_APPROVAL ||
    status === REGISTRATION_STATUS.PENDING
  );
}
