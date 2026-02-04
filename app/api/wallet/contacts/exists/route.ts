/**
 * Contact Existence Check API Route
 * Checks if a wallet address already exists in user's contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCurrentWalletService } from '@/features/wallet/services';
import { z } from 'zod';

const ExistsCheckSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

/**
 * POST /api/wallet/contacts/exists - Check if contact exists
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { address } = ExistsCheckSchema.parse(body);

    const walletService = getCurrentWalletService();
    const exists = await walletService.contactExists(session.user.id, address);

    return NextResponse.json({ exists });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to check contact existence:', error);
    return NextResponse.json(
      { error: 'Failed to check contact existence' },
      { status: 500 }
    );
  }
}
