# Supabase Setup for Settings MVP

## 1) SQL: user login history table + RLS
Run SQL file below in Supabase SQL Editor:

- `supabase/sql/20260307_user_login_history.sql`

## 2) Edge Function: delete-my-account
Deploy function:

```bash
supabase functions deploy delete-my-account
```

No extra secret is required when running inside Supabase Cloud because
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available in function env.

## 3) If VS Code shows ts(2307) in function files
- Install **Deno** extension in VS Code.
- Reopen folder `supabase/functions` (or reload window).
- This repo already includes `supabase/functions/deno.json` and
  `.vscode/settings.json` for proper module/type resolution.
