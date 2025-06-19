'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { getFirestore, doc, updateDoc } from "firebase/firestore"
import { app } from "@/lib/firebase-client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const db = getFirestore(app)

export function CryptoOnboardingForm() {
  const { data: session, update } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return

    try {
      await updateDoc(doc(db, "users", session.user.id), {
        name,
        email,
      })

      // Update the session
      await update({
        ...session,
        user: {
          ...session.user,
          name,
          email,
        },
        needsOnboarding: false,
      })
    } catch (error) {
      console.error("Error updating user data:", error)
      alert("Failed to update user information")
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        required
      />
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <Button type="submit">Complete Profile</Button>
    </form>
  )
}

