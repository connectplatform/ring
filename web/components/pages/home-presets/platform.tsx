'use client'

/**
 * Default home landing (`home.preset = "platform"`).
 *
 * Same role as `features/entities/presets/platform.ts`: L1 always ships the
 * default preset module so `import(\`./home-presets/${id}\`)` has a real
 * directory context (bare L1 / empire org compose, no pack). Packs and clones
 * add sibling files (`mvm-landing.tsx`, `news-landing.tsx`, …) — they do not
 * overwrite this module.
 */
export { default } from '../home'
