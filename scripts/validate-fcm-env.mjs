#!/usr/bin/env node
/**
 * Validate Firebase client + admin env for FCM web push.
 *
 * Usage:
 *   node scripts/validate-fcm-env.mjs
 *   node scripts/validate-fcm-env.mjs --file .env.local
 *   node scripts/validate-fcm-env.mjs --file k8s/secrets.yaml --format yaml
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseYamlKeyedEnv } from './lib/parse-yaml-keyed-env.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')

const CLIENT_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
]

const SERVER_VARS = [
  'AUTH_FIREBASE_PROJECT_ID',
  'AUTH_FIREBASE_CLIENT_EMAIL',
  'AUTH_FIREBASE_PRIVATE_KEY',
]

/** Staged RFC web-push dual-stack — warn if incomplete; never required for FCM-only. */
const WEBPUSH_VARS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']

const PLACEHOLDER = /^(your_|demo-|changeme|replace_me|xxx|todo|your-)/i

function parseArgs() {
  const fileIdx = process.argv.indexOf('--file')
  const formatIdx = process.argv.indexOf('--format')
  return {
    file: fileIdx >= 0 ? process.argv[fileIdx + 1] : '.env.local',
    format: formatIdx >= 0 ? process.argv[formatIdx + 1] : 'dotenv',
  }
}

function parseDotenv(content) {
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function parseYamlFirebase(content) {
  return parseYamlKeyedEnv(content, [...CLIENT_VARS, ...SERVER_VARS, ...WEBPUSH_VARS])
}

function loadEnv(file, format) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file)
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`)
    process.exit(1)
  }
  const content = fs.readFileSync(abs, 'utf8')
  return format === 'yaml' ? parseYamlFirebase(content) : parseDotenv(content)
}

function statusFor(key, value) {
  if (!value?.trim()) return { level: 'error', message: 'MISSING' }
  if (PLACEHOLDER.test(value.trim())) return { level: 'error', message: 'PLACEHOLDER' }
  return { level: 'ok', message: `set (${value.trim().length} chars)` }
}

function main() {
  const { file, format } = parseArgs()
  const env = loadEnv(file, format)
  let fail = 0
  let warn = 0

  console.log(`FCM env audit — ${file}\n`)

  console.log('Client (NEXT_PUBLIC_FIREBASE_*):')
  for (const key of CLIENT_VARS) {
    const st = statusFor(key, env[key])
    console.log(`  ${st.level === 'ok' ? 'OK' : 'FAIL'}  ${key}: ${st.message}`)
    if (st.level !== 'ok') fail++
  }

  console.log('\nServer (Firebase Admin — push send):')
  for (const key of SERVER_VARS) {
    const st = statusFor(key, env[key])
    console.log(`  ${st.level === 'ok' ? 'OK' : 'FAIL'}  ${key}: ${st.message}`)
    if (st.level !== 'ok') fail++
  }

  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  const adminProject = env.AUTH_FIREBASE_PROJECT_ID?.trim()
  if (projectId && adminProject && projectId !== adminProject) {
    console.log(`\nWARN  Project mismatch: client=${projectId} admin=${adminProject}`)
    warn++
  }

  const vapid = env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()

  const sender = env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim()
  const appId = env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
  if (sender && appId && !appId.includes(`:${sender}:`)) {
    console.log(
      `\nWARN  APP_ID sender segment may not match MESSAGING_SENDER_ID (${sender}) — verify Firebase web app config`,
    )
    warn++
  }

  console.log('\nRFC Web Push (VAPID_* dual-stack — dedicated keypair):')
  const webpushPresent = WEBPUSH_VARS.map((k) => Boolean(env[k]?.trim()))
  const webpushAny = webpushPresent.some(Boolean)
  const webpushAll = webpushPresent.every(Boolean)
  for (const key of WEBPUSH_VARS) {
    const value = env[key]
    if (!value?.trim()) {
      console.log(`  ${webpushAny ? 'WARN' : 'SKIP'}  ${key}: MISSING`)
      if (webpushAny) warn++
      continue
    }
    if (PLACEHOLDER.test(value.trim())) {
      console.log(`  WARN  ${key}: PLACEHOLDER`)
      warn++
      continue
    }
    console.log(`  OK    ${key}: set (${value.trim().length} chars)`)
  }
  if (webpushAny && !webpushAll) {
    console.log(
      '  WARN  Partial VAPID_* set — web-push send requires PUBLIC + PRIVATE + SUBJECT',
    )
    warn++
  }
  const rfcPublic = env.VAPID_PUBLIC_KEY?.trim()
  if (rfcPublic && vapid && rfcPublic === vapid) {
    console.log(
      '  WARN  VAPID_PUBLIC_KEY equals NEXT_PUBLIC_FIREBASE_VAPID_KEY — prefer a dedicated RFC keypair (Console cert has no usable private for web-push)',
    )
    warn++
  }
  if (webpushAll) {
    console.log('  NOTE  Never pass VAPID_* into firebase getToken({ vapidKey })')
  }

  console.log(`\nSummary: ${fail} error(s), ${warn} warning(s)`)
  if (fail > 0) {
    console.log('\nGCP checklist (if VAPID is correct but subscribe still fails):')
    console.log('  - Enable "Firebase Cloud Messaging API" for the Firebase/GCP project')
    console.log('  - Enable "Firebase Installations API"')
    console.log('  - Ensure API key is not HTTP-referrer restricted blocking fcmregistrations.googleapis.com')
    process.exit(1)
  }
}

main()
