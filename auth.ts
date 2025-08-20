// Build-time compatibility layer for BetterAuth migration
// Avoids importing BetterAuth during module initialization to prevent database adapter issues

// Main auth function for server-side components (compatibility with NextAuth pattern)
export const auth = async () => {
  try {
    // Dynamic import to ensure BetterAuth is loaded properly
    const { getServerSession } = await import('@/lib/auth')
    return await getServerSession()
  } catch (error) {
    console.warn('Auth session unavailable:', error?.message || 'Unknown error')
    return null
  }
}

// Server session helper for compatibility
export const getServerAuthSession = auth

// Legacy exports for backward compatibility during migration
export const handlers = {
  GET: () => new Response('Auth handlers moved to /api/auth/[...all]/route.ts', { status: 410 }),
  POST: () => new Response('Auth handlers moved to /api/auth/[...all]/route.ts', { status: 410 })
}