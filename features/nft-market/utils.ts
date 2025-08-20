export async function toWeiDecimal(amount: string, decimals = 18): Promise<bigint> {
  const { parseUnits } = await import('ethers')
  return BigInt(parseUnits(amount, decimals).toString())
}


