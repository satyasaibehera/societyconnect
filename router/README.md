# Universal Tenant Router (Netlify + Neon)

This package powers `https://universal-tenant-router.netlify.app`.

## Public routes

`GET /api/societies` and `GET /api/buildings` are **public** (no JWT) so the
registration UI can load catalogs before sign-in.

See `src/middleware/auth.ts` → `PUBLIC_ROUTES`.

## Buildings response

`GET /api/buildings?society_id=<uuid>` returns buildings with nested units and
a `has_owner` flag (no resident PII):

```json
{
  "buildings": [
    {
      "id": "...",
      "name": "A",
      "units": [{ "id": "...", "unit_number": "A-101", "floor": 1, "has_owner": false }]
    }
  ]
}
```

## Societies response

Returns only active rows from root Neon `public.societies`:

```sql
SELECT id, name, city, state, is_active
FROM public.societies
WHERE is_active = true
ORDER BY name ASC
```

Internal fields such as `created_by` are omitted.

## Required env (Netlify)

- `DATABASE_URL` or `NEON_DATABASE_URL` — root Neon connection string

## Local

```bash
cd router
npm install
DATABASE_URL=postgres://... npm run dev
```
