import { ethers } from "ethers";
import contractData from "../constants/DecentralizedAppStore.json";

/**
 * Initializes and returns a contract instance connected to the local Hardhat node
 */
export function getBlockchainContract() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    throw new Error("Missing blockchain environment configuration");
  }

  // Create a provider pointing to the local node running in your terminal
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Initialize the contract object using address, ABI, and provider
  const contract = new ethers.Contract(
    contractAddress,
    contractData.abi,
    provider
  );

  return contract;
}