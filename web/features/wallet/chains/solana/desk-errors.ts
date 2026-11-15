export class DeskInsufficientCreditError extends Error {
  readonly code = 'INSUFFICIENT_CREDIT' as const
  constructor(message = 'INSUFFICIENT_CREDIT') {
    super(message)
    this.name = 'DeskInsufficientCreditError'
  }
}

export class DeskOutOfStockError extends Error {
  readonly code = 'DESK_OUT_OF_STOCK' as const
  constructor(message = 'DESK_OUT_OF_STOCK') {
    super(message)
    this.name = 'DeskOutOfStockError'
  }
}

export type DeskExecuteErrorCode = 'INSUFFICIENT_CREDIT' | 'DESK_OUT_OF_STOCK'

/** Typed desk execute failures the API may surface to the client. */
export function getDeskExecuteErrorCode(error: unknown): DeskExecuteErrorCode | null {
  if (error instanceof DeskInsufficientCreditError) return 'INSUFFICIENT_CREDIT'
  if (error instanceof DeskOutOfStockError) return 'DESK_OUT_OF_STOCK'
  const code = (error as { code?: string } | null)?.code
  if (code === 'INSUFFICIENT_CREDIT' || code === 'DESK_OUT_OF_STOCK') return code
  const message = error instanceof Error ? error.message : ''
  if (message === 'INSUFFICIENT_CREDIT' || message === 'DESK_OUT_OF_STOCK') return message
  return null
}
