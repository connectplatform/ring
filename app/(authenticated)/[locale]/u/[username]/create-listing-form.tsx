"use client"

import React from 'react'
import { useFormStatus } from 'react-dom'

function SubmitBtn() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="btn btn-primary">{pending ? 'Listing...' : 'Create Listing'}</button>
}

export default function CreateListingForm({ username }: { username: string }) {
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    const selectedStandard = String(formData.get('standard') || 'ERC721')
    const standard: 'ERC721' | 'ERC1155' = selectedStandard === 'ERC1155' ? 'ERC1155' : 'ERC721'

    const item: { address: string; tokenId: string; standard: 'ERC721' | 'ERC1155'; chainId: number } = {
      address: String(formData.get('address') || ''),
      tokenId: String(formData.get('tokenId') || ''),
      standard,
      chainId: Number(formData.get('chainId') || '137')
    }

    const payload = {
      sellerUsername: username,
      item,
      price: { amount: String(formData.get('amount') || ''), currency: String(formData.get('currency') || 'NATIVE') }
    }
    try {
      const res = await fetch('/api/nft-market/listings', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create draft')
      const draftId = json.id as string

      // Trigger on-chain listing and activate draft
      const mod = await import('@/features/nft-market/client/create-listing')
      await mod.createListingOnChainAndActivateClient(draftId, payload.item, payload.price.amount)
      setSuccess('Listing created and activated.')
      form.reset()
    } catch (e: any) {
      setError(e?.message || 'Failed to create listing')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <div className="text-sm text-destructive">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}
      <div>
        <label className="block text-sm mb-1">NFT Contract Address</label>
        <input name="address" className="w-full border rounded px-3 py-2" placeholder="0x..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Token ID</label>
          <input name="tokenId" className="w-full border rounded px-3 py-2" placeholder="123" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Standard</label>
          <select name="standard" className="w-full border rounded px-3 py-2" defaultValue="ERC721">
            <option>ERC721</option>
            <option>ERC1155</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Chain ID</label>
          <input name="chainId" className="w-full border rounded px-3 py-2" defaultValue="137" />
        </div>
        <div>
          <label className="block text-sm mb-1">Currency</label>
          <select name="currency" className="w-full border rounded px-3 py-2" defaultValue="NATIVE">
            <option>NATIVE</option>
            <option>DAAR</option>
            <option>DAARION</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Amount</label>
        <input name="amount" className="w-full border rounded px-3 py-2" placeholder="0.1" required />
      </div>
      <SubmitBtn />
    </form>
  )
}


