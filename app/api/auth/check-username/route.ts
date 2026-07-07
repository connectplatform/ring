import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  // Ensure database connection for every request (this also opts out of static prerendering)
  await connection();

  try {
    // Parse the username from query parameters
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    // Validate presence of username
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' }, 
        { status: 400 }
      );
    }

    // Enforce minimum username length
    if (username.length < 3) {
      return NextResponse.json(
        { 
          available: false, 
          error: 'Username must be at least 3 characters long',
        },
        { status: 400 }
      );
    }

    // Only allow alphanumeric characters, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { 
          available: false, 
          error: 'Username can only contain letters, numbers, hyphens, and underscores', 
        }, 
        { status: 400 }
      );
    }

    try {
      // Log the query about to be performed
      console.log('API: check-username - About to query users by username:', { collection: 'users', field: 'username', value: username });
      
      // Query the database for any matching users (limit to 1 result for efficiency)
      const existingUsersResult = await db().queryDocs({
        collection: 'users',
        filters: [{ field: 'username', operator: '=', value: username }],
        pagination: { limit: 1 }
      });

      console.log('API: check-username - query result:', existingUsersResult);

      // Handle unsuccessful DB operation
      if (!existingUsersResult.success) {
        if (existingUsersResult.metadata?.operation === 'initialize') {
          // Specific failure: Database initialization
          console.error('API: check-username - Database initialization failed:', existingUsersResult.error);
          return NextResponse.json(
            { error: 'Database not available' }, 
            { status: 500 }
          );
        }
        // Generic DB error
        console.error('Database error checking username:', existingUsersResult.error);
        return NextResponse.json(
          { 
            error: 'Database error',
            details: existingUsersResult.error?.message
          }, 
          { status: 500 }
        );
      }

      // Username is available if no results found in DB
      const available = existingUsersResult.data.length === 0;

      return NextResponse.json({
        available,
        // Always return the normalized username (lowercase)
        username: username.toLowerCase()
      });

    } catch (dbError) {
      // Catch unanticipated DB errors
      console.error('Database error checking username:', dbError);
      return NextResponse.json(
        { error: 'Database error' }, 
        { status: 500 }
      );
    }

  } catch (error) {
    // Catch all other errors (e.g., malformed request.url)
    console.error('Error checking username availability:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// TODO: Consider adding a cache-layer or deduplication for rapid repeated username checks.
// TODO: If possible, leverage Draft/Partial Response (React 19, Next 16) for even faster feedback in UI when applicable.
// TODO: Username normalization logic should happen before DB query to prevent case mismatches.