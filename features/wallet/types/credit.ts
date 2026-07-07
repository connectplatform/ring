/**
 * Wallet credit types — Re-exports from lib/zod/credit-schemas (SSOT).
 *
 * Credit schemas use Zod for runtime validation.  These re-exports provide
 * a convenient wallet-centric import path without changing the SSOT.
 */

export type {
  CreditTransactionType,
  CreditTransaction,
  UserCreditBalance,
  UserProfileWithCredits,
  CreditTopUpRequest,
  CreditSpendRequest,
  CreditBalanceResponse,
  CreditHistoryRequest,
  CreditHistoryResponse,
} from '@/lib/zod/credit-schemas'
