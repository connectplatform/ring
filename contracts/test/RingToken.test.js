const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Ring Platform Smart Contracts", function () {
  let ringToken, ringMembership;
  let owner, treasury, user1, user2, user3;
  let membershipFee, initialSupply;

  beforeEach(async function () {
    // Get signers
    [owner, treasury, user1, user2, user3] = await ethers.getSigners();

    // Deploy RingToken
    const RingToken = await ethers.getContractFactory("RingToken");
    ringToken = await upgrades.deployProxy(
      RingToken,
      [treasury.address, owner.address],
      { initializer: "initialize" }
    );
    await ringToken.deployed();

    // Deploy RingMembership
    const RingMembership = await ethers.getContractFactory("RingMembership");
    ringMembership = await upgrades.deployProxy(
      RingMembership,
      [ringToken.address, owner.address],
      { initializer: "initialize" }
    );
    await ringMembership.deployed();

    // Link contracts
    await ringToken.setMembershipContract(ringMembership.address);

    // Get constants
    membershipFee = await ringToken.MEMBERSHIP_FEE();
    initialSupply = await ringToken.totalSupply();
  });

  describe("RingToken Deployment", function () {
    it("Should have correct initial parameters", async function () {
      expect(await ringToken.name()).to.equal("Ring Token");
      expect(await ringToken.symbol()).to.equal("RING");
      expect(await ringToken.decimals()).to.equal(18);
      expect(await ringToken.totalSupply()).to.equal(ethers.utils.parseEther("1000000000"));
      expect(await ringToken.treasury()).to.equal(treasury.address);
    });

    it("Should mint initial supply to treasury", async function () {
      const treasuryBalance = await ringToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(initialSupply);
    });

    it("Should have correct membership fee", async function () {
      expect(membershipFee).to.equal(ethers.utils.parseEther("1"));
    });
  });

  describe("Token Distribution", function () {
    it("Should allow owner to credit tokens to users", async function () {
      const amount = ethers.utils.parseEther("100");
      
      await expect(ringToken.creditTokens(user1.address, amount, "Test credit"))
        .to.emit(ringToken, "TokensCredited")
        .withArgs(user1.address, amount, "Test credit");
      
      expect(await ringToken.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should not allow non-owner to credit tokens", async function () {
      const amount = ethers.utils.parseEther("100");
      
      await expect(
        ringToken.connect(user1).creditTokens(user2.address, amount, "Unauthorized")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("RingMembership Functionality", function () {
    beforeEach(async function () {
      // Give user1 enough tokens for subscription
      const amount = ethers.utils.parseEther("24"); // 2 years worth
      await ringToken.creditTokens(user1.address, amount, "Test setup");
    });

    it("Should allow user to create subscription", async function () {
      await expect(ringMembership.connect(user1).createSubscription())
        .to.emit(ringMembership, "SubscriptionCreated")
        .withArgs(user1.address, await getBlockTimestamp());
      
      const subscription = await ringMembership.getSubscription(user1.address);
      expect(subscription.status).to.equal(1); // ACTIVE
    });

    it("Should deduct membership fee on subscription creation", async function () {
      const initialBalance = await ringToken.balanceOf(user1.address);
      
      await ringMembership.connect(user1).createSubscription();
      
      const finalBalance = await ringToken.balanceOf(user1.address);
      expect(initialBalance.sub(finalBalance)).to.equal(membershipFee);
    });

    it("Should not allow subscription without sufficient balance", async function () {
      // Give user minimal tokens (less than membership fee)
      await ringToken.creditTokens(user2.address, ethers.utils.parseEther("0.5"), "Insufficient");
      
      await expect(
        ringMembership.connect(user2).createSubscription()
      ).to.be.revertedWith("Insufficient RING balance");
    });

    it("Should allow user to cancel subscription", async function () {
      await ringMembership.connect(user1).createSubscription();
      
      await expect(ringMembership.connect(user1).cancelSubscription())
        .to.emit(ringMembership, "SubscriptionCancelled")
        .withArgs(user1.address, await getBlockTimestamp(), "User cancelled");
      
      const subscription = await ringMembership.getSubscription(user1.address);
      expect(subscription.status).to.equal(3); // CANCELLED
    });
  });

  describe("Subscription Balance Checks", function () {
    it("Should correctly calculate remaining membership months", async function () {
      const amount = ethers.utils.parseEther("12"); // 12 RING = 12 months
      await ringToken.creditTokens(user1.address, amount, "Test");
      
      const months = await ringToken.getRemainingMembershipMonths(user1.address);
      expect(months).to.equal(12);
    });

    it("Should check subscription balance requirement", async function () {
      const minAmount = await ringToken.MIN_SUBSCRIPTION_BALANCE();
      await ringToken.creditTokens(user1.address, minAmount, "Min balance");
      
      expect(await ringToken.hasSubscriptionBalance(user1.address)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to set treasury", async function () {
      await expect(
        ringToken.connect(user1).setTreasury(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(ringToken.setTreasury(user1.address))
        .to.emit(ringToken, "TreasuryUpdated")
        .withArgs(treasury.address, user1.address);
    });

    it("Should allow only owner to set membership contract", async function () {
      await expect(
        ringToken.connect(user1).setMembershipContract(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow only membership contract to deduct fees", async function () {
      await ringToken.creditTokens(user1.address, membershipFee, "Test");
      
      await expect(
        ringToken.connect(user1).deductMembershipFee(user1.address)
      ).to.be.revertedWith("Only membership contract can deduct fees");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to pause and unpause contract", async function () {
      await ringToken.pause();
      expect(await ringToken.paused()).to.be.true;
      
      // Transfers should fail when paused
      await expect(
        ringToken.connect(treasury).transfer(user1.address, membershipFee)
      ).to.be.revertedWith("Pausable: paused");
      
      await ringToken.unpause();
      expect(await ringToken.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        ringToken.connect(user1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // Helper function to get current block timestamp
  async function getBlockTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
