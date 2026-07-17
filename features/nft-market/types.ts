import type { NftGateSlug } from '@/features/nft-gates/types'

export type NftListingStatus = 'draft' | 'active' | 'sold' | 'cancelled' | 'expired'
export type NftListingMode = 'ledger-dev' | 'metaplex-core'
export type NftChainFamily = 'solana' | 'evm'
export type NftSettlementCurrency = 'RING'
/** Exhibition lane: KEYS vendor gates vs member-created collections. */
export type NftMarketLane = 'keys' | 'member'

export interface NftListingAttribute {
  traitType: string
  value: string | number | boolean
}

export interface NFTItemRef {
  chainId: number
  address: string
  tokenId: string
  standard: 'ERC721' | 'ERC1155'
  slug?: string
  name?: string
}

export interface NftMarketListing {
  id: string
  chainFamily: NftChainFamily
  mode: NftListingMode
  /** Dual-lane Exhibition: keys = verified KEYS gates; member = creator mints. */
  lane?: NftMarketLane
  asset: string
  collection?: string
  /** Member collection row id when lane is member. */
  collectionId?: string
  collectionName?: string
  collectionSymbol: 'KEYS' | string
  collectionUri?: string
  slug: NftGateSlug | string
  name: string
  description?: string
  imageUri?: string
  metadataUri?: string
  /** Generative gallery / Metaplex animation extras */
  showcase?: {
    animationUrl?: string
    files?: Array<{ uri: string; type: string }>
    ringShowcase?: {
      primaryImageUrl: string
      media?: Array<{
        id: string
        originalUrl: string
        webpUrl?: string
        contentType: string
        source: string
        enabled: boolean
        isPrimary: boolean
      }>
    }
  }
  attributes?: NftListingAttribute[]
  sellerUserId: string
  sellerUsername?: string
  sellerWallet?: string
  ownershipId?: string
  buyerUserId?: string
  buyerWallet?: string
  priceRaw: string
  priceRing: string
  decimals: number
  currency: NftSettlementCurrency
  ringMint?: string
  feeBps: number
  feeRecipient?: string
  feeRaw?: string
  sellerProceedsRaw?: string
  listingPda?: string
  escrowPda?: string
  listSignature?: string
  cancelSignature?: string
  saleSignature?: string
  licenseExpiresAt?: string
  listedAt?: string
  soldAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt?: string
  status: NftListingStatus
  searchText?: string
}

export interface NftMarketSale {
  id: string
  listingId: string
  idempotencyKey: string
  buyerUserId: string
  sellerUserId: string
  asset: string
  status: 'pending' | 'submitted' | 'confirmed' | 'failed'
  priceRaw: string
  priceRing: string
  feeRaw: string
  sellerProceedsRaw: string
  currency: NftSettlementCurrency
  txHash?: string
  error?: string
  createdAt: string
  updatedAt?: string
  confirmedAt?: string
}

export interface NftMarketCollection {
  id: string
  collection: string
  slug?: string
  name: string
  symbol: 'KEYS' | string
  uri?: string
  imageUri?: string
  activeListings: number
  floorPriceRaw?: string
  volumeRaw?: string
  itemCount?: number
  creatorUserId?: string
  lane?: NftMarketLane
  updatedAt: string
}

export interface NftMemberCollection {
  id: string
  creatorUserId: string
  collectionMint?: string
  name: string
  symbol: string
  uri?: string
  imageUri?: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  mintCount: number
  maxMints: number
  mode: NftListingMode
  createSignature?: string
  createdAt: string
  updatedAt: string
}

export interface CreateNftListingDraftInput {
  sellerUserId: string
  sellerUsername?: string
  asset: string
  slug: NftGateSlug | string
  priceRing: string | number
  lane?: NftMarketLane
  collectionId?: string
  name?: string
  description?: string
  metadataUri?: string
  imageUri?: string
  attributes?: NftListingAttribute[]
  licenseExpiresAt?: string
}

export interface ActivateNftListingInput {
  listingId: string
  sellerUserId: string
}

export interface CancelNftListingInput {
  listingId: string
  sellerUserId: string
}

export interface NftMarketListingFilters {
  q?: string
  collection?: string
  collectionId?: string
  lane?: NftMarketLane
  slug?: NftGateSlug | string
  sellerUserId?: string
  sellerUsername?: string
  username?: string
  status?: NftListingStatus
  startAfter?: string
  limit?: number
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
}

export interface PaginatedNftMarketListings {
  items: NftMarketListing[]
  cursor: string | null
  nextCursor: string | null
  hasMore: boolean
}

/** Back-compat export for older UI imports. */
export type Listing = NftMarketListing

export interface NftItem {
  id: string
  name: string
  description?: string
  price: string
  currency: { symbol?: string; name?: string } | string
  creator?: string
  benefits?: string[]
}

export interface NftMarketAdapter {
  listAll(): Promise<NftItem[]>
  buy(id: string): Promise<{ txHash: string }>
  mint?(metadataUri: string): Promise<{ txHash: string; tokenId?: string }>
}
