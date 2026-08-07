import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const cityName = req.nextUrl.searchParams.get('city') || ''
    if (!cityName) return NextResponse.json({ warehouses: [] })
    const apiKey = process.env.NOVAPOST_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'NOVAPOST_API_KEY not set' }, { status: 500 })
    // Step 1: find city Ref
    const citiesRes = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ apiKey, modelName: 'Address', calledMethod: 'getCities', methodProperties: { FindByString: cityName } })
    })
    if (!citiesRes.ok) throw new Error('NovaPost API error: getCities')
    const citiesData = await citiesRes.json()
    const cityRef = citiesData?.data?.[0]?.Ref
    if (!cityRef) return NextResponse.json({ warehouses: [] })
    // Step 2: list warehouses by CityRef
    const whRes = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ apiKey, modelName: 'AddressGeneral', calledMethod: 'getWarehouses', methodProperties: { CityRef: cityRef } })
    })
    if (!whRes.ok) throw new Error('NovaPost API error: getWarehouses')
    const whData = await whRes.json()
    const warehouses = Array.isArray(whData?.data) ? whData.data.map((w: any) => w.Description) : []
    return NextResponse.json({ warehouses })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load warehouses' }, { status: 500 })
  }
}


