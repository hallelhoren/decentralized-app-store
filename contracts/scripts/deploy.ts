import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Writing the deployed address/ABI straight into web-ui removes the manual "copy the ABI
// json, paste the address into .env.local" steps from the original setup instructions -
// those two files are the only per-deploy state the frontend needs.
function syncWebUiConfig(contractAddress: string) {
  const webUiDir = path.join(__dirname, "..", "..", "web-ui");
  if (!fs.existsSync(webUiDir)) return;

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "DappStore.sol",
    "DecentralizedAppStore.json"
  );
  const constantsDir = path.join(webUiDir, "src", "constants");
  fs.mkdirSync(constantsDir, { recursive: true });
  fs.copyFileSync(artifactPath, path.join(constantsDir, "DecentralizedAppStore.json"));

  const envPath = path.join(webUiDir, ".env.local");
  const rpcUrl = network.name === "localhost" || network.name === "hardhat"
    ? "http://127.0.0.1:8545"
    : (process.env.SEPOLIA_RPC_URL || "");

  const lines = [
    `NEXT_PUBLIC_RPC_URL=${rpcUrl}`,
    `NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`,
  ];
  fs.writeFileSync(envPath, lines.join("\n") + "\n");

  console.log(`Synced ABI + .env.local into web-ui (network: ${network.name})`);
}

async function main() {
  console.log("Starting deployment of DecentralizedAppStore...");

  const AppStoreFactory = await ethers.getContractFactory("DecentralizedAppStore");
  const appStore = await AppStoreFactory.deploy();
  await appStore.waitForDeployment();

  const contractAddress = await appStore.getAddress();
  console.log(`Success! DecentralizedAppStore deployed to: ${contractAddress}`);

  syncWebUiConfig(contractAddress);

  // The deployer is the aggregator by default (see the contract's constructor). Point it at
  // the dedicated "cache server" wallet instead, matching web-ui/src/lib/reviews-aggregator.ts,
  // which signs updateReviews() calls with this same account (Hardhat's default account #1).
  const [deployer, cacheServerWallet] = await ethers.getSigners();
  if (cacheServerWallet) {
    const tx = await appStore.connect(deployer).setAggregator(cacheServerWallet.address);
    await tx.wait();
    console.log(`Aggregator set to the cache server's wallet: ${cacheServerWallet.address}`);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});