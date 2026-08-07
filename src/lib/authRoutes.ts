/** Routes where unauthenticated users may browse without tenant role resolution. */
export const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/auth/callback",
  "/reset-password",
]);

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.has(pathname);
}
