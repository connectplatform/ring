import 'server-only'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { getVerificationProcedureByNumber } from '@/features/verification/services/get-verification-procedure'
import { EntityPermissionError } from '@/lib/errors'

export async function assertVerificationBlobAccess(procedureNumber: string): Promise<{
  procedure: Awaited<ReturnType<typeof getVerificationProcedureByNumber>>
  userId: string
  isAdmin: boolean
}> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityPermissionError('Authentication required')
  }

  const procedure = await getVerificationProcedureByNumber(procedureNumber)
  if (!procedure) {
    throw new EntityPermissionError('Verification procedure not found')
  }

  const role = session.user.role as UserRole
  const isAdmin = role === UserRole.admin || role === UserRole.superadmin
  const isApplicant = procedure.applicantUserId === session.user.id

  if (!isAdmin && !isApplicant) {
    throw new EntityPermissionError('You do not have permission to access verification documents')
  }

  return { procedure, userId: session.user.id, isAdmin }
}
