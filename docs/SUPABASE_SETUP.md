# SKYE Supabase Setup

This site stays hosted on GitHub Pages. Supabase provides the database, login, photo storage, and broker approval workflow.

## 1. Create The Project

1. Go to https://supabase.com.
2. Create an account.
3. Create a new project named `skye-real-estate`.
4. Save the project password somewhere secure.
5. Open Project Settings > API.
6. Copy the Project URL and anon public key.
7. Paste them into `js/supabase-config.js`.

## 2. Create The Database

1. In Supabase, open SQL Editor.
2. Paste the contents of `supabase/schema.sql`.
3. Run the script.

For an existing Supabase database, run `supabase/broker-review-workflow-update.sql` instead of recreating the schema.

## 3. Create Storage Bucket

1. Open Storage.
2. Create a bucket named `listing-photos`.
3. Make the bucket public so listing photos can render on GitHub Pages public listing pages.
4. Public listing pages use the stored image URL from this bucket.

If uploads fail because of storage permissions, run `supabase/storage-policies.sql` in the Supabase SQL Editor.

The admin tool currently enforces a maximum of 4 listing photos.

## 4. Authentication Settings

Use email/password login first.

Recommended settings:

- Agents use `name@skyegroup.realestate`.
- Public signups disabled.
- Admin/principal broker creates agent accounts.
- Password reset enabled.
- Redirect URLs include the GitHub Pages site URL, local testing URL, and `admin/set-password.html` for invite/password setup links.

Passkeys can be added later. Supabase passkeys are available, but currently marked experimental in Supabase documentation, so the first production version should rely on email/password.

## 5. Principal Broker

Create Amber as the first user:

- Email: `Amber.Krisky@skyegroup.realestate`
- Role: `principal_broker`

After the user exists in Supabase Auth, add a matching row in `public.profiles`.

## 6. Approval Email

Approval emails should come from:

`no-reply@skyegroup.realestate`

The included Edge Function stub at `supabase/functions/submit-listing-for-approval/index.ts` is where the production broker notification integration goes.

When the principal broker sends a listing back for edits, deploy `supabase/functions/request-listing-edits/index.ts` and set these Edge Function secrets:

- `APPROVAL_FROM_EMAIL`: defaults to `no-reply@skyegroup.realestate`
- `RESEND_API_KEY`: required for the email to actually send through Resend

The edit-request email subject is `Please review and update your listing`. The body is `Hello [agent_first_name], I have reviewed the listing.  Please take a look at my comments and re-submit.`

## 7. Recommended Learning Path

- Supabase Getting Started: https://supabase.com/docs/guides/getting-started
- Supabase Auth: https://supabase.com/docs/guides/auth
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Passkeys: https://supabase.com/docs/guides/auth/passkeys
