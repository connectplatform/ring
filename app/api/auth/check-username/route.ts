import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { auth } from '@/auth';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering (uses request.url + auth)

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
      // Initialize database service
      console.log(`API: check-username - Initializing database service`);
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        console.error(`API: check-username - Database initialization failed:`, initResult.error);
        return NextResponse.json({ error: 'Database not available' }, { status: 500 });
      }

      const dbService = getDatabaseService();

      // Check if username is already taken using efficient findByField query
      console.log('API: check-username - About to call findByField with:', { collection: 'users', field: 'username', value: username });
      const existingUsersResult = await dbService.findByField('users', 'username', username, { limit: 1 });
      console.log('API: check-username - findByField result:', existingUsersResult);

      if (!existingUsersResult.success) {
        console.error('Database error checking username:', existingUsersResult.error);
        return NextResponse.json({
          error: 'Database error',
          details: existingUsersResult.error?.message
        }, { status: 500 });
      }

      const existingUsers = existingUsersResult.data || [];
      const available = existingUsers.length === 0;

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

