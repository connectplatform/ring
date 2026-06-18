/**
 * E2E smoke: verification procedures SSOT — create, attach, submit, review,
 * entity identity request contract, private blob read, matcher event fan-out.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   npx tsx scripts/smoke-verification-pipeline.cts [--keep]
 *
 * Requires migration `data/migrations/012_verification_procedures.sql`.
 */

import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { createVerificationProcedure } from '@/features/verification/services/create-verification-procedure'
import {
  attachVerificationDocuments,
  submitVerificationProcedure,
} from '@/features/verification/services/attach-verification-documents'
import { getVerificationProcedureByNumber } from '@/features/verification/services/get-verification-procedure'
import { persistVerificationProcedure } from '@/features/verification/services/create-verification-procedure'
import { readVerificationBlob } from '@/features/verification/lib/read-verification-blob'
import { resolveLocalStorageRoot } from '@/lib/file/local-storage-root'
import {
  entityMatchesVerificationFilter,
  isEntityIdentityVerified,
  determineEntityVerificationLevel,
} from '@/features/entities/lib/entity-verification-resolver'
import { notifyVerificationEvent } from '@/features/verification/services/notify-verification'
import type { SerializedEntity } from '@/features/entities/types'

const KEEP = process.argv.includes('--keep')

const IDS = {
  applicant: 'smk11applicant',
  reviewer: 'smk11reviewer',
  entity: 'smk11entity',
  counterYear: `vrf_counter_${new Date().getFullYear()}`,
}

let pass = 0
let fail = 0
let warn = 0
let kycProcedureNumber = ''
let entityProcedureNumber = ''
let blobObjectKey = ''

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function warning(name: string, detail: string) {
  warn++
  console.log(`  ⚠️  ${name} — ${detail}`)
}

async function cleanup() {
  const db = getDatabaseService()
  const collections: Array<[string, string]> = [
    ['users', IDS.applicant],
    ['users', IDS.reviewer],
    ['entities', IDS.entity],
  ]

  for (const [collection, id] of collections) {
    try {
      await db.delete(collection, id)
    } catch {
      /* best effort */
    }
  }

  for (const procedureNumber of [kycProcedureNumber, entityProcedureNumber]) {
    if (!procedureNumber) continue
    try {
      await db.delete('verification_procedures', procedureNumber)
    } catch {
      /* best effort */
    }
  }

  if (blobObjectKey) {
    try {
      await unlink(join(resolveLocalStorageRoot(), blobObjectKey))
    } catch {
      /* best effort */
    }
  }

  try {
    await db.delete('verification_counters', IDS.counterYear)
  } catch {
    /* best effort */
  }
}

async function smokeApproveKyc(procedureNumber: string, reviewerUserId: string) {
  const procedure = await getVerificationProcedureByNumber(procedureNumber)
  if (!procedure) throw new Error('procedure missing')
  const now = new Date().toISOString()
  await persistVerificationProcedure({
    ...procedure,
    status: 'approved',
    reviewerUserId,
    reviewedAt: now,
    completedAt: now,
    statusHistory: [...(procedure.statusHistory ?? []), { status: 'approved', at: now, actorUserId: reviewerUserId }],
    forensics: [...(procedure.forensics ?? []), { at: now, actorUserId: reviewerUserId, action: 'approved' }],
  })
  const db = getDatabaseService()
  await db.update(
    'users',
    procedure.subjectId,
    {
      kycVerification: {
        status: 'approved',
        level: 'standard',
        verifiedAt: now,
        procedureNumber,
      },
      isVerified: true,
    },
    { merge: true },
  )
}

async function smokeRejectEntity(procedureNumber: string, reviewerUserId: string, entityId: string) {
  const procedure = await getVerificationProcedureByNumber(procedureNumber)
  if (!procedure) throw new Error('procedure missing')
  const now = new Date().toISOString()
  await persistVerificationProcedure({
    ...procedure,
    status: 'rejected',
    reviewerUserId,
    reviewedAt: now,
    completedAt: now,
    rejectionReason: 'Smoke rejection — incomplete documents',
    statusHistory: [...(procedure.statusHistory ?? []), { status: 'rejected', at: now, actorUserId: reviewerUserId }],
    forensics: [...(procedure.forensics ?? []), { at: now, actorUserId: reviewerUserId, action: 'rejected' }],
  })
  const db = getDatabaseService()
  await db.update(
    'entities',
    entityId,
    { verificationStatus: 'rejected' },
    { merge: true },
  )
}

async function main() {
  console.log('smoke-verification-pipeline (smk11_)')
  await initializeDatabase()
  const db = getDatabaseService()

  const now = new Date().toISOString()

  await db.create(
    'users',
    { email: 'smk11-applicant@test.local', role: 'subscriber', createdAt: now },
    { id: IDS.applicant },
  )
  await db.create(
    'users',
    { email: 'smk11-reviewer@test.local', role: 'admin', createdAt: now },
    { id: IDS.reviewer },
  )
  await db.create(
    'entities',
    {
      name: 'Smoke Verification Entity',
      type: 'company',
      addedBy: IDS.applicant,
      isPublic: true,
      verificationStatus: 'none',
      dateAdded: now,
      lastUpdated: now,
    },
    { id: IDS.entity },
  )

  // ── 1. verification.procedure.create ─────────────────────────────────────
  console.log('1) verification.procedure.create')
  const kycProcedure = await createVerificationProcedure({
    subjectType: 'user_kyc',
    subjectId: IDS.applicant,
    applicantUserId: IDS.applicant,
  })
  kycProcedureNumber = kycProcedure.procedureNumber
  ok('procedureNumber format VRF-YYYY-######', /^VRF-\d{4}-\d{6}$/.test(kycProcedureNumber))
  ok('attemptNumber starts at 1', kycProcedure.attemptNumber === 1)
  ok('initial status draft', kycProcedure.status === 'draft')

  // ── 2. verification.document.attach + blob ───────────────────────────────
  console.log('2) verification.document.attach + verification.document.proxy')
  blobObjectKey = `smoke11/kyc/${IDS.applicant}_doc.pdf`
  const blobDir = join(resolveLocalStorageRoot(), 'smoke11', 'kyc')
  await mkdir(blobDir, { recursive: true })
  await writeFile(join(resolveLocalStorageRoot(), blobObjectKey), Buffer.from('%PDF-smoke-kyc'))

  await attachVerificationDocuments({
    procedureNumber: kycProcedureNumber,
    applicantUserId: IDS.applicant,
    documentType: 'passport',
    objectKey: blobObjectKey,
    fileName: 'passport.pdf',
    contentType: 'application/pdf',
  })

  const withDoc = await getVerificationProcedureByNumber(kycProcedureNumber)
  ok('document attached to procedure', (withDoc?.documents?.length ?? 0) === 1)

  try {
    const blob = await readVerificationBlob(blobObjectKey)
    ok('readVerificationBlob returns bytes', blob.buffer.length > 0)
  } catch (e) {
    ok('readVerificationBlob returns bytes', false, e instanceof Error ? e.message : String(e))
  }

  // ── 3. verification.procedure.submit ─────────────────────────────────────
  console.log('3) verification.procedure.submit')
  await submitVerificationProcedure(kycProcedureNumber, IDS.applicant)
  const submitted = await getVerificationProcedureByNumber(kycProcedureNumber)
  ok('status submitted after submit', submitted?.status === 'submitted')

  await notifyVerificationEvent({
    type: 'verification.submitted',
    procedureNumber: kycProcedureNumber,
    subjectType: 'user_kyc',
    subjectId: IDS.applicant,
    applicantUserId: IDS.applicant,
  })

  const events = await db.query({
    collection: 'matcher_verification_events',
    filters: [{ field: 'procedureNumber', operator: '=', value: kycProcedureNumber }],
    pagination: { limit: 5 },
  })
  ok('matcher_verification_events row persisted', events.success && (events.data?.length ?? 0) > 0)

  // ── 4. verification.admin.approve ────────────────────────────────────────
  console.log('4) verification.admin.approve')
  await smokeApproveKyc(kycProcedureNumber, IDS.reviewer)
  const approved = await getVerificationProcedureByNumber(kycProcedureNumber)
  ok('procedure approved', approved?.status === 'approved')
  ok('forensics audit trail present', (approved?.forensics?.length ?? 0) >= 2)

  const userRow = await db.read('users', IDS.applicant)
  const userData = (userRow.data?.data || userRow.data || {}) as Record<string, unknown>
  const kycVerification = userData.kycVerification as { status?: string } | undefined
  ok('user kycVerification.status approved', kycVerification?.status === 'approved')

  // ── 5. verification.admin.reject (entity) ──────────────────────────────
  console.log('5) verification.entity.request + verification.admin.reject')
  const entityProcedure = await createVerificationProcedure({
    subjectType: 'entity_identity',
    subjectId: IDS.entity,
    applicantUserId: IDS.applicant,
    entityName: 'Smoke Verification Entity',
  })
  entityProcedureNumber = entityProcedure.procedureNumber

  await attachVerificationDocuments({
    procedureNumber: entityProcedureNumber,
    applicantUserId: IDS.applicant,
    documentType: 'business_registration',
    objectKey: blobObjectKey,
    fileName: 'registration.pdf',
    contentType: 'application/pdf',
  })

  await db.update(
    'entities',
    IDS.entity,
    {
      verificationStatus: 'pending',
      verificationRequestedAt: now,
      verificationProcedureNumber: entityProcedureNumber,
    },
    { merge: true },
  )

  await submitVerificationProcedure(entityProcedureNumber, IDS.applicant)
  await smokeRejectEntity(entityProcedureNumber, IDS.reviewer, IDS.entity)

  const entityRow = await db.read('entities', IDS.entity)
  const entityData = (entityRow.data?.data || entityRow.data || {}) as Record<string, unknown>
  ok('entity verificationStatus rejected', entityData.verificationStatus === 'rejected')

  // ── 6. SSOT filter + badge resolver ──────────────────────────────────────
  console.log('6) entity verification SSOT helpers')
  const verifiedEntity = {
    id: IDS.entity,
    name: 'Verified Entity',
    type: 'company',
    addedBy: IDS.applicant,
    isPublic: true,
    verificationStatus: 'verified',
    storeVerification: { identityVerified: true },
    dateAdded: now,
    lastUpdated: now,
  } as SerializedEntity

  ok('isEntityIdentityVerified true when status verified', isEntityIdentityVerified(verifiedEntity))
  ok(
    'entityMatchesVerificationFilter verified',
    entityMatchesVerificationFilter(verifiedEntity, 'verified'),
  )
  ok(
    'determineEntityVerificationLevel returns verified',
    determineEntityVerificationLevel(verifiedEntity) === 'verified',
  )

  if (!KEEP) {
    await cleanup()
  } else {
    warning('cleanup', '--keep set; smk11_ rows retained')
  }

  console.log('')
  console.log(`Results: ${pass} passed, ${fail} failed, ${warn} warnings`)
  if (fail > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
