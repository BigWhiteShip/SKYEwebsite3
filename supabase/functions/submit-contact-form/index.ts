import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

type ContactPayload = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  message?: string
  captchaConfirmed?: boolean
  marketingConsent?: boolean
  contactConsent?: boolean
  sourcePage?: string
  listingSlug?: string
  propertyAddress?: string
  honeypot?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function displayAddress(listing: Record<string, unknown>) {
  if (listing.hide_address) return 'Address available upon request'

  return [
    clean(listing.address),
    clean(listing.city),
    clean(listing.state),
    clean(listing.zip_code)
  ].filter(Boolean).join(', ')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405)
  }

  let payload: ContactPayload
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid form submission.' }, 400)
  }

  if (clean(payload.honeypot)) {
    return json({ ok: true })
  }

  const firstName = clean(payload.firstName)
  const lastName = clean(payload.lastName)
  const email = clean(payload.email).toLowerCase()
  const phone = clean(payload.phone)
  const message = clean(payload.message)
  const listingSlug = clean(payload.listingSlug)

  if (!firstName || !lastName || !email) {
    return json({ ok: false, error: 'Please provide your first name, last name, and email.' }, 400)
  }

  if (!emailPattern.test(email)) {
    return json({ ok: false, error: 'Please enter a valid email address.' }, 400)
  }

  if (!payload.captchaConfirmed) {
    return json({ ok: false, error: 'Please confirm the checkbox captcha.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const amberEmail = Deno.env.get('CONTACT_TO_EMAIL') ?? 'Amber.Krisky@skyegroup.realestate'
  const fromEmail = Deno.env.get('CONTACT_FROM_EMAIL') ?? 'no-reply@skyegroup.realestate'

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: 'Contact form database setup is missing.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })

  if (!listingSlug) {
    return json({ ok: false, error: 'Property information is missing from this inquiry.' }, 400)
  }

  const { data: listing, error: listingError } = await supabase
    .from('public_listings')
    .select('slug,title,address,city,state,zip_code,hide_address,agent_name,agent_email')
    .eq('slug', listingSlug)
    .in('status', ['published', 'sold'])
    .single()

  if (listingError || !listing) {
    console.error('Listing lookup failed', listingError)
    return json({ ok: false, error: 'Unable to find this property listing.' }, 400)
  }

  const agentEmail = clean(listing.agent_email)
  const agentName = clean(listing.agent_name)
  const listingTitle = clean(listing.title)
  const propertyAddress = displayAddress(listing)

  if (!agentEmail || !emailPattern.test(agentEmail)) {
    return json({ ok: false, error: 'This property does not have a valid listing agent email.' }, 500)
  }

  const now = new Date().toISOString()
  const { data: client, error: clientError } = await supabase
    .from('crm_clients')
    .upsert(
      {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        lead_source: 'property_contact_form',
        marketing_consent: payload.marketingConsent !== false,
        contact_consent: payload.contactConsent !== false,
        updated_at: now
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single()

  if (clientError) {
    console.error('Client upsert failed', clientError)
    return json({ ok: false, error: 'Unable to save your contact information.' }, 500)
  }

  const { error: submissionError } = await supabase
    .from('contact_submissions')
    .insert({
      client_id: client.id,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      message: message || null,
      captcha_confirmed: true,
      marketing_consent: payload.marketingConsent !== false,
      contact_consent: payload.contactConsent !== false,
      page_url: clean(payload.sourcePage),
      property_slug: listingSlug,
      property_address: propertyAddress,
      agent_email: agentEmail,
      user_agent: req.headers.get('user-agent')
    })

  if (submissionError) {
    console.error('Contact submission failed', submissionError)
    return json({ ok: false, error: 'Unable to save your message.' }, 500)
  }

  if (!resendApiKey) {
    return json({
      ok: false,
      sent: false,
      error: 'The message was saved, but email is not configured. RESEND_API_KEY is missing.'
    }, 500)
  }

  const submittedAt = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Los_Angeles'
  }).format(new Date())

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: agentEmail,
      cc: agentEmail.toLowerCase() === amberEmail.toLowerCase() ? undefined : amberEmail,
      reply_to: email,
      subject: `New property inquiry from ${firstName} ${lastName}`,
      html: `
        <h2>New Property Inquiry</h2>
        <p><strong>Property:</strong> ${escapeHtml(listingTitle || propertyAddress)}</p>
        <p><strong>Address shown:</strong> ${escapeHtml(propertyAddress)}</p>
        <p><strong>Listing agent:</strong> ${escapeHtml(agentName || 'Not provided')} (${escapeHtml(agentEmail)})</p>
        <p><strong>Name:</strong> ${escapeHtml(firstName)} ${escapeHtml(lastName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${phone ? escapeHtml(phone) : 'Not provided'}</p>
        <p><strong>Message:</strong></p>
        <p>${message ? escapeHtml(message).replace(/\n/g, '<br>') : 'No message provided.'}</p>
        <hr>
        <p><strong>Page:</strong> ${payload.sourcePage ? escapeHtml(payload.sourcePage) : 'Not provided'}</p>
        <p><strong>Submitted:</strong> ${submittedAt}</p>
      `
    })
  })

  const emailResult = await emailResponse.json().catch(() => ({}))

  if (!emailResponse.ok) {
    console.error('Resend email failed', emailResult)
    return json({
      ok: false,
      sent: false,
      error: `The message was saved, but email could not be sent: ${emailResult?.message ?? 'Resend rejected the request.'}`
    }, 502)
  }

  return json({ ok: true, sent: true, emailId: emailResult.id })
})
