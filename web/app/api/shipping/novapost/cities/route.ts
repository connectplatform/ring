import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.NOVAPOST_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'NOVAPOST_API_KEY not set' }, { status: 500 })
    }
    const payload = {
      apiKey,
      modelName: 'Address',
      calledMethod: 'getCities',
      methodProperties: {}
    }
    const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // No cache to ensure fresh data
      cache: 'no-store'
    })
    if (!res.ok) throw new Error('NovaPost API error')
    const data = await res.json()
    const cities = Array.isArray(data?.data) ? data.data.map((c: any) => c.Description) : []
    return NextResponse.json({ cities })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load cities' }, { status: 500 })
  }
}


