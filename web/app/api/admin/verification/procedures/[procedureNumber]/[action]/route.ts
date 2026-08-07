import { NextRequest, NextResponse, connection } from 'next/server';
import {
  approveVerificationProcedure,
  rejectVerificationProcedure,
  requestVerificationInfo,
  markVerificationUnderReview,
} from '@/features/verification/services/kyc-validator';
import { VerificationProcedureError } from '@/features/verification/services/create-verification-procedure';
import { EntityPermissionError } from '@/lib/errors';
import { RouteHandlerProps } from '@/types/next-page';
import { z } from 'zod';

// Define the schema for the expected request body.
const bodySchema = z.object({
  note: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
});

/**
 * Handles the corresponding action by dispatching it to the correct service function.
 * @param procedureNumber The procedure number from the route param
 * @param action The action to perform (approve, reject, request-info, under-review)
 * @param body The parsed request body
 */
async function handleAction(
  procedureNumber: string,
  action: string,
  body: z.infer<typeof bodySchema>,
) {
  switch (action) {
    case 'approve':
      // Approves the verification procedure with the supplied procedureNumber.
      return approveVerificationProcedure(procedureNumber);
    case 'reject':
      // Rejects the procedure, passing the rejection reason (or empty string if not present).
      return rejectVerificationProcedure(procedureNumber, body.rejectionReason || '');
    case 'request-info':
      // Requests additional info, optionally attaching a note.
      return requestVerificationInfo(procedureNumber, body.note || '');
    case 'under-review':
      // Marks the procedure as under review.
      return markVerificationUnderReview(procedureNumber);
    default:
      // Unrecognized action keyword.
      return null;
  }
}

/**
 * POST /api/admin/verification/procedures/{procedureNumber}/{action}
 */
export async function POST(
  req: NextRequest,
  context: RouteHandlerProps<{ procedureNumber: string; action: string }>,
) {
  // TODO: If your database adapter supports connection pooling, consider removing manual connection() calls (Next.js 16 supports improved database integration).
  await connection();

  // Extract route parameters for procedure and action.
  const { procedureNumber, action } = await context.params;
  if (!procedureNumber || !action) {
    // Guard clause: both params must be present.
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    // Parse raw request body as JSON; if parse fails, fallback to an empty object.
    const raw = await req.json().catch(() => ({}));
    body = bodySchema.parse(raw); // Validate request body schema.
  } catch {
    // Return 400 if validation fails.
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    // Dispatch action handler.
    const result = await handleAction(procedureNumber, action, body);
    if (!result) {
      // Invalid/unsupported action value handling.
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    // Return result merged with a success field.
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    // Handle authorization/permission errors with proper HTTP codes.
    if (error instanceof EntityPermissionError) {
      // Use 401 for authentication errors, 403 for other permission errors.
      const status = error.message.includes('Authentication') ? 401 : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    // Application-specific error handling for known cases.
    if (error instanceof VerificationProcedureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Fallback: Internal Server Error for unexpected issues.
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
