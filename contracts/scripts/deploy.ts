import { ethers } from "hardhat";

async function main() {
  console.log("Starting deployment of DecentralizedAppStore...");

  // Get the contract factory from Hardhat environment
  const AppStoreFactory = await ethers.getContractFactory("DecentralizedAppStore");

  // Deploy the contract
  const appStore = await AppStoreFactory.deploy();

  // Wait for the transaction to be mined (Ethers v6 syntax)
  await appStore.waitForDeployment();

  const contractAddress = await appStore.getAddress();
  console.log(`Success! DecentralizedAppStore deployed to: ${contractAddress}`);
}

// Execute the deployment logic
main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});