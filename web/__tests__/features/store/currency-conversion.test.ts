import { convertViaRates } from '@/lib/fx/convert-with-rates'
import { storeRailCurrencyGlyph } from '@/features/store/currency-context'

/** GreenFood overlay: main=UAH, 45 UAH/USD, 1 DAARION = 1000 USD = 45000 UAH */
const GREENFOOD_RATES = {
  UAH: 1,
  USD: 0.022222222222222,
  DAARION: 45000,
}

/** L1 RING: main=USD, RING priced at 10 USD */
const RING_RATES = {
  USD: 1,
  UAH: 41,
  RING: 10,
}

describe('convertViaRates native vs fiat conventions', () => {
  it('converts 79 UAH catalog price to ~$1.76 and ~0.00176 DAARION (not 79×45000)', () => {
    const usd = convertViaRates(79, 'UAH', 'USD', GREENFOOD_RATES, 'UAH', 'DAARION')
    const daarion = convertViaRates(79, 'UAH', 'DAARION', GREENFOOD_RATES, 'UAH', 'DAARION')
    expect(usd).toBeCloseTo(1.7556, 3)
    expect(daarion).toBeCloseTo(79 / 45000, 8)
    expect(daarion).toBeLessThan(0.01)
    expect(daarion).not.toBeCloseTo(79 * 45000, 0)
  })

  it('round-trips UAH ↔ DAARION and UAH ↔ USD', () => {
    const d = convertViaRates(79, 'UAH', 'DAARION', GREENFOOD_RATES, 'UAH', 'DAARION')
    expect(convertViaRates(d, 'DAARION', 'UAH', GREENFOOD_RATES, 'UAH', 'DAARION')).toBeCloseTo(
      79,
      6,
    )
    const usd = convertViaRates(79, 'UAH', 'USD', GREENFOOD_RATES, 'UAH', 'DAARION')
    expect(convertViaRates(usd, 'USD', 'UAH', GREENFOOD_RATES, 'UAH', 'DAARION')).toBeCloseTo(79, 5)
  })

  it('keeps DAARION invert when live NBU-style USD is merged into the table', () => {
    const liveMerged = { ...GREENFOOD_RATES, USD: 1 / 41.5 }
    const daarion = convertViaRates(79, 'UAH', 'DAARION', liveMerged, 'UAH', 'DAARION')
    expect(daarion).toBeCloseTo(79 / 45000, 8)
    const usd = convertViaRates(79, 'UAH', 'USD', liveMerged, 'UAH', 'DAARION')
    expect(usd).toBeCloseTo(79 / 41.5, 5)
  })

  it('keeps RING as 10 USD per token (not 10 RING per USD)', () => {
    expect(convertViaRates(10, 'USD', 'RING', RING_RATES, 'USD', 'RING')).toBeCloseTo(1, 8)
    expect(convertViaRates(1, 'RING', 'USD', RING_RATES, 'USD', 'RING')).toBeCloseTo(10, 8)
  })
})

describe('storeRailCurrencyGlyph', () => {
  it('shows hryvnia for GreenFood main currency even if leftover USD is still selected', () => {
    expect(storeRailCurrencyGlyph('USD', 'UAH', 'DAARION')).toBe('₴')
    expect(storeRailCurrencyGlyph('UAH', 'UAH', 'DAARION')).toBe('₴')
    expect(storeRailCurrencyGlyph('DAARION', 'UAH', 'DAARION')).toBe('Ⓡ')
  })
})
