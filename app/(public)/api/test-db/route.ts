import { NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database/DatabaseService';

export async function GET() {
  console.log('API: /api/test-db - Testing database service initialization');
  
  try {
    const db = getDatabaseService();
    console.log('Database service created');
    
    const result = await db.initialize();
    console.log('Database initialization result:', {
      success: result.success,
      error: result.error?.message,
      metadata: result.metadata
    });
    
    if (result.success) {
      console.log('✅ Database service initialized successfully!');
      
      // Test reading from users table
      const readResult = await db.read('users', 'test-user-id');
      console.log('Test read result:', {
        success: readResult.success,
        data: readResult.data,
        error: readResult.error?.message
      });
      
      return NextResponse.json({
        success: true,
        message: 'Database service initialized successfully',
        readResult: {
          success: readResult.success,
          error: readResult.error?.message
        }
      });
    } else {
      console.error('❌ Database service initialization failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error?.message,
        metadata: result.metadata
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error testing database service:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
