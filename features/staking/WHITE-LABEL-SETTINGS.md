### White-label settings for Staking

Configure addresses per environment and wire ABIs for your deployment.

Addresses (Polygon mainnet defaults):
- DAAR: `0x5aF82259455a963eC20Ea92471f55767B5919E38`
- DAARION: `0x8Fe60b6F2DCBE68a1659b81175C665EB94015B16`
- APR Staking: `0xe9a321c213d837379ebD7027CE685B62dFDb8c3b`
- DAAR Distributor: `0x605F5F73536ab6099ADc4381A3713Eab73384BE5`

Environment variables (override as needed):
- `RING_DAAR_ADDRESS`
- `RING_DAARION_ADDRESS`
- `RING_APR_STAKING_ADDRESS`
- `RING_DAAR_DISTRIBUTOR_ADDRESS`
- `POLYGON_RPC_URL` (server-side reads only)

Adapter config builder:
```ts
import { RingStakingService, createEvmStakingAdapter } from '@/features/staking'
import { buildEvmStakingConfig } from '@/features/staking/staking.config'
import aprStakingAbi from 'path-to/abi/aprstaking.json'
import distributorAbi from 'path-to/abi/daardistributor.json'

const adapter = createEvmStakingAdapter(
  buildEvmStakingConfig({
    getSigner: async () => {
      const { BrowserProvider } = await import('ethers')
      // @ts-ignore
      const provider = new BrowserProvider(window.ethereum)
      return provider.getSigner()
    },
    aprStakingAbi,
    feeDistributorAbi: distributorAbi
  })
)

export const stakingService = new RingStakingService(adapter)
```

Server-side reads (optional): use `server/read-positions.ts` to cache reads via RPC. Not required for signing.


