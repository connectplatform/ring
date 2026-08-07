const { ethers, upgrades } = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  const [deployer] = await ethers.getSigners()
  const operator = process.env.REFERRAL_MINTER_ADDRESS || deployer.address
  const token = process.env.REFERRAL_REWARD_TOKEN_ADDRESS
  const mode = Number(process.env.REFERRAL_REWARD_MODE || '0')

  if (!token) {
    throw new Error('REFERRAL_REWARD_TOKEN_ADDRESS is required')
  }

  const ReferralRewards = await ethers.getContractFactory('ReferralRewards')
  const proxy = await upgrades.deployProxy(
    ReferralRewards,
    [deployer.address, operator, token, mode],
    { initializer: 'initialize', kind: 'uups' }
  )
  await proxy.waitForDeployment()

  const proxyAddress = await proxy.getAddress()
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress)

  const info = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    operator,
    token,
    mode,
    contracts: { ReferralRewards: { proxy: proxyAddress, implementation: implAddress } },
  }

  const dir = path.join(__dirname, '..', 'deployments')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `referral-rewards-${Date.now()}.json`), JSON.stringify(info, null, 2))

  console.log('ReferralRewards proxy:', proxyAddress)
  console.log('Implementation:', implAddress)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
