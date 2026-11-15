import {
  DeskInsufficientCreditError,
  DeskOutOfStockError,
  getDeskExecuteErrorCode,
} from '@/features/wallet/chains/solana/desk-errors'

describe('getDeskExecuteErrorCode', () => {
  it('maps DeskInsufficientCreditError', () => {
    expect(getDeskExecuteErrorCode(new DeskInsufficientCreditError())).toBe(
      'INSUFFICIENT_CREDIT',
    )
  })

  it('maps DeskOutOfStockError', () => {
    expect(getDeskExecuteErrorCode(new DeskOutOfStockError())).toBe('DESK_OUT_OF_STOCK')
  })

  it('maps code or message without an instance', () => {
    expect(getDeskExecuteErrorCode({ code: 'DESK_OUT_OF_STOCK' })).toBe('DESK_OUT_OF_STOCK')
    expect(getDeskExecuteErrorCode(new Error('INSUFFICIENT_CREDIT'))).toBe(
      'INSUFFICIENT_CREDIT',
    )
  })

  it('ignores raw simulation logs and other errors', () => {
    expect(
      getDeskExecuteErrorCode(
        new Error('Simulation failed. Message: Transaction simulation failed: Error processing Instruction 1: custom program error: 0x1'),
      ),
    ).toBeNull()
    expect(getDeskExecuteErrorCode(new Error('Desk buy failed'))).toBeNull()
    expect(getDeskExecuteErrorCode(null)).toBeNull()
  })
})
