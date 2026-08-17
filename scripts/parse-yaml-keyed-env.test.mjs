import assert from 'node:assert/strict'
import test from 'node:test'
import { parseYamlKeyedEnv } from './lib/parse-yaml-keyed-env.mjs'

const KEYS = [
  'AUTH_FIREBASE_PRIVATE_KEY',
  'AUTH_FIREBASE_PROJECT_ID',
  'VAPID_PUBLIC_KEY',
]

test('|- block scalar PEM is not 1–2 chars', () => {
  const yaml = `
stringData:
  AUTH_FIREBASE_PROJECT_ID: ring-platform
  AUTH_FIREBASE_PRIVATE_KEY: |-
    -----BEGIN PRIVATE KEY-----
    MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC
    -----END PRIVATE KEY-----
  VAPID_PUBLIC_KEY: "BBPjeda"
`
  const env = parseYamlKeyedEnv(yaml, KEYS)
  assert.equal(env.AUTH_FIREBASE_PROJECT_ID, 'ring-platform')
  assert.ok(env.AUTH_FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY'))
  assert.ok(env.AUTH_FIREBASE_PRIVATE_KEY.length > 40)
  assert.equal(env.VAPID_PUBLIC_KEY, 'BBPjeda')
})

test('| block scalar (no chomp) also captures PEM body', () => {
  const yaml = `
  AUTH_FIREBASE_PRIVATE_KEY: |
    -----BEGIN PRIVATE KEY-----
    abcdef
    -----END PRIVATE KEY-----
`
  const env = parseYamlKeyedEnv(yaml, KEYS)
  assert.equal(
    env.AUTH_FIREBASE_PRIVATE_KEY,
    '-----BEGIN PRIVATE KEY-----\nabcdef\n-----END PRIVATE KEY-----',
  )
})

test('quoted scalar with escaped newlines', () => {
  const yaml = `  AUTH_FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----"\n`
  const env = parseYamlKeyedEnv(yaml, KEYS)
  assert.ok(env.AUTH_FIREBASE_PRIVATE_KEY.includes('\n'))
  assert.ok(env.AUTH_FIREBASE_PRIVATE_KEY.length > 20)
})
