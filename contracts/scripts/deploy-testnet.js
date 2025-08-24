const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Ring Platform contracts to Polygon Mumbai Testnet...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "MATIC");

  // Configuration for testnet deployment
  const config = {
    treasury: process.env.RING_TREASURY_TESTNET || deployer.address,
    owner: deployer.address,
  };

  console.log("⚙️  Deployment configuration:");
  console.log("   Treasury:", config.treasury);
  console.log("   Owner:", config.owner);

  try {
    // Deploy RING Token contract
    console.log("\n📄 Deploying RingToken contract...");
    const RingToken = await ethers.getContractFactory("RingToken");
    const ringToken = await upgrades.deployProxy(
      RingToken,
      [config.treasury, config.owner],
      { initializer: "initialize", kind: "uups" }
    );

    await ringToken.deployed();
    console.log("✅ RingToken deployed to:", ringToken.address);

    // Deploy Ring Membership contract
    console.log("\n📄 Deploying RingMembership contract...");
    const RingMembership = await ethers.getContractFactory("RingMembership");
    const ringMembership = await upgrades.deployProxy(
      RingMembership,
      [ringToken.address, config.owner],
      { initializer: "initialize", kind: "uups" }
    );

    await ringMembership.deployed();
    console.log("✅ RingMembership deployed to:", ringMembership.address);

    // Set membership contract in token contract
    console.log("\n🔗 Linking contracts...");
    const setMembershipTx = await ringToken.setMembershipContract(ringMembership.address);
    await setMembershipTx.wait();
    console.log("✅ Membership contract linked to token contract");

    // Display deployment summary
    console.log("\n📋 DEPLOYMENT SUMMARY");
    console.log("=====================");
    console.log("Network: Polygon Mumbai Testnet");
    console.log("RingToken Address:", ringToken.address);
    console.log("RingMembership Address:", ringMembership.address);
    console.log("Treasury Address:", config.treasury);
    console.log("Owner Address:", config.owner);
    
    // Get token supply information
    const totalSupply = await ringToken.totalSupply();
    const membershipFee = await ringToken.MEMBERSHIP_FEE();
    const minBalance = await ringToken.MIN_SUBSCRIPTION_BALANCE();
    
    console.log("\n💰 TOKEN INFORMATION");
    console.log("====================");
    console.log("Total Supply:", ethers.utils.formatEther(totalSupply), "RING");
    console.log("Membership Fee:", ethers.utils.formatEther(membershipFee), "RING/month");
    console.log("Min Subscription Balance:", ethers.utils.formatEther(minBalance), "RING");

    // Save deployment addresses to file
    const deploymentInfo = {
      network: "mumbai",
      chainId: 80001,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: {
        RingToken: {
          address: ringToken.address,
          implementation: await upgrades.erc1967.getImplementationAddress(ringToken.address),
        },
        RingMembership: {
          address: ringMembership.address,
          implementation: await upgrades.erc1967.getImplementationAddress(ringMembership.address),
        },
      },
      config: config,
      tokenInfo: {
        totalSupply: ethers.utils.formatEther(totalSupply),
        membershipFee: ethers.utils.formatEther(membershipFee),
        minSubscriptionBalance: ethers.utils.formatEther(minBalance),
      },
    };

    const fs = require("fs");
    fs.writeFileSync(
      "./deployments/mumbai-deployment.json",
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n💾 Deployment info saved to: ./deployments/mumbai-deployment.json");
    console.log("\n🔍 Verify contracts with:");
    console.log(`npx hardhat verify ${ringToken.address} --network mumbai`);
    console.log(`npx hardhat verify ${ringMembership.address} --network mumbai`);
    
    console.log("\n✨ Deployment completed successfully!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
