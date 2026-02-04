/**
 * Wallet Contacts API Route
 * Handles CRUD operations for wallet contacts
 * Server-side only - no client bundle issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCurrentWalletService } from '@/features/wallet/services';
import { z } from 'zod';

// Validation schemas
const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  note: z.string().max(500).optional(),
});

const ContactUpdateSchema = ContactSchema.partial();

/**
 * GET /api/wallet/contacts - Get all contacts for authenticated user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const walletService = getCurrentWalletService();
    const contacts = await walletService.getContacts(session.user.id);

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Failed to get contacts:', error);
    return NextResponse.json(
      { error: 'Failed to get contacts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wallet/contacts - Add new contact
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = ContactSchema.parse(body);

    const walletService = getCurrentWalletService();
    const contact = await walletService.addContact(session.user.id, validatedData);

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to add contact:', error);
    return NextResponse.json(
      { error: 'Failed to add contact' },
      { status: 500 }
    );
  }
}

