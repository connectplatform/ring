import { polarPoint } from '@/lib/ring-widgets/matcher-orchestration'

export type Point = { x: number; y: number }

export type CircleObstacle = Point & { r: number }

export type QuadPath = {
  p0: Point
  p1: Point
  p2: Point
}

const MATCHER_CENTER = { x: 50, y: 50 }
const MATCHER_RADIUS = 8
const USER_RADIUS = 6.2

export function pointOnQuad(path: QuadPath, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * path.p0.x + 2 * u * t * path.p1.x + t * t * path.p2.x,
    y: u * u * path.p0.y + 2 * u * t * path.p1.y + t * t * path.p2.y,
  }
}

export function quadPathD(path: QuadPath): string {
  return `M ${path.p0.x} ${path.p0.y} Q ${path.p1.x} ${path.p1.y} ${path.p2.x} ${path.p2.y}`
}

export function pointOnJointPath(leg1: QuadPath, leg2: QuadPath, t: number): Point {
  if (t <= 0.5) return pointOnQuad(leg1, t * 2)
  return pointOnQuad(leg2, (t - 0.5) * 2)
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function pointOnMorphPath(
  leg1: QuadPath,
  leg2: QuadPath,
  direct: QuadPath,
  morph: number,
  t: number,
): Point {
  const joint = pointOnJointPath(leg1, leg2, t)
  const straight = pointOnQuad(direct, t)
  return lerpPoint(joint, straight, morph)
}

function repelFromObstacles(point: Point, obstacles: CircleObstacle[]): Point {
  let { x, y } = point
  for (const obs of obstacles) {
    const dx = x - obs.x
    const dy = y - obs.y
    const dist = Math.hypot(dx, dy) || 0.001
    const minDist = obs.r + 1.8
    if (dist < minDist) {
      const push = (minDist - dist) * 1.15
      x += (dx / dist) * push
      y += (dy / dist) * push
    }
  }
  return { x, y }
}

function bendControlPoint(
  start: Point,
  end: Point,
  obstacles: CircleObstacle[],
  bulgeScale = 7,
): Point {
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy) || 1
  const perpX = -dy / len
  const perpY = dx / len

  const toCenterX = MATCHER_CENTER.x - mid.x
  const toCenterY = MATCHER_CENTER.y - mid.y
  const dot = perpX * toCenterX + perpY * toCenterY
  const sign = dot > 0 ? -1 : 1

  const bent = {
    x: mid.x + perpX * bulgeScale * sign,
    y: mid.y + perpY * bulgeScale * sign,
  }
  return repelFromObstacles(bent, obstacles)
}

export function buildObstacles(
  positions: Point[],
  excludeIndices: number[],
  includeMatcher = true,
): CircleObstacle[] {
  const excluded = new Set(excludeIndices)
  const obstacles: CircleObstacle[] = []

  if (includeMatcher) {
    obstacles.push({ ...MATCHER_CENTER, r: MATCHER_RADIUS })
  }

  positions.forEach((pos, index) => {
    if (excluded.has(index)) return
    obstacles.push({ ...pos, r: USER_RADIUS })
  })

  return obstacles
}

export function buildWireLeg(
  start: Point,
  end: Point,
  obstacles: CircleObstacle[],
  bulgeScale = 7,
): QuadPath {
  return {
    p0: start,
    p1: bendControlPoint(start, end, obstacles, bulgeScale),
    p2: end,
  }
}

export function buildMatchWirePaths(
  requestPos: Point,
  providerPos: Point,
  positions: Point[],
  requestorIdx: number,
  providerIdx: number,
) {
  const leg1Obstacles = buildObstacles(positions, [requestorIdx], false)
  const leg2Obstacles = buildObstacles(positions, [providerIdx], false)
  const directObstacles = buildObstacles(positions, [requestorIdx, providerIdx], true)

  const leg1 = buildWireLeg(requestPos, MATCHER_CENTER, leg1Obstacles)
  const leg2 = buildWireLeg(MATCHER_CENTER, providerPos, leg2Obstacles)
  const direct = buildWireLeg(requestPos, providerPos, directObstacles, 9)

  return { leg1, leg2, direct, matcher: MATCHER_CENTER }
}

/** Tangent angle in degrees for orienting ants along the curve */
export function tangentAngleOnQuad(path: QuadPath, t: number): number {
  const dt = 0.012
  const a = pointOnQuad(path, Math.max(0, t - dt))
  const b = pointOnQuad(path, Math.min(1, t + dt))
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** Offset a point outward from the hub (for floating event labels). */
export function outwardFromCenter(point: Point, center: Point, distance: number): Point {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const len = Math.hypot(dx, dy) || 1
  return {
    x: point.x + (dx / len) * distance,
    y: point.y + (dy / len) * distance,
  }
}

export function approximateQuadLength(path: QuadPath, samples = 12): number {
  let length = 0
  let prev = path.p0
  for (let i = 1; i <= samples; i++) {
    const next = pointOnQuad(path, i / samples)
    length += Math.hypot(next.x - prev.x, next.y - prev.y)
    prev = next
  }
  return length
}

export function actorPositionsFromAngles(
  cx: number,
  cy: number,
  radius: number,
  angles: number[],
): Point[] {
  return angles.map((angle) => polarPoint(cx, cy, radius, angle))
}
