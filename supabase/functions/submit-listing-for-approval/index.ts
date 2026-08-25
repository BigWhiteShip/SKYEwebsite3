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

  const { listingId, listingTitle, agentName, reviewUrl } = await req.json()

  if (!listingId || !listingTitle) {
    return Response.json(
      { ok: false, error: 'Missing listingId or listingTitle.' },
      { status: 400, headers: corsHeaders }
    )
  }

  const brokerEmail = Deno.env.get('BROKER_APPROVAL_EMAIL') ?? 'Amber.Krisky@skyegroup.realestate'
  const fromEmail = Deno.env.get('APPROVAL_FROM_EMAIL') ?? 'no-reply@skyegroup.realestate'
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  const subject = `Listing approval needed: ${listingTitle}`
  const textLines = [
    'Hello,',
    '',
    `${agentName || 'An agent'} has submitted a listing for your review.`,
    '',
    `Listing: ${listingTitle}`,
  ]
  if (reviewUrl) textLines.push(`Review it here: ${reviewUrl}`)
  textLines.push('', 'SKYE Group Real Estate')
  const text = textLines.join('\n')

  const email = { from: fromEmail, to: brokerEmail, subject, text }

  if (!resendApiKey) {
    return Response.json({
      ok: true,
      sent: false,
      reason: 'RESEND_API_KEY is not configured.',
      listingId,
      listingTitle,
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
    return Response.json({
      ok: true,
      sent: false,
      reason: result?.message ?? 'Resend could not send the email.',
      resendError: result,
      listingId,
      listingTitle
    }, { headers: corsHeaders })
  }

  return Response.json({
    ok: true,
    sent: true,
    listingId,
    listingTitle,
    emailId: result.id
  }, { headers: corsHeaders })
})
