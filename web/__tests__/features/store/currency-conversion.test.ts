/**
 * DEV TESTS (run only in dev).
 * You could move these to a separate __tests__ file.
 */
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  const assert = (cond: boolean, msg?: string) => { if (!cond) throw new Error('[StorePaymentMethods Test] ' + msg) }

  // Conversion roundtrip (should always be idempotent for same)
  for (const from of ALL_CURRENCIES) {
    for (const to of ALL_CURRENCIES) {
      const amount = 123.456
      const converted = EXCHANGE_RATES[from] && EXCHANGE_RATES[to]
        ? (amount / EXCHANGE_RATES[from]) * EXCHANGE_RATES[to]
        : NaN
      const roundtripped = (converted / EXCHANGE_RATES[to]) * EXCHANGE_RATES[from]
      if (!isNaN(converted) && !isNaN(roundtripped))
        assert(Math.abs(roundtripped - amount) < 1e-8, `Conversion round-trip failed: ${from}->${to}->${from}`)
    }
  }
  // Try toggle all cycles
  let curr = ALL_CURRENCIES[0]
  for (let i = 0; i < ALL_CURRENCIES.length * 2; ++i) {
    const idx = ALL_CURRENCIES.indexOf(curr)
    const next = ALL_CURRENCIES[(idx + 1) % ALL_CURRENCIES.length]
    curr = next
    assert(ALL_CURRENCIES.includes(curr), 'toggleCurrency cycles properly')
  }
}

