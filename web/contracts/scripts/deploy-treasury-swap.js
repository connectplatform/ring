/**
 * Deploy RingTreasurySwap to Polygon Amoy (EVM testnet / "devnet").
 *
 * Usage (from ring-platform.org/contracts):
 *   TREASURY_ADDRESS=0x... DEPLOYER_PRIVATE_KEY=0x... \
 *   npx hardhat run scripts/deploy-treasury-swap.js --network amoy
 *
 * Then:
 *   1. setTokenAllowlisted(USDC, true) / USDT as needed
 *   2. Set ring-config chains.evm.treasuryAddress = TREASURY_ADDRESS
 *   3. Set NEXT_PUBLIC_EVM_TREASURY_ADDRESS for client soft-gates
 *   4. Record deployed RingTreasurySwap address in ops notes
 *
 * Security: Smart Contract Security Auditor MUST clear mainnet deploy.
 */

const hre = require('hardhat')

async function main() {
  const treasury = process.env.TREASURY_ADDRESS || process.env.EVM_TREASURY_ADDRESS
  if (!treasury || !/^0x[a-fA-F0-9]{40}$/.test(treasury)) {
    throw new Error('Set TREASURY_ADDRESS (0x…) — RING EVM treasury that receives allowlisted ERC-20')
  }

  const [deployer] = await hre.ethers.getSigners()
  console.log('Network:', hre.network.name)
  console.log('Deployer:', deployer.address)
  console.log('Treasury:', treasury)

  const Factory = await hre.ethers.getContractFactory('RingTreasurySwap')
  const contract = await Factory.deploy(treasury)
  await contract.waitForDeployment()
  const address = await contract.getAddress()

  console.log('RingTreasurySwap deployed:', address)
  console.log(
    JSON.stringify(
      {
        network: hre.network.name,
        ringTreasurySwap: address,
        treasury,
        deployer: deployer.address,
        next: [
          'Owner: setTokenAllowlisted for USDC/USDT',
          'ring-config: chains.evm.treasuryAddress',
          'NEXT_PUBLIC_EVM_TREASURY_ADDRESS',
          'Security audit before mainnet',
        ],
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
