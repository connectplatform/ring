#!/usr/bin/env node
/**
 * One-shot locale patch for admin i18n consolidation (*.nav leaves, web3 hub, parity).
 * Run: node scripts/patch-admin-i18n-nav.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const base = path.resolve(import.meta.dirname, '../locales')

const NAV_REMOVALS = [
  'fraudDeskNav',
  'settingsNav',
  'matcherNav',
  'verificationNav',
  'processesNav',
  'subscriptionsNav',
  'web3Nav',
]

const NAV_VALUES = {
  en: {
    matcher: 'Matcher',
    settings: 'Settings',
    processes: 'Background Processes',
    subscriptions: 'Subscriptions',
    fraudDesk: 'Fraud desk',
    verificationQueue: 'Verification',
    web3: {
      nav: 'Web3',
      title: 'Web3 — Native Token Dashboard',
      subtitle: 'Token supply, mint, burn, and fee payer gas management.',
    },
  },
  uk: {
    matcher: 'Matcher',
    settings: 'Налаштування',
    processes: 'Фонові процеси',
    subscriptions: 'Підписки',
    fraudDesk: 'Антифрод',
    verificationQueue: 'Верифікація',
    web3: {
      nav: 'Web3',
      title: 'Web3 — Панель нативного токена',
      subtitle: 'Пропозиція токенів, mint, burn та керування gas fee payer.',
    },
  },
  ru: {
    matcher: 'Matcher',
    settings: 'Настройки',
    processes: 'Фоновые процессы',
    subscriptions: 'Подписки',
    fraudDesk: 'Антифрод',
    verificationQueue: 'Верификация',
    web3: {
      nav: 'Web3',
      title: 'Web3 — Панель нативного токена',
      subtitle: 'Эмиссия токенов, mint, burn и управление gas fee payer.',
    },
  },
}

const VQ_RESTORE = {
  uk: {
    accountRestore: 'Відновлення облікового запису',
    restoreApprove: 'Відновити обліковий запис',
    restoreNotePreview: 'Відеоканал і контакт у примітці процедури',
  },
  ru: {
    accountRestore: 'Восстановление аккаунта',
    restoreApprove: 'Восстановить аккаунт',
    restoreNotePreview: 'Видеоканал и контакт в примечании процедуры',
  },
}

const PIPELINE_TRANSLATIONS = {
  uk: {
    commerce: 'Комерція',
    'settlement-payout': {
      label: 'Пакет виплат постачальникам',
      description: 'Обробка належних розрахунків постачальників і запис пакетів виплат',
      schedule: 'Щодня або щогодини',
    },
    'cleanup-news-deleted': {
      label: 'Очищення новин',
      description: 'Остаточне видалення м’яко видалених статей після періоду зберігання',
      schedule: 'Щотижня',
    },
    'subscription-expiry-check': {
      label: 'Перевірка закінчення підписок',
      description: 'Позначення прострочених підписок і зниження ролей користувачів',
      schedule: 'Щодня опівночі',
    },
    'credit-balance-monthly': {
      label: 'Щомісячний кредитний баланс',
      description: 'Автопродовження підписників credit_balance та обробка помилок',
      schedule: 'Щогодини',
    },
    'subscription-payment': {
      label: 'Перевірка платежів підписок',
      description: 'Синхронізація статусів Stripe і рекурентних платежів WayForPay',
      schedule: 'Щодня о 2:00',
    },
    'solana-batch-payment': {
      label: 'Пакетні платежі Solana',
      description: 'Виклик Membership.processBatchPayments() on-chain (Phase S6)',
      schedule: 'Щодня о 3:00',
    },
    'nft-gate-expiry': {
      label: 'Закінчення NFT Gate',
      description: 'Перевірка володіння NFT для підписників nft_gate (Phase S7)',
      schedule: 'Щодня о 4:00',
    },
  },
  ru: {
    commerce: 'Коммерция',
    'settlement-payout': {
      label: 'Пакет выплат поставщикам',
      description: 'Обработка due-расчётов поставщиков и запись пакетов выплат',
      schedule: 'Ежедневно или каждый час',
    },
    'cleanup-news-deleted': {
      label: 'Очистка новостей',
      description: 'Окончательное удаление мягко удалённых статей после срока хранения',
      schedule: 'Еженедельно',
    },
    'subscription-expiry-check': {
      label: 'Проверка истечения подписок',
      description: 'Пометка истёкших подписок и понижение ролей пользователей',
      schedule: 'Ежедневно в полночь',
    },
    'credit-balance-monthly': {
      label: 'Ежемесячный кредитный баланс',
      description: 'Автопродление подписчиков credit_balance и обработка ошибок',
      schedule: 'Каждый час',
    },
    'subscription-payment': {
      label: 'Проверка платежей подписок',
      description: 'Синхронизация статусов Stripe и рекуррентных платежей WayForPay',
      schedule: 'Ежедневно в 2:00',
    },
    'solana-batch-payment': {
      label: 'Пакетные платежи Solana',
      description: 'Вызов Membership.processBatchPayments() on-chain (Phase S6)',
      schedule: 'Ежедневно в 3:00',
    },
    'nft-gate-expiry': {
      label: 'Истечение NFT Gate',
      description: 'Проверка владения NFT для подписчиков nft_gate (Phase S7)',
      schedule: 'Ежедневно в 4:00',
    },
  },
}

function readJson(loc) {
  const p = path.join(base, loc, 'modules/admin.json')
  return { p, j: JSON.parse(fs.readFileSync(p, 'utf8')) }
}

function writeJson(p, j) {
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`)
}

const { j: en } = readJson('en')

for (const loc of ['en', 'uk', 'ru']) {
  const { p, j } = readJson(loc)
  const nav = NAV_VALUES[loc]

  if (j.matcher) j.matcher.nav = nav.matcher
  if (j.settings) j.settings.nav = nav.settings
  if (j.processes) j.processes.nav = nav.processes
  if (j.subscriptions) j.subscriptions.nav = nav.subscriptions
  if (j.fraudDesk) j.fraudDesk.nav = nav.fraudDesk
  if (j.verificationQueue) j.verificationQueue.nav = nav.verificationQueue

  j.web3 = { ...nav.web3 }

  for (const k of NAV_REMOVALS) delete j[k]

  if (loc !== 'en') {
    const tr = PIPELINE_TRANSLATIONS[loc]
    j.processes.categories = { ...en.processes.categories, ...j.processes.categories }
    if (tr?.commerce) j.processes.categories.commerce = tr.commerce

    const mergedPipelines = { ...en.processes.pipelines }
    for (const [key, existing] of Object.entries(j.processes.pipelines ?? {})) {
      mergedPipelines[key] = { ...mergedPipelines[key], ...existing }
    }
    for (const [key, trEntry] of Object.entries(tr ?? {})) {
      if (key === 'commerce') continue
      mergedPipelines[key] = { ...mergedPipelines[key], ...trEntry }
    }
    j.processes.pipelines = mergedPipelines

    j.processes.dashboardStats =
      loc === 'uk'
        ? '13 cron-пайплайнів · журнал запусків · SUPERADMIN'
        : '13 cron-пайплайнов · журнал запусков · SUPERADMIN'

    Object.assign(j.verificationQueue, VQ_RESTORE[loc])
  }

  writeJson(p, j)
  console.log(`patched ${loc}`)
}
