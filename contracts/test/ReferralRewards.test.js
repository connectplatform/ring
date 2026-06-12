const { expect } = require('chai')
const { ethers, upgrades } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers')

describe('ReferralRewards', function () {
  async function deployFixture() {
    const [admin, operator, referrer, other] = await ethers.getSigners()

    const MockMintableToken = await ethers.getContractFactory('MockMintableToken')
    const token = await MockMintableToken.deploy()
    await token.waitForDeployment()

    const ReferralRewards = await ethers.getContractFactory('ReferralRewards')
    const rewards = await upgrades.deployProxy(
      ReferralRewards,
      [admin.address, operator.address, await token.getAddress(), 0],
      { initializer: 'initialize', kind: 'uups' }
    )
    await rewards.waitForDeployment()

    await token.transferOwnership(await rewards.getAddress())

    return { rewards, token, admin, operator, referrer, other }
  }

  it('mints tokens to referrer on payReferral', async function () {
    const { rewards, token, operator, referrer } = await loadFixture(deployFixture)
    const orderRef = ethers.id('store_order_1')
    const amount = ethers.parseEther('10')

    await expect(rewards.connect(operator).payReferral(referrer.address, amount, orderRef))
      .to.emit(rewards, 'ReferralPaid')
      .withArgs(referrer.address, amount, orderRef)

    expect(await token.balanceOf(referrer.address)).to.equal(amount)
    expect(await rewards.paidOrders(orderRef)).to.equal(true)
  })

  it('reverts duplicate orderRef', async function () {
    const { rewards, operator, referrer } = await loadFixture(deployFixture)
    const orderRef = ethers.id('dup_order')
    const amount = ethers.parseEther('1')

    await rewards.connect(operator).payReferral(referrer.address, amount, orderRef)
    await expect(
      rewards.connect(operator).payReferral(referrer.address, amount, orderRef)
    ).to.be.revertedWithCustomError(rewards, 'ReferralRewards__AlreadyPaid')
  })

  it('reverts when non-operator calls payReferral', async function () {
    const { rewards, referrer, other } = await loadFixture(deployFixture)
    await expect(
      rewards.connect(other).payReferral(referrer.address, 1n, ethers.id('x'))
    ).to.be.reverted
  })

  it('reverts when paused', async function () {
    const { rewards, operator, referrer, admin } = await loadFixture(deployFixture)
    await rewards.connect(admin).pause()
    await expect(
      rewards.connect(operator).payReferral(referrer.address, 1n, ethers.id('paused'))
    ).to.be.revertedWithCustomError(rewards, 'EnforcedPause')
  })

  it('preserves state after upgrade', async function () {
    const { rewards, operator, referrer, admin } = await loadFixture(deployFixture)
    const orderRef = ethers.id('upgrade_test')
    await rewards.connect(operator).payReferral(referrer.address, 1n, orderRef)

    const ReferralRewardsV2 = await ethers.getContractFactory('ReferralRewards')
    const upgraded = await upgrades.upgradeProxy(await rewards.getAddress(), ReferralRewardsV2, {
      kind: 'uups',
    })
    expect(await upgraded.paidOrders(orderRef)).to.equal(true)
    expect(await upgraded.hasRole(await upgraded.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true)
  })
})
