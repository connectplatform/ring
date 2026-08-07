/**
 * LAYER1_STUB — community no-op. Full Order Lab / project_orders live in overlays.
 * Leak gate: keep this file under 2000 bytes.
 */
import 'server-only'

export type ProjectOrderStub = {
  id: string
  userId: string
  workStatus: string
  integratorId?: string | null
}

export const ProjectOrderService = {
  async listForUser(_userId: string): Promise<ProjectOrderStub[]> {
    return []
  },
  async listForIntegrator(_userId: string): Promise<ProjectOrderStub[]> {
    return []
  },
  async getById(_id: string): Promise<ProjectOrderStub | null> {
    return null
  },
  async appendRequestor(_orderId: string, _userId: string): Promise<void> {
    /* community: CRM overlay required */
  },
}
