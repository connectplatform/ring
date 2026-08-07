import { parseUnits } from 'viem'

export function toWeiDecimal(amount: string, decimals = 18): bigint {
  return parseUnits(amount, decimals)
}


