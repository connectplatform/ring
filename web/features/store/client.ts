import { RingStoreService } from './service'
import { HttpStoreAdapter } from './adapters/http-adapter'

export async function getClientStoreService() {
  return new RingStoreService(new HttpStoreAdapter())
}


