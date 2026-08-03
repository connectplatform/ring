import 'server-only'

import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import {
  mergeOrderProjectConfig,
  maskBuyerProjectConfigPatch,
  orderProjectConfigSchema,
  emptyOrderProjectConfig,
  type OrderProjectConfig,
} from '@/features/crm/orders/order-project-config'

export type ProjectConfigPatchRole = 'buyer' | 'integrator' | 'admin'

export const OrderProjectConfigService = {
  async get(orderId: string): Promise<OrderProjectConfig> {
    const order = await ProjectOrderService.getById(orderId)
    if (!order) throw new Error('Project order not found')
    return order.projectConfig || emptyOrderProjectConfig()
  },

  async patch(
    orderId: string,
    rawPatch: unknown,
    role: ProjectConfigPatchRole,
  ): Promise<OrderProjectConfig> {
    const parsed = orderProjectConfigSchema.safeParse(rawPatch ?? {})
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid project config')
    }
    let patch = parsed.data
    if (role === 'buyer') {
      patch = maskBuyerProjectConfigPatch(patch)
    }
    const existing = await this.get(orderId)
    const next = mergeOrderProjectConfig(existing, patch)
    const validated = orderProjectConfigSchema.parse(next)
    await ProjectOrderService.patch(orderId, { projectConfig: validated })
    return validated
  },
}
