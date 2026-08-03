/**
 * Resident records are provisioned on Neon via POST /api/register during signup.
 * No Supabase PostgREST writes are needed after email confirmation.
 */
export async function ensurePendingResidentForUser(_userId: string): Promise<{
  created: boolean;
  error: Error | null;
}> {
  return { created: false, error: null };
}
