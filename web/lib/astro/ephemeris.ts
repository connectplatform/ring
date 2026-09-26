/**
 * Thin geocentric ephemeris socket for any Ring clone.
 *
 * Brand-free: no clone, preset, or product imports. Callers (Human Design,
 * lunar calendars, etc.) own interpretation; this module only wraps
 * astronomy-engine for true-of-date ecliptic longitudes, an osculating
 * lunar node, a wrapped solar-longitude solver, and moon illumination.
 */

import {
  Body,
  Ecliptic,
  GeoVector,
  Illumination,
  MakeTime,
  SearchSunLongitude,
} from 'astronomy-engine'

/** Mean tropical solar motion used to seed the longitude solver (deg/day). */
const TROPICAL_SOLAR_DEG_PER_DAY = 360 / 365.2421897

const NODE_DT_MS = 60_000

export const ECLIPTIC_BODY_IDS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const

export type EclipticBodyId = (typeof ECLIPTIC_BODY_IDS)[number]

export type EclipticLongitudeMap = Record<EclipticBodyId, number>

const BODY_BY_ID: Record<EclipticBodyId, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
}

export type MoonPhaseName =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent'

export type MoonIllumination = {
  fraction: number
  phaseName?: MoonPhaseName
  source: 'astronomy-engine'
}

function normalizeDegrees(lon: number): number {
  const wrapped = lon % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** Shortest signed delta `a - b` in (-180, 180]. */
function wrappedDelta(a: number, b: number): number {
  let delta = normalizeDegrees(a) - normalizeDegrees(b)
  if (delta > 180) delta -= 360
  if (delta <= -180) delta += 360
  return delta
}

function sunApparentElon(utc: Date): number {
  return Ecliptic(GeoVector(Body.Sun, MakeTime(utc), true)).elon
}

function moonPhaseName(sunLon: number, moonLon: number): MoonPhaseName {
  const elongation = normalizeDegrees(moonLon - sunLon)
  if (elongation < 22.5 || elongation >= 337.5) return 'new'
  if (elongation < 67.5) return 'waxing_crescent'
  if (elongation < 112.5) return 'first_quarter'
  if (elongation < 157.5) return 'waxing_gibbous'
  if (elongation < 202.5) return 'full'
  if (elongation < 247.5) return 'waning_gibbous'
  if (elongation < 292.5) return 'last_quarter'
  return 'waning_crescent'
}

function bisectSunLongitude(target: number, estimateMs: number): Date {
  let lo = new Date(estimateMs - 10 * 86_400_000)
  let hi = new Date(estimateMs + 10 * 86_400_000)
  let fLo = wrappedDelta(sunApparentElon(lo), target)
  let fHi = wrappedDelta(sunApparentElon(hi), target)

  for (let expand = 0; expand < 5 && fLo * fHi > 0; expand += 1) {
    lo = new Date(lo.getTime() - 10 * 86_400_000)
    hi = new Date(hi.getTime() + 10 * 86_400_000)
    fLo = wrappedDelta(sunApparentElon(lo), target)
    fHi = wrappedDelta(sunApparentElon(hi), target)
  }

  for (let i = 0; i < 60; i += 1) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2)
    const fMid = wrappedDelta(sunApparentElon(mid), target)
    if (Math.abs(fMid) < 1e-7) return mid
    if (fMid < 0) lo = mid
    else hi = mid
  }

  return new Date((lo.getTime() + hi.getTime()) / 2)
}

/**
 * Geocentric true ecliptic-of-date longitudes in [0, 360) for the ten
 * classical bodies. Aberration is applied (`GeoVector(..., true)`).
 */
export function eclipticLongitudes(utc: Date): EclipticLongitudeMap {
  const time = MakeTime(utc)
  const longitudes = {} as EclipticLongitudeMap
  for (const id of ECLIPTIC_BODY_IDS) {
    longitudes[id] = normalizeDegrees(
      Ecliptic(GeoVector(BODY_BY_ID[id], time, true)).elon
    )
  }
  return longitudes
}

/**
 * Osculating lunar ascending-node longitude in [0, 360).
 *
 * Geometric Moon `GeoVector` at `t` and `t+60s`, both converted to ecliptic
 * cartesian; velocity is the finite difference; `h = r × v`; node =
 * `atan2(hx, -hy)` in degrees.
 */
export function moonTrueNodeLongitude(utc: Date): number {
  const t0 = MakeTime(utc)
  const t1 = MakeTime(new Date(utc.getTime() + NODE_DT_MS))
  const r0 = Ecliptic(GeoVector(Body.Moon, t0, false)).vec
  const r1 = Ecliptic(GeoVector(Body.Moon, t1, false)).vec
  const vx = r1.x - r0.x
  const vy = r1.y - r0.y
  const vz = r1.z - r0.z
  const hx = r0.y * vz - r0.z * vy
  const hy = r0.z * vx - r0.x * vz
  return normalizeDegrees((Math.atan2(hx, -hy) * 180) / Math.PI)
}

/**
 * Instant when the Sun's apparent geocentric ecliptic longitude equals
 * `targetLon` (any real; wrapped to [0, 360)), nearest to `nearUtc`.
 *
 * Human Design Design-Sun is personality Sun minus 88°, which wraps across
 * 0 Aries; the solver uses shortest-arc seeding plus
 * `SearchSunLongitude` (10-day window) with bisection fallback so the
 * result is within 60 seconds of the true instant.
 */
export function solveSunLongitudeTime(targetLon: number, nearUtc: Date): Date {
  const target = normalizeDegrees(targetLon)
  const here = sunApparentElon(nearUtc)
  const deltaDeg = wrappedDelta(target, here)
  const estimateMs =
    nearUtc.getTime() + (deltaDeg / TROPICAL_SOLAR_DEG_PER_DAY) * 86_400_000

  if (Math.abs(deltaDeg) < 1e-6) {
    return nearUtc
  }

  const windowDays = 10
  const dateStart = new Date(estimateMs - (windowDays / 2) * 86_400_000)
  const found = SearchSunLongitude(target, dateStart, windowDays)
  if (found) return found.date

  return bisectSunLongitude(target, estimateMs)
}

/**
 * Illuminated fraction of the Moon as seen from Earth, from
 * `Illumination(Body.Moon, time).phase_fraction`.
 */
export function moonIllumination(utc: Date): MoonIllumination {
  const time = MakeTime(utc)
  const info = Illumination(Body.Moon, time)
  const sunLon = Ecliptic(GeoVector(Body.Sun, time, true)).elon
  const moonLon = Ecliptic(GeoVector(Body.Moon, time, true)).elon
  return {
    fraction: info.phase_fraction,
    phaseName: moonPhaseName(sunLon, moonLon),
    source: 'astronomy-engine',
  }
}
