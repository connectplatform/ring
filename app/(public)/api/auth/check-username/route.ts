import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminDb } from '@/lib/firebase-admin.server';

export async function GET(request: NextRequest) {
  try {
    // Get username from query parameters
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ 
        available: false, 
        error: 'Username must be at least 3 characters long' 
      }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json({ 
        available: false, 
        error: 'Username can only contain letters, numbers, hyphens, and underscores' 
      }, { status: 400 });
    }

    try {
      const db = getAdminDb();
      if (!db) {
        return NextResponse.json({ error: 'Database not available' }, { status: 500 });
      }

      // Check if username is already taken
      const usersRef = db.collection('users');
      const usernameQuery = await usersRef.where('username', '==', username).limit(1).get();

      const available = usernameQuery.empty;

      return NextResponse.json({ 
        available,
        username: username.toLowerCase() // Return normalized username
      });

    } catch (dbError) {
      console.error('Database error checking username:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error checking username availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
