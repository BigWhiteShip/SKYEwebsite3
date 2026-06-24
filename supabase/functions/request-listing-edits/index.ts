import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const {
    listingId,
    listingTitle,
    agentEmail,
    agentFirstName,
    comments,
    subject = 'Please review and update your listing',
    textBody
  } = await req.json()

  if (!agentEmail) {
    return Response.json({ ok: false, error: 'Missing agent email.' }, { status: 400, headers: corsHeaders })
  }

  const fromEmail = Deno.env.get('APPROVAL_FROM_EMAIL') ?? 'no-reply@skyegroup.realestate'
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const body = textBody ?? `Hello ${agentFirstName || 'there'}, I have reviewed the listing.  Please take a look at my comments and re-submit.`
  const email = {
    from: fromEmail,
    to: agentEmail,
    subject,
    text: body
  }

  if (!resendApiKey) {
    return Response.json({
      ok: true,
      sent: false,
      reason: 'RESEND_API_KEY is not configured.',
      listingId,
      listingTitle,
      comments,
      email
    }, { headers: corsHeaders })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(email)
  })

  const result = await response.json()

  if (!response.ok) {
    return Response.json({ ok: false, sent: false, error: result }, { status: response.status, headers: corsHeaders })
  }

  return Response.json({
    ok: true,
    sent: true,
    listingId,
    listingTitle,
    comments,
    emailId: result.id
  }, { headers: corsHeaders })
})
