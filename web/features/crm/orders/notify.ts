/**
 * LAYER1_STUB — community no-op notifications for project orders.
 */
export async function notifyProjectOrderPaid(_input: {
  orderId: string
  buyerUserId: string
}): Promise<void> {}

export async function notifyProjectOrderAvailable(_input: {
  orderId: string
  buyerUserId: string
}): Promise<void> {}

export async function notifyProjectOrderRequested(_input: {
  orderId: string
  buyerUserId: string
  requestorUserId: string
  opportunityId: string
}): Promise<void> {}

export async function notifyProjectOrderAssigned(_input: {
  orderId: string
  buyerUserId: string
  integratorUserId: string
}): Promise<void> {}

export async function notifyProjectOrderRefunded(_input: {
  orderId: string
  buyerUserId: string
}): Promise<void> {}

export async function notifyProjectOrderProgress(_input: {
  orderId: string
  buyerUserId: string
  progress: number
}): Promise<void> {}
