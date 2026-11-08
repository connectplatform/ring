import {
  mapNovaPostCities,
  mapNovaPostWarehouses,
  normalizeNovaPostBranchQuery,
  normalizeNovaPostQuery,
  novaPostDivisionNumber,
  rankNovaPostWarehouses,
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

describe('normalizeNovaPostBranchQuery', () => {
  it('keeps a single branch digit', () => {
    expect(normalizeNovaPostBranchQuery('3')).toBe('3')
    expect(normalizeNovaPostBranchQuery('  ')).toBeNull()
  })
})

describe('mapNovaPostCities', () => {
  it('maps v.1.0 settlement id and name', () => {
    expect(
      mapNovaPostCities([
        { id: 123, name: 'місто Черкаси', region: { id: 1, name: 'Черкаський', parent: { id: 2, name: 'Черкаська' } } },
        { name: 'no id' },
      ]),
    ).toEqual([{ ref: '123', name: 'Черкаси', area: 'Черкаська' }])
  })

  it('puts the regional capital ahead of villages that share the prefix', () => {
    const cities = mapNovaPostCities(
      [
        { id: 1, name: 'село Черкаський Бишкин', boost: 0, region: { name: 'Зміївський район', parent: { name: 'Харківська область' } } },
        { id: 2, name: 'селище міського типу Черкаське', boost: 0, region: { name: 'Самарівський район', parent: { name: 'Дніпропетровська область' } } },
        { id: 3, name: 'місто Черкаси', boost: 31, region: { name: 'Черкаська область', parent: null } },
        { id: 4, name: 'місто Умань', boost: 10, region: { name: 'Уманський район', parent: { name: 'Черкаська область' } } },
        { id: 5, name: 'село Черкаси', boost: 0, region: { name: 'Ковельський район', parent: { name: 'Волинська область' } } },
      ],
      'черк',
    )
    expect(cities.map((city) => `${city.name} · ${city.area}`)).toEqual([
      'Черкаси · Черкаська область',
      'Черкаси · Волинська область',
      'Черкаське · Дніпропетровська область',
      'Черкаський Бишкин · Харківська область',
      'Умань · Черкаська область',
    ])
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

  it('reads the public number from the branch title', () => {
    expect(novaPostDivisionNumber('99/31', 'Відділення №31 (до 30 кг): вул. Сінна, 27')).toBe('31')
  })

  it('keeps the branch title and the city street from fullAddress', () => {
    expect(
      mapNovaPostWarehouses([
        {
          id: 11,
          name: 'Відділення №11 (до 30 кг на одне місце): вул. Небесної Сотні, 2',
          number: '99/11',
          address: '18002, Україна, Черкаська область, місто Черкаси, Небесної Сотні, 2',
          fullAddress: { settlement: 'місто Черкаси', street: 'Небесної Сотні', building: '2', zipcode: '18002' },
        },
        {
          id: 14,
          name: "Відділення №14 (до 30 кг на одне місце): вул. Благовісна, 372/Юрія Іллєнка, 59",
          number: '99/14',
          address: '18001, Україна, Черкаська область, місто Черкаси, Благовісна, 372',
          fullAddress: { settlement: 'місто Черкаси', street: 'Благовісна', building: '372' },
        },
      ]),
    ).toEqual([
      {
        ref: '11',
        name: 'Відділення №11 (до 30 кг на одне місце)',
        number: '11',
        address: 'місто Черкаси, Небесної Сотні, 2',
      },
      {
        ref: '14',
        name: 'Відділення №14 (до 30 кг на одне місце)',
        number: '14',
        address: 'місто Черкаси, Благовісна, 372',
      },
    ])
  })

  it('drops a postomat street even when the prefix is not "вул."', () => {
    expect(
      mapNovaPostWarehouses([
        {
          id: 5911,
          name: 'Поштомат "Нова Пошта" №5911: провул. Січовий, 17 (маг. Делві)',
          number: '5911',
          fullAddress: { settlement: 'місто Черкаси', street: 'Січовий (Корнійчука)', building: '17' },
        },
      ]),
    ).toEqual([
      {
        ref: '5911',
        name: 'Поштомат "Нова Пошта" №5911',
        number: '5911',
        address: 'місто Черкаси, Січовий (Корнійчука), 17',
      },
    ])
  })
})

describe('rankNovaPostWarehouses', () => {
  const rows = [
    { ref: '31', name: 'Відділення №31', number: '31', address: 'вул. Сінна, 27' },
    { ref: '13', name: 'Відділення №13', number: '13', address: 'вул. Грушевського, 2' },
    { ref: '3', name: 'Відділення №3', number: '3', address: 'бульв. Шевченка, 150' },
    { ref: '8', name: 'Відділення №8', number: '8', address: 'вул. Надпільна, 326' },
    { ref: '30', name: 'Відділення №30', number: '30', address: 'бульв. Шевченка, 5' },
  ]

  it('orders an empty query by branch number', () => {
    expect(rankNovaPostWarehouses(rows, null).map((row) => row.number)).toEqual(['3', '8', '13', '30', '31'])
  })

  it('puts an exact number before longer numbers that start with it', () => {
    expect(rankNovaPostWarehouses(rows, '3').map((row) => row.number)).toEqual(['3', '30', '31', '13'])
  })
})
