import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'
import { mainnet, polygon, arbitrum, optimism, base } from 'viem/chains'

const CHAIN_CLIENTS = {
  [mainnet.id]: createPublicClient({
    chain: mainnet,
    transport: http(process.env.ETHEREUM_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
  }),
  [polygon.id]: createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
  }),
  [arbitrum.id]: createPublicClient({
    chain: arbitrum,
    transport: http(process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'),
  }),
  [optimism.id]: createPublicClient({
    chain: optimism,
    transport: http(process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io'),
  }),
  [base.id]: createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  }),
}

const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_CLIENTS).map(Number)

export async function POST(request: NextRequest) {
  try {
    const { address, chainId } = await request.json()

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      )
    }

    // Validate address format
    if (!address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      )
    }

    const targetChainId = chainId || 137 // Default to Polygon

    if (!SUPPORTED_CHAIN_IDS.includes(targetChainId)) {
      return NextResponse.json(
        { error: 'Unsupported chain ID' },
        { status: 400 }
      )
    }

    const client = CHAIN_CLIENTS[targetChainId]

    if (!client) {
      return NextResponse.json(
        { error: 'Chain client not configured' },
        { status: 500 }
      )
    }

    // Fetch native token balance
    const balance = await client.getBalance({
      address: address as `0x${string}`,
    })

    const formattedBalance = formatEther(balance)

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

    return NextResponse.json(
      {
        error: 'Failed to fetch balance',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function getChainSymbol(chainId: number): string {
  switch (chainId) {
    case 1: return 'ETH'
    case 137: return 'POL'
    case 42161: return 'ETH' // Arbitrum
    case 10: return 'ETH' // Optimism
    case 8453: return 'ETH' // Base
    default: return 'ETH'
  }
}
