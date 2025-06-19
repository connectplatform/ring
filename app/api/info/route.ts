
import { NextRequest, NextResponse } from 'next/server'
import { geolocation } from '@vercel/functions'
import { ipAddress } from '@vercel/functions'

export async function GET(req: NextRequest) {
  const ip = ipAddress(req) || 'Unknown'
  const { city } = geolocation(req) || { city: 'Unknown' }

  return NextResponse.json({ ip, city })
}

