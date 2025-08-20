"use server"

import { getServerAuthSession } from '@/auth'

export interface AddListingDraftState {
  error?: string
  success?: boolean
  id?: string
}

// Optional server action wrapper to create draft listing via API (for progressive enhancement forms)
export async function addListingDraft(
  prev: AddListingDraftState | null,
  formData: FormData
): Promise<AddListingDraftState> {
  const session = await getServerAuthSession()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  try {
    const payload = {
      sellerUsername: String(formData.get('username') || ''),
      item: {
        address: String(formData.get('address') || ''),
        tokenId: String(formData.get('tokenId') || ''),
        standard: (String(formData.get('standard') || 'ERC721') === 'ERC1155' ? 'ERC1155' : 'ERC721') as 'ERC721' | 'ERC1155',
        chainId: Number(formData.get('chainId') || '137')
      },
      price: { amount: String(formData.get('amount') || ''), currency: String(formData.get('currency') || 'NATIVE') }
    }
    const res = await fetch('/api/nft-market/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) return { error: json?.error || 'Failed to create draft' }
    return { success: true, id: json.id }
  } catch (e: any) {
    return { error: e?.message || 'Failed to create draft' }
  }
}


