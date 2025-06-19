import { NextApiRequest, NextApiResponse } from 'next'
import { auth } from '@/auth'

import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { app } from '@/lib/firebase-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await auth()

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const db = getFirestore(app)
    const userDoc = await getDoc(doc(db, 'users', session.user.id))

    if (!userDoc.exists()) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    return res.status(200).json({ role: userData.role })
  } catch (error) {
    console.error('Error refreshing user role:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}