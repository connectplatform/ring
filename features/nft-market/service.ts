import type { NftMarketAdapter, NftItem } from './types'

export class RingNftMarketService {
  private adapter: NftMarketAdapter

  constructor(adapter: NftMarketAdapter) {
    this.adapter = adapter
  }

  async list(): Promise<NftItem[]> {
    return this.adapter.listAll()
  }

  async buy(id: string) {
    return this.adapter.buy(id)
  }
}


