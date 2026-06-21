import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { listingId, listingTitle, reviewUrl } = await req.json()
  const brokerEmail = Deno.env.get('BROKER_APPROVAL_EMAIL') ?? 'Amber.Krisky@skyegroup.realestate'
  const fromEmail = Deno.env.get('APPROVAL_FROM_EMAIL') ?? 'no-reply@skyegroup.realestate'

  // Production note: connect this to Resend or another transactional email provider.
  // Subject: Listing approval needed: ${listingTitle}
  // To: ${brokerEmail}
  // From: ${fromEmail}
  // Body should include listingId and reviewUrl.

  return Response.json({
    ok: true,
    listingId,
    listingTitle,
    brokerEmail,
    fromEmail,
    reviewUrl
  })
})
