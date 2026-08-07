/** Minimal address shape for checkout flattening (client-safe). */
export type FlattenableAddress = {
  addressLine1?: string
  addressLine2?: string
  city?: string
  postalCode?: string
  country?: string
  phone?: string
}

/** Flatten UserAddress (or already-flat string) for WayForPay / order shippingInfo.address */
export function flattenShippingAddress(
  address: FlattenableAddress | string | null | undefined,
): { address: string; city?: string; postalCode?: string; country?: string; phone?: string } {
  if (!address) return { address: '' }
  if (typeof address === 'string') return { address }
  return {
    address: [address.addressLine1, address.addressLine2].filter(Boolean).join(', '),
    city: address.city,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
  }
}
