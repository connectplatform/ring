import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

/**
 * Stable KEYS collection metadata JSON for Metaplex Core / Explorer Symbol.
 * Also reachable via rewrite: /nft/gates/collection.json
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'nft', 'gates', 'collection.json')
    const body = await readFile(filePath, 'utf8')
    JSON.parse(body) // validate
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    // Fallback if public file missing from image (e.g. mid-deploy)
    const fallback = {
      name: 'Ringdom Keys Collection',
      symbol: 'KEYS',
      description: 'Metaplex Core gate NFTs for Ring membership and vendor access.',
      image: 'https://ring-platform.org/favicon.ico',
      external_url: 'https://ring-platform.org/nft/keys',
      attributes: [
        { trait_type: 'Platform', value: 'Ring' },
        { trait_type: 'Access Model', value: 'NFT Gate' },
        { trait_type: 'Family', value: 'KEYS' },
      ],
    }
    return NextResponse.json(fallback, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
