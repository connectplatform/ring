/** Floor(base * multiplier); never zero a positive base. */
export function computeRewardFinalAmount(base: number, multiplier: number): number {
  let final = Math.floor(base * multiplier)
  if (final < 1 && base >= 1) final = 1
  return final
}
