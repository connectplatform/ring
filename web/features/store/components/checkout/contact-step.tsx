'use client'
import React from 'react'

export function ContactStep({
  firstName, lastName, email, notes,
  setFirstName, setLastName, setEmail, setNotes
}: {
  firstName: string
  lastName: string
  email: string
  notes: string
  setFirstName: (v: string) => void
  setLastName: (v: string) => void
  setEmail: (v: string) => void
  setNotes: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="First name" className="border rounded p-2" value={firstName} onChange={e => setFirstName(e.target.value)} required />
        <input placeholder="Last name" className="border rounded p-2" value={lastName} onChange={e => setLastName(e.target.value)} required />
      </div>
      <input placeholder="Email" className="border rounded p-2 w-full" value={email} onChange={e => setEmail(e.target.value)} />
      <textarea placeholder="Notes" className="border rounded p-2 w-full" rows={4} value={notes} onChange={e => setNotes(e.target.value)} />
    </div>
  )
}


