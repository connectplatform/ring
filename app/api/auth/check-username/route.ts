import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering (uses request.url + auth)

  try {
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
      console.log('API: check-username - About to query users by username:', { collection: 'users', field: 'username', value: username });
      const existingUsersResult = await db().queryDocs({
        collection: 'users',
        filters: [{ field: 'username', operator: '=', value: username }],
        pagination: { limit: 1 }
      });
      console.log('API: check-username - query result:', existingUsersResult);

      if (!existingUsersResult.success) {
        if (existingUsersResult.metadata?.operation === 'initialize') {
          console.error(`API: check-username - Database initialization failed:`, existingUsersResult.error);
          return NextResponse.json({ error: 'Database not available' }, { status: 500 });
        }
        console.error('Database error checking username:', existingUsersResult.error);
        return NextResponse.json({
          error: 'Database error',
          details: existingUsersResult.error?.message
        }, { status: 500 });
      }

      const available = existingUsersResult.data.length === 0;

      return NextResponse.json({
        available,
        username: username.toLowerCase()
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
