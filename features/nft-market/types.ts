export type ChainId = number

export interface Money {
  currency: 'NATIVE' | 'DAAR' | 'DAARION'
  amount: string // decimal string
}

export interface CollectionRef {
  chainId: ChainId
  address: string
  slug?: string
  name?: string
}

export interface NFTItemRef extends CollectionRef {
  tokenId: string
  standard: 'ERC721' | 'ERC1155'
}

export type ListingStatus = 'draft' | 'active' | 'sold' | 'cancelled'

export interface Listing {
  id: string
  sellerUserId: string
  sellerUsername?: string
  item: NFTItemRef
  price: Money
  createdAt: string
  updatedAt?: string
  status: ListingStatus
  txHash?: string
  buyerUserId?: string
}

export interface NftItem {
  id: string
  name: string
  description?: string
  price: string
  currency: 'DAAR' | 'DAARION'
  creator?: string
  benefits?: string[]
}

export interface NftMarketAdapter {
  listAll(): Promise<NftItem[]>
  buy(id: string): Promise<{ txHash: string }>
  mint?(metadataUri: string): Promise<{ txHash: string, tokenId?: string }>
}


