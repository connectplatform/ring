import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailContactService } from '@/features/email-crm/pipeline/crm/email-contact-service'

// Handler for GET requests to fetch email contacts.
// Expects optional query params: email, name, company, type.
// Returns up to 100 contacts matching filters.
export async function GET(req: NextRequest) {
  // Establish database connection.
  await connection()

  // Check if the user is an authenticated email admin.
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    // If auth fails, respond with the error and appropriate status code.
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse query parameters from the URL for contact search.
  const url = new URL(req.url)
  // Calls the contact service to search contacts with any of the provided filters.
  const contacts = await getEmailContactService().searchContacts({
    email: url.searchParams.get('email') ?? undefined,      // filter by email if provided
    name: url.searchParams.get('name') ?? undefined,        // filter by name if provided
    company: url.searchParams.get('company') ?? undefined,  // filter by company if provided
    type: (url.searchParams.get('type') as never) ?? undefined, // filter by type if provided
    limit: 100, // Max number of results to return
  })

  // Send the found contacts as a JSON response.
  return NextResponse.json({ contacts })
}

// Handler for POST requests to create/get an email contact.
// Expects JSON body including at least 'email', plus optional 'name', 'company', 'type'.
export async function POST(req: NextRequest) {
  // Establish database connection.
  await connection()

  // Validate admin authentication as above.
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    // Early return on authentication failure.
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse body as JSON.
  const body = await req.json()
  // If email is missing, reject the request with validation error.
  if (!body?.email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  // Get or create a contact with provided information.
  const contact = await getEmailContactService().getOrCreateContact(body.email, {
    name: body.name,        // optional
    company: body.company,  // optional
    type: body.type,        // optional
  })

  // Respond with the contact object.
  return NextResponse.json({ contact })
}

// TODO: Consider adopting Next.js Route Handlers middleware for shared logic (e.g., connection, auth) to reduce duplication.
// TODO: Explore edge runtimes or streaming responses using React 19/Next 16 capabilities if dealing with large contact sets.