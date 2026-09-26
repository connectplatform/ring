import {
  mapNovaPostCities,
  mapNovaPostWarehouses,
  normalizeNovaPostQuery,
} from '@/lib/shipping/nova-post'

describe('normalizeNovaPostQuery', () => {
  it('rejects short queries', () => {
    expect(normalizeNovaPostQuery('')).toBeNull()
    expect(normalizeNovaPostQuery('a')).toBeNull()
    expect(normalizeNovaPostQuery('  к ')).toBeNull()
  })

  it('keeps a city prefix and caps length', () => {
    expect(normalizeNovaPostQuery('  Черкаси ')).toBe('Черкаси')
    expect(normalizeNovaPostQuery('x'.repeat(80))?.length).toBe(64)
  })
})

describe('mapNovaPostCities', () => {
  it('maps v.1.0 settlement id and name', () => {
    expect(
      mapNovaPostCities([
        { id: 123, name: 'місто Черкаси', region: { id: 1, name: 'Черкаський', parent: { id: 2, name: 'Черкаська' } } },
        { name: 'no id' },
      ]),
    ).toEqual([{ ref: '123', name: 'місто Черкаси', area: 'Черкаська' }])
  })
})

describe('mapNovaPostWarehouses', () => {
  it('maps v.1.0 division name and address', () => {
    expect(
      mapNovaPostWarehouses([
        { id: 9, name: 'Відділення №1', number: '1', address: 'вул. Хрещатик, 1' },
      ]),
    ).toEqual([
      { ref: '9', name: 'Відділення №1', number: '1', address: 'вул. Хрещатик, 1' },
    ])
  })
})
