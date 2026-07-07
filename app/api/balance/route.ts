import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'
import { mainnet, polygon, arbitrum, optimism, base } from 'viem/chains'

// Map each supported network's chainId to a corresponding client instance
const CHAIN_CLIENTS = {
  [mainnet.id]: createPublicClient({
    chain: mainnet,
    // Use provided RPC URL for Ethereum mainnet or fallback to default Alchemy
    transport: http(process.env.ETHEREUM_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
  }),
  [polygon.id]: createPublicClient({
    chain: polygon,
    // Use provided RPC URL for Polygon or fallback to public endpoint
    transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
  }),
  [arbitrum.id]: createPublicClient({
    chain: arbitrum,
    // Use provided RPC URL for Arbitrum or fallback to public endpoint
    transport: http(process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'),
  }),
  [optimism.id]: createPublicClient({
    chain: optimism,
    // Use provided RPC URL for Optimism or fallback to public endpoint
    transport: http(process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io'),
  }),
  [base.id]: createPublicClient({
    chain: base,
    // Use provided RPC URL for Base or fallback to public endpoint
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  }),
}

// Compose array of allowed chain IDs from the CHAIN_CLIENTS map
const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_CLIENTS).map(Number)

// Handle POST requests for balance fetching
export async function POST(request: NextRequest) {
  try {
    // Read JSON body from the incoming request
    const { address, chainId } = await request.json()

    // Check for address presence
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      )
    }

    // Naive validation: Ethereum-style address should start with 0x and be 42 chars long
    if (!address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      )
    }
    // TODO: Use viem's isAddress() utility for stricter address validation

    // Default to Polygon (137) if no chainId is given
    const targetChainId = chainId || 137 

    // Check if requested chain is supported
    if (!SUPPORTED_CHAIN_IDS.includes(targetChainId)) {
      return NextResponse.json(
        { error: 'Unsupported chain ID' },
        { status: 400 }
      )
    }

    // Look up the client instance for the target chain
    const client = CHAIN_CLIENTS[targetChainId]

    // Defensive check: Shouldn't really happen because of SUPPORTED_CHAIN_IDS check above
    if (!client) {
      return NextResponse.json(
        { error: 'Chain client not configured' },
        { status: 500 }
      )
    }

    // Fetch the native token balance using the chain client
    const balance = await client.getBalance({
      address: address as `0x${string}`,
    })

    // Format balance as ETH and as raw wei string
    const formattedBalance = formatEther(balance)

    // Respond with all relevant details, including the chain's symbol and timestamp
    return NextResponse.json({
      address,
      chainId: targetChainId,
      balance: formattedBalance,
      rawBalance: balance.toString(),
      symbol: getChainSymbol(targetChainId),
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Balance fetch error:', error)

    // Unexpected error handling with extra details if possible
    return NextResponse.json(
      {
        error: 'Failed to fetch balance',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Maps chain IDs to their respective native token symbol
function getChainSymbol(chainId: number): string {
  switch (chainId) {
    case 1: return 'ETH' // Ethereum mainnet
    case 137: return 'POL' // Polygon
    case 42161: return 'ETH' // Arbitrum
    case 10: return 'ETH' // Optimism
    case 8453: return 'ETH' // Base
    default: return 'ETH' // Fallback for unknown chains
  }
}

// TODO: Once React 19/Next 16 get stable streaming API support for route handlers, consider using native Server Actions for this endpoint instead of API routes.