"use server"

import { auth } from '@/auth'
// Removed apiClient import - using direct service calls instead
// import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'

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

  const session = await auth()
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
    
    // ✅ Use direct service call instead of HTTP request
    const { createListingDraft } = await import('@/features/nft-market/services/listing-service')
    const result = await createListingDraft(payload)
    
    if (result.success && result.id) {
      return { success: true, id: result.id }
    } else {
      return { error: result.error || 'Failed to create draft' }
    }
  } catch (e: any) {
    console.error('NFT listing creation service call failed:', {
      error: e instanceof Error ? e.message : e
    })
    return { error: e?.message || 'Failed to create draft' }
  }
}


