import {
  ECLIPTIC_BODY_IDS,
  eclipticLongitudes,
  moonIllumination,
  moonTrueNodeLongitude,
  solveSunLongitudeTime,
} from '@/lib/astro/ephemeris'

describe('lib/astro/ephemeris', () => {
  const j2000Utc = new Date('2000-01-01T12:00:00.000Z')

  it('returns all ten geocentric ecliptic longitudes in [0, 360)', () => {
    const longitudes = eclipticLongitudes(j2000Utc)
    expect(Object.keys(longitudes).sort()).toEqual([...ECLIPTIC_BODY_IDS].sort())
    for (const id of ECLIPTIC_BODY_IDS) {
      expect(longitudes[id]).toBeGreaterThanOrEqual(0)
      expect(longitudes[id]).toBeLessThan(360)
    }
  })

  it('places the J2000 Sun near 280.4° Capricorn', () => {
    // Jean Meeus, Astronomical Algorithms, 2nd ed. (1998), eq. 25.2:
    // geometric mean longitude of the Sun at J2000.0 (T=0) is 280.46646°.
    // Wikipedia "Position of the Sun" quotes 280.460° for the mean longitude
    // corrected for aberration at J2000.0. Apparent geocentric true ecliptic
    // longitude at 2000-01-01 12:00 UTC (J2000.0 is 12:00 TT; TT-UTC ≈ 64 s
    // in 2000) is therefore ~280.4° (Capricorn, 270-300°).
    const { sun } = eclipticLongitudes(j2000Utc)
    expect(Math.abs(sun - 280.46)).toBeLessThan(0.5)
    expect(sun).toBeGreaterThanOrEqual(270)
    expect(sun).toBeLessThan(300)
  })

  it('returns moon illumination fraction in [0, 1] from astronomy-engine', () => {
    const illumination = moonIllumination(j2000Utc)
    expect(illumination.source).toBe('astronomy-engine')
    expect(illumination.fraction).toBeGreaterThanOrEqual(0)
    expect(illumination.fraction).toBeLessThanOrEqual(1)
  })

  it('solves sun longitude from a nearby guess within 60 seconds', () => {
    const utc = new Date('1990-08-18T12:00:00.000Z')
    const { sun } = eclipticLongitudes(utc)
    const guess = new Date(utc.getTime() + 2 * 86_400_000)
    const solved = solveSunLongitudeTime(sun, guess)
    expect(Math.abs(solved.getTime() - utc.getTime())).toBeLessThanOrEqual(60_000)
  })

  it('wraps solar longitude so Sun-minus-88° (Human Design Design) still solves', () => {
    const personality = new Date('1990-08-18T12:00:00.000Z')
    const { sun } = eclipticLongitudes(personality)
    const designLon = (sun - 88 + 360) % 360
    const solved = solveSunLongitudeTime(designLon, personality)
    const { sun: designSun } = eclipticLongitudes(solved)
    const err = Math.abs(((designSun - designLon + 540) % 360) - 180)
    expect(err).toBeLessThan(0.001)
    expect(Math.abs(solved.getTime() - personality.getTime())).toBeGreaterThan(
      80 * 86_400_000
    )
    expect(Math.abs(solved.getTime() - personality.getTime())).toBeLessThan(
      96 * 86_400_000
    )
  })

  it('returns moon true node longitude in [0, 360)', () => {
    const node = moonTrueNodeLongitude(j2000Utc)
    expect(node).toBeGreaterThanOrEqual(0)
    expect(node).toBeLessThan(360)
  })
})
