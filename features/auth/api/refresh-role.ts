import { NextApiRequest, NextApiResponse } from 'next'
import { auth } from '@/auth'

import { db } from '@/lib/database'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await auth()

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const result = await db().findDocById<Record<string, unknown>>('users', session.user.id)
    if (!result.success || !result.data) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.status(200).json({ role: result.data.role })
  } catch (error) {
    console.error('Error refreshing user role:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
