# SKYEwebsite3
Third attempt

## Property Contact Form

The contact form on `property.html` appears beneath the listing agent panel. It submits to the Supabase Edge Function in `supabase/functions/submit-contact-form`.

The form message is prefilled from the address shown on the property page. The Edge Function looks up the listing by slug and sends the email to that listing's `agent_email`, with Amber copied when the listing agent is someone else.

Setup required in Supabase:

1. Run `supabase/contact-crm.sql` in the Supabase SQL editor.
2. Deploy the Edge Function:

   ```bash
   supabase functions deploy submit-contact-form
   ```

3. Add these Supabase secrets:

   ```bash
   supabase secrets set RESEND_API_KEY=your_resend_key
   supabase secrets set CONTACT_TO_EMAIL=Amber.Krisky@skyegroup.realestate
   supabase secrets set CONTACT_FROM_EMAIL=no-reply@skyegroup.realestate
   ```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to deployed Supabase functions.
