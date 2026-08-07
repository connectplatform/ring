const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Ring Platform contracts to Polygon Mainnet...");
  console.log("⚠️  WARNING: This is a MAINNET deployment!");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "MATIC");

  // Require minimum balance for mainnet deployment
  const minBalance = ethers.utils.parseEther("10"); // 10 MATIC minimum
  if (balance.lt(minBalance)) {
    console.error("❌ Insufficient balance for mainnet deployment. Minimum 10 MATIC required.");
    process.exit(1);
  }

  // Configuration for mainnet deployment
  const config = {
    treasury: process.env.RING_TREASURY_MAINNET,
    owner: process.env.RING_OWNER_MAINNET || deployer.address,
  };

  // Validate required addresses
  if (!config.treasury || config.treasury === "0x0000000000000000000000000000000000000000") {
    console.error("❌ RING_TREASURY_MAINNET environment variable is required for mainnet deployment");
    process.exit(1);
  }

  console.log("⚙️  Deployment configuration:");
  console.log("   Treasury:", config.treasury);
  console.log("   Owner:", config.owner);

  // Confirmation prompt for mainnet
  console.log("\n⚠️  You are about to deploy to MAINNET!");
  console.log("   This will cost real MATIC tokens.");
  console.log("   Please double-check all configuration.");
  
  // In a real deployment, you'd want to add a manual confirmation step
  // For automation, we assume environment variables are properly set

  try {
    console.log("\n⏳ Starting deployment...");

    // Deploy RING Token contract
    console.log("\n📄 Deploying RingToken contract...");
    const RingToken = await ethers.getContractFactory("RingToken");
    
    console.log("   Estimating gas...");
    const deployTx = await upgrades.deployProxy(
      RingToken,
      [config.treasury, config.owner],
      { 
        initializer: "initialize", 
        kind: "uups",
        gasLimit: 3000000, // Set reasonable gas limit for mainnet
      }
    );

    console.log("   Waiting for deployment confirmation...");
    const ringToken = await deployTx.deployed();
    console.log("✅ RingToken deployed to:", ringToken.address);

    // Wait for additional confirmations on mainnet
    console.log("   Waiting for additional confirmations...");
    await ringToken.deployTransaction.wait(3); // Wait for 3 confirmations

    // Deploy Ring Membership contract
    console.log("\n📄 Deploying Membership contract...");
    const Membership = await ethers.getContractFactory("Membership");
    
    const membershipDeployTx = await upgrades.deployProxy(
      Membership,
      [ringToken.address, config.owner],
      { 
        initializer: "initialize", 
        kind: "uups",
        gasLimit: 3000000,
      }
    );

    console.log("   Waiting for deployment confirmation...");
    const ringMembership = await membershipDeployTx.deployed();
    console.log("✅ Membership deployed to:", ringMembership.address);

    // Wait for additional confirmations
    console.log("   Waiting for additional confirmations...");
    await ringMembership.deployTransaction.wait(3);

    // Set membership contract in token contract
    console.log("\n🔗 Linking contracts...");
    const setMembershipTx = await ringToken.setMembershipContract(ringMembership.address, {
      gasLimit: 100000,
    });
    await setMembershipTx.wait(2);
    console.log("✅ Membership contract linked to token contract");

    // Display deployment summary
    console.log("\n📋 DEPLOYMENT SUMMARY");
    console.log("=====================");
    console.log("Network: Polygon Mainnet");
    console.log("Chain ID: 137");
    console.log("RingToken Address:", ringToken.address);
    console.log("Membership Address:", ringMembership.address);
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

    // Calculate gas costs
    const deploymentGasCost = ringToken.deployTransaction.gasUsed
      .add(ringMembership.deployTransaction.gasUsed)
      .add(setMembershipTx.gasUsed || 0);
    
    const gasPrice = await deployer.getGasPrice();
    const totalCost = deploymentGasCost.mul(gasPrice);
    
    console.log("\n⛽ GAS USAGE");
    console.log("=============");
    console.log("Total Gas Used:", deploymentGasCost.toString());
    console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "Gwei");
    console.log("Total Cost:", ethers.utils.formatEther(totalCost), "MATIC");

    // Save deployment addresses to file
    const deploymentInfo = {
      network: "polygon",
      chainId: 137,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      gasUsed: deploymentGasCost.toString(),
      totalCost: ethers.utils.formatEther(totalCost),
      contracts: {
        RingToken: {
          address: ringToken.address,
          implementation: await upgrades.erc1967.getImplementationAddress(ringToken.address),
          deployTx: ringToken.deployTransaction.hash,
        },
        Membership: {
          address: ringMembership.address,
          implementation: await upgrades.erc1967.getImplementationAddress(ringMembership.address),
          deployTx: ringMembership.deployTransaction.hash,
        },
      },
      config: config,
      tokenInfo: {
        totalSupply: ethers.utils.formatEther(totalSupply),
        membershipFee: ethers.utils.formatEther(membershipFee),
        minSubscriptionBalance: ethers.utils.formatEther(minBalance),
      },
    };

    // Ensure deployments directory exists
    const fs = require("fs");
    const path = require("path");
    const deployDir = "./deployments";
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir);
    }

    fs.writeFileSync(
      path.join(deployDir, "polygon-mainnet-deployment.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n💾 Deployment info saved to: ./deployments/polygon-mainnet-deployment.json");
    
    console.log("\n🔍 VERIFICATION COMMANDS");
    console.log("========================");
    console.log(`npx hardhat verify ${ringToken.address} --network polygon`);
    console.log(`npx hardhat verify ${ringMembership.address} --network polygon`);
    
    console.log("\n🌐 POLYGON SCAN LINKS");
    console.log("=====================");
    console.log(`RingToken: https://polygonscan.com/address/${ringToken.address}`);
    console.log(`Membership: https://polygonscan.com/address/${ringMembership.address}`);
    
    console.log("\n✨ MAINNET DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("\n📝 IMPORTANT NEXT STEPS:");
    console.log("1. Verify contracts on PolygonScan");
    console.log("2. Update Ring Platform environment variables");
    console.log("3. Transfer ownership to multisig wallet (recommended)");
    console.log("4. Set up automated subscription payment processor");
    console.log("5. Test with small amounts before full launch");

  } catch (error) {
    console.error("❌ Mainnet deployment failed:", error);
    console.error("\n🔄 RECOVERY STEPS:");
    console.error("1. Check transaction status on PolygonScan");
    console.error("2. Verify account has sufficient MATIC balance");
    console.error("3. Check for network congestion and retry if needed");
    console.error("4. Review error logs and contract compilation");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
