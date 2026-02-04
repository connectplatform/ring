/**
 * Individual Contact API Route
 * Handles operations for specific wallet contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCurrentWalletService } from '@/features/wallet/services';
import { z } from 'zod';

const ContactUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address').optional(),
  note: z.string().max(500).optional(),
});

/**
 * PUT /api/wallet/contacts/[contactId] - Update contact
 */
// PUT endpoint not implemented - wallet service doesn't support contact updates

/**
 * DELETE /api/wallet/contacts/[contactId] - Remove contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = params;
    const walletService = getCurrentWalletService();

    await walletService.removeContact(session.user.id, contactId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove contact:', error);
    return NextResponse.json(
      { error: 'Failed to remove contact' },
      { status: 500 }
    );
  }
}

